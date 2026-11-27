// npm run kits:refresh: packs desktop-kit and pwa-kit into vendor/ and points package.json at the tarballs (Vercel
// clones only this repository, so both kits ride along as tarballs). Then: npm install, and commit vendor/,
// package.json and package-lock.json. TEMPORARY: until the kits have release tags (DK.RELEASE), then package.json pins
// the tags and this script goes (README, "The kits").
//   --desktop-kit <dir>  the desktop-kit checkout (default DESKTOP_KIT_DIR, else ../desktop-kit)
//   --pwa-kit <dir>      the pwa-kit checkout (default PWA_KIT_DIR, else ../pwa-kit)
//   --no-build           packs both as they are built; --no-build=desktop-kit (or pwa-kit) skips one kit's build
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const KITS = /** @type {const} */ (['desktop-kit', 'pwa-kit']);
/** @type {Record<string, string | undefined>} */
const given = {};
/** @type {Set<string>} */
const noBuild = new Set();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--desktop-kit' || a === '--pwa-kit') given[a.slice(2)] = argv[++i];
  else if (a === '--no-build') KITS.forEach((k) => noBuild.add(k));
  else if (a.startsWith('--no-build=')) noBuild.add(a.slice('--no-build='.length));
  else throw new Error(`kits-refresh: unknown argument ${a}`);
}

// npm without a shell where its script is found (the one npm run gave, else the one beside node), so no argument is
// read by a shell; else npm through the shell as one quoted command line (npm.cmd does not start without one).
const npmCli = [process.env.npm_execpath, join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')]
  .find((p) => p && /\.c?js$/.test(p) && existsSync(p));
/** @param {string} a */
const quote = (a) => (/^[\w./:=@-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);
/** @param {string[]} args @param {string} cwd */
const run = (args, cwd) => (npmCli
  ? execFileSync(process.execPath, [npmCli, ...args], { cwd, stdio: 'inherit' })
  : execSync([process.platform === 'win32' ? 'npm.cmd' : 'npm', ...args].map(quote).join(' '), { cwd, stdio: 'inherit' }));
const vendor = join(root, 'vendor');
mkdirSync(vendor, { recursive: true });
const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

for (const kit of KITS) {
  const envDir = process.env[kit === 'desktop-kit' ? 'DESKTOP_KIT_DIR' : 'PWA_KIT_DIR'];
  const dir = resolve(given[kit] ?? envDir ?? join(root, '..', kit));
  if (!existsSync(join(dir, 'package.json'))) throw new Error(`kits-refresh: no ${kit} checkout at ${dir}`);
  if (!noBuild.has(kit)) run(['run', 'build'], dir);
  if (!existsSync(join(dir, 'dist'))) throw new Error(`kits-refresh: ${kit} at ${dir} is not built (npm ci, then npm run build there)`);
  const tarball = new RegExp(`^${kit}-.*\\.tgz$`);
  for (const f of readdirSync(vendor)) if (tarball.test(f)) rmSync(join(vendor, f));
  run(['pack', '--pack-destination', vendor], dir);
  const tgz = readdirSync(vendor).find((f) => tarball.test(f));
  if (!tgz) throw new Error(`kits-refresh: npm pack wrote no ${kit} tarball into vendor/`);
  pkg.dependencies[kit] = `file:vendor/${tgz}`;
  console.log(`${kit} vendored as vendor/${tgz}`);
}
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log('now run npm install, and commit vendor/, package.json and package-lock.json');
