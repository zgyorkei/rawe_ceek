/* RW art: hand-drawn flags, brick-style car stand-ins, corner scenes and the head stand-in. No logos, no wordmarks. */
window.RW = window.RW || {};
(function (RW) {
  var zig = function (n, h) { var p = ['0,0'], s = h / n, i; for (i = 0; i < n; i++) { p.push('22,' + (i * s).toFixed(2)); p.push('15,' + ((i + 0.5) * s).toFixed(2)); } p.push('22,' + h); p.push('0,' + h); return p.join(' '); };
  var usStripes = ''; for (var i = 0; i < 13; i += 2) usStripes += '<rect y="' + (i * 40 / 13) + '" width="60" height="' + (40 / 13) + '" fill="#b22234"/>';
  RW.flagSvg = {
    gb: '<rect width="60" height="40" fill="#1f3a8a"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width="3"/><path d="M30 0V40M0 20H60" stroke="#fff" stroke-width="12"/><path d="M30 0V40M0 20H60" stroke="#c8102e" stroke-width="7"/>',
    it: '<rect width="20" height="40" fill="#009246"/><rect x="20" width="20" height="40" fill="#fff"/><rect x="40" width="20" height="40" fill="#ce2b37"/>',
    qa: '<rect width="60" height="40" fill="#8a1538"/><polygon points="' + zig(9, 40) + '" fill="#fff"/>',
    us: '<rect width="60" height="40" fill="#fff"/>' + usStripes + '<rect width="26" height="21.5" fill="#3c3b6e"/><g fill="#fff"><circle cx="5" cy="5" r="1.2"/><circle cx="13" cy="5" r="1.2"/><circle cx="21" cy="5" r="1.2"/><circle cx="9" cy="11" r="1.2"/><circle cx="17" cy="11" r="1.2"/><circle cx="5" cy="17" r="1.2"/><circle cx="13" cy="17" r="1.2"/><circle cx="21" cy="17" r="1.2"/></g>',
    ae: '<rect width="60" height="40" fill="#fff"/><rect x="15" width="45" height="13.4" fill="#00732f"/><rect x="15" y="26.6" width="45" height="13.4" fill="#000"/><rect width="15" height="40" fill="#ff0000"/>',
    xx: '<rect width="60" height="40" fill="#8a8f98"/><rect y="13" width="60" height="14" fill="#c9ced6"/><text x="30" y="25" text-anchor="middle" font-size="12" font-family="sans-serif" font-weight="700" fill="#4a4f58">?</text>'
  };
  RW.flag = function (cc) { return '<svg class="flag" viewBox="0 0 60 40" aria-hidden="true">' + (RW.flagSvg[cc] || RW.flagSvg.xx) + '</svg>'; };

  /* open-wheel brick-style stand-in */
  function ow(c) {
    var h = '<svg class="car" viewBox="0 0 160 64" role="img" aria-label="' + c.label + ' (brick-style stand-in)">';
    h += '<ellipse cx="80" cy="60" rx="70" ry="3" fill="#000" opacity=".2"/>';
    h += '<rect x="2" y="52" width="26" height="5" rx="2" fill="' + c.wing + '"/><rect x="134" y="19" width="22" height="7" rx="2" fill="' + c.wing + '"/><rect x="141" y="25" width="5" height="19" fill="' + c.wing + '"/><rect x="133" y="17" width="3" height="12" fill="' + c.wing + '"/><rect x="154" y="17" width="3" height="12" fill="' + c.wing + '"/>';
    h += '<circle cx="36" cy="47" r="11" fill="#1c1c1c"/><circle cx="36" cy="47" r="5" fill="#c4c8cf"/><circle cx="122" cy="44" r="14" fill="#1c1c1c"/><circle cx="122" cy="44" r="6" fill="#c4c8cf"/>';
    h += '<rect x="14" y="44" width="122" height="9" rx="3" fill="' + c.body + '"/><rect x="8" y="46" width="44" height="7" rx="2" fill="' + c.body + '"/><rect x="36" y="38" width="26" height="10" rx="2" fill="' + c.body + '"/>';
    h += '<rect x="56" y="34" width="46" height="18" rx="3" fill="' + c.body + '"/>';
    if (c.stripes) h += '<rect x="56" y="40" width="64" height="2.2" fill="' + c.stripes[0] + '"/><rect x="56" y="43.4" width="64" height="2.2" fill="' + c.stripes[1] + '"/>';
    h += '<rect x="94" y="27" width="36" height="17" rx="3" fill="' + c.cover + '"/><rect x="100" y="22" width="12" height="8" rx="2" fill="' + c.cover + '"/>';
    h += '<path d="M70 30 Q82 20 96 30" fill="none" stroke="#222" stroke-width="2.4"/><circle cx="82" cy="31" r="6" fill="' + c.helmet + '"/><rect x="78" y="29" width="8" height="3" rx="1.5" fill="#223"/>';
    h += '<g fill="#fff" opacity=".3"><ellipse cx="62" cy="34" rx="3.6" ry="1.7"/><ellipse cx="74" cy="34" rx="3.6" ry="1.7"/><ellipse cx="20" cy="44" rx="3.6" ry="1.7"/><ellipse cx="116" cy="26.6" rx="3.6" ry="1.7"/></g>';
    if (c.num) h += '<circle cx="62" cy="46" r="6" fill="#fff"/><text x="62" y="49" text-anchor="middle" font-size="8" font-weight="700" font-family="sans-serif" fill="#111">' + c.num + '</text>';
    return h + '</svg>';
  }
  /* closed-cockpit hypercar brick-style stand-in */
  function hy(c) {
    var h = '<svg class="car" viewBox="0 0 200 64" role="img" aria-label="' + c.label + ' (brick-style stand-in)">';
    h += '<ellipse cx="100" cy="60" rx="90" ry="3" fill="#000" opacity=".2"/>';
    h += '<circle cx="44" cy="49" r="11" fill="#1c1c1c"/><circle cx="44" cy="49" r="5" fill="#c4c8cf"/><circle cx="152" cy="49" r="12" fill="#1c1c1c"/><circle cx="152" cy="49" r="5.5" fill="#c4c8cf"/>';
    h += '<rect x="8" y="40" width="186" height="13" rx="6" fill="' + c.body + '"/>';
    h += '<rect x="148" y="19" width="8" height="24" rx="2" fill="' + c.body + '"/><rect x="146" y="17" width="12" height="4" rx="2" fill="#1b1b1b"/>';
    h += '<rect x="66" y="24" width="68" height="19" rx="8" fill="' + c.body + '"/><path d="M72 30 Q84 25 96 25 L104 25 L104 38 L74 38 Z" fill="#a9d6f5"/><path d="M108 25 L124 27 Q130 30 130 38 L108 38 Z" fill="#a9d6f5" opacity=".85"/>';
    h += '<rect x="90" y="24" width="5" height="19" fill="' + c.accent + '"/><rect x="100" y="24" width="5" height="19" fill="' + c.accent + '"/>';
    h += '<polygon points="22,44 42,44 33,39" fill="' + c.accent + '"/>';
    h += '<g fill="#fff" opacity=".3"><ellipse cx="74" cy="24.5" rx="3.6" ry="1.5"/><ellipse cx="124" cy="24.5" rx="3.6" ry="1.5"/><ellipse cx="60" cy="40" rx="3.6" ry="1.5"/><ellipse cx="176" cy="40" rx="3.6" ry="1.5"/></g>';
    h += '<circle cx="118" cy="48" r="7" fill="#fff"/><text x="118" y="51.2" text-anchor="middle" font-size="9" font-weight="700" font-family="sans-serif" fill="#111">' + c.num + '</text>';
    return h + '</svg>';
  }
  RW.carSpec = {
    f1: { label: 'Formula 1 car, red', body: '#d40000', wing: '#1b1b1b', cover: '#ffffff', helmet: '#f2f2f2' },
    f2: { label: 'Formula 2 car, blue', body: '#1c5fd8', wing: '#0e2f6b', cover: '#dfe9ff', helmet: '#f2f2f2' },
    f3: { label: 'Formula 3 car, orange', body: '#ff7a00', wing: '#5a2a00', cover: '#ffe3c2', helmet: '#f2f2f2' },
    f1a: { label: 'F1 Academy car, yellow and black', body: '#ffd500', wing: '#171717', cover: '#171717', helmet: '#f2f2f2', stripes: ['#f0589b', '#8cccef'], num: '32' },
    fe: { label: 'Formula E car, plain stand-in', body: '#8a93a3', wing: '#3a404b', cover: '#c9d0dc', helmet: '#f2f2f2' },
    wec50: { label: 'Hypercar #50, red', body: '#d40000', accent: '#ffd500', num: '50' },
    wec51: { label: 'Hypercar #51, red', body: '#d40000', accent: '#ffd500', num: '51' }
  };
  RW.car = function (id) {
    if (id === 'wec') return '<span class="car-pair">' + hy(RW.carSpec.wec50) + hy(RW.carSpec.wec51) + '</span>';
    return ow(RW.carSpec[id]);
  };

  /* corner picture stand-ins: generic scenes, drawn with currentColor so a direction can tint them (duotone) */
  RW.scene = function (kind) {
    var o = '<svg class="scene" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="currentColor" stroke="currentColor">';
    o += '<rect width="300" height="200" opacity=".10" stroke="none"/><rect y="120" width="300" height="80" opacity=".30" stroke="none"/>';
    if (kind === 'esses') o += '<path d="M-10 190 C80 150 90 110 150 112 C215 114 215 80 320 70" fill="none" stroke-width="46" opacity=".45"/><path d="M-10 190 C80 150 90 110 150 112 C215 114 215 80 320 70" fill="none" stroke-width="4" stroke-dasharray="14 14" opacity=".9" stroke="#fff"/><path d="M-10 168 C80 128 88 88 150 90" fill="none" stroke-width="7" stroke-dasharray="12 12" opacity=".8"/>';
    if (kind === 'curve') o += '<path d="M-10 190 C120 190 250 160 270 60" fill="none" stroke-width="50" opacity=".45"/><path d="M270 60 L300 20" stroke-width="30" opacity=".35"/><path d="M-10 160 C100 164 214 140 240 52" fill="none" stroke-width="6" stroke-dasharray="10 10" opacity=".85"/>';
    if (kind === 'hairpin') o += '<path d="M-10 170 L190 170 C260 170 260 80 190 80 L60 80" fill="none" stroke-width="40" opacity=".45"/><path d="M190 190 C290 190 290 60 190 60" fill="none" stroke-width="6" stroke-dasharray="10 10" opacity=".85"/>';
    if (kind === 'straight') o += '<polygon points="120,110 180,110 300,200 0,200" opacity=".45" stroke="none"/><g opacity=".5" stroke="none"><rect x="14" y="40" width="22" height="80"/><rect x="44" y="20" width="18" height="100"/><rect x="236" y="30" width="24" height="90"/><rect x="268" y="56" width="20" height="64"/></g><path d="M150 112 L150 200" stroke-width="3" stroke-dasharray="12 10" opacity=".9" stroke="#fff"/>';
    if (kind === 'bridge') o += '<path d="M-10 150 L310 150" stroke-width="30" opacity=".45"/><g opacity=".6" stroke="none"><rect x="60" y="40" width="10" height="110"/><rect x="230" y="40" width="10" height="110"/></g><path d="M65 44 L150 108 L235 44" fill="none" stroke-width="3" opacity=".8"/><path d="M-10 130 L310 130" stroke-width="5" stroke-dasharray="12 12" opacity=".8"/>';
    if (kind === 'chicane') o += '<path d="M-10 175 L90 175 L130 120 L190 120 L230 70 L310 70" fill="none" stroke-width="36" opacity=".45" stroke-linejoin="round"/><path d="M-10 150 L82 150 L120 96" fill="none" stroke-width="6" stroke-dasharray="10 10" opacity=".85"/>';
    return o + '</g></svg>';
  };

  /* brick-style head stand-in: a plain yellow brick head with dark hair, not a likeness copy */
  RW.head = function () {
    return '<svg class="head" viewBox="0 0 64 64" role="img" aria-label="brick-style head stand-in"><rect x="22" y="48" width="20" height="12" rx="2" fill="#e5b800"/><rect x="26" y="4" width="12" height="7" rx="2" fill="#2a1a12"/><rect x="12" y="10" width="40" height="42" rx="13" fill="#ffd500"/><path d="M11 30 C9 10 20 8 32 8 C46 8 55 12 53 30 C50 22 46 18 38 17 C30 20 20 20 14 24 Z" fill="#2a1a12"/><ellipse cx="25" cy="33" rx="2.6" ry="3.2" fill="#1b1b1b"/><ellipse cx="39" cy="33" rx="2.6" ry="3.2" fill="#1b1b1b"/><path d="M20 28 Q25 25 29 27 M35 27 Q39 25 44 28" stroke="#2a1a12" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M25 43 Q32 48 39 43" stroke="#1b1b1b" stroke-width="2.2" fill="none" stroke-linecap="round"/><rect x="18" y="56" width="28" height="6" rx="2" fill="#d40000"/></svg>';
  };

  /* weather icons, simple shapes */
  RW.wxIcon = function (code) {
    var k = RW.wxKind(code), c = '#9aa7b8';
    var sun = '<circle cx="16" cy="16" r="6" fill="#ffc531"/><g stroke="#ffc531" stroke-width="2" stroke-linecap="round"><path d="M16 4v3M16 25v3M4 16h3M25 16h3M7.5 7.5l2 2M22.5 22.5l2 2M7.5 24.5l2-2M22.5 9.5l2-2"/></g>';
    var cloud = '<path d="M9 22a5 5 0 0 1 0-10 7 7 0 0 1 13.5-1A5.5 5.5 0 0 1 22 22z" fill="' + c + '"/>';
    var s = { clear: sun, partly: '<g transform="translate(-3 -4) scale(.8)">' + sun + '</g><g transform="translate(3 4) scale(.85)">' + cloud + '</g>', cloud: cloud, fog: cloud + '<path d="M6 25h20M9 28.5h14" stroke="#9aa7b8" stroke-width="2" stroke-linecap="round"/>', rain: cloud + '<path d="M11 24l-1.5 4M16 24l-1.5 4M21 24l-1.5 4" stroke="#3b8be8" stroke-width="2" stroke-linecap="round"/>', storm: cloud + '<path d="M17 21l-4 5h4l-2 4" stroke="#ffc531" stroke-width="2" fill="none" stroke-linejoin="round"/>', snow: cloud + '<g fill="#fff"><circle cx="11" cy="26" r="1.6"/><circle cx="16" cy="28" r="1.6"/><circle cx="21" cy="26" r="1.6"/></g>' }[k];
    return '<svg class="wx" viewBox="0 0 32 32" aria-hidden="true">' + s + '</svg>';
  };
  RW.wxKind = function (code) {
    if (code === 0 || code === 1) return 'clear'; if (code === 2) return 'partly'; if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog'; if (code >= 51 && code <= 67) return 'rain'; if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain'; if (code >= 85 && code <= 86) return 'snow'; if (code >= 95) return 'storm'; return 'cloud';
  };
  RW.wxText = { clear: 'Clear', partly: 'Partly cloudy', cloud: 'Cloudy', fog: 'Fog', rain: 'Rain', storm: 'Thunderstorm', snow: 'Snow' };
})(window.RW);
