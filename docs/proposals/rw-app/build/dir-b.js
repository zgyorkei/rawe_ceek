/* Direction B "Race poster": warm paper, black ink, one printed red and one deep blue, serif type. Hooks: weather (a forecast ribbon), popup (the close button moves first so it stays reachable), champion (an editorial article, no calculator). RW.wxIcon is redrawn as ink line icons. */
(function () {
  var API, INK = '#1b1713', RED = '#c8351f', BLUE = '#1d3b63', PAPER = '#f8f2e3';

  /* ink line weather icons, the sun in printed red and the rain in printed blue (same signature and svg class as the default) */
  window.RW.wxIcon = function (code) {
    var k = RW.wxKind(code), st = 'fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
    var sun = '<g ' + st + ' stroke="' + RED + '"><circle cx="16" cy="16" r="5.2" fill="' + PAPER + '"/><path d="M16 4.5v3.2M16 24.3v3.2M4.5 16h3.2M24.3 16h3.2M7.9 7.9l2.2 2.2M21.9 21.9l2.2 2.2M7.9 24.1l2.2-2.2M21.9 10.1l2.2-2.2"/></g>';
    var cloud = '<path ' + st + ' stroke="' + INK + '" fill="' + PAPER + '" d="M9 22.5a5 5 0 0 1 0-10 7 7 0 0 1 13.5-1.2A5.5 5.5 0 0 1 22 22.5z"/>';
    var s = {
      clear: sun,
      partly: '<g transform="translate(-4 -5) scale(.74)">' + sun + '</g><g transform="translate(2 4) scale(.88)">' + cloud + '</g>',
      cloud: cloud,
      fog: cloud + '<path ' + st + ' stroke="' + INK + '" d="M6 26h20M9.5 29.5h13"/>',
      rain: cloud + '<path ' + st + ' stroke="' + BLUE + '" d="M11 25l-1.6 4M16 25l-1.6 4M21 25l-1.6 4"/>',
      storm: cloud + '<path ' + st + ' stroke="' + RED + '" d="M17.5 21l-4.5 5h4.5l-2.5 4.5"/>',
      snow: cloud + '<g fill="' + BLUE + '"><circle cx="11" cy="26.5" r="1.7"/><circle cx="16" cy="29" r="1.7"/><circle cx="21" cy="26.5" r="1.7"/></g>'
    }[k];
    return '<svg class="wx" viewBox="0 0 32 32" aria-hidden="true">' + s + '</svg>';
  };

  window.RW_DIR = {
    id: 'b', letter: 'B', name: 'Race poster',
    tag: 'A printed race poster: warm paper, black ink, one red and one blue, serif headlines. Race days are small posters with the track drawn big in ink, the menu is a top sheet, the day is a printed programme and the champion window reads like a magazine article.',
    spoilerSwitch: false, spoilerDefault: false, chips: false, menuOpen: false, menuForm: 'top', cellMax: 5, calc: false,
    look: [
      '<b>Race days as posters.</b> On the PC window a race day is a small poster: the track outline big in ink, a faded corner picture behind it, the flag, the city in big type, the race name in capitals, and the sessions as a typeset programme with a Results link at the end of each line.',
      '<b>The top sheet.</b> Press the three line button in the top bar: a sheet slides down under the bar and covers the top of the calendar. Each series is a card with a line-drawn car and a stamp that says SHOWN or HIDDEN. On the phone the sheet is full width with two cards a row.',
      '<b>Click a race day.</b> A printed programme card opens in the middle. It has the city and date in big type, a programme table, and the weather as a forecast ribbon: one narrow column per hour with icon, temperature and rain chance, and the session hours underlined in red.',
      '<b>The Champion? badge</b> bottom right (a round paper badge with the head). It opens an article: the headline, the honest answer in the first paragraph, the sum in a box, three worked examples in three columns and the standings as a printed table. There is no calculator.',
      '<b>Weekend and List.</b> The weekend card is a broadsheet: a big venue header, then one column for each series with a small line-drawn car. In the list, the first tile of a weekend is a poster banner and the sessions follow as programme lines.'
    ],
    q: {
      menu: 'a top sheet that slides down under the bar: a grid of cards, each with a line-drawn car, the series name and a stamp for shown or hidden. On a phone it is full width with two cards a row and the calendar dimmed below.',
      pop: 'a printed programme card in the middle of the screen, with the weather as a forecast ribbon. On a phone the card fills the screen with a small margin and scrolls.',
      champ: 'an article with a big headline, the honest answer first, the sum in a box, three worked examples in columns and the standings as a printed table. There is no calculator.'
    },
    extra: [
      { id: 'poster', q: 'Poster tiles. On the PC window every race day is printed as a small poster: a big track outline in ink, a faded picture behind and the sessions as a programme. How much poster do you want in the calendar?', type: 'radio', opts: ['Posters as here', 'Calmer: a smaller outline and less ink', 'A plain cell is enough, the poster look only in the popup and the list'] },
      { id: 'paper', q: 'Colour. This page is warm paper with black ink, one printed red and one deep blue, and it has no dark mode. Is a light only app fine?', type: 'radio', opts: ['Yes, paper and ink only', 'Paper first, a dark option later', 'I prefer a dark app'] }
    ],
    hooks: {
      /* weather: a forecast ribbon, one narrow column per hour; session hours are underlined and tinted */
      weather: function (w, win, app) {
        var hrs = w.hours.filter(function (x) { var h = +x.h.slice(0, 2); return h >= win.from && h <= win.to; });
        if (!hrs.length) hrs = w.hours;
        var pops = hrs.map(function (x) { return x.pop; }).filter(function (x) { return x != null; });
        var temps = hrs.map(function (x) { return x.temp; }), tmin = Math.min.apply(null, temps), tmax = Math.max.apply(null, temps);
        var gust = Math.max.apply(null, hrs.map(function (x) { return x.gust; }));
        var badge = w.state === 'live' ? '<span class="badge ok">live call ok' + (w.archive ? ' (archive)' : '') + '</span>' : '<span class="badge bad">call failed, sample shown</span>';
        var ribbon = hrs.map(function (x) {
          var h = +x.h.slice(0, 2), ses = !!win.ses[h], p = x.pop == null ? 0 : Math.max(0, Math.min(100, x.pop));
          return '<div class="hr' + (ses ? ' ses' : '') + '"><span class="t">' + x.h + '</span>' + RW.wxIcon(x.code) + '<b>' + Math.round(x.temp) + '&deg;</b><span class="pp" style="--p:' + p + '">' + (x.pop == null ? 'n/a' : x.pop + '%') + '</span><span class="wd">' + Math.round(x.wind) + '</span></div>';
        }).join('');
        return '<h3>Weather at the track ' + badge + '</h3>' +
          '<p class="wsum">Temperature <b>' + Math.round(tmin) + ' to ' + Math.round(tmax) + ' &deg;C</b>; rain chance up to <b>' + (pops.length ? Math.max.apply(null, pops) + ' %' : 'n/a (archive)') + '</b>; gusts up to <b>' + Math.round(gust) + ' km/h</b>.</p>' +
          '<div class="strip" role="group" aria-label="Hourly forecast at the track, track time">' + ribbon + '</div>' +
          '<p class="wnote">Hours are track time; the underlined red hours have a session. In each column: the icon, the temperature, the chance of rain with a bar, and the wind in km/h at the bottom. Model value for the circuit point, not a trackside sensor; no asphalt temperature. Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>. Rain radar is not in v1 (open question below).</p>';
      },

      /* popup: the close button goes first so it can stay in view while the card scrolls */
      popup: function (app) {
        var h = API.D.popup(app), m = h.match(/<button class="x"[^>]*>[^<]*<\/button>/);
        if (!m) return h;
        return m[0] + h.replace(m[0], '');
      },

      /* champion: an editorial article in three bands (lead and equation, third place and standings, worked examples); no calculator */
      champion: function (app) {
        var CB = API.CB, x = '<button class="x" data-act="champclose" aria-label="Close">&times;</button>', body;
        if (app.state.s2027) body = '<div class="c-foot">' + CB.future(app) + CB.foot() + '</div>';
        else body = '<div class="c-lede">' + CB.headline() + '</div><div class="c-eq">' + CB.sum() + '</div>' +
          '<div class="c-third">' + CB.third() + '</div><div class="c-ladder">' + CB.ladder() + '</div>' +
          '<div class="c-ex"><h3 class="c-h">Three worked examples: what Leclerc could score in the last two races</h3>' + CB.examples() + '</div>' +
          '<div class="c-foot">' + CB.future(app) + CB.foot() + '</div>';
        return x + '<p class="kick">The title sum, explained</p><h2>Can Charles Leclerc still be champion?</h2><div class="chb">' + body + '</div>';
      }
    },
    init: function (api) { API = api; }
  };
})();
