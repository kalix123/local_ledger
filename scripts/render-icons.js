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

// Coin with a tea leaf, centred, ~540px wide so it sits inside the adaptive-icon safe zone.
const mark = (scale = 1) => `
  <g transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    <circle cx="512" cy="528" r="270" fill="#000" opacity="0.18"/>
    <circle cx="512" cy="512" r="270" fill="${CREAM}"/>
    <circle cx="512" cy="512" r="226" fill="none" stroke="${CREAM_SHADE}" stroke-width="14"/>
    <path d="M392 640 C392 482 500 392 652 384 C652 548 556 640 392 640 Z" fill="${TEAL}"/>
    <path d="M418 616 C480 560 548 494 618 418" fill="none" stroke="${CREAM}" stroke-width="20" stroke-linecap="round"/>
  </g>`;

// Single-colour version for Android themed icons: white coin, leaf knocked out.
const mono = `
  <defs><mask id="m">
    <rect width="1024" height="1024" fill="#fff"/>
    <circle cx="512" cy="512" r="226" fill="none" stroke="#000" stroke-width="14"/>
    <path d="M392 640 C392 482 500 392 652 384 C652 548 556 640 392 640 Z" fill="#000"/>
  </mask></defs>
  <g transform="translate(512 512) scale(1.1) translate(-512 -512)"><circle cx="512" cy="512" r="270" fill="#fff" mask="url(#m)"/>
  <path d="M418 616 C480 560 548 494 618 418" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round"/></g>`;

const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`);

const jobs = [
  ['icon.png', svg(bg(false) + mark(1.15)), 1024],
  ['android-icon-background.png', svg(bg(false)), 1024],
  ['android-icon-foreground.png', svg(mark(1.1)), 1024],
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
