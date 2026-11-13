// Renders the Open Graph images (1200×630) into public/: `node scripts/og.mjs`.
// Text is drawn with system fonts, so run it on a Mac (Hiragino for the kanji).
import sharp from 'sharp';

const copy = {
  es: { a: 'Japonés que', b: 'se queda.', sub: 'Tarjetas con repaso espaciado · iPhone y iPad' },
  en: { a: 'Japanese', b: 'that sticks.', sub: 'Spaced-repetition flashcards · iPhone and iPad' },
};

for (const [lang, t] of Object.entries(copy)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <rect width="1200" height="630" fill="#0369A1"/>
    <text x="1010" y="330" font-family="Hiragino Sans, sans-serif" font-weight="900" font-size="330" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="3" text-anchor="middle">暗</text>
    <text x="1010" y="640" font-family="Hiragino Sans, sans-serif" font-weight="900" font-size="330" fill="none" stroke="#fff" stroke-opacity="0.2" stroke-width="3" text-anchor="middle">記</text>
    <text x="80" y="120" font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="44" fill="#fff">Anqui <tspan font-family="Hiragino Sans, sans-serif" fill-opacity="0.75">暗記</tspan></text>
    <rect x="76" y="388" width="${t.b.length * 52}" height="34" rx="17" fill="#F6A5C0" transform="rotate(-1.5 80 400)"/>
    <text font-family="Helvetica Neue, Arial, sans-serif" font-weight="700" font-size="118" fill="#fff" letter-spacing="-4">
      <tspan x="76" y="300">${t.a}</tspan><tspan x="76" y="410">${t.b}</tspan>
    </text>
    <text x="80" y="520" font-family="Helvetica Neue, Arial, sans-serif" font-weight="500" font-size="30" fill="#fff" fill-opacity="0.9">${t.sub}</text>
  </svg>`;
  const cat = await sharp('src/assets/mascot/waving.png').resize(390, 390).toBuffer();
  await sharp(Buffer.from(svg))
    .composite([{ input: cat, left: 800, top: 225 }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(`public/og-${lang}.png`);
  console.log(`public/og-${lang}.png`);
}
