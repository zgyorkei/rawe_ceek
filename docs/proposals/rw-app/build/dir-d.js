/* RW direction D: Night glass. Frosted glass cards on a navy-black field with blurred series glows, neon track lines,
   a full overlay menu with floating cars, a sky-coloured popup with a smooth forecast curve, and a "path to third" champion window. */
(function () {
  var A = null, seq = 0;
  var ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
  var PRIO = { storm: 7, rain: 6, snow: 5, fog: 4, cloud: 3, partly: 2, clear: 1 };

  /* ---------- small helpers ---------- */
  function sIdx(id) { for (var i = 0; i < RW.series.length; i++) if (RW.series[i].id === id) return i; return 99; }
  function serOrder(items) {
    var c = {}, order = [];
    items.forEach(function (i) { var k = i.w.series; if (!c[k]) { c[k] = 0; order.push(k); } c[k]++; });
    order.sort(function (a, b) { return c[b] - c[a] || sIdx(a) - sIdx(b); });
    return order;
  }
  function cvars(items) {
    var o = serOrder(items).map(function (k) { return A.SER[k].color; });
    return '--c:' + (o[0] || '#7aa8ff') + (o[1] ? ';--c2:' + o[1] : '') + (o[2] ? ';--c3:' + o[2] : '');
  }
  function groupOf(key) { return RW.groups.filter(function (x) { return x.key === key; })[0]; }
  /* put the series colours on the root element of a block (from = the opening of that element) */
  function inject(html, from, vars) { return html.replace(from, function (m) { return m.replace(/^(<\w+)/, '$1 style="' + vars + '"'); }); }

  /* ---------- weather: smooth temperature curve ---------- */
  function mono(P) {
    var n = P.length, dx = [], m = [], t = [], i, d;
    if (n < 2) return '';
    for (i = 0; i < n - 1; i++) { dx[i] = P[i + 1][0] - P[i][0]; m[i] = (P[i + 1][1] - P[i][1]) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = (m[i - 1] * m[i] <= 0) ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; } else {
        var a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
        if (s > 9) { var k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
      }
    }
    d = 'M' + P[0][0].toFixed(1) + ' ' + P[0][1].toFixed(1);
    for (i = 0; i < n - 1; i++) {
      d += ' C' + (P[i][0] + dx[i] / 3).toFixed(1) + ' ' + (P[i][1] + t[i] * dx[i] / 3).toFixed(1) + ' ' + (P[i + 1][0] - dx[i] / 3).toFixed(1) + ' ' + (P[i + 1][1] - t[i + 1] * dx[i] / 3).toFixed(1) + ' ' + P[i + 1][0].toFixed(1) + ' ' + P[i + 1][1].toFixed(1);
    }
    return d;
  }
  function skyKind(hrs, win) {
    var c = {}, any = false, best = 'clear', bc = -1;
    hrs.forEach(function (x) { if (win.ses[+x.h.slice(0, 2)]) { any = true; var k = RW.wxKind(x.code); c[k] = (c[k] || 0) + 1; } });
    if (!any) hrs.forEach(function (x) { var k = RW.wxKind(x.code); c[k] = (c[k] || 0) + 1; });
    Object.keys(c).forEach(function (k) { if (c[k] > bc || (c[k] === bc && PRIO[k] > PRIO[best])) { best = k; bc = c[k]; } });
    return best;
  }
  function weather(w, win, app) {
    var hrs = w.hours.filter(function (x) { var h = +x.h.slice(0, 2); return h >= win.from && h <= win.to; });
    var kind = skyKind(hrs.length ? hrs : w.hours, win), pop = app.root.querySelector('.pop');
    if (pop) pop.setAttribute('data-sky', kind);
    if (hrs.length < 2) return A.D.weather(w, win, app);
    var n = hrs.length, u = 'dw' + (++seq), W = 1000, H = 220, yTop = 46, yBase = 168, rainH = 46;
    var temps = hrs.map(function (x) { return x.temp; }), tmin = Math.min.apply(null, temps), tmax = Math.max.apply(null, temps);
    var lo = Math.floor(tmin) - 1, hi = Math.ceil(tmax) + 1; if (hi - lo < 5) hi = lo + 5;
    var gust = Math.max.apply(null, hrs.map(function (x) { return x.gust; }));
    var pops = hrs.map(function (x) { return x.pop; }).filter(function (x) { return x != null; });
    var cw = W / n, pts = hrs.map(function (x, i) { return [(i + 0.5) * cw, yBase - (x.temp - lo) / (hi - lo) * (yBase - yTop)]; });
    var P = [[0, pts[0][1]]].concat(pts, [[W, pts[n - 1][1]]]), line = mono(P);
    var area = line + ' L' + W + ' ' + yBase + ' L0 ' + yBase + ' Z';
    var peak = temps.indexOf(tmax);
    var badge = w.state === 'live' ? '<span class="badge ok">live call ok' + (w.archive ? ' (archive)' : '') + '</span>' : '<span class="badge bad">call failed, sample shown</span>';
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="' + u + 'a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd6ff" stop-opacity=".55"/><stop offset="1" stop-color="#7a6bff" stop-opacity="0"/></linearGradient><linearGradient id="' + u + 'l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#46e0d0"/><stop offset=".55" stop-color="#7aa8ff"/><stop offset="1" stop-color="#c58bff"/></linearGradient></defs>';
    hrs.forEach(function (x, i) { if (win.ses[+x.h.slice(0, 2)]) svg += '<rect class="wsh" x="' + (i * cw).toFixed(1) + '" y="0" width="' + cw.toFixed(1) + '" height="' + H + '"/><rect class="wst" x="' + (i * cw).toFixed(1) + '" y="0" width="' + cw.toFixed(1) + '" height="3"/>'; });
    svg += '<line class="wgl" x1="0" x2="' + W + '" y1="' + yBase + '" y2="' + yBase + '"/><line class="wgl" x1="0" x2="' + W + '" y1="' + ((yBase + yTop) / 2).toFixed(0) + '" y2="' + ((yBase + yTop) / 2).toFixed(0) + '"/>';
    svg += '<path class="war" d="' + area + '" fill="url(#' + u + 'a)"/><path class="wln" d="' + line + '" stroke="url(#' + u + 'l)"/></svg>';
    /* rain chance as thin HTML bars (square at the baseline, rounded at the data end) */
    var rains = hrs.map(function (x, i) {
      var v = x.pop != null ? x.pop : Math.min(100, (x.rain || 0) * 25), bh = Math.max(v > 0 ? 3 : 0, v / 100 * rainH);
      return bh > 0 ? '<i class="rbar" style="left:' + ((i + 0.5) / n * 100).toFixed(2) + '%;height:' + (bh / H * 100).toFixed(2) + '%"></i>' : '';
    }).join('');
    var dots = hrs.map(function (x, i) {
      return '<span class="wdot' + (i === peak ? ' peak' : '') + (i % 2 ? ' alt' : '') + '" style="left:' + ((i + 0.5) / n * 100).toFixed(2) + '%;top:' + (pts[i][1] / H * 100).toFixed(2) + '%"><i></i><b>' + Math.round(x.temp) + '&deg;</b></span>';
    }).join('');
    var cols = hrs.map(function (x) {
      var h = +x.h.slice(0, 2);
      return '<div class="hr' + (win.ses[h] ? ' ses' : '') + '"><span class="t"><u>' + x.h.slice(0, 2) + '</u><i>:00</i></span>' + RW.wxIcon(x.code) + '<span class="pp">' + (x.pop == null ? '' : x.pop + '%') + '</span><span class="wd">' + Math.round(x.wind) + '</span></div>';
    }).join('');
    return '<h3>Weather at the track ' + badge + '</h3>' +
      '<div class="wxtop"><div class="wxbig"><b>' + Math.round(tmax) + '</b><sup>&deg;C</sup><small>highest hour</small></div><div class="wxchip">' + RW.wxIcon({ clear: 0, partly: 2, cloud: 3, fog: 45, rain: 61, snow: 71, storm: 95 }[kind]) + '<span>' + RW.wxText[kind] + ' at the sessions</span></div></div>' +
      '<p class="wsum"><span><small>Temperature</small><b>' + Math.round(tmin) + ' to ' + Math.round(tmax) + ' &deg;C</b></span><span><small>Rain chance up to</small><b>' + (pops.length ? Math.max.apply(null, pops) + ' %' : 'not in archive data') + '</b></span><span><small>Gusts up to</small><b>' + Math.round(gust) + ' km/h</b></span></p>' +
      '<div class="wxc' + (n >= 12 ? ' d1' : '') + '" style="--cols:' + n + '"><div class="wxleg"><span class="l1">Temperature</span><span class="l2">' + (pops.length ? 'Rain chance' : 'Rain amount (archive has no chance)') + '</span><span class="l3">Session hours</span><span class="l4">Wind km/h, last row</span></div><div class="wxplot">' + svg + rains + dots + '</div><div class="wxcols">' + cols + '</div></div>' +
      '<p class="wnote">Hours are track time; shaded hours have a session. Wind in km/h. Model value for the circuit point, not a trackside sensor; no asphalt temperature. Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>. Rain radar is not in v1 (open question below).</p>';
  }

  /* ---------- champion: path to third ---------- */
  function me() { return RW.champ.drivers.filter(function (d) { return d.me; })[0]; }
  function nodesInner(app) {
    var C = RW.champ, m = me(), rk0 = C.drivers.indexOf(m) + 1, a = RW.whatif([app.state.picks[0], {}]), b = RW.whatif(app.state.picks);
    function node(cls, label, pts, rank, when) {
      return '<div class="pn ' + cls + '"><span class="dot"></span><small>' + label + '</small><b>' + pts + '<em>pts</em></b><span class="rk">' + ORD[rank] + '</span><span class="pw">' + when + '</span></div>';
    }
    return node('n0', 'Today', m.pts, rk0, '26 Nov') + node('n1' + (a.lec.rank === 3 ? ' ok' : ''), 'After ' + C.left[0].n, a.lec.pts, a.lec.rank, C.left[0].d) + node('n2' + (b.lec.rank === 3 && !b.dup.length ? ' ok' : ''), 'After ' + C.left[1].n, b.lec.pts, b.lec.rank, C.left[1].d);
  }
  function outcome(app) {
    var r = RW.whatif(app.state.picks), lec = r.lec, MAX = 420;
    var verdict = r.dup.length ? '<p class="warn">' + r.dup.join('. ') + '. Change one place.</p>' : '<p class="verdict ' + (lec.rank === 3 ? 'ok' : 'no') + '">Leclerc ends <b>' + ORD[lec.rank] + '</b> with ' + lec.pts + ' points.</p>';
    var bars = r.rows.filter(function (x) { return x.rank <= 7; }).map(function (x) {
      var b0 = (x.pts - x.add) / MAX * 100, b1 = x.add / MAX * 100;
      return '<li class="' + (x.me ? 'me ' : '') + (x.rank === 3 ? 'r3' : '') + '"><span class="rk">' + x.rank + '</span><span class="bn">' + x.name + '</span><span class="bt"><i class="b0" style="width:' + b0.toFixed(2) + '%"></i>' + (x.add ? '<i class="b1" style="width:' + b1.toFixed(2) + '%"></i>' : '') + '</span><span class="bv"><b>' + x.pts + '</b>' + (x.add ? '<em>+' + x.add + '</em>' : '') + '</span></li>';
    }).join('');
    return verdict + '<ol class="bars" aria-label="Final standings after Abu Dhabi">' + bars + '</ol><p class="bleg"><span class="k0">Points before the two races (dim)</span><span class="k1">Points added in the two races (bright)</span> Bars start at 0. The dashed line marks the end of the top three.</p>';
  }
  function pathHtml(app) {
    var C = RW.champ, m = me(), third = C.drivers[2], gap = third.pts - m.pts;
    var h = '<div class="path calc"><h3 class="pth">Path to third place</h3><p class="mut">Each stop is one race. Slide a driver to a finishing place: far left is outside the points, then P1 to P10 towards the right. The nodes and the bars update at once. The other drivers (Antonelli, Verstappen, Piastri) are held at their points.</p>';
    h += '<div class="pnodes" data-nodes>' + nodesInner(app) + '</div><div class="stops"><div class="stop s0"><b>' + ORD[C.drivers.indexOf(m) + 1] + ' today</b><p>' + m.pts + ' points, ' + gap + ' behind third place (' + third.name + ', ' + third.pts + ').</p></div>';
    [0, 1].forEach(function (r) {
      h += '<fieldset class="stop s' + (r + 1) + '"><legend>' + C.left[r].n + ' GP, ' + C.left[r].d + '</legend>' + A.PK.map(function (id) {
        var v = app.state.picks[r][id] || 0;
        return '<label class="pk' + (id === 'LEC' ? ' me' : '') + '"><span>' + A.PN[id] + '</span><input type="range" min="0" max="10" step="1" value="' + v + '" style="--p:' + (v * 10) + '%" data-pick data-r="' + r + '" data-d="' + id + '" aria-label="' + A.PN[id] + ', ' + C.left[r].n + ' race place"><output>' + (v ? 'P' + v : 'out') + '</output></label>';
      }).join('') + '</fieldset>';
    });
    return h + '</div><div class="calc-out" data-calc-out>' + outcome(app) + '</div></div>';
  }
  function examples() {
    return '<h3 class="exh">Worked examples</h3><div class="ex">' + RW.champBest.map(function (e, i) {
      return '<div class="exc"><h4>' + e.title + '</h4><b>' + e.lec + '<small>points</small></b><p>' + e.note + '</p><button data-act="preset" data-p="' + i + '">Show it on the path</button></div>';
    }).join('') + '</div>';
  }
  function champion(app) {
    var CB = A.CB;
    var body = app.state.s2027 ? '' : CB.headline() + CB.sum() + CB.third() + pathHtml(app) + examples() + CB.ladder();
    return '<header class="chh"><h2>Can Charles Leclerc still be champion?</h2><button class="x" data-act="champclose" aria-label="Close">&times;</button></header><div class="chb">' + body + CB.future(app) + CB.foot() + '</div>';
  }
  function champOut(app) {
    var h = outcome(app), el = app.root.querySelector('[data-nodes]');
    if (el) el.innerHTML = nodesInner(app);
    return h;
  }

  window.RW_DIR = {
    id: 'd', letter: 'D', name: 'Night glass',
    tag: 'A deep navy field with blurred series glows, frosted glass cards, neon track lines and a calm, light type.',
    spoilerSwitch: false, spoilerDefault: false, chips: false, menuOpen: false, menuForm: 'overlay', cellMax: 4, pickInput: 'range',
    look: [
      'The menu is a frosted overlay: press the hamburger and the six cars float on glass cards, a glowing ring shows shown or hidden. Two per row on the phone.',
      'Event days are glass tiles with a neon track outline and a glow in the series colour; sessions are pills with a series dot, and Results is a gradient pill.',
      'Open an event day: the popup takes its sky from the weather (clear blue to teal, cloud, rain streaks, storm, fog, snow); on the phone it fills the screen. The hourly forecast is a smooth temperature curve with session hours shaded and thin rain bars.',
      'The champion window is a path to third place: three nodes on a timeline (today, after Qatar, after Abu Dhabi), two race stops with sliders under them, and a glowing bar chart of the final standings.',
      'Weekend cards and the list use hero tiles with a glowing track line, glass lanes per series, and the floating button is a glowing glass circle with the head.'
    ],
    q: {
      menu: 'a full-frame frosted overlay opened by the hamburger, with the six cars floating on glass cards and a glowing ring for shown or hidden.',
      pop: 'a centred glass dialog on a PC and a full-screen sheet on a phone, coloured like the sky by the weather, with the hourly forecast as a smooth curve.',
      champ: 'a path to third place: a timeline with three nodes, two race stops with sliders and a glowing bar chart of the final standings.'
    },
    extra: [
      { id: 'motion', q: 'Motion and glow. The menu cards float, the track lines glow and the background colours drift slowly (all of it is off for people who ask for reduced motion). How much do you want?', type: 'radio', opts: ['As here', 'Calmer: no floating, softer glow', 'Still: no animation at all'] }
    ],
    hooks: {
      cell: function (ev, app, o) {
        return inject(A.D.cell(ev, app, o), '<div class="cell ev', cvars(ev.items));
      },
      weekendCard: function (g, app, k, n) {
        return inject(A.D.weekendCard(g, app, k, n), '<article class="wcard"', cvars(A.groupItems(app, g)));
      },
      listHead: function (g, app, items) {
        return inject(A.D.listHead(g, app, items), '<div class="lh">', cvars(items));
      },
      compactCell: function (d, inM, evs, app) {
        return A.D.compactCell(d, inM, evs, app).replace(/<i style="background:([^";]+)">/g, '<i style="background:$1;box-shadow:0 0 6px 1px $1">');
      },
      menu: function (app) {
        return A.D.menu(app).replace('<div class="menu-h">Series</div>', '<div class="menu-h"><span>Series</span><button class="mclose" data-act="menu">Done</button></div>');
      },
      popup: function (app) {
        var p = app.state.pop, g = groupOf(p.g), ev = A.eventsOn(app, p.d).filter(function (e) { return e.g.key === g.key; })[0];
        var h = A.D.popup(app).replace('<header class="ph">', '<header class="ph" style="' + cvars(ev ? ev.items : A.groupItems(app, g)) + '">' + A.bgHtml(g));
        return h + '<button class="pclose" data-act="popclose">Close</button>';
      },
      weather: weather,
      champion: champion,
      champOut: champOut
    },
    actions: {
      preset: function (app, el) {
        var p = RW.champBest[+el.getAttribute('data-p')].picks;
        app.state.picks = [{ LEC: p[0].LEC }, { LEC: p[1].LEC }];
        setTimeout(function () {
          var c = app.root.querySelector('.champ'), t = c && c.querySelector('.path');
          if (c && t) c.scrollTop += t.getBoundingClientRect().top - c.getBoundingClientRect().top - 76;
        }, 0);
      }
    },
    init: function (api) {
      A = api;
      /* the filled part of a slider track follows the value */
      document.addEventListener('input', function (e) {
        var t = e.target;
        if (t && t.type === 'range' && t.hasAttribute('data-pick')) t.style.setProperty('--p', (t.value * 10) + '%');
      }, true);
    }
  };
})();
