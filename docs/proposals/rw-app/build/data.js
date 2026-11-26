/* RW sample data. REAL = taken from the research note, Jolpica (F1 times) or F1DB (outlines). SAMPLE = invented in the same shape, labelled on the page. */
window.RW = window.RW || {};
(function (RW) {
  RW.series = [
    { id: 'f1', name: 'Formula 1', short: 'F1', color: '#d40000' },
    { id: 'f2', name: 'Formula 2', short: 'F2', color: '#1c5fd8' },
    { id: 'f3', name: 'Formula 3', short: 'F3', color: '#ff7a00' },
    { id: 'f1a', name: 'F1 Academy', short: 'F1A', color: '#ffd500', note: 'team look: brick racing #32 (yellow, black, thin pink and light blue)' },
    { id: 'wec', name: 'WEC', short: 'WEC', color: '#c4161c', note: 'Hypercar #50 and #51; class switch Hypercar / LMGT3' },
    { id: 'fe', name: 'Formula E', short: 'FE', color: '#8a93a3', note: 'sixth series; facts come from RW.RESEARCH.FE, plain stand-in until then' }
  ];
  RW.zones = [['Europe/Budapest', 'Budapest (CET)'], ['Europe/London', 'London'], ['America/New_York', 'New York'], ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney']];
  RW.outlines = RW.outlines || {};

  /* session helper: id, kind(practice|quali|sprint|race), name, startUtc, minutes, class(all|hypercar|lmgt3), extra */
  function S(kind, name, start, min, cls, x) {
    var s = { kind: kind, name: name, startUtc: start, endUtc: new Date(Date.parse(start) + min * 60000).toISOString(), cls: cls || 'all', conf: 'confirmed' };
    if (x) for (var k in x) s[k] = x[k];
    return s;
  }
  var VEN = {
    silverstone: { key: 'silverstone', city: 'Silverstone', country: 'United Kingdom', cc: 'gb', tz: 'Europe/London', lat: 52.0786, lon: -1.01694, outline: 'silverstone-8', circuit: 'Silverstone Circuit', corner: { scene: 'esses', cap: 'Stand-in picture. Idea for the real one: Maggotts and Becketts' } },
    monza: { key: 'monza', city: 'Monza', country: 'Italy', cc: 'it', tz: 'Europe/Rome', lat: 45.6156, lon: 9.2811, outline: 'monza-7', circuit: 'Autodromo Nazionale Monza', corner: { scene: 'curve', cap: 'Stand-in picture. Idea for the real one: Parabolica' } },
    vegas: { key: 'vegas', city: 'Las Vegas', country: 'United States', cc: 'us', tz: 'America/Los_Angeles', lat: 36.1147, lon: -115.1728, outline: 'las-vegas-1', circuit: 'Las Vegas Strip Circuit', corner: { scene: 'straight', cap: 'Stand-in picture. Idea for the real one: the Strip straight' } },
    lusail: { key: 'lusail', city: 'Lusail', country: 'Qatar', cc: 'qa', tz: 'Asia/Qatar', lat: 25.49, lon: 51.4542, outline: 'lusail-1', circuit: 'Lusail International Circuit', corner: { scene: 'hairpin', cap: 'Stand-in picture. Real corner to be chosen in the corner review' } },
    yas: { key: 'yas', city: 'Abu Dhabi', country: 'United Arab Emirates', cc: 'ae', tz: 'Asia/Dubai', lat: 24.4672, lon: 54.6031, outline: 'yas-marina-2', circuit: 'Yas Marina Circuit', corner: { scene: 'bridge', cap: 'Stand-in picture. Idea for the real one: the hotel section' } },
    fe1: { key: 'fe1', city: 'Sample City', country: 'Stand-in venue', cc: 'xx', tz: 'Europe/Berlin', lat: 52.52, lon: 13.405, outline: 'silverstone-8', circuit: 'Stand-in street circuit', stand: true, corner: { scene: 'chicane', cap: 'Stand-in picture and stand-in venue, until RW.RESEARCH.FE' } }
  };
  RW.venues = VEN;

  var TOP = {
    f1a_lv: { fp: [{ pos: 1, who: 'Palmowski', real: 1 }], q: [{ pos: 1, who: 'Palmowski', real: 1 }], rg: [{ pos: 1, who: 'Larsen', real: 1 }], f: [{ pos: 1, who: 'Palmowski', real: 1 }] },
    wec_monza: { hypercar: [{ pos: 1, who: 'Cadillac #38', real: 1 }, { pos: 3, who: 'Ferrari #51', real: 1 }, { pos: 9, who: 'Ferrari #50', real: 1 }], lmgt3: [] }
  };

  RW.weekends = [
    { id: 'f1-09', series: 'f1', season: 2026, round: 9, name: 'BRITISH GRAND PRIX', ven: 'silverstone', source: 'Jolpica (times, real); results SAMPLE', sample: false, updated: '2026-11-26 11:20 UTC', sessions: [
      S('practice', 'Practice 1', '2026-07-03T11:30:00Z', 60), S('quali', 'Sprint Qualifying', '2026-07-03T15:30:00Z', 45),
      S('sprint', 'Sprint', '2026-07-04T11:00:00Z', 40), S('quali', 'Qualifying', '2026-07-04T15:00:00Z', 60), S('race', 'Race', '2026-07-05T14:00:00Z', 110)] },
    { id: 'f2-07', series: 'f2', season: 2026, round: 7, name: 'Sprint and Feature weekend', ven: 'silverstone', source: 'SAMPLE (shape of the F2 data; times invented)', sample: true, updated: 'sample', sessions: [
      S('practice', 'Practice', '2026-07-03T09:30:00Z', 45), S('quali', 'Qualifying', '2026-07-03T13:35:00Z', 30),
      S('sprint', 'Sprint Race', '2026-07-04T09:25:00Z', 45), S('race', 'Feature Race', '2026-07-05T10:35:00Z', 60)] },
    { id: 'f3-05', series: 'f3', season: 2026, round: 5, name: 'Sprint and Feature weekend', ven: 'silverstone', source: 'SAMPLE (shape of the F3 data; times invented)', sample: true, updated: 'sample', sessions: [
      S('practice', 'Practice', '2026-07-03T07:30:00Z', 40), S('quali', 'Qualifying', '2026-07-03T09:00:00Z', 30),
      S('sprint', 'Sprint Race', '2026-07-04T07:45:00Z', 40), S('race', 'Feature Race', '2026-07-05T08:30:00Z', 45)] },
    { id: 'f1a-03', series: 'f1a', season: 2026, round: 3, name: 'Reverse Grid and Feature weekend', ven: 'silverstone', source: 'SAMPLE (shape of the F1 Academy data; times invented)', sample: true, updated: 'sample', sessions: [
      S('practice', 'Free Practice', '2026-07-02T13:00:00Z', 40), S('quali', 'Qualifying', '2026-07-02T15:30:00Z', 30),
      S('sprint', 'Reverse Grid Race', '2026-07-03T10:15:00Z', 30), S('race', 'Feature Race', '2026-07-04T12:45:00Z', 40)] },
    { id: 'fe-st1', series: 'fe', season: 2026, round: 0, name: 'STAND-IN E-PRIX (double-header)', ven: 'fe1', source: 'STAND-IN (the real Formula E facts come from RW.RESEARCH.FE)', sample: true, updated: 'stand-in', sessions: [
      S('practice', 'Practice', '2026-07-04T08:00:00Z', 45), S('quali', 'Qualifying', '2026-07-04T11:40:00Z', 30), S('race', 'Race 1', '2026-07-04T14:03:00Z', 45),
      S('practice', 'Practice', '2026-07-05T08:00:00Z', 45), S('quali', 'Qualifying', '2026-07-05T11:40:00Z', 30), S('race', 'Race 2', '2026-07-05T14:03:00Z', 45)] },

    { id: 'wec-08', series: 'wec', season: 2026, round: 8, name: '6 Hours of Monza', ven: 'monza', source: 'research note (times and results real)', sample: false, updated: '2026-11-08 17:40 UTC', sessions: [
      S('practice', 'Free Practice 1', '2026-11-06T09:30:00Z', 90), S('practice', 'Free Practice 2', '2026-11-06T13:30:00Z', 90), S('practice', 'Free Practice 3', '2026-11-07T09:30:00Z', 60),
      S('quali', 'Qualifying LMGT3', '2026-11-07T13:20:00Z', 10, 'lmgt3'), S('quali', 'Hyperpole LMGT3', '2026-11-07T13:40:00Z', 10, 'lmgt3'),
      S('quali', 'Qualifying Hypercar', '2026-11-07T14:00:00Z', 10, 'hypercar'), S('quali', 'Hyperpole Hypercar', '2026-11-07T14:20:00Z', 10, 'hypercar'),
      S('race', 'Race, 6 hours', '2026-11-08T10:00:00Z', 360, 'all', { byClass: TOP.wec_monza })] },

    { id: 'f1-21', series: 'f1', season: 2026, round: 21, name: 'LAS VEGAS GRAND PRIX', ven: 'vegas', source: 'Jolpica (times, real); results SAMPLE', sample: false, updated: '2026-11-22 07:10 UTC', sessions: [
      S('practice', 'Practice 1', '2026-11-20T00:30:00Z', 60), S('practice', 'Practice 2', '2026-11-20T04:00:00Z', 60), S('practice', 'Practice 3', '2026-11-21T00:30:00Z', 60),
      S('quali', 'Qualifying', '2026-11-21T04:00:00Z', 60), S('race', 'Race', '2026-11-22T04:00:00Z', 110)] },
    { id: 'f1a-06', series: 'f1a', season: 2026, round: 6, name: 'Reverse Grid and Feature weekend', ven: 'vegas', source: 'research note (times and leaders real)', sample: false, updated: '2026-11-22 03:30 UTC', sessions: [
      S('practice', 'Free Practice', '2026-11-20T02:00:00Z', 40, 'all', { top: TOP.f1a_lv.fp }), S('quali', 'Qualifying', '2026-11-20T05:30:00Z', 30, 'all', { top: TOP.f1a_lv.q }),
      S('sprint', 'Reverse Grid Race', '2026-11-21T02:15:00Z', 30, 'all', { top: TOP.f1a_lv.rg }), S('race', 'Feature Race', '2026-11-22T00:20:00Z', 40, 'all', { top: TOP.f1a_lv.f })] },

    { id: 'f1-22', series: 'f1', season: 2026, round: 22, name: 'QATAR GRAND PRIX', ven: 'lusail', source: 'research note and Jolpica (times, real)', sample: false, updated: '2026-11-26 11:20 UTC', sessions: [
      S('practice', 'Practice 1', '2026-11-27T13:30:00Z', 60), S('practice', 'Practice 2', '2026-11-27T17:00:00Z', 60), S('practice', 'Practice 3', '2026-11-28T14:30:00Z', 60),
      S('quali', 'Qualifying', '2026-11-28T18:00:00Z', 60), S('race', 'Race', '2026-11-29T16:00:00Z', 110)] },
    { id: 'f2-13', series: 'f2', season: 2026, round: 13, name: 'Sprint and Feature weekend', ven: 'lusail', source: 'research note (times real)', sample: false, updated: '2026-11-26 11:20 UTC', sessions: [
      S('practice', 'Practice', '2026-11-27T11:00:00Z', 45), S('quali', 'Qualifying', '2026-11-27T15:00:00Z', 30),
      S('sprint', 'Sprint Race', '2026-11-28T16:15:00Z', 45), S('race', 'Feature Race', '2026-11-29T12:00:00Z', 60)] },

    { id: 'f1-23', series: 'f1', season: 2026, round: 23, name: 'ABU DHABI GRAND PRIX', ven: 'yas', source: 'Jolpica (times, real)', sample: false, updated: '2026-11-26 11:20 UTC', sessions: [
      S('practice', 'Practice 1', '2026-12-04T09:30:00Z', 60), S('practice', 'Practice 2', '2026-12-04T13:00:00Z', 60), S('practice', 'Practice 3', '2026-12-05T10:30:00Z', 60),
      S('quali', 'Qualifying', '2026-12-05T14:00:00Z', 60), S('race', 'Race', '2026-12-06T13:00:00Z', 110)] },
    { id: 'f2-14', series: 'f2', season: 2026, round: 14, name: 'Sprint and Feature weekend', ven: 'yas', source: 'research note: placeholder 00:00 times, time to be confirmed', sample: false, updated: '2026-11-26 11:20 UTC', sessions: [
      S('practice', 'Practice', '2026-12-03T20:00:00Z', 45, 'all', { conf: 'placeholder' }), S('quali', 'Qualifying', '2026-12-03T20:00:00Z', 30, 'all', { conf: 'placeholder' }),
      S('sprint', 'Sprint Race', '2026-12-04T20:00:00Z', 45, 'all', { conf: 'placeholder' }), S('race', 'Feature Race', '2026-12-05T20:00:00Z', 60, 'all', { conf: 'placeholder' })] }
  ];
  RW.weekends.forEach(function (w) { w.sessions.forEach(function (s, i) { s.id = w.id + '-' + i; s.wid = w.id; s.series = w.series; }); });

  /* simulated "today" choices; the app clock is a UTC instant */
  RW.sims = [
    { id: 'between', label: 'Thu 26 Nov 2026', sub: 'between weekends: month view', now: '2026-11-26T10:00:00Z', month: '2026-11' },
    { id: 'qatar', label: 'Fri 27 Nov 2026', sub: 'Qatar weekend: weekend card', now: '2026-11-27T12:00:00Z', month: '2026-11' },
    { id: 'silverstone', label: 'Sat 4 Jul 2026', sub: 'Silverstone: two weekend cards', now: '2026-07-04T12:00:00Z', month: '2026-07' },
    { id: 'monza', label: 'Sat 7 Nov 2026', sub: 'WEC weekend card', now: '2026-11-07T12:00:00Z', month: '2026-11' }
  ];

  /* champion window: standings after round 21 (research section 7), fetched 2026-11-26 */
  RW.champ = {
    asOf: 'after round 21 (Las Vegas), 26 Nov 2026', left: [{ n: 'Qatar', d: '29 Nov' }, { n: 'Abu Dhabi', d: '6 Dec' }],
    pts: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    drivers: [
      { id: 'ANT', name: 'Antonelli', pts: 402, w: 9, s: 3, t: 4 }, { id: 'VER', name: 'Verstappen', pts: 304, w: 4, s: 5, t: 4 },
      { id: 'HAM', name: 'Hamilton', pts: 267, w: 1, s: 3, t: 3 }, { id: 'RUS', name: 'Russell', pts: 264, w: 3, s: 4, t: 1 },
      { id: 'NOR', name: 'Norris', pts: 264, w: 3, s: 2, t: 2 }, { id: 'LEC', name: 'Leclerc', pts: 250, w: 1, s: 3, t: 2, me: 1 },
      { id: 'PIA', name: 'Piastri', pts: 167, w: 0, s: 1, t: 2 }
    ]
  };
  /* what-if: picks = [{LEC:place, HAM:place, RUS:place, NOR:place}, {...}] with place 1..10, or 0 for outside the points */
  RW.whatif = function (picks) {
    var C = RW.champ, rows = C.drivers.map(function (d) { return { id: d.id, name: d.name, pts: d.pts, w: d.w, s: d.s, t: d.t, me: d.me, add: 0 }; });
    var by = {}; rows.forEach(function (r) { by[r.id] = r; });
    var dup = [];
    picks.forEach(function (race, ri) {
      var seen = {};
      Object.keys(race).forEach(function (id) {
        var p = race[id]; if (!p) return;
        if (seen[p]) dup.push('Race ' + (ri + 1) + ': place ' + p + ' is taken by two drivers'); seen[p] = id;
        var r = by[id]; r.pts += C.pts[p - 1]; r.add += C.pts[p - 1]; if (p === 1) r.w++; if (p === 2) r.s++; if (p === 3) r.t++;
      });
    });
    rows.sort(function (a, b) { return b.pts - a.pts || b.w - a.w || b.s - a.s || b.t - a.t; });
    rows.forEach(function (r, i) { r.rank = i + 1; });
    return { rows: rows, dup: dup, lec: by.LEC };
  };
  RW.champBest = [
    { title: 'Win both races', lec: 300, note: 'Hamilton must not take 2nd twice. Russell and Norris must not take 2nd twice.', picks: [{ LEC: 1 }, { LEC: 1 }] },
    { title: 'Win, then 2nd', lec: 293, note: 'Hamilton may add at most 26 points, Russell and Norris at most 28.', picks: [{ LEC: 1 }, { LEC: 2 }] },
    { title: '2nd and 2nd', lec: 286, note: 'Hamilton may add at most 19 points, Russell and Norris at most 21.', picks: [{ LEC: 2 }, { LEC: 2 }] }
  ];
})(window.RW);
