/* Builds the four standalone design pages from the parts in this folder.
   Usage: node build.cjs [a|b|c|d|all]   (default all). Output goes one folder up. */
const fs = require('fs'), path = require('path');
const here = __dirname, out = path.join(here, '..');
const DIRS = { a: 'a-pit-wall.html', b: 'b-race-poster.html', c: 'c-brick-plate.html', d: 'd-night-glass.html' };
const rd = (f) => fs.readFileSync(path.join(here, f), 'utf8');
const want = (process.argv[2] || 'all').toLowerCase();
const outlines = JSON.stringify(JSON.parse(rd('outlines.json')));
for (const k of Object.keys(DIRS)) {
  if (want !== 'all' && want !== k) continue;
  if (!fs.existsSync(path.join(here, 'dir-' + k + '.js'))) { console.log('skip ' + k + ' (no dir-' + k + '.js)'); continue; }
  const css = rd('page.css') + '\n' + (fs.existsSync(path.join(here, 'dir-' + k + '.css')) ? rd('dir-' + k + '.css') : '');
  const js = ['window.RW = window.RW || {}; RW.outlines = ' + outlines + ';', rd('art.js'), rd('data.js'), rd('dir-' + k + '.js'), rd('engine.js'), rd('page.js')].join('\n;\n');
  const html = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>rawe_ceek design ' + k.toUpperCase() + '</title><style>\n' + css + '\n</style></head><body><div id="pg"></div><script>\n' + js + '\n</script></body></html>\n';
  if (/–|—/.test(html)) console.log('WARNING: ' + k + ' contains an en or em dash');
  fs.writeFileSync(path.join(out, DIRS[k]), html);
  console.log('built ' + DIRS[k] + ' (' + Math.round(html.length / 1024) + ' KB)');
}
