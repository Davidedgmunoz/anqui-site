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
  const flipBtn = $('flip-btn');
  const grades = $('grades');
  const done = $('review-done');
  const left = $('review-left');
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
  let flipped = false;
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

  function render() {
    left.textContent = String(queue.length);
    const current = queue[0];
    const finished = !current;
    done.hidden = !finished;
    card.hidden = finished;
    flipBtn.hidden = finished;
    grades.hidden = true;
    if (finished) return;
    $('card-front').innerHTML = ruby(current.card.front);
    $('card-back').innerHTML = ruby(current.card.front);
    $('card-meaning').textContent = current.card.meaning;
    $('card-ex').innerHTML = ruby(current.card.ex);
    $('card-ext').textContent = current.card.exT;
    const labels = INTERVALS[Math.min(current.seen, 1)];
    gradeButtons.forEach((b, i) => (b.querySelector('small')!.textContent = labels[i]));
    flipped = false;
    gsap.set(card, { rotationY: 0 });
  }

  function flip() {
    if (busy || !queue.length) return;
    flipped = !flipped;
    gsap.to(card, { rotationY: flipped ? 180 : 0, duration: reduced ? 0 : 0.6, ease: 'back.out(1.3)' });
    flipBtn.hidden = flipped;
    grades.hidden = !flipped;
  }

  function grade(g: number) {
    if (busy || !flipped || !queue.length) return;
    busy = true;
    const current = queue.shift()!;
    // Again and Hard keep the card in learning; Good graduates it on its second pass; Easy right away.
    if (g <= 1 || (g === 2 && current.seen === 0)) queue.push({ card: current.card, seen: current.seen + 1 });
    gradeButtons[g].classList.add('pressed');
    const next = () => {
      gradeButtons[g].classList.remove('pressed');
      render();
      busy = false;
      mood(g === 0 ? 'again' : g === 1 ? 'hard' : 'good', queue.length ? 1700 : 1100);
      if (!reduced) gsap.fromTo(queue.length ? card : done, { y: 40, opacity: 0, x: 0, rotate: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'back.out(1.6)' });
      else gsap.set(card, { x: 0, opacity: 1, rotate: 0 });
    };
    if (reduced) return next();
    gsap.to(card, { x: g === 0 ? -260 : 260, rotate: g === 0 ? -14 : 14, opacity: 0, duration: 0.32, ease: 'power2.in', onComplete: next });
  }

  function start() {
    queue = data.cards.map((c) => ({ card: c, seen: 0 }));
    render();
    mood('idle');
  }

  card.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('.speak')) flip();
  });
  flipBtn.addEventListener('click', flip);
  gradeButtons.forEach((b, i) => b.addEventListener('click', () => grade(i)));
  $('review-reset').addEventListener('click', start);
  $<HTMLInputElement>('furigana-toggle').addEventListener('change', (e) => {
    root.classList.toggle('no-furigana', !(e.target as HTMLInputElement).checked);
  });

  // Same shortcuts as the app on iPad, only while the demo is on screen.
  let onScreen = false;
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting), { threshold: 0.5 }).observe(root);
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    if (!onScreen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (target.matches('input, textarea, select, a') || (target.matches('button') && e.key === ' ')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      flip();
    } else if (/^[1-4]$/.test(e.key)) {
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

hero();
demo();
curve();
typing();
habit();
themes();
