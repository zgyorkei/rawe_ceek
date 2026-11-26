/* Direction C "Brick plate": a toy-brick world. Light blue-grey baseplate with studs, chunky tiles with a darker bottom edge, primary colours, rounded type.
   Hooks: cell, weekendCard, listHead, listTile, sessionRow (venue and series colour variables), menu (brick tray), popup (colour band),
   champion (brick towers, one brick = 25 points). RW.wxIcon is redrawn as a mosaic of small squares. Actions: menu (so the narrow sheet can slide up once). */
(function () {
  var RW = window.RW, A = null;
  var INK = '#1b2330';

  /* ---- weather icons: 8 x 8 mosaic of small rounded squares (same signature and svg class as the default) ---- */
  var PAL = { Y: '#f5cd2f', O: '#f08a1c', W: '#ffffff', G: '#c3d1de', B: '#0055bf', S: '#7cc0f2', D: '#6b7785', E: '#4a5562', F: '#aebccb' };
  var PIX = {
    clear: ['...OO...', '.O.YY.O.', '..YYYY..', 'OYYYYYYO', 'OYYYYYYO', '..YYYY..', '.O.YY.O.', '...OO...'],
    partly: ['..O.....', '.YYY.WW.', 'YYYYWWWW', '.YYWWWWW', '..WWWWWW', '.WWWWWWW', '.GGGGGGG', '........'],
    cloud: ['........', '...WW...', '..WWWW..', '.WWWWWW.', 'WWWWWWWW', 'WWWWWWWW', 'GGGGGGGG', '........'],
    fog: ['........', '...WW...', '..WWWW..', '.WWWWWW.', 'WWWWWWWW', '........', 'FFFFFFF.', '.FFFFFFF'],
    rain: ['........', '...WW...', '..WWWW..', '.WWWWWW.', 'WWWWWWWW', 'GGGGGGGG', '.B..B..B', 'B..B..B.'],
    storm: ['...DD...', '..DDDD..', '.DDDDDD.', 'DDDDDDDD', 'EEEEEEEE', '...YY...', '..YY....', '...Y....'],
    snow: ['........', '...WW...', '..WWWW..', '.WWWWWW.', 'WWWWWWWW', 'GGGGGGGG', '..S..S..', '.S..S..S']
  };
  RW.wxIcon = function (code) {
    var rows = PIX[RW.wxKind(code)] || PIX.cloud, s = '';
    rows.forEach(function (row, r) {
      for (var c = 0; c < 8; c++) { var ch = row.charAt(c); if (ch !== '.') s += '<rect x="' + (c * 4 + 0.3) + '" y="' + (r * 4 + 0.3) + '" width="3.4" height="3.4" rx=".8" fill="' + PAL[ch] + '"/>'; }
    });
    return '<svg class="wx" viewBox="0 0 32 32" aria-hidden="true"><g stroke="#53677b" stroke-width=".45">' + s + '</g></svg>';
  };

  /* ---- colour helpers ---- */
  function lum(hex) {
    var n = parseInt(hex.slice(1), 16), c = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  var LI = lum(INK);
  /* the text colour with the better contrast on a brick: white on red, blue and dark bricks, dark on yellow, orange and grey bricks */
  function ink(hex) { var l = lum(hex); return 1.05 / (l + 0.05) >= (l + 0.05) / (LI + 0.05) ? '#fff' : INK; }
  /* every inline --c (series colour) also gets --cx (the text colour that reads on it) */
  function tint(html) { return html.replace(/style="--c:(#[0-9a-fA-F]{6})"/g, function (m, c) { return 'style="--c:' + c + ';--cx:' + ink(c) + '"'; }); }
  var VEN = ['#d01012', '#0055bf', '#f5cd2f', '#237841'];
  function vstyle(g) { var c = VEN[Math.max(0, RW.groups.indexOf(g)) % VEN.length]; return 'style="--t:' + c + ';--tx:' + ink(c) + '"'; }
  function put(html, marker, g) { return html.replace(marker, marker.replace(/ (class=)/, ' ' + vstyle(g) + ' $1')); }

  /* ---- champion towers ---- */
  var TOWER = { ANT: '#0055bf', VER: '#f5cd2f', HAM: '#237841', RUS: '#ffffff', NOR: '#f08a1c', LEC: '#d01012', PIA: '#5b6672' };
  function towers() {
    var C = RW.champ, B = 25, lec = C.drivers.filter(function (d) { return d.me; })[0], ham = C.drivers[2];
    var h = '<section class="tw-wrap" aria-label="Points as brick towers, one brick is 25 points"><h3>The standings as brick towers</h3><div class="tws" style="--ham:' + (ham.pts / B).toFixed(3) + '">';
    C.drivers.forEach(function (d) {
      var full = Math.floor(d.pts / B), rem = d.pts - full * B, bricks = '', i;
      for (i = 0; i < full; i++) bricks += '<i class="bk"></i>';
      if (rem) bricks += '<i class="bk part" style="--f:' + (rem / B).toFixed(3) + '"></i>';
      if (d.me) bricks += '<i class="bk ghost"></i><i class="bk ghost"></i>';
      h += '<div class="tw' + (d.me ? ' me' : '') + '" style="--k:' + TOWER[d.id] + '" role="img" aria-label="' + d.name + ', ' + d.pts + ' points">' +
        '<span class="tnm"><b>' + d.id + '</b><em>' + d.name + '</em></span><span class="stack" aria-hidden="true">' + bricks + '</span><span class="tpts" aria-hidden="true">' + d.pts + '</span>' +
        (d.me ? '<span class="tgap" aria-hidden="true">' + (ham.pts - d.pts) + ' to 3rd</span>' : '') + '</div>';
    });
    h += '<span class="line3" aria-hidden="true"><b>3rd</b></span></div><p class="tw-leg"><span><i class="sw"></i>3rd place now: Hamilton ' + ham.pts + ', which is ' + (ham.pts - lec.pts) + ' points above Leclerc.</span><span><i class="sw gh"></i>Dashed bricks: the 50 points Leclerc can still win in the two races left (Qatar 29 Nov, Abu Dhabi 6 Dec). One brick is 25 points.</span></p></section>';
    return h;
  }

  window.RW_DIR = {
    id: 'c', letter: 'C', name: 'Brick plate',
    tag: 'A toy-brick world: a light blue-grey baseplate with studs, chunky tiles with a darker bottom edge, the primary colours (red, blue, yellow, green, white, dark grey) and round, friendly type. Sessions are small bricks you press, the champion window is a row of brick towers.',
    spoilerSwitch: true, spoilerDefault: true, chips: true, menuOpen: true, menuForm: 'tray', cellMax: 4, pickInput: 'range',
    look: [
      '<b>The brick tray on the left.</b> Every series is a big car brick on its own stud tile, with its shown or hidden state. The brick button top left folds the tray to a thin strip of small cars. On the phone the same menu is a tray that slides up from the bottom over a dimmed screen, the cars in two columns.',
      '<b>Month cells as brick tiles.</b> Each race day is a pastel tile in the colour of its venue: a thick light road line (the track outline) and a faded corner picture behind, then every session as a 1 x 2 brick in its series colour with two studs on top, white or dark bold text, and a small white Results brick.',
      '<b>Hide winners as a big tile switch</b> in the top bar, on from the start: no winner name shows until you open a result. Turn it off and a small P1 chip appears on finished sessions.',
      '<b>Click a race day.</b> A big brick tile opens in the middle of the screen (a full height sheet on the phone) with a colour band in the first series colour. The hourly weather is a row of brick cells with small square icons: the sun is a yellow cluster, clouds are white squares, rain is blue drops.',
      '<b>The round yellow brick button</b> with the head, bottom right, opens the champion window: a brick tower per driver (one brick is 25 points), Leclerc in red with the gap to third place marked, then the sum, three worked example bricks and the slider calculator.'
    ],
    q: {
      menu: 'a brick tray: a big tray at the left with a large car on a stud tile for every series (folds to a thin tray with only small cars), and on a phone a tray that slides up from the bottom with the cars in two columns.',
      pop: 'a big brick tile window in the middle of the screen with a colour band in the first series colour on PC, and a full height sheet on a phone.',
      champ: 'a brick tower for every driver (one brick is 25 points) with Leclerc highlighted and the gap to third place marked, then the sum, three worked example cards and a calculator made of sliders.'
    },
    extra: [
      { id: 'tone', q: 'Tone. This page is a toy-brick world: chunky tiles, studs, primary colours and rounded type. Is that the right tone for a racing calendar?', type: 'radio', opts: ['Yes, as playful as here', 'Calmer: keep the colours, drop most studs and the thick edges', 'Not the tone I want'] },
      { id: 'sqicons', q: 'Weather icons. Here they are built from small squares like bricks. Which style do you want?', type: 'radio', opts: ['Square brick icons (as here)', 'Round classic weather icons', 'Decide with the final look'] }
    ],
    hooks: {
      cell: function (ev, app, o) { return tint(put(A.D.cell(ev, app, o), '<div class="cell ev', ev.g)); },
      sessionRow: function (it, app, ctx) { return tint(A.D.sessionRow(it, app, ctx)); },
      weekendCard: function (g, app, k, n) { return tint(put(A.D.weekendCard(g, app, k, n), '<article class="wcard"', g)); },
      listHead: function (g, app, items) { return tint(put(A.D.listHead(g, app, items), '<div class="lh"', g)); },
      listTile: function (it, app) { return tint(A.D.listTile(it, app)); },
      menu: function (app) {
        var st = app.state, anim = app.state.menuAnim; app.state.menuAnim = false;
        return tint('<nav class="menu' + (anim ? ' slide' : '') + '" aria-label="Series"><div class="menu-h"><span>Series</span></div><ul>' + RW.series.map(function (s) {
          var on = st.on[s.id];
          return '<li class="si ' + (on ? 'on' : 'off') + '" style="--c:' + s.color + '"><button data-act="series" data-s="' + s.id + '" aria-pressed="' + on + '" title="' + s.name + '"><span class="cw">' + RW.car(s.id) + '</span><span class="nm">' + s.name + '</span><span class="tg">' + (on ? 'shown' : 'hidden') + '</span></button>' +
            (s.id === 'wec' ? '<div class="cls"><button data-act="wcls" data-c="hypercar" class="' + (st.wecCls === 'hypercar' ? 'on' : '') + '">Hypercar</button><button data-act="wcls" data-c="lmgt3" class="' + (st.wecCls === 'lmgt3' ? 'on' : '') + '">LMGT3</button></div>' : '') +
            (s.id === 'fe' ? '<div class="sn">stand-in until RW.RESEARCH.FE</div>' : '') + '</li>';
        }).join('') + '</ul><p class="menu-f">Unofficial. Not associated with the Formula 1 companies, the FIA, Ferrari, any team, driver or series, or any maker of toy bricks. The brick-style drawings are our own.</p></nav>');
      },
      popup: function (app) {
        var h = tint(A.D.popup(app)), m = h.match(/class="ps ser-[a-z0-9]+" style="(--c:#[0-9a-fA-F]{6};--cx:#[0-9a-fA-F]{3,6})"/);
        return m ? h.replace('<header class="ph"', '<header class="ph" style="' + m[1] + '"') : h;
      },
      champion: function (app) {
        var CB = A.CB, s27 = app.state.s2027;
        return '<header class="chh"><h2>Can Charles Leclerc still be champion?</h2><button class="x" data-act="champclose" aria-label="Close">&times;</button></header><div class="chb">' +
          (s27 ? '' : CB.headline() + towers() + CB.sum() + CB.third() + CB.examples() + CB.calc(app) + '<details class="lad"><summary>Standings table with wins, 2nd and 3rd places</summary>' + CB.ladder() + '</details>') +
          CB.future(app) + CB.foot() + '</div>';
      }
    },
    actions: {
      /* the narrow tray slides up once when it opens (the engine redraws on every click, so the flag is read once by the menu hook) */
      menu: function (a) { a.state.menuOpen = !a.state.menuOpen; a.state.menuAnim = a.state.menuOpen; }
    },
    init: function (api) { A = api; }
  };
})();
