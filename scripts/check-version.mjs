// Fails the publish if src/version.ts drifted from package.json.
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const src = readFileSync(new URL('../src/version.ts', import.meta.url), 'utf8');
const inFile = src.match(/SDK_VERSION = '([^']*)'/)?.[1];

if (inFile !== pkg.version) {
  console.error(
    `src/version.ts (${inFile}) is out of sync with package.json (${pkg.version}). ` +
      `Run: npm run sync-version`,
  );
  process.exit(1);
}
