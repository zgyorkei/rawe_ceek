/* RW engine: one app, rendered into any number of frames. A direction (RW_DIR) can override renderers through RW_DIR.hooks and add actions through RW_DIR.actions. */
(function () {
  var RW = window.RW, DIR = window.RW_DIR || {}, HK = DIR.hooks || {};
  var G = { sim: 0, now: Date.parse(RW.sims[0].now) }, apps = [];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fc = {};
  function F(tz, o, loc) { var k = tz + (loc || '') + JSON.stringify(o); return fc[k] || (fc[k] = new Intl.DateTimeFormat(loc || 'en-GB', Object.assign({ timeZone: tz }, o))); }
  function hm(u, tz) { return F(tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(Date.parse(u)); }
  function ymd(u, tz) { var o = {}; F(tz, { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(Date.parse(u)).forEach(function (p) { o[p.type] = p.value; }); return o.year + '-' + o.month + '-' + o.day; }
  function toD(s) { var a = s.split('-'); return Date.UTC(+a[0], +a[1] - 1, +(a[2] || 1)); }
  function addD(s, n) { return new Date(toD(s) + n * 864e5).toISOString().slice(0, 10); }
  function dow(s) { return (new Date(toD(s)).getUTCDay() + 6) % 7; }
  function fmtD(s, o) { return F('UTC', o).format(toD(s)); }
  function monthLabel(m) { return fmtD(m + '-01', { month: 'long', year: 'numeric' }); }
  function addM(m, n) { var a = m.split('-'), d = new Date(Date.UTC(+a[0], +a[1] - 1 + n, 1)); return d.toISOString().slice(0, 7); }
  function dur(ms) { var m = Math.round(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60); m = m % 60; return (d ? d + ' d ' : '') + (h ? h + ' h ' : '') + (d ? '' : m + ' min'); }
  function H(n) { return HK[n] || D[n]; }
  var SER = {}; RW.series.forEach(function (s) { SER[s.id] = s; });

  /* groups: the weekends at one venue (the sample has one weekend per venue) */
  RW.groups = []; var gm = {};
  RW.weekends.forEach(function (w) {
    var v = RW.venues[w.ven], g = gm[w.ven]; if (!g) { g = gm[w.ven] = { key: w.ven, ven: v, ws: [], start: '9999', end: '0000' }; RW.groups.push(g); }
    g.ws.push(w); w.sessions.forEach(function (s) { var d = ymd(s.startUtc, v.tz); if (d < g.start) g.start = d; if (d > g.end) g.end = d; });
  });
  RW.groups.forEach(function (g) {
    var f1 = g.ws.filter(function (w) { return w.series === 'f1'; })[0], any = g.ws.filter(function (w) { return !/weekend$/.test(w.name); })[0];
    g.raceName = (f1 || any || { name: g.ven.city + ' weekend' }).name;
  });
  RW.groups.sort(function (a, b) { return a.start < b.start ? -1 : 1; });

  function eventsOn(app, d) {
    var out = [];
    RW.groups.forEach(function (g) {
      var items = [];
      g.ws.forEach(function (w) { if (!app.state.on[w.series]) return; w.sessions.forEach(function (s) { if (w.series === 'wec' && s.cls !== 'all' && s.cls !== app.state.wecCls) return; if (ymd(s.startUtc, g.ven.tz) === d) items.push({ w: w, s: s, g: g, d: d }); }); });
      if (items.length) { items.sort(function (a, b) { return a.s.startUtc < b.s.startUtc ? -1 : 1; }); out.push({ g: g, items: items, d: d }); }
    });
    out.sort(function (a, b) { return b.items.length - a.items.length; }); return out;
  }
  function groupItems(app, g) {
    var items = []; g.ws.forEach(function (w) { if (!app.state.on[w.series]) return; w.sessions.forEach(function (s) { if (w.series === 'wec' && s.cls !== 'all' && s.cls !== app.state.wecCls) return; items.push({ w: w, s: s, g: g, d: ymd(s.startUtc, g.ven.tz) }); }); });
    items.sort(function (a, b) { return a.s.startUtc < b.s.startUtc ? -1 : 1; }); return items;
  }
  function todayOf(app) { return ymd(new Date(G.now).toISOString(), app.state.tz); }
  function stat(s) {
    var st = Date.parse(s.startUtc), en = Date.parse(s.endUtc), n = G.now;
    if (n < st) return { k: 'up', t: 'in ' + dur(st - n) };
    if (n < en) return { k: 'live', t: 'live now' };
    var age = (n - en) / 60000;
    if (age < 20) return { k: 'pending', t: 'results pending' };
    if (age < 180 && s.kind !== 'practice') return { k: 'prov', t: 'provisional' };
    return { k: 'final', t: 'final' };
  }
  function clsLabel(s) { return s.cls === 'all' ? '' : (s.cls === 'hypercar' ? 'Hypercar' : 'LMGT3'); }
  function timeParts(it, app, d) {
    var s = it.s, tz = it.g.ven.tz, vt = app.state.tz, own = hm(s.startUtc, tz), mine = hm(s.startUtc, vt);
    var vd = ymd(s.startUtc, vt), shift = vd > d ? '+1d' : (vd < d ? '-1d' : '');
    var main = app.state.clock === 'viewer' ? mine : own, sub = app.state.clock === 'viewer' ? own : mine;
    var tbc = s.conf === 'placeholder';
    return { main: tbc ? 'TBC' : main, sub: tbc ? 'time to be confirmed' : sub, shift: tbc ? '' : (app.state.clock === 'viewer' ? shift : ''), subShift: app.state.clock === 'viewer' ? '' : shift, subLabel: app.state.clock === 'viewer' ? 'track' : 'mine' };
  }
  function leader(it, app) {
    var s = it.s; if (stat(s).k !== 'final') return null;
    var rows = s.byClass ? (s.byClass[app.state.wecCls === 'hypercar' ? 'hypercar' : 'lmgt3'] || []) : (s.top || []);
    return rows.filter(function (r) { return r.pos === 1 && r.real; })[0] || null;
  }
  function resultRows(it, app) {
    var s = it.s, rows;
    if (s.byClass) { rows = s.byClass[app.state.wecCls] || []; if (!rows.length) return { rows: [], note: 'No ' + clsLabel({ cls: app.state.wecCls }) + ' rows in the research sample. The data service will fill the full table.' }; return { rows: rows, note: 'Only the rows that the research lists. The full table comes from the data service.' }; }
    if (s.top && s.top.length) return { rows: s.top, note: 'Only the leader is in the research sample. The full table comes from the data service.' };
    return { rows: [{ pos: 1, who: 'Driver 1' }, { pos: 2, who: 'Driver 2' }, { pos: 3, who: 'Driver 3' }], sample: true, note: 'SAMPLE rows: the real table comes from the data service.' };
  }

  /* ----- default renderers ----- */
  var D = {};
  D.resBtn = function (it, app, ctx) {
    var st = stat(it.s);
    if (st.k === 'final') return '<button class="rb final" data-act="res" data-sid="' + it.s.id + '" data-d="' + it.d + '" data-g="' + it.g.key + '">Results</button>';
    if (st.k === 'prov') return '<button class="rb prov" data-act="res" data-sid="' + it.s.id + '" data-d="' + it.d + '" data-g="' + it.g.key + '">Results (provisional)</button>';
    if (st.k === 'pending') return '<span class="rb pending">Results soon</span>';
    if (st.k === 'live') return '<span class="rb live">Live</span>';
    return '';
  };
  D.sessionRow = function (it, app, ctx) {
    var s = it.s, se = SER[it.w.series], t = timeParts(it, app, it.d), st = stat(s), ld = leader(it, app), chip = '';
    if (DIR.chips && ld && !app.state.spoiler) chip = '<span class="win">P1 ' + esc(ld.who) + '</span>';
    var pop = ctx === 'pop', cl = clsLabel(s);
    return '<li class="sr k-' + s.kind + ' st-' + st.k + '" style="--c:' + se.color + '"><span class="sc">' + se.short + '</span><span class="tm">' + t.main + (t.shift ? '<sup>' + t.shift + '</sup>' : '') + (pop ? '<small>' + t.sub + (t.subShift ? ' ' + t.subShift : '') + '</small>' : '') + '</span><span class="nm">' + esc(s.name) + (cl ? ' <i>' + cl + '</i>' : '') + (s.conf === 'placeholder' ? ' <i>time to be confirmed</i>' : '') + (it.g.ven.stand && ctx !== 'pop' ? ' <i>' + esc(it.g.ven.city) + '</i>' : '') + '</span>' + (pop ? '<span class="stt">' + st.t + '</span>' : '') + chip + H('resBtn')(it, app, ctx) + '</li>';
  };
  function bgHtml(g) {
    return '<div class="bg"><svg class="out" viewBox="0 0 500 500" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d="' + RW.outlines[g.ven.outline] + '" fill="none" stroke="currentColor" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/></svg>' + RW.scene(g.ven.corner.scene) + '<i class="scrim"></i></div>';
  }
  function locHtml(g) { return RW.flag(g.ven.cc) + '<span class="loc"><b>' + esc(g.ven.city) + '</b><em>' + esc(g.ven.country) + '</em></span>'; }
  function rowsHtml(items, app, ctx, max) {
    var shown = max && items.length > max ? items.slice(0, max) : items, more = items.length - shown.length;
    return shown.map(function (it) { return H('sessionRow')(it, app, ctx); }).join('') + (more > 0 ? '<li class="more"><button data-act="open" data-g="' + items[0].g.key + '" data-d="' + items[0].d + '">+' + more + ' more</button></li>' : '');
  }
  D.cell = function (ev, app, o) {
    var d = ev.d, g = ev.g, today = todayOf(app) === d, card = o && o.card;
    var bad = ev.items.some(function (i) { return i.g.key !== g.key; });
    var rows = ev.items;
    return '<div class="cell ev' + (today ? ' today' : '') + (card ? ' card' : '') + '" data-act="' + (card ? 'open' : 'open') + '" data-g="' + g.key + '" data-d="' + d + '" tabindex="0">' + bgHtml(g) + '<div class="hd">' + locHtml(g) + '<span class="dn">' + (card ? fmtD(d, { weekday: 'long', day: 'numeric', month: 'long' }) : +d.slice(8)) + '</span></div><div class="rn">' + esc(g.raceName) + '</div><ul class="sl">' + rowsHtml(rows, app, 'cell', DIR.cellMax || 6) + '</ul>' + (card ? '<div class="go"><button data-act="open" data-g="' + g.key + '" data-d="' + d + '">Open the program and weather</button></div>' : '') + '</div>';
  };
  D.plainCell = function (d, inMonth, app) { return '<div class="cell' + (inMonth ? '' : ' out') + (todayOf(app) === d ? ' today' : '') + '"><span class="dn">' + +d.slice(8) + '</span></div>'; };
  D.compactCell = function (d, inMonth, evs, app) {
    var sel = app.state.sel === d, today = todayOf(app) === d, ser = {};
    evs.forEach(function (e) { e.items.forEach(function (i) { ser[i.w.series] = 1; }); });
    return '<button class="cc' + (inMonth ? '' : ' out') + (today ? ' today' : '') + (sel ? ' sel' : '') + (evs.length ? ' ev' : '') + '" data-act="sel" data-d="' + d + '"><span class="dn">' + +d.slice(8) + '</span>' + (evs.length ? RW.flag(evs[0].g.ven.cc) + '<span class="dots">' + Object.keys(ser).map(function (k) { return '<i style="background:' + SER[k].color + '"></i>'; }).join('') + '</span>' : '') + '</button>';
  };
  function gridDays(m) { var first = m + '-01', start = addD(first, -dow(first)), out = [], i; for (i = 0; i < 42; i++) { var d = addD(start, i); if (i >= 35 && d.slice(0, 7) !== m) break; out.push(d); } return out; }
  D.month = function (app) {
    var m = app.state.month, days = gridDays(m), wide = app.state.mode === 'wide', h;
    h = '<div class="month"><div class="dow">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>';
    if (wide) {
      h += '<div class="grid">' + days.map(function (d) { var inM = d.slice(0, 7) === m, ev = inM ? eventsOn(app, d) : []; return ev.length ? H('cell')(ev[0], app) : H('plainCell')(d, inM, app); }).join('') + '</div>';
    } else {
      var evm = {}; days.forEach(function (d) { evm[d] = d.slice(0, 7) === m ? eventsOn(app, d) : []; });
      if (!app.state.sel || app.state.sel.slice(0, 7) !== m) { var firstEv = days.filter(function (d) { return evm[d].length; }); app.state.sel = firstEv.length ? firstEv[0] : m + '-01'; }
      h += '<div class="cgrid">' + days.map(function (d) { return H('compactCell')(d, d.slice(0, 7) === m, evm[d], app); }).join('') + '</div>';
      var se = evm[app.state.sel] || []; h += '<div class="daycard">' + (se.length ? se.map(function (e) { return H('cell')(e, app, { card: true }); }).join('') : '<p class="empty">No session on ' + fmtD(app.state.sel, { weekday: 'long', day: 'numeric', month: 'long' }) + ' for the chosen series.</p>') + '</div>';
    }
    return h + '</div>';
  };
  /* weekend (C) view */
  function activeGroups(app) {
    var t = todayOf(app), vis = RW.groups.filter(function (g) { return g.ws.some(function (w) { return app.state.on[w.series]; }); });
    var cur = vis.filter(function (g) { var a = ymd(Date.parse(g.start + 'T00:00:00Z') + 0 + '' === 'NaN' ? '' : new Date(toD(g.start)).toISOString(), 'UTC'); return g.start <= t && t <= g.end; });
    return cur;
  }
  function nearGroups(app) {
    var t = todayOf(app), vis = RW.groups.filter(function (g) { return g.ws.some(function (w) { return app.state.on[w.series]; }); });
    var cur = activeGroups(app); if (cur.length) return cur;
    var nx = vis.filter(function (g) { return g.end >= t; })[0] || vis[vis.length - 1]; if (!nx) return [];
    return vis.filter(function (g) { return Math.abs(toD(g.start) - toD(nx.start)) <= 3 * 864e5; });
  }
  D.weekendCard = function (g, app, k, n) {
    var items = groupItems(app, g), sers = RW.series.filter(function (s) { return items.some(function (i) { return i.w.series === s.id; }); });
    var dates = fmtD(g.start, { day: 'numeric', month: 'short' }) + ' to ' + fmtD(g.end, { day: 'numeric', month: 'short', year: 'numeric' });
    var h = '<article class="wcard" data-g="' + g.key + '">' + bgHtml(g) + '<header class="wh"><div class="wl">' + locHtml(g) + '</div><div class="rn">' + esc(g.raceName) + '</div><div class="wd">' + dates + (n > 1 ? ' <span class="vn">venue ' + (k + 1) + ' of ' + n + '</span>' : '') + '</div></header><div class="wser">';
    sers.forEach(function (se) {
      var its = items.filter(function (i) { return i.w.series === se.id; }), w = its[0].w, days = {}, order = [];
      its.forEach(function (i) { if (!days[i.d]) { days[i.d] = []; order.push(i.d); } days[i.d].push(i); });
      h += '<section class="sb ser-' + se.id + '" style="--c:' + se.color + '"><div class="sbh"><span class="cw">' + RW.car(se.id) + '</span><span class="sbt"><b>' + se.name + '</b><em>' + (w.round ? 'Round ' + w.round : 'stand-in round') + (w.sample ? ' (' + (w.series === 'fe' ? 'stand-in' : 'sample') + ')' : '') + '</em></span></div><div class="sdays">';
      order.forEach(function (d) { h += '<div class="sd"><h4>' + fmtD(d, { weekday: 'short', day: 'numeric', month: 'short' }) + '</h4><ul class="sl">' + rowsHtml(days[d], app, 'card') + '</ul></div>'; });
      h += '</div></section>';
    });
    var t = todayOf(app), od = (items.filter(function (i) { return i.d >= t; })[0] || items[0]).d;
    return h + '</div><footer class="wf"><button class="pbtn" data-act="open" data-g="' + g.key + '" data-d="' + od + '">Open ' + fmtD(od, { weekday: 'long' }) + ': program and weather</button></footer></article>';
  };
  D.weekend = function (app) {
    var gs = nearGroups(app), auto = app.state.view === 'auto', live = activeGroups(app).length > 0;
    var h = '<div class="wk n' + gs.length + '">';
    if (auto && live) h += '<div class="autob"><span>Race weekend now: the weekend card replaced the month view by itself.</span><button data-act="view" data-v="month">Show the month</button></div>';
    else if (!live) h += '<div class="autob soft"><span>No race on today\'s date: this is the next weekend' + (gs.length > 1 ? 's' : '') + '.</span></div>';
    h += '<div class="cards">' + gs.map(function (g, k) { return H('weekendCard')(g, app, k, gs.length); }).join('') + '</div></div>';
    return h;
  };
  /* list view */
  D.listHead = function (g, app, items) {
    var dates = fmtD(g.start, { day: 'numeric', month: 'short' }) + ' to ' + fmtD(g.end, { day: 'numeric', month: 'short' }), ser = {};
    items.forEach(function (i) { ser[i.w.series] = 1; });
    return '<div class="lh">' + bgHtml(g) + '<div class="lt">' + locHtml(g) + '<div class="rn">' + esc(g.raceName) + '</div><div class="wd">' + dates + ' · ' + esc(g.ven.circuit) + '</div><div class="chips">' + Object.keys(ser).map(function (k) { return '<span class="sc" style="--c:' + SER[k].color + '">' + SER[k].short + '</span>'; }).join('') + '</div></div></div>';
  };
  D.listTile = function (it, app) {
    var s = it.s, se = SER[it.w.series], t = timeParts(it, app, it.d), st = stat(s), cl = clsLabel(s), ld = leader(it, app);
    return '<div class="lti st-' + st.k + '" style="--c:' + se.color + '" data-act="open" data-g="' + it.g.key + '" data-d="' + it.d + '"><span class="ld">' + fmtD(it.d, { weekday: 'short', day: 'numeric', month: 'short' }) + '</span><span class="tm">' + t.main + (t.shift ? '<sup>' + t.shift + '</sup>' : '') + '<small>' + t.sub + '</small></span><span class="sc">' + se.short + '</span><span class="nm">' + esc(s.name) + (cl ? ' <i>' + cl + '</i>' : '') + (s.conf === 'placeholder' ? ' <i>time to be confirmed</i>' : '') + '</span>' + (DIR.chips && ld && !app.state.spoiler ? '<span class="win">P1 ' + esc(ld.who) + '</span>' : '') + H('resBtn')(it, app, 'list') + '</div>';
  };
  D.list = function (app) {
    var h = '<div class="list">';
    RW.groups.forEach(function (g) {
      var items = groupItems(app, g); if (!items.length) return;
      h += '<section class="lg">' + H('listHead')(g, app, items) + '<div class="lts">' + items.map(function (i) { return H('listTile')(i, app); }).join('') + '</div></section>';
    });
    return h + '</div>';
  };
  /* bar and menu */
  D.bar = function (app) {
    var st = app.state, m = st.view === 'auto' ? (activeGroups(app).length ? 'weekend' : 'month') : st.view;
    return '<header class="bar"><button class="hb" data-act="menu" aria-label="Series menu" aria-expanded="' + (st.menuOpen ? 'true' : 'false') + '"><i></i><i></i><i></i></button><span class="brand">rawe_ceek</span>' +
      '<div class="seg" role="tablist">' + [['month', 'Month'], ['weekend', 'Weekend'], ['list', 'List']].map(function (v) { return '<button data-act="view" data-v="' + v[0] + '" class="' + (m === v[0] ? 'on' : '') + '">' + v[1] + '</button>'; }).join('') + '<button data-act="view" data-v="auto" class="auto ' + (st.view === 'auto' ? 'on' : '') + '" title="Swap to the weekend card by itself on race weekends">Auto</button></div>' +
      (m === 'month' ? '<div class="mn"><button data-act="mm" data-n="-1" aria-label="Previous month">&lsaquo;</button><b>' + monthLabel(st.month) + '</b><button data-act="mm" data-n="1" aria-label="Next month">&rsaquo;</button></div>' : '<div class="mn sp"></div>') +
      '<div class="opts"><button class="chip" data-act="clock" title="Main clock">' + (st.clock === 'viewer' ? 'My time' : 'Track time') + '</button><select data-act="tz" aria-label="My time zone">' + RW.zones.map(function (z) { return '<option value="' + z[0] + '"' + (z[0] === st.tz ? ' selected' : '') + '>' + z[1] + '</option>'; }).join('') + '</select>' +
      (DIR.spoilerSwitch ? '<label class="spoil"><input type="checkbox" data-act="spoiler"' + (st.spoiler ? ' checked' : '') + '><span>Hide winners</span></label>' : '') + '</div></header>';
  };
  D.menu = function (app) {
    var st = app.state;
    return '<nav class="menu" aria-label="Series"><div class="menu-h">Series</div><ul>' + RW.series.map(function (s) {
      var on = st.on[s.id];
      return '<li class="si ' + (on ? 'on' : 'off') + '" style="--c:' + s.color + '"><button data-act="series" data-s="' + s.id + '" aria-pressed="' + on + '"><span class="cw">' + RW.car(s.id) + '</span><span class="nm">' + s.name + '</span><span class="tg">' + (on ? 'shown' : 'hidden') + '</span></button>' +
        (s.id === 'wec' ? '<div class="cls"><button data-act="wcls" data-c="hypercar" class="' + (st.wecCls === 'hypercar' ? 'on' : '') + '">Hypercar</button><button data-act="wcls" data-c="lmgt3" class="' + (st.wecCls === 'lmgt3' ? 'on' : '') + '">LMGT3</button></div>' : '') + (s.id === 'fe' ? '<div class="sn">stand-in until RW.RESEARCH.FE</div>' : '') + '</li>';
    }).join('') + '</ul><p class="menu-f">Unofficial. Not associated with the Formula 1 companies, the FIA, Ferrari, the LEGO Group, any team, driver or series.</p></nav>';
  };
  /* popup and weather */
  D.popup = function (app) {
    var p = app.state.pop, g = RW.groups.filter(function (x) { return x.key === p.g; })[0], ev = eventsOn(app, p.d).filter(function (e) { return e.g.key === g.key; })[0];
    var items = ev ? ev.items : [], sers = RW.series.filter(function (s) { return items.some(function (i) { return i.w.series === s.id; }); });
    var days = []; groupItems(app, g).forEach(function (i) { if (days.indexOf(i.d) < 0) days.push(i.d); });
    var h = '<header class="ph"><div class="pl">' + locHtml(g) + '</div><div class="rn">' + esc(g.raceName) + '</div><div class="pd">' + fmtD(p.d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + esc(g.ven.circuit) + '</div><button class="x" data-act="popclose" aria-label="Close">&times;</button></header>';
    h += '<div class="pbody"><section class="prog"><h3>Program</h3><p class="clk">Times: ' + (app.state.clock === 'viewer' ? 'your time (' + esc(RW.zones.filter(function (z) { return z[0] === app.state.tz; })[0][1]) + '), track time small' : 'track time, your time small') + '. "+1d" means the next day for you.</p>';
    sers.forEach(function (se) {
      var its = items.filter(function (i) { return i.w.series === se.id; });
      h += '<div class="ps ser-' + se.id + '" style="--c:' + se.color + '"><div class="psh"><span class="cw">' + RW.car(se.id) + '</span><b>' + se.name + '</b><em>' + (its[0].w.round ? 'Round ' + its[0].w.round : 'stand-in round') + '</em></div><ul class="sl">';
      its.forEach(function (it) {
        h += H('sessionRow')(it, app, 'pop');
        if (p.open === it.s.id) { var rr = resultRows(it, app); h += '<li class="resp"><b>Result' + (stat(it.s).k === 'prov' ? ' (provisional)' : '') + '</b>' + (rr.rows.length ? '<ol>' + rr.rows.map(function (r) { return '<li value="' + r.pos + '">' + esc(r.who) + (rr.sample ? ' <i>SAMPLE</i>' : '') + '</li>'; }).join('') + '</ol>' : '') + '<p>' + rr.note + '</p></li>'; }
      });
      h += '</ul></div>';
    });
    h += '</section><section class="wxs" data-wx="' + g.key + '|' + p.d + '"><h3>Weather at the track</h3><p class="load">Loading the forecast...</p></section>';
    h += '<section class="also"><h3>Also this weekend</h3><div>' + days.map(function (d) { return '<button class="' + (d === p.d ? 'on' : '') + '" data-act="popday" data-g="' + g.key + '" data-d="' + d + '">' + fmtD(d, { weekday: 'short', day: 'numeric' }) + '</button>'; }).join('') + '</div></section></div>';
    var src = g.ws.filter(function (w) { return app.state.on[w.series]; }).map(function (w) { return SER[w.series].short + ': ' + w.source + ' (updated ' + w.updated + ')'; });
    return h + '<footer class="pf">' + src.map(esc).join('<br>') + '</footer>';
  };
  var wxCache = {};
  function sampleWx(v, d) {
    var seed = 0, i; (v.key + d).split('').forEach(function (c) { seed = (seed * 31 + c.charCodeAt(0)) % 997; });
    var base = 28 - Math.abs(v.lat) * 0.35 + (seed % 5) - 2, hours = [];
    for (i = 0; i < 24; i++) { var rain = (seed % 3 === 0 && i > 13 && i < 18) ? 1.2 : 0; hours.push({ h: ('0' + i).slice(-2) + ':00', temp: Math.round((base + 5 * Math.sin((i - 9) / 24 * 6.28)) * 10) / 10, pop: rain ? 55 : (seed % 4) * 5, rain: rain, wind: 8 + (seed + i) % 9, gust: 16 + (seed + i) % 12, hum: 55 + (i * 3 + seed) % 25, code: rain ? 61 : (seed % 2 ? 2 : 1) }); }
    return hours;
  }
  function getWx(v, d) {
    var key = v.key + '|' + d; if (wxCache[key]) return wxCache[key];
    var real = new Date().toISOString().slice(0, 10), diff = Math.round((toD(d) - toD(real)) / 864e5);
    var out = function (o) { return o; };
    if (diff > 15) return (wxCache[key] = Promise.resolve({ state: 'far' }));
    var arch = diff < -4, base = arch ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
    var vars = 'temperature_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m' + (arch ? '' : ',precipitation_probability');
    var url = base + '?latitude=' + v.lat + '&longitude=' + v.lon + '&hourly=' + vars + '&timezone=' + encodeURIComponent(v.tz) + '&start_date=' + d + '&end_date=' + d;
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 7000);
    return (wxCache[key] = fetch(url, { signal: ctl.signal }).then(function (r) { clearTimeout(to); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (j) {
      var t = j.hourly.time.map(function (x, i) { return { h: x.slice(11), temp: j.hourly.temperature_2m[i], pop: j.hourly.precipitation_probability ? j.hourly.precipitation_probability[i] : null, rain: j.hourly.precipitation[i], wind: j.hourly.wind_speed_10m[i], gust: j.hourly.wind_gusts_10m[i], hum: j.hourly.relative_humidity_2m[i], code: j.hourly.weather_code[i] }; });
      return out({ state: 'live', hours: t, archive: arch });
    }).catch(function (e) { clearTimeout(to); return out({ state: 'sample', hours: sampleWx(v, d), why: String(e && e.message || e).slice(0, 60) }); }));
  }
  function wxWindow(app, p) {
    var g = RW.groups.filter(function (x) { return x.key === p.g; })[0], ev = eventsOn(app, p.d).filter(function (e) { return e.g.key === g.key; })[0];
    var items = ev ? ev.items : [], tz = g.ven.tz, lo = 24, hi = 0, ses = {};
    items.forEach(function (i) { var a = +hm(i.s.startUtc, tz).slice(0, 2), b = +hm(i.s.endUtc, tz).slice(0, 2), d1 = ymd(i.s.endUtc, tz); if (d1 > p.d) b = 23; if (i.s.conf === 'placeholder') return; if (a < lo) lo = a; if (b > hi) hi = b; for (var x = a; x <= b; x++) ses[x] = 1; });
    if (lo > hi) { lo = 9; hi = 17; }
    return { from: Math.max(0, lo - 1), to: Math.min(23, hi + 1), ses: ses, g: g };
  }
  D.weather = function (w, win, app) {
    var hrs = w.hours.filter(function (x) { var h = +x.h.slice(0, 2); return h >= win.from && h <= win.to; });
    var pops = hrs.map(function (x) { return x.pop; }).filter(function (x) { return x != null; });
    var tmin = Math.min.apply(null, hrs.map(function (x) { return x.temp; })), tmax = Math.max.apply(null, hrs.map(function (x) { return x.temp; })), gust = Math.max.apply(null, hrs.map(function (x) { return x.gust; }));
    var badge = w.state === 'live' ? '<span class="badge ok">live call ok' + (w.archive ? ' (archive)' : '') + '</span>' : '<span class="badge bad">call failed, sample shown</span>';
    return '<h3>Weather at the track ' + badge + '</h3><p class="wsum"><b>' + Math.round(tmin) + ' to ' + Math.round(tmax) + ' &deg;C</b> · rain chance up to <b>' + (pops.length ? Math.max.apply(null, pops) + ' %' : 'not in archive data') + '</b> · gusts up to <b>' + Math.round(gust) + ' km/h</b></p><div class="strip">' + hrs.map(function (x) {
      var h = +x.h.slice(0, 2); return '<div class="hr' + (win.ses[h] ? ' ses' : '') + '"><span class="t">' + x.h + '</span>' + RW.wxIcon(x.code) + '<b>' + Math.round(x.temp) + '&deg;</b><span class="pp">' + (x.pop == null ? '' : x.pop + '%') + '</span><span class="wd">' + Math.round(x.wind) + '</span></div>';
    }).join('') + '</div><p class="wnote">Hours are track time; shaded hours have a session. Wind in km/h. Model value for the circuit point, not a trackside sensor; no asphalt temperature. Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>. Rain radar is not in v1 (open question below).</p>';
  };
  function fillWx(app) {
    var p = app.state.pop; if (!p) return; var el = app.root.querySelector('.wxs'); if (!el) return;
    var g = RW.groups.filter(function (x) { return x.key === p.g; })[0], key = el.getAttribute('data-wx');
    getWx(g.ven, p.d).then(function (w) {
      var cur = app.root.querySelector('.wxs'); if (!cur || cur.getAttribute('data-wx') !== key) return;
      if (w.state === 'far') { cur.innerHTML = '<h3>Weather at the track</h3><p class="far">Forecast not available yet: the date is more than 16 days ahead. It appears here when the date comes within 16 days.</p>'; return; }
      cur.innerHTML = H('weather')(w, wxWindow(app, p), app);
    });
  }
  /* champion window */
  var CB = {};
  CB.headline = function () { return '<p class="ch-head"><b>Not this season.</b> Mathematically out since the United States GP (round 18, 25 Oct 2026).</p><p class="ch-sub">Antonelli is champion since the Mexico City GP (round 19). What is still open for Leclerc: <b>third place</b> in the standings.</p>'; };
  CB.ladder = function () {
    var C = RW.champ, top = C.drivers[0].pts;
    return '<table class="ladder"><caption>Standings ' + C.asOf + '</caption><thead><tr><th>#</th><th>Driver</th><th>Pts</th><th>Gap to leader</th><th>Wins / 2nd / 3rd</th></tr></thead><tbody>' + C.drivers.map(function (d, i) { return '<tr' + (d.me ? ' class="me"' : '') + '><td>' + (i + 1) + '</td><td>' + d.name + '</td><td>' + d.pts + '</td><td>' + (i ? '-' + (top - d.pts) : '') + '</td><td>' + d.w + ' / ' + d.s + ' / ' + d.t + '</td></tr>'; }).join('') + '</tbody></table><p class="mut">Left: Qatar 29 Nov and Abu Dhabi 6 Dec, no sprints, 50 points at most. Fetched 26 Nov 2026.</p>';
  };
  CB.sum = function () { return '<div class="sum"><code>250 + 50 = 300 &lt; 304</code><span>Leclerc\'s best total is below Verstappen\'s 304, so second place and the title are out. Win both races and he reaches 300.</span></div>'; };
  CB.third = function () { return '<p class="third"><b>Third place is still possible.</b> Over the two races he must score at least 18 more than Hamilton (17 if countback favours him) and at least 15 more than Russell and Norris (14 on countback). Points: 25-18-15-12-10-8-6-4-2-1; countback = most wins, then 2nd places, then 3rd places (Grand Prix places only).</p>'; };
  CB.examples = function () {
    return '<div class="ex">' + RW.champBest.map(function (e) { return '<div class="exc"><h4>' + e.title + '</h4><b>' + e.lec + ' points</b><p>' + e.note + '</p>' + (DIR.calc !== false ? '<button data-act="preset" data-p="' + RW.champBest.indexOf(e) + '">Try it below</button>' : '') + '</div>'; }).join('') + '</div>';
  };
  var PK = ['LEC', 'HAM', 'RUS', 'NOR'], PN = { LEC: 'Leclerc', HAM: 'Hamilton', RUS: 'Russell', NOR: 'Norris' };
  CB.calc = function (app) {
    var h = '<div class="calc"><p class="mut">Pick the finishing places of four drivers in the two races. The other drivers (Antonelli, Verstappen, Piastri) are held at their points: they cannot change the third place fight.</p>';
    [0, 1].forEach(function (r) {
      h += '<fieldset><legend>' + RW.champ.left[r].n + ' GP, ' + RW.champ.left[r].d + '</legend>' + PK.map(function (id) {
        var v = app.state.picks[r][id] || 0, ctl;
        if (DIR.pickInput === 'range') ctl = '<input type="range" min="0" max="10" step="1" value="' + v + '" data-pick data-r="' + r + '" data-d="' + id + '"><output>' + (v ? 'P' + v : 'out') + '</output>';
        else ctl = '<select data-pick data-r="' + r + '" data-d="' + id + '"><option value="0"' + (v ? '' : ' selected') + '>outside the points</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (p) { return '<option value="' + p + '"' + (v === p ? ' selected' : '') + '>P' + p + ' (' + RW.champ.pts[p - 1] + ' pts)</option>'; }).join('') + '</select>';
        return '<label class="pk' + (id === 'LEC' ? ' me' : '') + '"><span>' + PN[id] + '</span>' + ctl + '</label>';
      }).join('') + '</fieldset>';
    });
    return h + '<div class="calc-out" data-calc-out>' + H('champOut')(app) + '</div></div>';
  };
  D.champOut = function (app) {
    var r = RW.whatif(app.state.picks), lec = r.lec, who = r.rows.filter(function (x) { return x.rank <= 7; });
    var verdict = r.dup.length ? '<p class="warn">' + r.dup.join('. ') + '. Change one place.</p>' : '<p class="verdict ' + (lec.rank === 3 ? 'ok' : 'no') + '">Leclerc ends <b>' + ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][lec.rank] + '</b> with ' + lec.pts + ' points.</p>';
    return verdict + '<table class="ladder small"><tbody>' + who.map(function (x) { return '<tr' + (x.me ? ' class="me"' : '') + '><td>' + x.rank + '</td><td>' + x.name + '</td><td>' + x.pts + '</td><td>' + (x.add ? '+' + x.add : '') + '</td></tr>'; }).join('') + '</tbody></table>';
  };
  CB.future = function (app) {
    return '<div class="fut"><button data-act="s2027" class="' + (app.state.s2027 ? 'on' : '') + '">' + (app.state.s2027 ? 'Back to 2026' : 'After the finale: switch to 2027') + '</button>' + (app.state.s2027 ? '<p>2027: 24 rounds, opens 14 Mar 2027 in Bahrain. 680 points are available, everyone starts on 0, so the window will show the title maths again from round 1.</p>' : '') + '</div>';
  };
  CB.foot = function () { return '<p class="mut">Source: the season standings of 26 Nov 2026 (the data service refreshes them after every race). Texts are templated, no AI on Formula 1 content.</p>'; };
  RW.CB = CB;
  D.champion = function (app) {
    return '<header class="chh"><h2>Can Charles Leclerc still be champion?</h2><button class="x" data-act="champclose" aria-label="Close">&times;</button></header><div class="chb">' + (app.state.s2027 ? '' : CB.headline() + CB.sum() + CB.third() + CB.ladder() + CB.examples() + (DIR.calc !== false ? CB.calc(app) : '')) + CB.future(app) + CB.foot() + '</div>';
  };

  /* ----- app ----- */
  function mkState(mode) {
    var sim = RW.sims[G.sim], on = {}; RW.series.forEach(function (s) { on[s.id] = true; });
    return { mode: mode, view: 'auto', month: sim.month, sel: null, menuOpen: !!DIR.menuOpen && mode === 'wide', on: on, wecCls: 'hypercar', clock: 'viewer', tz: 'Europe/Budapest', spoiler: !!DIR.spoilerDefault, pop: null, champ: false, s2027: false, picks: [{ LEC: 1 }, { LEC: 1 }] };
  }
  function render(app) {
    var st = app.state, root = app.root, sc = root.querySelector('.view'), top = sc ? sc.scrollTop : 0, psc = root.querySelector('.pop'), ptop = psc ? psc.scrollTop : 0;
    var view = st.view === 'auto' ? (activeGroups(app).length ? 'weekend' : 'month') : st.view;
    root.setAttribute('data-mode', st.mode); root.setAttribute('data-menu', st.menuOpen ? 'open' : 'closed'); root.setAttribute('data-view', view); root.setAttribute('data-dir', DIR.id || ''); root.setAttribute('data-menuform', DIR.menuForm || 'rail');
    var body = view === 'month' ? H('month')(app) : view === 'weekend' ? H('weekend')(app) : H('list')(app);
    root.innerHTML = H('bar')(app) + '<div class="shell">' + H('menu')(app) + '<main class="view">' + body + '</main></div>' +
      '<button class="fab" data-act="champ" aria-label="Can Charles Leclerc still become champion?">' + RW.head() + '<span>Champion?</span></button>' +
      (st.menuOpen ? '<div class="scrim-m" data-act="menu"></div>' : '') +
      (st.pop ? '<div class="pop-layer" data-act="popclose" data-layer><div class="pop" role="dialog" aria-modal="true">' + H('popup')(app) + '</div></div>' : '') +
      (st.champ ? '<div class="champ-layer" data-act="champclose" data-layer><div class="champ" role="dialog" aria-modal="true">' + H('champion')(app) + '</div></div>' : '');
    var v2 = root.querySelector('.view'); if (v2) v2.scrollTop = top; var p2 = root.querySelector('.pop'); if (p2) p2.scrollTop = ptop;
    if (st.pop) fillWx(app);
  }
  var ACT = {
    menu: function (a) { a.state.menuOpen = !a.state.menuOpen; },
    series: function (a, el) { var id = el.getAttribute('data-s'); a.state.on[id] = !a.state.on[id]; },
    wcls: function (a, el) { a.state.wecCls = el.getAttribute('data-c'); },
    view: function (a, el) { a.state.view = el.getAttribute('data-v'); },
    mm: function (a, el) { a.state.month = addM(a.state.month, +el.getAttribute('data-n')); a.state.sel = null; },
    sel: function (a, el) { a.state.sel = el.getAttribute('data-d'); },
    open: function (a, el) { a.state.pop = { g: el.getAttribute('data-g'), d: el.getAttribute('data-d'), open: null }; },
    res: function (a, el) { a.state.pop = { g: el.getAttribute('data-g'), d: el.getAttribute('data-d'), open: el.getAttribute('data-sid') }; },
    popday: function (a, el) { a.state.pop = { g: el.getAttribute('data-g'), d: el.getAttribute('data-d'), open: null }; },
    popclose: function (a) { a.state.pop = null; },
    champ: function (a) { a.state.champ = true; },
    champclose: function (a) { a.state.champ = false; },
    clock: function (a) { a.state.clock = a.state.clock === 'viewer' ? 'circuit' : 'viewer'; },
    s2027: function (a) { a.state.s2027 = !a.state.s2027; },
    preset: function (a, el) { var p = RW.champBest[+el.getAttribute('data-p')].picks; a.state.picks = [{ LEC: p[0].LEC }, { LEC: p[1].LEC }]; var c = a.root.querySelector('.calc'); if (c) c.scrollIntoView({ block: 'nearest' }); }
  };
  function mount(el, mode) {
    var app = { root: el, state: mkState(mode), auto: mode === 'auto' };
    if (app.auto) { app.state.mode = el.clientWidth >= 860 ? 'wide' : 'narrow'; app.state.menuOpen = !!DIR.menuOpen && app.state.mode === 'wide'; }
    el.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-act]'); if (!t || !el.contains(t)) return;
      var act = t.getAttribute('data-act');
      if (t.hasAttribute('data-layer') && ev.target !== t) return;
      if (act === 'tz' || act === 'spoiler') return;
      var fn = (DIR.actions && DIR.actions[act]) || ACT[act]; if (!fn) return;
      if (t.tagName === 'A') return;
      if (t.closest('.cell.ev') && t !== t.closest('.cell.ev') && act !== 'open') ev.stopPropagation();
      fn(app, t, ev); render(app);
    });
    el.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { if (app.state.champ) app.state.champ = false; else if (app.state.pop) app.state.pop = null; else if (app.state.menuOpen) app.state.menuOpen = false; else return; render(app); } if (ev.key === 'Enter' && ev.target.classList.contains('cell')) { ev.target.click(); } });
    el.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.getAttribute('data-act') === 'tz') { app.state.tz = t.value; render(app); }
      else if (t.getAttribute('data-act') === 'spoiler') { app.state.spoiler = t.checked; render(app); }
    });
    el.addEventListener('input', function (ev) {
      var t = ev.target; if (!t.hasAttribute('data-pick')) return;
      app.state.picks[+t.getAttribute('data-r')][t.getAttribute('data-d')] = +t.value;
      if (t.type === 'range') { var o = t.parentNode.querySelector('output'); if (o) o.textContent = +t.value ? 'P' + t.value : 'out'; }
      var out = el.querySelector('[data-calc-out]'); if (out) out.innerHTML = H('champOut')(app);
    });
    if (app.auto && window.ResizeObserver) new ResizeObserver(function () { var m = el.clientWidth >= 860 ? 'wide' : 'narrow'; if (m !== app.state.mode && el.clientWidth > 0) { app.state.mode = m; if (m === 'narrow') app.state.menuOpen = false; render(app); } }).observe(el);
    apps.push(app); render(app); return app;
  }
  RW.mount = mount;
  RW.setSim = function (i) { G.sim = i; G.now = Date.parse(RW.sims[i].now); apps.forEach(function (a) { a.state.month = RW.sims[i].month; a.state.sel = null; a.state.pop = null; render(a); }); };
  RW.api = { D: D, H: H, esc: esc, hm: hm, ymd: ymd, fmtD: fmtD, addD: addD, bgHtml: bgHtml, locHtml: locHtml, rowsHtml: rowsHtml, eventsOn: eventsOn, groupItems: groupItems, stat: stat, timeParts: timeParts, resultRows: resultRows, leader: leader, CB: CB, SER: SER, activeGroups: activeGroups, todayOf: todayOf, monthLabel: monthLabel, PK: PK, PN: PN, getWx: getWx, G: G };
  if (DIR.init) DIR.init(RW.api);
})();
