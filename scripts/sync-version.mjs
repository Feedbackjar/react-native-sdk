// Keeps src/version.ts in sync with package.json.
// Run automatically by the npm `version` lifecycle; also usable standalone.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const file = new URL('../src/version.ts', import.meta.url);
const src = readFileSync(file, 'utf8');
const next = src.replace(/SDK_VERSION = '[^']*'/, `SDK_VERSION = '${pkg.version}'`);

if (next !== src) {
  writeFileSync(file, next);
  console.log(`src/version.ts -> ${pkg.version}`);
}
