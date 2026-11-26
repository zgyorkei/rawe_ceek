/* RW page shell: header, device and simulated-today controls, the two frames, legend, open questions, credits. Uses window.RW_DIR for the text of one direction. */
(function () {
  var RW = window.RW, DIR = window.RW_DIR, root = document.getElementById('pg'), esc = RW.api.esc;
  var FILES = [['A', 'a-pit-wall.html', 'Pit wall'], ['B', 'b-race-poster.html', 'Race poster'], ['C', 'c-brick-plate.html', 'Brick plate'], ['D', 'd-night-glass.html', 'Night glass']];
  var Q = [];
  Q.push({ id: 'pick', q: 'Direction ' + DIR.letter + ' (' + DIR.name + '): what do we do with it?', type: 'radio', opts: ['Build the app in this direction as it is', 'Build it in this direction with the changes in my comment', 'Not this direction'] });
  Q.push({ id: 'spoiler', q: 'Hide-the-winners switch. ' + (DIR.spoilerSwitch ? 'This page shows a "Hide winners" switch in the top bar (top right). With it on, no winner name appears anywhere before you open a result.' : 'This page has no switch: ' + (DIR.chips ? 'winner names show on finished sessions.' : 'winner names never show outside the result view.')) + ' What do you want in the app?', type: 'radio', opts: ['A switch, winners hidden by default', 'A switch, winners shown by default', 'No switch, winners always shown', 'No switch, winners only inside the result view'] });
  Q.push({ id: 'menu', q: 'Series menu. This page uses ' + DIR.q.menu + ' Is that the form you want?', type: 'radio', opts: ['Keep this form', 'A plain text list is enough', 'Prefer another form (say which)'] });
  Q.push({ id: 'clock', q: 'Which time is big in the calendar and list: your time or the track\'s time?', type: 'radio', opts: ['Your time big, track time small (as here)', 'Track time big, your time small', 'The user chooses, with a switch (as here)', 'Your time only'] });
  Q.push({ id: 'popup', q: 'Day detail. This page uses ' + DIR.q.pop + ' Is that the form you want?', type: 'radio', opts: ['Keep this form', 'A centred window on every device', 'Side panel on PC and full screen on phone', 'A page of its own (no window)'] });
  Q.push({ id: 'weather', q: 'Weather detail. The hourly view runs from 1 hour before the first session to 1 hour after the last. How much per hour?', type: 'radio', opts: ['Compact: icon, temperature, rain chance', 'As here: plus wind', 'More: plus gusts, humidity and rain amount'] });
  Q.push({ id: 'radar', q: 'Rain radar (a moving map of the rain around the track) is out of version 1 and still open. What should we do with it?', type: 'radio', opts: ['Leave it out of version 1 (recommended)', 'Put it in version 1 (needs another service and more time)', 'Later version, keep it on the list'] });
  Q.push({ id: 'champ', q: 'Champion window. This page uses ' + DIR.q.champ + ' What should it have?', type: 'radio', opts: ['This form as it is', 'The worked examples only, no calculator', 'The calculator only', 'Both examples and calculator'] });
  Q.push({ id: 'fe', q: 'Formula E car. It is a plain grey stand-in until the Formula E research is done. What look do you want for it?', type: 'radio', opts: ['Plain grey until the research', 'Electric blue', 'Purple', 'Decide after the research'] });
  Q.push({ id: 'twoc', q: 'Weekend card on a phone when two venues race the same weekend (Silverstone and the Formula E stand-in, "Sat 4 Jul 2026" above). How do the two cards show?', type: 'radio', opts: ['Stacked, one under the other (as here)', 'Swiped sideways, one at a time', 'One card with a venue switch'] });
  (DIR.extra || []).forEach(function (x) { Q.push(x); });
  Q.push({ id: 'keep', q: 'Which parts of this direction do you want to keep, even if you pick another one?', type: 'checkbox', opts: ['Series menu', 'Month calendar', 'Day cells (flag, track silhouette)', 'Day detail window', 'Race list', 'Weekend card', 'Champion window', 'Floating button and head', 'Colours and type', 'Car and flag drawings'] });

  function qHtml(q, i) {
    return '<section class="q" data-q="' + q.id + '"><h3><span>Q' + (i + 1) + '</span>' + esc(q.q) + '</h3><div class="opts">' + q.opts.map(function (o, k) {
      return '<label><input type="' + q.type + '" name="q-' + q.id + '" value="' + esc(o) + '"><span>' + esc(o) + '</span></label>';
    }).join('') + '</div><label class="cm"><span>Comment (optional)</span><textarea rows="2" placeholder="Anything you want to add about this question"></textarea></label></section>';
  }
  var h = '';
  h += '<header class="pg-h"><div><p class="pg-k">rawe_ceek · racing calendar · design direction ' + DIR.letter + ' of 4</p><h1>' + esc(DIR.name) + '</h1><p class="pg-t">' + esc(DIR.tag) + '</p></div><nav class="pg-nav" aria-label="The four directions">' + FILES.map(function (f) { return '<a href="' + f[1] + '"' + (f[0] === DIR.letter ? ' class="on" aria-current="page"' : '') + '><b>' + f[0] + '</b> ' + f[2] + '</a>'; }).join('') + '</nav></header>';
  h += '<section class="pg-c"><div class="pg-cg"><span>Window</span><button data-dev="pc">PC window</button><button data-dev="phone">Phone</button><button data-dev="both" class="on">Both</button></div><div class="pg-cg"><span>Simulated today</span>' + RW.sims.map(function (s, i) { return '<button data-sim="' + i + '" class="' + (i ? '' : 'on') + '" title="' + esc(s.sub) + '">' + esc(s.label) + '</button>'; }).join('') + '</div><p class="pg-n">Simulated today moves only the app clock (cells, "in 2 h", weekend card). The weather call uses the real date. Click anything in the frames: it works.</p></section>';
  h += '<div class="pg-frames"><figure class="fw pc"><figcaption>PC-sized window</figcaption><div class="frame"><div class="rw" id="rw-pc"></div></div></figure><figure class="fw phone"><figcaption>Phone</figcaption><div class="frame"><div class="rw" id="rw-ph"></div></div></figure></div>';
  h += '<section class="pg-info"><div><h2>What to look at</h2><ul>' + DIR.look.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div><div><h2>What is real on this page</h2><ul><li><b>REAL</b>: Silverstone F1 times (Jolpica), Qatar, Abu Dhabi and Las Vegas F1 times (Jolpica), the WEC Monza times and results, Las Vegas and Qatar series times from the research note, the standings of the champion window, the track outlines (Formula One Database).</li><li><b>SAMPLE</b>: results rows the research does not list; Silverstone F2, F3 and F1 Academy times (invented to show a full weekend); the weather call falls back to a sample, with a visible badge, if it cannot be reached.</li><li><b>STAND-IN</b>: the corner pictures (generic drawings, you review the 30 real corners first), all cars and flags (hand-drawn, no logos), the Leclerc head (brick-style stand-in, Blender comes later), the Formula E round (a made-up "Sample City" E-Prix).</li></ul></div></section>';
  h += '<section class="pg-q"><h2>Open questions</h2><p class="pg-n">Pick what you like, add a comment to any question (optional), then copy or save the answers.</p><form id="qform" onsubmit="return false">' + Q.map(qHtml).join('') + '<section class="q" data-q="more"><h3><span>Last</span>Additional comments</h3><label class="cm"><span>Anything else (optional)</span><textarea rows="4" placeholder="Anything else you want to tell us"></textarea></label></section></form><div class="pg-act"><button id="q-copy">Copy answers</button><button id="q-save">Save as .txt</button><span id="q-st" role="status"></span></div><details><summary>Preview of the text</summary><pre id="q-prev"></pre></details></section>';
  h += '<footer class="pg-f"><p>Unofficial fan-made design study. Not associated with the Formula 1 companies, the FIA, Ferrari, the LEGO Group, any team, driver or series. No logos or wordmarks of any series, team or sponsor appear on this page.</p><p>Track outlines: <a href="https://github.com/f1db/f1db" target="_blank" rel="noopener">Formula One Database (F1DB)</a>, CC BY 4.0. Weather data by <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a>. Session times: Jolpica F1 API (CC BY-NC-SA 4.0) and the research note of 26 Nov 2026. Formula E facts come later (RW.RESEARCH.FE). WEC: Hypercar is the default class, LMGT3 is a switch in the menu.</p></footer>';
  root.className = 'pg'; root.setAttribute('data-dev', 'both'); root.innerHTML = h;

  RW.mount(document.getElementById('rw-pc'), 'auto'); RW.mount(document.getElementById('rw-ph'), 'auto');
  root.addEventListener('click', function (ev) {
    var b = ev.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-dev')) { root.setAttribute('data-dev', b.getAttribute('data-dev')); [].forEach.call(root.querySelectorAll('[data-dev]'), function (x) { if (x.tagName === 'BUTTON') x.classList.toggle('on', x === b); }); }
    if (b.hasAttribute('data-sim')) { RW.setSim(+b.getAttribute('data-sim')); [].forEach.call(root.querySelectorAll('[data-sim]'), function (x) { x.classList.toggle('on', x === b); }); }
  });
  function collect() {
    var out = ['rawe_ceek design answers: direction ' + DIR.letter + ' (' + DIR.name + '), ' + new Date().toISOString().slice(0, 10), ''];
    [].forEach.call(root.querySelectorAll('.q'), function (s, i) {
      var id = s.getAttribute('data-q'), q = Q.filter(function (x) { return x.id === id; })[0], ch = [].map.call(s.querySelectorAll('input:checked'), function (x) { return x.value; }), cm = s.querySelector('textarea').value.trim();
      out.push(q ? 'Q' + (Q.indexOf(q) + 1) + '. ' + q.q : 'Additional comments');
      if (q) out.push('Answer: ' + (ch.length ? ch.join('; ') : '(no choice)'));
      out.push((q ? 'Comment on Q' + (Q.indexOf(q) + 1) + ': ' : 'Text: ') + (cm || '(none)')); out.push('');
    });
    return out.join('\n');
  }
  var prev = document.getElementById('q-prev'), st = document.getElementById('q-st');
  function upd() { prev.textContent = collect(); }
  root.addEventListener('input', upd); root.addEventListener('change', upd); upd();
  document.getElementById('q-copy').addEventListener('click', function () {
    var t = collect();
    function done(ok) { st.textContent = ok ? 'Copied ' + t.length + ' characters.' : 'Copy was blocked: open "Preview of the text" and copy from there.'; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { done(true); }, function () { var x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } document.body.removeChild(x); done(ok); });
    else { var x = document.createElement('textarea'); x.value = t; document.body.appendChild(x); x.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { } document.body.removeChild(x); done(ok); }
  });
  document.getElementById('q-save').addEventListener('click', function () {
    var t = collect(), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'text/plain' })); a.download = 'rw-design-' + DIR.letter.toLowerCase() + '-answers.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); st.textContent = 'Saved ' + a.download + '.';
  });
})();
