/* Direction A "Pit wall": a dark timing screen. Hooks: menu (adds the series code for the folded rail), weekendCard (moves the picture into the header), weather (dense hourly table). RW.wxIcon is redrawn as thin line icons. */
(function () {
  var AMB = '#ffb62e', CY = '#38d6ea', GR = '#aeb9c5';

  /* thin line weather icons in timing colours (same signature and svg class as the default) */
  window.RW.wxIcon = function (code) {
    var k = RW.wxKind(code), st = 'fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var sun = '<g ' + st + ' stroke="' + AMB + '"><circle cx="16" cy="16" r="5"/><path d="M16 5v3M16 24v3M5 16h3M24 16h3M8.2 8.2l2.1 2.1M21.7 21.7l2.1 2.1M8.2 23.8l2.1-2.1M21.7 10.3l2.1-2.1"/></g>';
    var cloud = '<path ' + st + ' stroke="' + GR + '" d="M9 23a5 5 0 0 1 0-10 7 7 0 0 1 13.5-1.5A5.5 5.5 0 0 1 22 23z"/>';
    var s = {
      clear: sun,
      partly: '<g transform="translate(-4 -5) scale(.7)">' + sun + '</g><g transform="translate(2 3) scale(.88)">' + cloud + '</g>',
      cloud: cloud,
      fog: cloud + '<path ' + st + ' stroke="' + GR + '" d="M7 25h18M10 28.5h12"/>',
      rain: cloud + '<path ' + st + ' stroke="' + CY + '" d="M11 25l-1.5 4M16 25l-1.5 4M21 25l-1.5 4"/>',
      storm: cloud + '<path ' + st + ' stroke="' + AMB + '" d="M17 21l-4 5h4l-2 4"/>',
      snow: cloud + '<g fill="#e9eef3"><circle cx="11" cy="26.5" r="1.5"/><circle cx="16" cy="28.5" r="1.5"/><circle cx="21" cy="26.5" r="1.5"/></g>'
    }[k];
    return '<svg class="wx" viewBox="0 0 32 32" aria-hidden="true">' + s + '</svg>';
  };

  window.RW_DIR = {
    id: 'a', letter: 'A', name: 'Pit wall',
    tag: 'A dark timing screen: near black panels, thin one pixel rules, monospace times and points, and the green, amber, magenta and cyan of a timing tower. Dense rows, a left rail for the series, a side sheet for the day.',
    spoilerSwitch: true, spoilerDefault: false, chips: true, menuOpen: true, menuForm: 'rail', cellMax: 5,
    look: [
      '<b>The series rail on the left.</b> Press the three line button in the top bar: the rail folds to the small car and the series code only. On the phone the same menu is a drawer from the left.',
      '<b>Month cells as data tiles.</b> Flag, city, race name, the track outline and a faded corner picture behind, then one table row per session with a thin series colour bar, a monospace time and a Results button.',
      '<b>Click a race day.</b> A side sheet opens on the right (a bottom sheet on the phone) with the program and the hourly weather as a table: hour, icon, temperature, rain chance, wind. Session hours are amber.',
      '<b>The Champion? button</b> bottom right: a centred panel (full screen on the phone) with the sum in a monospace box, the standings and gap table, three worked examples and the calculator with selects.'
    ],
    q: {
      menu: 'a persistent left rail: cars with names and shown or hidden when open, only the small car and the series code when folded (a drawer from the left on a phone).',
      pop: 'a side sheet on the right over the dimmed calendar on PC, and a bottom sheet of about 90 percent of the height on a phone.',
      champ: 'a centred panel on PC and a full screen on a phone, with the standings and gap table and a calculator made of selects.'
    },
    extra: [
      { id: 'dense', q: 'Density. The month cells and session rows here are dense data rows: series code, time, name and a Results button, with one thin colour bar per series. How dense do you want the calendar?', type: 'radio', opts: ['As dense as here', 'More air, fewer rows in a cell', 'Even denser: only code and time, the rest on click'] },
      { id: 'dark', q: 'Colour. This page is a dark timing screen only: near black, thin lines, green, amber, magenta and cyan accents. Is a dark only app fine?', type: 'radio', opts: ['Yes, dark only', 'Dark first, a light option later', 'I prefer a light app'] }
    ],
    /* the engine builds the state before it knows the width ('auto'), so the menuOpen switch never opens the rail at start: press the hamburger once after mounting a wide frame */
    init: function () {
      var mount = RW.mount;
      RW.mount = function (el, mode) {
        var app = mount(el, mode), hb = el.querySelector('.hb');
        if (app.state.mode === 'wide' && !app.state.menuOpen && hb) hb.click();
        return app;
      };
    },
    hooks: {
      /* the menu with the series code (shown only when the rail is folded) */
      menu: function (app) {
        var A = RW.api, st = app.state, esc = A.esc;
        return '<nav class="menu" aria-label="Series"><div class="menu-h">Series</div><ul>' + RW.series.map(function (s) {
          var on = st.on[s.id];
          return '<li class="si ' + (on ? 'on' : 'off') + '" style="--c:' + s.color + '"><button data-act="series" data-s="' + s.id + '" aria-pressed="' + on + '" title="' + esc(s.name) + (on ? ', shown' : ', hidden') + '"><span class="cw">' + RW.car(s.id) + '</span><span class="cd">' + esc(s.short) + '</span><span class="nm">' + s.name + '</span><span class="tg">' + (on ? 'shown' : 'hidden') + '</span></button>' +
            (s.id === 'wec' ? '<div class="cls"><button data-act="wcls" data-c="hypercar" class="' + (st.wecCls === 'hypercar' ? 'on' : '') + '">Hypercar</button><button data-act="wcls" data-c="lmgt3" class="' + (st.wecCls === 'lmgt3' ? 'on' : '') + '">LMGT3</button></div>' : '') +
            (s.id === 'fe' ? '<div class="sn">stand-in until RW.RESEARCH.FE</div>' : '') + '</li>';
        }).join('') + '</ul><p class="menu-f">Unofficial. Not associated with the Formula 1 companies, the FIA, Ferrari, the LEGO Group, any team, driver or series.</p></nav>';
      },

      /* weekend card: the picture moves into the header so it only sits behind the title block */
      weekendCard: function (g, app, k, n) {
        var h = RW.api.D.weekendCard(g, app, k, n);
        return h.replace(/(<article class="wcard"[^>]*>)(<div class="bg">[\s\S]*?<\/div>)(<header class="wh">)([\s\S]*?)(<\/header>)/, '$1$3$2$4$5');
      },

      /* weather: a dense hourly table, session hours highlighted */
      weather: function (w, win, app) {
        var hrs = w.hours.filter(function (x) { var h = +x.h.slice(0, 2); return h >= win.from && h <= win.to; });
        if (!hrs.length) hrs = w.hours;
        var pops = hrs.map(function (x) { return x.pop; }).filter(function (x) { return x != null; });
        var temps = hrs.map(function (x) { return x.temp; }), tmin = Math.min.apply(null, temps), tmax = Math.max.apply(null, temps);
        var gust = Math.max.apply(null, hrs.map(function (x) { return x.gust; }));
        var badge = w.state === 'live' ? '<span class="badge ok">live call ok' + (w.archive ? ' (archive)' : '') + '</span>' : '<span class="badge bad">call failed, sample shown</span>';
        var rows = hrs.map(function (x) {
          var h = +x.h.slice(0, 2), ses = !!win.ses[h];
          return '<tr class="' + (ses ? 'ses' : '') + '"><th scope="row">' + x.h + (ses ? '<span class="vh"> session hour</span>' : '') + '</th><td>' + RW.wxIcon(x.code) + '</td><td class="n">' + Math.round(x.temp) + '&deg;</td><td class="n pp">' +
            (x.pop == null ? 'n/a' : '<span class="pb"><i style="width:' + Math.max(0, Math.min(100, x.pop)) + '%"></i></span>' + x.pop + '%') + '</td><td class="n">' + Math.round(x.wind) + '</td></tr>';
        }).join('');
        return '<h3>Weather at the track ' + badge + '</h3>' +
          '<p class="wsum"><span>Temperature <b>' + Math.round(tmin) + ' to ' + Math.round(tmax) + ' &deg;C</b></span><span>Rain chance up to <b>' + (pops.length ? Math.max.apply(null, pops) + ' %' : 'n/a (archive)') + '</b></span><span>Gusts up to <b>' + Math.round(gust) + ' km/h</b></span></p>' +
          '<table class="wxt"><caption class="vh">Hourly weather at the track, track time</caption><thead><tr><th scope="col">Hour</th><th scope="col">Sky</th><th scope="col" class="n">Temp</th><th scope="col" class="n">Rain chance</th><th scope="col" class="n">Wind km/h</th></tr></thead><tbody>' + rows + '</tbody></table>' +
          '<p class="wnote">Hours are track time; shaded hours have a session. Wind in km/h. Model value for the circuit point, not a trackside sensor; no asphalt temperature. Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>. Rain radar is not in v1 (open question below).</p>';
      }
    }
  };
})();
