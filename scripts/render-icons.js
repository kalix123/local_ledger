/* global Buffer */
// Regenerate every icon in assets/:
//   npm install --no-save sharp@0.34.4 && node scripts/render-icons.js assets
// (sharp is only needed for this script, so it is not saved as a dependency)
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const out = process.argv[2];

const TEAL_DARK = '#0B4F4A';
const TEAL = '#0F766E';
const TEAL_LIGHT = '#14A394';
const CREAM = '#F6F1E4';
const CREAM_SHADE = '#E7DFC9';

const bg = (rounded) => `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${TEAL_LIGHT}"/>
      <stop offset="1" stop-color="${TEAL_DARK}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" ${rounded ? 'rx="224"' : ''} fill="url(#g)"/>`;

// Local Ledger mark: a closed ledger book (cream cover, darker spine) with ruled
// entry lines and a teal leaf on the cover (a nod to Cora Tealeaf). Centred on the canvas.
const BOOK = { x: 322, y: 262, w: 380, h: 500, r: 40, spine: 64 };
const LEAF = 'M560 470 C560 382 620 330 704 326 C704 418 650 470 560 470 Z'; // drawn relative to the cover, see translate below
const LEAF_VEIN = 'M576 456 C612 424 650 386 688 342';
// Rows of a ledger: a short "item" stroke and a right-aligned "amount" stroke.
const ROWS = [
  { y: 540, item: [430, 530], amount: [600, 660] },
  { y: 604, item: [430, 550], amount: [620, 660] },
  { y: 668, item: [430, 510], amount: [590, 660] },
];

const book = (fill, spineFill, lineColor, leafFill, veinColor) => `
    <rect x="${BOOK.x}" y="${BOOK.y}" width="${BOOK.w}" height="${BOOK.h}" rx="${BOOK.r}" fill="${fill}"/>
    <path d="M${BOOK.x + BOOK.r} ${BOOK.y} H${BOOK.x + BOOK.spine} V${BOOK.y + BOOK.h} H${BOOK.x + BOOK.r} A${BOOK.r} ${BOOK.r} 0 0 1 ${BOOK.x} ${BOOK.y + BOOK.h - BOOK.r} V${BOOK.y + BOOK.r} A${BOOK.r} ${BOOK.r} 0 0 1 ${BOOK.x + BOOK.r} ${BOOK.y} Z" fill="${spineFill}"/>
    ${ROWS.map((r) => `<line x1="${r.item[0]}" y1="${r.y}" x2="${r.item[1]}" y2="${r.y}" stroke="${lineColor}" stroke-width="22" stroke-linecap="round"/>
    <line x1="${r.amount[0]}" y1="${r.y}" x2="${r.amount[1]}" y2="${r.y}" stroke="${lineColor}" stroke-width="22" stroke-linecap="round"/>`).join('')}
    <g transform="translate(-88 -10)"><path d="${LEAF}" fill="${leafFill}"/>
    <path d="${LEAF_VEIN}" fill="none" stroke="${veinColor}" stroke-width="14" stroke-linecap="round"/></g>`;

const mark = (scale = 1) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <rect x="${BOOK.x}" y="${BOOK.y + 18}" width="${BOOK.w}" height="${BOOK.h}" rx="${BOOK.r}" fill="#000" opacity="0.18"/>
    ${book(CREAM, CREAM_SHADE, TEAL_LIGHT, TEAL, CREAM)}
  </g>`;

// Single-colour version for Android themed icons: white book; lines, leaf and a thin spine gap knocked out.
const mono = `
  <defs><mask id="m">
    <rect width="1024" height="1024" fill="#fff"/>
    ${book('none', '#fff', '#000', '#000', '#fff')}
    <rect x="${BOOK.x + BOOK.spine}" y="${BOOK.y}" width="10" height="${BOOK.h}" fill="#000"/>
  </mask></defs>
  <g transform="translate(512 512) scale(0.95) translate(-512 -512)">
    <rect x="${BOOK.x}" y="${BOOK.y}" width="${BOOK.w}" height="${BOOK.h}" rx="${BOOK.r}" fill="#fff" mask="url(#m)"/>
  </g>`;

const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`);

const jobs = [
  ['icon.png', svg(bg(false) + mark(1.15)), 1024],
  ['android-icon-background.png', svg(bg(false)), 1024],
  // Adaptive icons are masked to a circle as small as ~66% of the canvas, so the book's corners need room.
  ['android-icon-foreground.png', svg(mark(0.95)), 1024],
  ['android-icon-monochrome.png', svg(mono), 1024],
  ['splash-icon.png', svg(mark(1.4)), 1024],
  ['favicon.png', svg(bg(true) + mark(1.5)), 48],
  ['logo.png', svg(bg(true) + mark(1.5)), 256],
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  for (const [name, buf, size] of jobs) {
    await sharp(buf, { density: 144 }).resize(size, size).png().toFile(path.join(out, name));
    console.log('wrote', name, size);
  }
})();
