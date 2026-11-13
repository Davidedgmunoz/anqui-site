import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { bind } from 'wanakana';

interface Card {
  front: string;
  reading: string;
  meaning: string;
  ex: string;
  exT: string;
}
type Mood = 'idle' | 'good' | 'again' | 'hard' | 'done' | 'theme';
interface Data {
  mascot: Record<string, string>;
  cards: Card[];
  demo: { bubbles: Record<Mood, string>; bubbleNotes: Record<Mood, string> };
  type: { ok: string };
  days: string;
  companion: Record<string, [string, string]>;
}

const data: Data = JSON.parse(document.getElementById('anqui-data')!.textContent!);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add('js-anim');

/** Anki-style furigana (`食[た]べる`) to ruby markup. The input is our own static copy. */
function ruby(text: string): string {
  return text.replace(/([一-鿿々]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
}

function onceVisible(el: Element, run: () => void, threshold = 0.35) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        run();
      }
    },
    { threshold },
  );
  io.observe(el);
}

// Scroll reveal
for (const el of document.querySelectorAll('.reveal')) onceVisible(el, () => el.classList.add('in'), 0.15);

// ---------------------------------------------------------------- Hero
function hero() {
  const cat = $<HTMLButtonElement>('hero-cat');
  const bubble = $('hero-bubble');
  const phone = $('hero-phone');
  const lines = ['にゃ！', 'こんにちは！', '勉強しよう！', 'いっしょに！', 'にゃーん'];
  let line = 0;
  let hideTimer = 0;

  cat.addEventListener('click', () => {
    cat.classList.add('touched');
    bubble.textContent = lines[line++ % lines.length];
    bubble.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => bubble.classList.remove('show'), 1600);
    if (reduced) return;
    gsap
      .timeline({ overwrite: true })
      .to(cat, { y: -46, scaleY: 1.06, scaleX: 0.96, duration: 0.22, ease: 'power2.out' })
      .to(cat, { y: 0, scaleY: 0.92, scaleX: 1.06, duration: 0.2, ease: 'power2.in' })
      .to(cat, { scaleY: 1, scaleX: 1, duration: 0.45, ease: 'elastic.out(1.2, 0.4)' });
  });

  if (reduced) return;

  gsap
    .timeline({ defaults: { ease: 'power3.out' } })
    .from('.hero h1 .line > *, .hero h1 .line', { yPercent: 110, duration: 0.9, stagger: 0.08 }, 0.1)
    .from('.hero .eyebrow, .hero .lead, .hero .store-row, .hero .platforms', { opacity: 0, y: 22, duration: 0.7, stagger: 0.08 }, 0.35)
    .from(phone, { y: 120, opacity: 0, rotate: 16, duration: 1.1 }, 0.25)
    .from(cat, { scale: 0, rotate: -25, transformOrigin: '50% 100%', duration: 0.8, ease: 'back.out(1.8)' }, 0.75)
    .from('.floater', { opacity: 0, scale: 0, duration: 0.6, stagger: 0.04, ease: 'back.out(2)' }, 0.5);

  // The phone straightens and drifts as the hero scrolls away.
  gsap.to(phone, {
    yPercent: -12,
    rotate: -3,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
  });

  // Pointer parallax: the kana drift by depth and the cat leans toward the pointer.
  const section = document.querySelector<HTMLElement>('.hero')!;
  const floaters = [...section.querySelectorAll<HTMLElement>('.floater')].map((el) => ({
    depth: Number(el.dataset.depth),
    x: gsap.quickTo(el, 'x', { duration: 0.9, ease: 'power3' }),
    y: gsap.quickTo(el, 'y', { duration: 0.9, ease: 'power3' }),
  }));
  const lean = gsap.quickTo(cat.querySelector('img'), 'rotate', { duration: 0.6, ease: 'power3' });
  const kanjiX = gsap.quickTo('.hero-kanji', 'x', { duration: 1.2, ease: 'power3' });
  section.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const r = section.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5;
    const ny = (e.clientY - r.top) / r.height - 0.5;
    for (const f of floaters) {
      f.x(nx * -22 * f.depth);
      f.y(ny * -16 * f.depth);
    }
    const c = cat.getBoundingClientRect();
    lean(gsap.utils.clamp(-9, 9, ((e.clientX - (c.left + c.width / 2)) / r.width) * 26));
    kanjiX(nx * 30);
  });
}

// ---------------------------------------------------------------- Review demo
function demo() {
  const root = $('review');
  const card = $('flashcard');
  const body = $('card-body');
  const flipBtn = $('flip-btn');
  const grades = $('grades');
  const done = $('review-done');
  const speak = $<HTMLButtonElement>('speak');
  const mascot = $<HTMLImageElement>('demo-mascot');
  const bubble = $('demo-bubble');
  const gradeButtons = [...grades.querySelectorAll<HTMLButtonElement>('.grade')];

  // Learning steps, then graduating intervals: a small stand-in for the app's scheduler.
  const INTERVALS = [
    ['<1 min', '6 min', '10 min', '4 d'],
    ['<1 min', '10 min', '1 d', '5 d'],
  ];
  const POSE: Record<Mood, string> = { idle: 'studying', good: 'happy', again: 'teaching', hard: 'searching', done: 'sleeping', theme: 'happy' };

  let queue: { card: Card; seen: number }[] = [];
  let revealed = false;
  let busy = false;
  let moodTimer = 0;

  for (const src of Object.values(data.mascot)) new Image().src = src;

  function mood(m: Mood, hold = 0) {
    clearTimeout(moodTimer);
    mascot.src = data.mascot[POSE[m]];
    bubble.querySelector('b')!.textContent = data.demo.bubbles[m];
    bubble.querySelector('i')!.textContent = data.demo.bubbleNotes[m];
    if (!reduced) {
      gsap.fromTo(mascot, { scale: 0.86, rotate: m === 'again' ? -6 : 5 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.45)' });
      gsap.fromTo(bubble, { scale: 0.5 }, { scale: 1, duration: 0.4, ease: 'back.out(2.4)' });
    }
    if (hold) moodTimer = window.setTimeout(() => mood(queue.length ? 'idle' : 'done'), hold);
  }
  document.addEventListener('anqui:theme', () => mood('theme', 1500));

  function setRevealed(value: boolean) {
    revealed = value;
    card.classList.toggle('revealed', value);
    const finished = !queue.length;
    flipBtn.hidden = value || finished;
    grades.hidden = !value || finished;
  }

  function render() {
    const fresh = queue.filter((q) => q.seen === 0).length;
    const learning = queue.length - fresh;
    $('count-new').textContent = String(fresh);
    $('count-learn').textContent = String(learning);
    document.dispatchEvent(new CustomEvent('anqui:counts', { detail: { fresh, learning } }));
    const current = queue[0];
    done.hidden = !!current;
    body.hidden = !current;
    setRevealed(false);
    if (!current) return;
    $('card-front').innerHTML = ruby(current.card.front);
    $('card-meaning').textContent = current.card.meaning;
    $('card-ex').innerHTML = ruby(current.card.ex);
    $('card-ext').textContent = current.card.exT;
    const labels = INTERVALS[Math.min(current.seen, 1)];
    gradeButtons.forEach((b, i) => (b.querySelector('small')!.textContent = labels[i]));
  }

  /** Turns the card over like the app: the answer appears when the card is edge-on. */
  function reveal() {
    if (busy || revealed || !queue.length) return;
    if (reduced) return setRevealed(true);
    busy = true;
    // The buttons change at once; the card catches up.
    flipBtn.hidden = true;
    grades.hidden = false;
    gsap
      .timeline({ onComplete: () => (busy = false) })
      .to(card, { rotationY: 90, duration: 0.17, ease: 'power2.in' })
      .add(() => setRevealed(true))
      .set(card, { rotationY: -90 })
      .to(card, { rotationY: 0, duration: 0.3, ease: 'power2.out' });
    gsap.from(gradeButtons, { y: 14, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'back.out(2)' });
  }

  function grade(g: number) {
    if (!revealed || !queue.length) return;
    // A grade during the flip lands on the finished card.
    gsap.getTweensOf(card).forEach((t) => t.progress(1));
    gsap.set(card, { rotationY: 0 });
    busy = true;
    const current = queue.shift()!;
    // Again and Hard keep the card in learning; Good graduates it on its second pass; Easy right away.
    if (g <= 1 || (g === 2 && current.seen === 0)) queue.push({ card: current.card, seen: current.seen + 1 });
    const next = () => {
      render();
      busy = false;
      mood(g === 0 ? 'again' : g === 1 ? 'hard' : 'good', queue.length ? 1700 : 1100);
      if (!reduced) gsap.fromTo([body, done], { opacity: 0 }, { opacity: 1, duration: 0.2 });
    };
    if (reduced) return next();
    // The next card cross-fades inside the same surface; the surface stays still.
    gsap.to(body, { opacity: 0, duration: 0.15, onComplete: next });
  }

  function start() {
    queue = data.cards.map((c) => ({ card: c, seen: 0 }));
    render();
    mood('idle');
  }

  card.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('button')) reveal();
  });
  flipBtn.addEventListener('click', reveal);
  gradeButtons.forEach((b, i) => b.addEventListener('click', () => grade(i)));
  $('review-reset').addEventListener('click', start);
  $<HTMLInputElement>('furigana-toggle').addEventListener('change', (e) => {
    root.classList.toggle('no-furigana', !(e.target as HTMLInputElement).checked);
  });

  // Glass highlight follows the pointer.
  for (const el of root.querySelectorAll<HTMLElement>('.glass')) {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }

  // Same shortcuts as the app on iPad, only while the demo is on screen.
  let onScreen = false;
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { threshold: 0.5 }).observe(root);
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (!onScreen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (target.matches('input, textarea, select, a') || (target.matches('button') && e.key === ' ')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      reveal();
    } else if (/^[1-4]$/.test(e.key) && revealed) {
      const button = gradeButtons[Number(e.key) - 1];
      button.classList.add('pressed');
      setTimeout(() => button.classList.remove('pressed'), 160);
      grade(Number(e.key) - 1);
    }
  });

  // Read the kana reading aloud, like the app does, so the pronunciation is right.
  if ('speechSynthesis' in window) {
    speak.addEventListener('click', () => {
      const current = queue[0];
      if (!current) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(current.card.reading);
      u.lang = 'ja-JP';
      u.rate = 0.9;
      u.onend = u.onerror = () => speak.classList.remove('playing');
      speak.classList.add('playing');
      speechSynthesis.speak(u);
    });
  } else {
    speak.hidden = true;
  }

  start();
}

// ---------------------------------------------------------------- Forgetting curve
function curve() {
  const NS = 'http://www.w3.org/2000/svg';
  const range = $<HTMLInputElement>('curve-range');
  const path = $('curve-path');
  const area = $('curve-area');
  const dots = $('curve-dots');
  const target = $('curve-target');
  const DAYS = 120;
  const X0 = 40;
  const X1 = 630;
  const Y0 = 20;
  const Y1 = 250;
  const FLOOR = 0.6;
  // FSRS power forgetting curve: R(t) = (1 + F·t/S)^-0.5, which gives R(S) = 0.9.
  const F = 19 / 81;
  const x = (day: number) => X0 + (day / DAYS) * (X1 - X0);
  const y = (r: number) => Y0 + ((1 - r) / (1 - FLOOR)) * (Y1 - Y0);

  const gridlines = $('curve-gridlines');
  for (const r of [1, 0.9, 0.8, 0.7]) {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('class', 'gridline');
    line.setAttribute('x1', String(X0));
    line.setAttribute('x2', String(X1));
    line.setAttribute('y1', String(y(r)));
    line.setAttribute('y2', String(y(r)));
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('class', 'tick');
    label.setAttribute('x', String(X0 - 8));
    label.setAttribute('y', String(y(r) + 4));
    label.setAttribute('text-anchor', 'end');
    label.textContent = `${Math.round(r * 100)}`;
    gridlines.append(line, label);
  }

  function draw() {
    const goal = Number(range.value) / 100;
    let stability = 1.2;
    let day = 0;
    let reviews = 0;
    let interval = 0;
    let d = `M${x(0)} ${y(1)}`;
    dots.replaceChildren();
    while (day < DAYS) {
      interval = Math.max(1, (stability / F) * (goal ** -2 - 1));
      const end = Math.min(day + interval, DAYS);
      for (let i = 1; i <= 24; i++) {
        const t = ((end - day) * i) / 24;
        d += ` L${x(day + t).toFixed(1)} ${y((1 + (F * t) / stability) ** -0.5).toFixed(1)}`;
      }
      day += interval;
      if (day >= DAYS) break;
      // A review brings recall back to 100%; harder recalls (lower retention) grow stability more.
      reviews++;
      stability *= 1.9 + 9 * (1 - goal);
      d += ` L${x(day).toFixed(1)} ${y(1)}`;
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'dot');
      dot.setAttribute('cx', x(day).toFixed(1));
      dot.setAttribute('cy', String(y(1)));
      dot.setAttribute('r', '5');
      dots.append(dot);
    }
    path.setAttribute('d', d);
    area.setAttribute('d', `${d} L${X1} ${Y1} L${X0} ${Y1} Z`);
    target.setAttribute('y1', String(y(goal)));
    target.setAttribute('y2', String(y(goal)));
    $('curve-value').textContent = `${range.value}%`;
    $('curve-reviews').textContent = String(reviews);
    $('curve-next').textContent = `${Math.round(interval)} ${data.days}`;
  }

  range.addEventListener('input', draw);
  draw();

  if (reduced) return;
  // Draw the line in when it first scrolls into view.
  onceVisible($('curve'), () => {
    const length = (path as unknown as SVGPathElement).getTotalLength();
    gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length }, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.inOut', onComplete: () => gsap.set(path, { clearProps: 'strokeDasharray,strokeDashoffset' }) });
    gsap.from(area, { opacity: 0, duration: 1.2, delay: 0.8 });
    gsap.from('#curve .dot', { scale: 0, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.12, delay: 0.5, ease: 'back.out(3)' });
  });
}

// ---------------------------------------------------------------- Kana typing diff
/** Aligns what was typed against the answer (LCS) and marks matches, extras and missing kana. */
function diff(typed: string, answer: string): { ch: string; kind: 'ok' | 'bad' | 'miss' }[] {
  const a = [...typed];
  const b = [...answer];
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const out: { ch: string; kind: 'ok' | 'bad' | 'miss' }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) out.push({ ch: a[i++], kind: (j++, 'ok') });
    else if (i < a.length && (j >= b.length || lcs[i + 1][j] >= lcs[i][j + 1])) out.push({ ch: a[i++], kind: 'bad' });
    else out.push({ ch: b[j++], kind: 'miss' });
  }
  return out;
}

function typing() {
  const input = $<HTMLInputElement>('kana-input');
  const output = $('kana-diff');
  const ANSWER = 'わすれる';
  bind(input, { IMEMode: 'toHiragana' });
  input.addEventListener('input', () => {
    const typed = input.value.trim();
    output.replaceChildren();
    if (!typed) return;
    for (const part of diff(typed, ANSWER)) {
      const span = document.createElement('span');
      span.className = part.kind;
      span.textContent = part.ch;
      output.append(span);
    }
    if (typed === ANSWER) {
      const verdict = document.createElement('span');
      verdict.className = 'verdict';
      verdict.lang = document.documentElement.lang;
      verdict.textContent = data.type.ok;
      output.append(verdict);
    }
    if (!reduced) gsap.from(output.children, { y: 10, opacity: 0, duration: 0.25, stagger: 0.03 });
  });
}

// ---------------------------------------------------------------- Habit
function habit() {
  const map = $('heatmap');
  const WEEKS = 26;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const total = WEEKS * 7;
  for (let i = 0; i < total; i++) {
    const cell = document.createElement('i');
    // The last 30 days are never empty: that is the streak the counter shows.
    const inStreak = i >= total - 30;
    const v = inStreak ? 1 + Math.floor(random() * 4) : random() < 0.28 ? 0 : Math.floor(random() * 5);
    cell.style.setProperty('--v', String(v));
    cell.style.setProperty('--d', String(i));
    map.append(cell);
  }
  const count = $('streak-count');
  const to = Number(count.dataset.to);
  onceVisible(map, () => {
    map.classList.add('lit');
    if (reduced) return void (count.textContent = String(to));
    const state = { n: 0 };
    gsap.to(state, { n: to, duration: 1.8, ease: 'power2.out', onUpdate: () => (count.textContent = String(Math.round(state.n))) });
    gsap.from('.medal', { y: 40, opacity: 0, rotate: -20, duration: 0.7, stagger: 0.09, delay: 0.5, ease: 'back.out(1.8)' });
  });
  if (reduced) count.textContent = String(to);

  for (const medal of document.querySelectorAll<HTMLElement>('.medal')) {
    medal.addEventListener('pointermove', (e) => {
      const r = medal.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      medal.style.transform = `rotateY(${nx * 34}deg) rotateX(${ny * -34}deg) scale(1.12)`;
    });
    medal.addEventListener('pointerleave', () => (medal.style.transform = ''));
  }

  onceVisible($('fan'), () => $('fan').classList.add('open'), 0.6);
  onceVisible($('stamps'), () => $('stamps').classList.add('lit'), 0.6);
}

// ---------------------------------------------------------------- Themes
function themes() {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('.swatch')];
  const root = document.documentElement;
  const mark = () => {
    const current = root.dataset.theme ?? 'anqui';
    for (const b of buttons) b.setAttribute('aria-checked', String(b.dataset.themeId === current));
  };
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const id = b.dataset.themeId!;
      if (id === 'anqui') delete root.dataset.theme;
      else root.dataset.theme = id;
      try {
        localStorage.setItem('anqui-theme', id);
      } catch {
        // Private mode: the choice just does not persist.
      }
      mark();
      document.dispatchEvent(new CustomEvent('anqui:theme'));
    });
  }
  mark();
}


// ---------------------------------------------------------------- Widgets
function widgets() {
  const total = data.cards.length;
  const set = (id: string, fraction: number) => ($(id).style.strokeDashoffset = String(100 - Math.max(0, Math.min(1, fraction)) * 100));
  // The rings fill as the demo's cards leave "new" and then leave learning.
  document.addEventListener('anqui:counts', (e) => {
    const { fresh, learning } = (e as CustomEvent<{ fresh: number; learning: number }>).detail;
    $('widget-due').textContent = String(fresh + learning);
    $('widget-new').textContent = String(fresh);
    $('widget-learn').textContent = String(learning);
    set('ring-new', (total - fresh) / total);
    set('ring-learn', (total - fresh - learning) / total);
    set('ring-review', fresh + learning === 0 ? 1 : 0.6);
  });

  const word = $('widget-word');
  const meaning = $('widget-meaning');
  let index = 0;
  const show = () => {
    const card = data.cards[index++ % total];
    word.innerHTML = ruby(card.front);
    meaning.textContent = card.meaning;
    if (!reduced) gsap.fromTo([word, meaning], { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06 });
  };
  show();
  setInterval(show, 3600);
}

// ---------------------------------------------------------------- Kana chart
function kanaChart() {
  const grid = $('kana-grid');
  const cells = [...grid.querySelectorAll<HTMLButtonElement>('.kana-cell')];
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.segmented button')];
  let script: 'h' | 'k' = 'h';

  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      script = tab.dataset.script as 'h' | 'k';
      for (const other of tabs) other.setAttribute('aria-checked', String(other === tab));
      cells.forEach((cell, i) => {
        const swap = () => (cell.querySelector('.ch')!.textContent = cell.dataset[script]!);
        if (reduced) return swap();
        // A wave across the chart: each kana turns over into the other script.
        gsap
          .timeline({ delay: Math.floor(i / 5) * 0.035 + (i % 5) * 0.015 })
          .to(cell, { rotationX: 90, duration: 0.14, ease: 'power2.in' })
          .add(swap)
          .to(cell, { rotationX: 0, duration: 0.3, ease: 'back.out(2)' });
      });
    });
  }

  for (const cell of cells) {
    cell.addEventListener('click', () => {
      // Touch has no hover: show the romaji for a moment.
      cell.classList.add('on');
      setTimeout(() => cell.classList.remove('on'), 900);
      if (!('speechSynthesis' in window)) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(cell.dataset.h!);
      u.lang = 'ja-JP';
      u.rate = 0.85;
      speechSynthesis.speak(u);
    });
  }
}

// ---------------------------------------------------------------- Roadmap
function roadmap() {
  const rail = $('rail');
  const stops = [...rail.querySelectorAll<HTMLElement>('.stop')];
  const update = (p: number) => {
    rail.style.setProperty('--p', p.toFixed(3));
    stops.forEach((stop, i) => stop.classList.toggle('passed', p >= i / stops.length - 0.02));
  };
  if (reduced) return update(0);
  ScrollTrigger.create({ trigger: rail, start: 'top 80%', end: 'bottom 45%', scrub: 0.5, onUpdate: (self) => update(self.progress) });
  gsap.from(stops, { opacity: 0, y: 30, duration: 0.6, stagger: 0.12, ease: 'power3.out', scrollTrigger: { trigger: rail, start: 'top 80%' } });
}

// ---------------------------------------------------------------- Scroll companion
function companion() {
  const el = $('companion');
  const img = el.querySelector('img')!;
  const bubble = el.querySelector('.bubble')!;
  const POSES: Record<string, string> = { fsrs: 'teaching', japanese: 'studying', habit: 'happy', kana: 'teaching', themes: 'happy', more: 'searching', roadmap: 'waving' };
  const sections = Object.keys(POSES).map((id) => $(id));
  let current = '';
  let hideTimer = 0;
  let queued = false;

  function update() {
    queued = false;
    const middle = innerHeight / 2;
    const active = sections.find((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= middle && r.bottom > middle;
    });
    const id = active?.id ?? '';
    if (id === current) return;
    current = id;
    el.classList.toggle('show', !!id);
    if (!id) return;
    img.src = data.mascot[POSES[id]];
    const [jp, note] = data.companion[id];
    bubble.querySelector('b')!.textContent = jp;
    bubble.querySelector('i')!.textContent = note;
    bubble.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => bubble.classList.remove('show'), 2600);
    if (!reduced) gsap.fromTo(img, { scale: 0.8, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.45)' });
  }
  addEventListener(
    'scroll',
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

hero();
widgets();
demo();
curve();
typing();
habit();
kanaChart();
roadmap();
companion();
themes();
