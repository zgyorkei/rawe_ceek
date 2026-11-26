/* Screenshot tour of one built page with Playwright (the script starts Edge itself over a pipe, no debugging port).
   Usage: node shot.cjs <a|b|c|d> <outDir> [pc|phone|both]
   Writes PNGs of the frames, prints console errors, the weather badge text and layout overflow warnings. */
const path = require('path'), fs = require('fs');
const { chromium } = require('C:/git_accenture/ai-project-hub/node_modules/playwright-core');
const FILES = { a: 'a-pit-wall.html', b: 'b-race-poster.html', c: 'c-brick-plate.html', d: 'd-night-glass.html' };
const key = (process.argv[2] || 'a').toLowerCase(), outDir = process.argv[3] || path.join(process.env.TEMP, 'rw-shots', key), which = process.argv[4] || 'both';
fs.mkdirSync(outDir, { recursive: true });
const file = 'file:///' + path.join(__dirname, '..', FILES[key]).replace(/\\/g, '/');
(async () => {
  const br = await chromium.launch({ channel: 'msedge' });
  const pg = await br.newPage({ viewport: { width: 1520, height: 1000 } });
  const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  pg.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await pg.goto(file); await pg.waitForTimeout(400);
  const snap = async (side, name) => { await pg.waitForTimeout(250); await pg.locator('.fw.' + side + ' .frame').screenshot({ path: path.join(outDir, side + '-' + name + '.png') }); };
  const click = async (side, sel) => { const l = pg.locator('.fw.' + side + ' ' + sel).first(); if (await l.count()) { await l.click({ timeout: 4000 }).catch((e) => errs.push('click ' + side + ' ' + sel + ': ' + e.message.split('\n')[0])); } else errs.push('missing ' + side + ' ' + sel); await pg.waitForTimeout(150); };
  const sim = async (i) => { await pg.locator('[data-sim="' + i + '"]').click(); await pg.waitForTimeout(200); };
  const over = async (side) => { const r = await pg.evaluate((s) => { const fr = document.querySelector('.fw.' + s + ' .frame'), bad = []; fr.querySelectorAll('.rw *').forEach((e) => { if (e.closest('svg') && e.tagName !== 'svg') return; if (e.clientWidth > 0 && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX === 'visible' && !e.closest('.strip') && !e.closest('.cgrid')) bad.push(e.className && e.className.baseVal === undefined ? e.tagName + '.' + e.className : e.tagName); }); return [...new Set(bad)].slice(0, 8); }, side); if (r.length) errs.push('overflow in ' + side + ': ' + r.join(', ')); };
  await pg.locator('button[data-dev="' + which + '"]').click();
  for (const side of which === 'both' ? ['pc', 'phone'] : [which]) {
    await sim(0); await snap(side, '1-month');
    await click(side, '.hb'); await snap(side, '2-menu'); await click(side, '.hb');
    await click(side, '.cell.ev'); await pg.waitForTimeout(2500); await snap(side, '3-popup');
    const badge = await pg.locator('.fw.' + side + ' .badge').first().textContent().catch(() => 'no badge'); console.log(side + ' weather badge: ' + badge);
    const pop = pg.locator('.fw.' + side + ' .pop'); if (await pop.count()) { await pop.evaluate((e) => { e.scrollTop = e.scrollHeight; }); await snap(side, '3b-popup-bottom'); }
    await click(side, '.x[data-act=popclose]'); await pg.waitForTimeout(100);
    if (side === 'phone') await click(side, '.cc[data-d="2026-11-08"]'); await click(side, '.cell.ev .rb.final'); await snap(side, '4-result'); await click(side, '.x[data-act=popclose]');
    await click(side, '.seg [data-v=list]'); await snap(side, '5-list'); await pg.locator('.fw.' + side + ' .view').evaluate((e) => { e.scrollTop = 900; }).catch(() => { }); await snap(side, '5b-list-scrolled');
    await click(side, '.seg .auto'); await click(side, '.fab'); await snap(side, '6-champion');
    const ch = pg.locator('.fw.' + side + ' .champ'); if (await ch.count()) { await ch.evaluate((e) => { const b = e.querySelector('.chb') || e; b.scrollTop = b.scrollHeight; e.scrollTop = e.scrollHeight; }); await snap(side, '6b-champion-bottom'); }
    await click(side, '.x[data-act=champclose]');
    await sim(1); await snap(side, '7-weekend-qatar');
    await sim(2); await snap(side, '8-weekend-two-cards'); await over(side);
    await sim(3); await snap(side, '9-weekend-wec');
    await sim(0); await click(side, '.seg [data-v=month]'); await over(side);
    await click(side, '.seg [data-v=auto]');
  }
  await pg.locator('button[data-dev="both"]').click(); await pg.waitForTimeout(200);
  await pg.screenshot({ path: path.join(outDir, 'page-full.png'), fullPage: true });
  console.log(errs.length ? 'PROBLEMS:\n' + errs.join('\n') : 'no console errors or overflow warnings');
  console.log('shots in ' + outDir);
  await br.close();
})().catch((e) => { console.error('shot failed: ' + e.message); process.exit(1); });
