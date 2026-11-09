// Make a supporter code and the fingerprint the app checks it against.
//   node scripts/gen-supporter-code.js                 → a new random code (LL-XXXX-XXXX-XXXX)
//   node scripts/gen-supporter-code.js LL-ABCD-EFGH    → the fingerprint for a code you chose
// Paste the printed hash into SUPPORTER_CODE_HASHES in src/supporter.ts.
// The code itself never goes into the app. Keep PEPPER in sync with src/supporter.ts.
const crypto = require('crypto');

const PEPPER = 'localledger-supporter-v2:';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I to avoid typos

function randomCode() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
    groups.push(s);
  }
  return `LL-${groups.join('-')}`;
}

const arg = process.argv[2];
const code = arg ? arg.trim().toUpperCase().replace(/\s+/g, '') : randomCode();
// LL- is the current format; FT- codes from before the rename are still accepted.
if (!/^(LL|FT)(-[A-Z0-9]{4}){2,4}$/.test(code)) {
  console.error(`"${code}" isn't a valid format. Use LL- followed by 2 to 4 groups of 4 letters/digits, e.g. LL-ABCD-EFGH-JKLM.`);
  process.exit(1);
}
const hash = crypto.createHash('sha256').update(PEPPER + code).digest('hex');

console.log(`Code (give this to supporters):   ${code}`);
console.log(`Hash (paste into src/supporter.ts): '${hash}',`);
