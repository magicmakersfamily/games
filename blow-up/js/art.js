/* ============================================================================================
   ART — everything drawn in code (SVG strings). No images.
   Scene coordinates: 800 × 450; the floor line is y = 400.
   ============================================================================================ */
'use strict';
const CT = window.BUContent, SIM = window.BUSim;
const NS = 'http://www.w3.org/2000/svg';
const KID_X = 440, ADULT_X = 200, FLOOR = 400;

function skyFor(t) {
  if (t >= 740) return ['#1E2448', '#2E3563'];
  if (t >= 690) return ['#5B4A8A', '#E98E6B'];
  if (t >= 570) return ['#F4B37D', '#FBE0B5'];
  if (t >= 120) return ['#8ECDF0', '#D5EEFA'];
  return ['#B5DDF2', '#FCE6C8'];
}
function sunFor(t, x, y, r) {
  if (t >= 690) return `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF3C4"/><circle cx="${x + r * .45}" cy="${y - r * .2}" r="${r * .85}" fill="${skyFor(t)[0]}"/>
    <circle cx="${x - r * 2}" cy="${y + r}" r="1.6" fill="#fff"/><circle cx="${x + r * 2.2}" cy="${y - r * .6}" r="1.4" fill="#fff"/><circle cx="${x - r * 1.2}" cy="${y - r * 1.4}" r="1.2" fill="#fff"/>`;
  let rays = '';
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; rays += `<line x1="${x + Math.cos(a) * (r + 6)}" y1="${y + Math.sin(a) * (r + 6)}" x2="${x + Math.cos(a) * (r + 16)}" y2="${y + Math.sin(a) * (r + 16)}"/>`; }
  return `<g class="spin-slow" stroke="#FFD85A" stroke-width="4" stroke-linecap="round" opacity=".7">${rays}</g><circle cx="${x}" cy="${y}" r="${r + 7}" fill="#FFD85A" opacity=".25"/><circle cx="${x}" cy="${y}" r="${r}" fill="#FFD85A"/>`;
}
function clouds(y, t) {
  const c = t >= 690 ? '#8C80B8' : '#FFFFFF';
  return `<g class="drift"><g fill="${c}" opacity=".9"><ellipse cx="160" cy="${y}" rx="46" ry="16"/><ellipse cx="190" cy="${y - 10}" rx="30" ry="16"/>
    <ellipse cx="560" cy="${y + 24}" rx="54" ry="15"/><ellipse cx="590" cy="${y + 12}" rx="30" ry="15"/></g></g>`;
}
function windowPane(x, y, w, h, t) {
  const [a, b] = skyFor(t);
  return `<g><rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 16}" rx="10" fill="#FFFFFF"/>
    <defs><linearGradient id="wg${x}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="url(#wg${x})"/>
    ${sunFor(t, x + w * .72, y + h * .32, 13)}
    <path d="M${x} ${y + h} q${w * .25} -26 ${w * .5} -8 t${w * .5} -12 V${y + h} Z" fill="#7DBB6A"/>
    <rect x="${x + w / 2 - 3}" y="${y}" width="6" height="${h}" fill="#FFFFFF"/><rect x="${x}" y="${y + h / 2 - 3}" width="${w}" height="6" fill="#FFFFFF"/></g>`;
}
function woodFloor(col) {
  let s = `<rect x="0" y="${FLOOR}" width="800" height="50" fill="${col || '#C98B5B'}"/>`;
  for (let x = 0; x < 800; x += 90) s += `<line x1="${x}" y1="${FLOOR}" x2="${x - 30}" y2="450" stroke="#A86F45" stroke-width="2"/>`;
  return s + `<rect x="0" y="${FLOOR - 6}" width="800" height="8" fill="#FFFFFF" opacity=".6"/>`;
}
function grass(y, col) {
  return `<path d="M0 ${y} Q200 ${y - 22} 400 ${y - 6} T800 ${y - 12} V450 H0 Z" fill="${col || '#7DBB6A'}"/>
    <path d="M0 ${y + 18} Q260 ${y + 2} 520 ${y + 16} T800 ${y + 10} V450 H0 Z" fill="#6AAA58"/>`;
}
function tree(x, y, s) {
  s = s || 1;
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="sway" style="animation-delay:${(x % 7) * -0.4}s"><rect x="-8" y="-70" width="16" height="72" rx="6" fill="#8A5A3B"/>
    <circle cx="0" cy="-92" r="40" fill="#5E9E4F"/><circle cx="-26" cy="-72" r="26" fill="#6FB25C"/><circle cx="26" cy="-74" r="28" fill="#579148"/><circle cx="-10" cy="-104" r="12" fill="#7CC26A" opacity=".7"/></g></g>`;
}
function birds(t) {
  if (t >= 690) return '';
  const b = (y, d, dur) => `<g class="fly" style="animation-delay:${d}s;animation-duration:${dur}s"><g class="flap"><path d="M0 ${y} q7 -7 14 0 q7 -7 14 0" stroke="#3A2A33" stroke-width="2.5" fill="none" stroke-linecap="round"/></g></g>`;
  return b(70, 0, 17) + b(96, -6, 21) + b(54, -12, 19);
}
function flowers(y) {
  let s = '';
  const cols = ['#EC6FA8', '#F2C641', '#FFFFFF', '#E0493E'];
  for (let i = 0; i < 14; i++) { const x = 30 + i * 57 + (i % 3) * 9, yy = y + (i % 4) * 9; s += `<circle cx="${x}" cy="${yy}" r="4" fill="${cols[i % 4]}"/><circle cx="${x}" cy="${yy}" r="1.6" fill="#8A5A3B"/>`; }
  return s;
}

function background(loc, room, sceneId, t) {
  const [a, b] = skyFor(t);
  const skyGrad = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="800" height="450" fill="url(#sky)"/>`;
  if (loc === 'home') {
    const wall = { bedroom: '#E6DAF2', kitchen: '#FCE3C4', living: '#F6D8C4', bath: '#D3ECF2' }[room] || '#F6D8C4';
    let s = `<rect width="800" height="450" fill="${wall}"/>`;
    if (room === 'bath') { for (let x = 0; x < 800; x += 40) for (let y = 0; y < 400; y += 40) s += `<rect x="${x + 1}" y="${y + 1}" width="38" height="38" rx="4" fill="#E3F4F8"/>`; }
    else s += `<path d="M0 60 H800" stroke="#FFFFFF" stroke-width="3" opacity=".5"/>`;
    s += windowPane(70, 70, 150, 120, t) + woodFloor(room === 'bath' ? '#9CC6D0' : null);
    if (room === 'bedroom') s += `<g><rect x="570" y="300" width="220" height="100" rx="14" fill="#8A5A3B"/><rect x="580" y="282" width="200" height="60" rx="16" fill="#7EC3EA"/>
      <rect x="590" y="268" width="70" height="34" rx="14" fill="#FFFFFF"/><path d="M660 300 q50 -20 120 0 v40 h-120z" fill="#5FA7D8"/><circle cx="700" cy="318" r="5" fill="#F2C641"/><circle cx="740" cy="325" r="5" fill="#F2C641"/></g>
      <g transform="translate(330 90)"><path d="M0 -26 L7 -8 L26 -8 L11 3 L17 22 L0 11 L-17 22 L-11 3 L-26 -8 L-7 -8Z" fill="#F2C641"/></g>
      <rect x="250" y="170" width="46" height="60" rx="6" fill="#EC6FA8" opacity=".6"/>`;
    if (room === 'kitchen') s += `<g><rect x="560" y="210" width="240" height="120" fill="#D2693F"/><rect x="560" y="200" width="240" height="14" rx="4" fill="#F4E4D3"/>
      <rect x="580" y="230" width="60" height="80" rx="6" fill="#E88A60"/><rect x="660" y="230" width="60" height="80" rx="6" fill="#E88A60"/><circle cx="628" cy="270" r="4" fill="#fff"/><circle cx="708" cy="270" r="4" fill="#fff"/>
      <rect x="600" y="170" width="46" height="30" rx="6" fill="#7EC3EA"/><g class="rise"><path d="M608 170 q4 -20 0 -34 M622 170 q4 -18 0 -30" stroke="#fff" stroke-width="3" fill="none" opacity=".7"/></g></g>
      <g><rect x="250" y="330" width="130" height="12" rx="4" fill="#8A5A3B"/><rect x="262" y="342" width="10" height="58" fill="#8A5A3B"/><rect x="358" y="342" width="10" height="58" fill="#8A5A3B"/>
      <ellipse cx="300" cy="326" rx="22" ry="7" fill="#FFFFFF"/><rect x="336" y="306" width="16" height="22" rx="4" fill="#3F93E0"/></g>`;
    if (room === 'living') s += `<g><rect x="560" y="300" width="230" height="100" rx="24" fill="#6C4B8C"/><rect x="580" y="262" width="190" height="70" rx="20" fill="#8768A6"/>
      <rect x="560" y="300" width="40" height="80" rx="18" fill="#5A3D77"/><rect x="750" y="300" width="40" height="80" rx="18" fill="#5A3D77"/></g>
      <ellipse cx="420" cy="420" rx="180" ry="18" fill="#E7A56B" opacity=".6"/>
      <g><rect x="280" y="370" width="30" height="30" rx="4" fill="#E0493E"/><rect x="284" y="340" width="30" height="30" rx="4" fill="#3F93E0"/><rect x="278" y="310" width="30" height="30" rx="4" fill="#F2C641"/></g>`;
    if (room === 'bath') s += `<g><rect x="540" y="300" width="250" height="100" rx="40" fill="#FFFFFF"/><rect x="560" y="290" width="210" height="30" rx="14" fill="#BFE6F2"/>
      <circle cx="590" cy="290" r="16" fill="#FFFFFF"/><circle cx="620" cy="282" r="20" fill="#FFFFFF"/><circle cx="660" cy="288" r="14" fill="#FFFFFF"/><circle cx="720" cy="284" r="18" fill="#FFFFFF"/>
      <path d="M700 300 q8 -16 22 -10 q-4 -14 -18 -10z" fill="#F2C641"/>
      <g fill="#FFFFFF" stroke="#BFE6F2"><circle class="rise" cx="610" cy="260" r="7"/><circle class="rise" style="animation-delay:-1s" cx="660" cy="250" r="5"/><circle class="rise" style="animation-delay:-2s" cx="720" cy="262" r="6"/></g></g>`;
    return s;
  }
  if (loc === 'classroom') {
    let s = `<rect width="800" height="450" fill="#F1E4CF"/>` + woodFloor('#B98457');
    if (room === 'lunch') {
      s += `<rect x="60" y="80" width="200" height="110" rx="8" fill="#FFFFFF"/><text x="160" y="146" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="30" fill="#D2693F">LUNCH</text>
        ${windowPane(470, 70, 150, 110, t)}
        <g><rect x="280" y="340" width="330" height="14" rx="4" fill="#9A6B45"/><rect x="300" y="354" width="12" height="46" fill="#9A6B45"/><rect x="580" y="354" width="12" height="46" fill="#9A6B45"/>
        <rect x="320" y="326" width="50" height="14" rx="3" fill="#E0493E"/><rect x="520" y="326" width="50" height="14" rx="3" fill="#5FB86A"/></g>
        <g opacity=".75"><circle cx="680" cy="300" r="22" fill="#E9B98F"/><rect x="660" y="322" width="40" height="60" rx="14" fill="#E0493E"/><circle cx="740" cy="306" r="20" fill="#B97A52"/><rect x="722" y="326" width="36" height="56" rx="14" fill="#F2C641"/>
        <circle cx="110" cy="306" r="20" fill="#C98E6A"/><rect x="92" y="326" width="36" height="56" rx="14" fill="#5FB86A"/></g>`;
      return s;
    }
    s += `<rect x="230" y="50" width="340" height="150" rx="10" fill="#8A5A3B"/><rect x="240" y="60" width="320" height="130" rx="6" fill="#2F5D4A"/>
      <text x="400" y="118" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="34" fill="#F6F0DC" opacity=".9">A B C 1 2 3</text>
      <text x="400" y="164" text-anchor="middle" font-family="Baloo 2, sans-serif" font-size="22" fill="#F6F0DC" opacity=".7">2 + 2 = ?</text>
      <circle cx="660" cy="100" r="30" fill="#FFFFFF" stroke="#3A2A33" stroke-width="4"/><path d="M660 100 H676" stroke="#3A2A33" stroke-width="4" stroke-linecap="round"/><path class="tick" d="M660 100 V76" stroke="#E0493E" stroke-width="3" stroke-linecap="round"/>
      ${windowPane(40, 80, 120, 110, t)}
      <g opacity=".8"><rect x="600" y="340" width="120" height="12" rx="4" fill="#9A6B45"/><rect x="610" y="352" width="10" height="48" fill="#9A6B45"/><rect x="700" y="352" width="10" height="48" fill="#9A6B45"/>
      <circle cx="660" cy="300" r="20" fill="#B97A52"/><rect x="642" y="318" width="36" height="24" rx="10" fill="#5FB86A"/>
      <rect x="720" y="352" width="70" height="48" fill="#6C4B8C" opacity=".4"/></g>
      <g><rect x="40" y="250" width="80" height="60" rx="6" fill="#FFFFFF"/><path d="M52 290 l14 -18 l12 12 l10 -8 l20 18z" fill="#5FB86A"/><circle cx="96" cy="266" r="6" fill="#F2C641"/></g>`;
    return s;
  }
  if (loc === 'playground') {
    return skyGrad + sunFor(t, 690, 70, 28) + clouds(80, t) + birds(t) + tree(80, 390, 1.1) + grass(385) +
      `<g><path d="M560 400 L600 250 L620 250 L590 400Z" fill="#E0493E"/><rect x="600" y="250" width="100" height="10" fill="#3F93E0"/>
      <path d="M690 250 Q740 330 790 390 L770 400 Q720 340 680 262Z" fill="#F2C641"/><rect x="690" y="250" width="10" height="150" fill="#3F93E0"/></g>
      <g><rect x="160" y="240" width="8" height="160" fill="#8A5A3B"/><rect x="300" y="240" width="8" height="160" fill="#8A5A3B"/><rect x="160" y="236" width="148" height="10" rx="4" fill="#8A5A3B"/>
      <g class="swing"><line x1="210" y1="246" x2="210" y2="330" stroke="#3A2A33" stroke-width="2"/><line x1="250" y1="246" x2="250" y2="330" stroke="#3A2A33" stroke-width="2"/><rect x="202" y="328" width="56" height="8" rx="3" fill="#E0493E"/></g></g>` + flowers(420);
  }
  if (loc === 'field' || loc === 'walk') {
    let s = skyGrad + sunFor(t, 660, 80, 30) + clouds(70, t) + birds(t) +
      `<path d="M0 330 Q180 250 380 310 T800 290 V450 H0Z" fill="#9FCB7E"/>` + tree(120, 360, 1.2) + tree(700, 340, .9) + tree(760, 370, 1.1) + grass(390) + flowers(410);
    if (loc === 'walk') s += `<path d="M300 450 Q380 400 460 390 T620 380 L660 384 Q560 400 520 450Z" fill="#D9B98A"/>`;
    if (sceneId === 'project') s += `<g><path d="M560 400 L610 300 L660 400Z" fill="none" stroke="#8A5A3B" stroke-width="7" stroke-linejoin="round"/>
      <path d="M590 400 L640 290 L700 400Z" fill="none" stroke="#9A6B45" stroke-width="7" stroke-linejoin="round"/><path d="M600 340 H690" stroke="#8A5A3B" stroke-width="6"/><path d="M640 290 l0 -26 l24 8 l-24 8" fill="#E0493E" stroke="#8A5A3B" stroke-width="3"/></g>`;
    s += `<g class="flutter"><path d="M300 200 q-10 -12 0 -16 q10 4 0 16 q10 -12 20 -8 q-4 12 -20 8" fill="#EC6FA8"/></g><g class="flutter" style="animation-delay:-3s"><path d="M520 250 q-8 -10 0 -13 q8 3 0 13 q8 -10 16 -6 q-3 10 -16 6" fill="#F2C641"/></g>`;
    return s;
  }
  if (loc === 'bus' || loc === 'car') {
    const inside = loc === 'bus' ? '#DDE6EE' : '#CFC6BE';
    let scenery = '';
    for (let i = 0; i < 6; i++) scenery += tree(60 + i * 160, 250, .7) + `<rect x="${120 + i * 160}" y="190" width="40" height="60" fill="#E7A56B"/>`;
    let s = skyGrad + `<g class="passing">${scenery}<g transform="translate(960 0)">${scenery}</g></g><rect x="0" y="250" width="800" height="200" fill="#8C8C8C"/>`;
    s += `<rect width="800" height="450" fill="${inside}" mask="url(#winmask)"/>
      <defs><mask id="winmask"><rect width="800" height="450" fill="#fff"/>${loc === 'bus' ? '<rect x="40" y="60" width="200" height="140" rx="16" fill="#000"/><rect x="300" y="60" width="200" height="140" rx="16" fill="#000"/><rect x="560" y="60" width="200" height="140" rx="16" fill="#000"/>' : '<rect x="120" y="60" width="560" height="170" rx="40" fill="#000"/>'}</mask></defs>`;
    if (loc === 'bus') s += `<rect x="0" y="300" width="800" height="150" fill="#B8C4CE"/><g fill="#3F93E0"><rect x="560" y="250" width="200" height="110" rx="18"/><rect x="40" y="250" width="160" height="110" rx="18"/></g>
      <rect x="270" y="0" width="10" height="400" fill="#F2C641"/><rect x="0" y="${FLOOR}" width="800" height="50" fill="#6E7A86"/>
      <g opacity=".75"><circle cx="640" cy="236" r="20" fill="#E9B98F"/><circle cx="700" cy="232" r="20" fill="#7A4A2E"/><circle cx="110" cy="236" r="20" fill="#C98E6A"/></g>`;
    else s += `<rect x="0" y="260" width="800" height="190" fill="#7D6F66"/><rect x="60" y="300" width="680" height="120" rx="30" fill="#5A4F48"/><rect x="0" y="${FLOOR}" width="800" height="50" fill="#4B423D"/>`;
    return s;
  }
  return skyGrad + grass(390);
}

// --- Characters ----------------------------------------------------------------------------------
function kidSVG(k) {
  return `<g id="kid">
    <g id="kidLegs"><g class="legA"><rect x="-26" y="-58" width="22" height="56" rx="10" fill="#2F4A7A" stroke="#3A2A33" stroke-width="2.5"/><ellipse cx="-16" cy="-2" rx="18" ry="9" fill="#E0493E" stroke="#3A2A33" stroke-width="2.5"/></g>
      <g class="legB"><rect x="4" y="-58" width="22" height="56" rx="10" fill="#2F4A7A" stroke="#3A2A33" stroke-width="2.5"/><ellipse cx="16" cy="-2" rx="18" ry="9" fill="#E0493E" stroke="#3A2A33" stroke-width="2.5"/></g>
      <g id="sockFlag" opacity="0"><rect x="-30" y="-20" width="26" height="10" rx="4" fill="#F2C641"/><path d="M-30 -24 l4 -6 l4 6 l4 -6 l4 6 l4 -6" stroke="#E0493E" stroke-width="2" fill="none"/></g></g>
    <g id="kidArmL"><path d="M-34 -106 Q-58 -84 -52 -60" stroke="${k.shirt}" stroke-width="18" stroke-linecap="round" fill="none"/><circle id="handL" cx="-52" cy="-58" r="11" fill="${k.skin}" stroke="#3A2A33" stroke-width="2.5"/></g>
    <g id="kidArmR"><path d="M34 -106 Q58 -84 52 -60" stroke="${k.shirt}" stroke-width="18" stroke-linecap="round" fill="none"/><circle id="handR" cx="52" cy="-58" r="11" fill="${k.skin}" stroke="#3A2A33" stroke-width="2.5"/></g>
    <g class="breathe"><rect x="-38" y="-118" width="76" height="68" rx="26" fill="${k.shirt}" stroke="#3A2A33" stroke-width="2.5"/><rect x="-36" y="-78" width="72" height="8" fill="#FFFFFF" opacity=".25"/></g>
    <path d="M-12 -96 l12 12 l12 -12" stroke="#FFFFFF" stroke-width="4" fill="none" opacity=".7"/>
    <g id="tummy" opacity="0"><circle cx="0" cy="-80" r="16" fill="#8FD16A"/><circle cx="-6" cy="-84" r="3" fill="#3A2A33"/><circle cx="6" cy="-84" r="3" fill="#3A2A33"/><path d="M-8 -74 l4 4 l4 -4 l4 4 l4 -4" stroke="#3A2A33" stroke-width="2" fill="none"/></g>
    <g id="head">
      <circle cx="-44" cy="-158" r="10" fill="${k.skin}" stroke="#3A2A33" stroke-width="2.5"/><circle cx="44" cy="-158" r="10" fill="${k.skin}" stroke="#3A2A33" stroke-width="2.5"/>
      <circle cx="0" cy="-160" r="46" fill="${k.skin}" stroke="#3A2A33" stroke-width="2.5"/>
      <circle id="faceHeat" cx="0" cy="-150" r="40" fill="#E0493E" opacity="0"/>
      <g id="frizz" opacity="0" stroke="${k.hair}" stroke-width="6" stroke-linecap="round"><path d="M-30 -200 l-10 -18 M-10 -206 l-4 -22 M10 -206 l4 -22 M30 -200 l10 -18 M-42 -186 l-18 -8 M42 -186 l18 -8"/></g>
      <path d="M-46 -166 Q-44 -214 0 -210 Q46 -214 46 -166 Q30 -190 0 -186 Q-24 -196 -46 -166Z" fill="${k.hair}"/><path d="M-22 -202 q14 -6 30 -2" stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".25" stroke-linecap="round"/>
      <g id="eyes"><ellipse cx="-16" cy="-160" rx="6" ry="8" fill="#3A2A33"/><ellipse cx="16" cy="-160" rx="6" ry="8" fill="#3A2A33"/><circle cx="-14" cy="-163" r="2" fill="#fff"/><circle cx="18" cy="-163" r="2" fill="#fff"/></g>
      <g id="eyesShut" opacity="0" stroke="#3A2A33" stroke-width="3" fill="none" stroke-linecap="round"><path d="M-22 -158 q6 5 12 0"/><path d="M10 -158 q6 5 12 0"/></g>
      <g id="brows" stroke="#3A2A33" stroke-width="4" stroke-linecap="round"><path id="browL" d="M-24 -176 q8 -5 16 0"/><path id="browR" d="M8 -176 q8 -5 16 0"/></g>
      <circle cx="-28" cy="-142" r="7" fill="#F28A8A" opacity=".55"/><circle cx="28" cy="-142" r="7" fill="#F28A8A" opacity=".55"/>
      <path id="mouth" d="M-14 -136 Q0 -124 14 -136" stroke="#3A2A33" stroke-width="4" fill="none" stroke-linecap="round"/>
      <g id="teeth" opacity="0"><path d="M-22 -140 Q0 -108 22 -140Z" fill="#3A2A33"/><path d="M-20 -139 l5 8 l5 -8 l5 8 l5 -8 l5 8 l5 -8 l5 8 l2 -8Z" fill="#fff"/></g>
      <g id="steam" opacity="0"><g class="zzz" style="animation-duration:1s"><circle cx="-58" cy="-164" r="8" fill="#fff"/></g><g class="zzz" style="animation-duration:1.2s;animation-delay:.3s"><circle cx="58" cy="-164" r="8" fill="#fff"/></g></g>
    </g>
  </g>`;
}
function adultSVG(kind) {
  const teacher = kind === 'teacher';
  const top = teacher ? '#6C4B8C' : '#D2693F', skin = teacher ? '#C98E6A' : '#E6B48C', hair = teacher ? '#2B2021' : '#7A4A2E';
  return `<g id="adult">
    <rect x="-24" y="-96" width="20" height="94" rx="9" fill="#39405A"/><rect x="4" y="-96" width="20" height="94" rx="9" fill="#39405A"/>
    <ellipse cx="-14" cy="-2" rx="17" ry="7" fill="#3A2A33"/><ellipse cx="14" cy="-2" rx="17" ry="7" fill="#3A2A33"/>
    <path d="M-40 -186 Q-60 -140 -50 -100" stroke="${top}" stroke-width="18" stroke-linecap="round" fill="none"/><circle cx="-50" cy="-98" r="10" fill="${skin}"/>
    <path d="M40 -186 Q60 -140 50 -100" stroke="${top}" stroke-width="18" stroke-linecap="round" fill="none"/><circle cx="50" cy="-98" r="10" fill="${skin}"/>
    <rect x="-44" y="-196" width="88" height="110" rx="30" fill="${top}" stroke="#3A2A33" stroke-width="2.5"/>
    ${teacher ? '<path d="M-14 -190 L0 -150 L14 -190" stroke="#F2C641" stroke-width="4" fill="none"/><rect x="-10" y="-152" width="20" height="26" rx="3" fill="#FFFFFF"/>' : '<rect x="-28" y="-150" width="56" height="60" rx="10" fill="#F6E1CF" opacity=".85"/>'}
    <circle cx="0" cy="-230" r="38" fill="${skin}" stroke="#3A2A33" stroke-width="2.5"/>
    <path d="M-38 -236 Q-36 -276 0 -272 Q38 -276 38 -236 Q20 -254 0 -250 Q-20 -254 -38 -236Z" fill="${hair}"/>
    ${teacher ? '' : `<circle cx="0" cy="-276" r="14" fill="${hair}"/>`}
    <g id="adultEyes"><ellipse cx="-13" cy="-232" rx="5" ry="6" fill="#3A2A33"/><ellipse cx="13" cy="-232" rx="5" ry="6" fill="#3A2A33"/></g>
    ${teacher ? '<g fill="none" stroke="#3A2A33" stroke-width="2.5"><circle cx="-13" cy="-232" r="10"/><circle cx="13" cy="-232" r="10"/><path d="M-3 -232 h6"/></g>' : ''}
    <path id="adultBrows" d="M-22 -246 q9 -4 18 0 M4 -246 q9 -4 18 0" stroke="#3A2A33" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path id="adultMouth" d="M-11 -212 Q0 -202 11 -212" stroke="#3A2A33" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path id="adultSweat" d="M34 -250 q6 10 0 14 q-6 -4 0 -14z" fill="#7EC3EA" opacity="0"/>
  </g>`;
}
function petSVG() {
  return `<g id="pet" transform="translate(690 400)"><g>
    <ellipse cx="0" cy="-22" rx="34" ry="20" fill="#E3B77E"/><circle cx="32" cy="-40" r="18" fill="#E3B77E"/><ellipse cx="40" cy="-50" rx="7" ry="12" fill="#B9854E" transform="rotate(30 40 -50)"/>
    <circle cx="38" cy="-42" r="3" fill="#3A2A33"/><circle cx="49" cy="-36" r="4" fill="#3A2A33"/><rect x="-26" y="-8" width="10" height="10" rx="4" fill="#E3B77E"/><rect x="14" y="-8" width="10" height="10" rx="4" fill="#E3B77E"/>
    <path d="M-34 -26 q-16 -12 -10 -24" stroke="#E3B77E" stroke-width="7" stroke-linecap="round" fill="none" class="wag"/></g></g>`;
}
function pickleSVG() {
  return `<svg viewBox="0 0 60 92" width="58" height="89" aria-hidden="true">
    <path d="M14 58 L6 90 H54 L46 58Z" fill="#FFFFFF" stroke="#3A2A33" stroke-width="2"/>
    <rect x="14" y="4" width="32" height="70" rx="16" fill="#6FB25C" stroke="#3A2A33" stroke-width="2"/>
    <circle cx="20" cy="22" r="2" fill="#4E8A3F"/><circle cx="38" cy="44" r="2" fill="#4E8A3F"/><circle cx="24" cy="58" r="2" fill="#4E8A3F"/>
    <g fill="#FFFFFF" stroke="#3A2A33" stroke-width="2"><circle cx="24" cy="26" r="7"/><circle cx="38" cy="26" r="7"/></g><path d="M31 26 h0" stroke="#3A2A33" stroke-width="2"/>
    <circle cx="25" cy="27" r="2.5" fill="#3A2A33"/><circle cx="37" cy="27" r="2.5" fill="#3A2A33"/>
    <path id="pkMouth" d="M24 38 q7 6 14 0" stroke="#3A2A33" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M22 35 q4 -3 8 0 q4 -3 8 0" stroke="#5A3D2A" stroke-width="2.5" fill="none"/>
    <rect x="44" y="60" width="8" height="14" rx="2" fill="#7EC3EA" stroke="#3A2A33" stroke-width="1.5"/></svg>`;
}
function avatarSVG(night) {
  const face = night ? '#F6ECB0' : '#FFD85A';
  let rays = '';
  if (!night) for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; rays += `<path d="M${40 + Math.cos(a) * 27} ${40 + Math.sin(a) * 27} L${40 + Math.cos(a + .13) * 37} ${40 + Math.sin(a + .13) * 37} L${40 + Math.cos(a - .13) * 37} ${40 + Math.sin(a - .13) * 37}Z" fill="#F2A93B"/>`; }
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><g class="spin-slow">${rays}</g>
    <circle cx="40" cy="40" r="25" fill="${face}" stroke="#3A2A33" stroke-width="2.5"/>
    ${night ? '<circle cx="50" cy="32" r="6" fill="#E6D98A"/><circle cx="30" cy="52" r="4" fill="#E6D98A"/>' : ''}
    <circle cx="28" cy="46" r="4" fill="#F28A8A" opacity=".6"/><circle cx="52" cy="46" r="4" fill="#F28A8A" opacity=".6"/>
    <g id="navEyes"><ellipse cx="32" cy="36" rx="3" ry="4" fill="#3A2A33"/><ellipse cx="48" cy="36" rx="3" ry="4" fill="#3A2A33"/></g>
    <path id="navMouth" d="M31 47 Q40 54 49 47" stroke="#3A2A33" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
}
function brainSVG() {
  return `<rect width="180" height="96" fill="#FDF3E8"/><rect y="78" width="180" height="18" fill="#EBD5C1"/>
    <g id="dog" transform="translate(44 80)"><g id="dogBody">
      <ellipse cx="0" cy="-16" rx="20" ry="16" fill="#B9854E"/><circle cx="12" cy="-34" r="14" fill="#B9854E"/><ellipse cx="4" cy="-44" rx="5" ry="10" fill="#8A5A3B" transform="rotate(-20 4 -44)"/>
      <ellipse cx="22" cy="-30" rx="7" ry="5" fill="#D9AE7C"/><circle cx="27" cy="-31" r="2.6" fill="#3A2A33"/><circle cx="14" cy="-38" r="2.4" fill="#3A2A33"/>
      <rect x="-12" y="-10" width="7" height="10" rx="3" fill="#B9854E"/><rect x="6" y="-10" width="7" height="10" rx="3" fill="#B9854E"/>
      <path d="M-4 -24 h16" stroke="#E0493E" stroke-width="3"/><circle cx="4" cy="-20" r="3" fill="#F2C641"/></g>
      <g id="dogBark" opacity="0"><path d="M30 -52 l10 -8 M32 -40 h14 M30 -28 l10 8" stroke="#E0493E" stroke-width="3" stroke-linecap="round"/><text id="dogText" x="-26" y="-58" font-family="Baloo 2, sans-serif" font-weight="800" font-size="12" fill="#E0493E">WOOF!</text></g>
      <text id="dogZ" x="20" y="-52" font-size="11" opacity="0" fill="#3F93E0" font-weight="700">z z</text></g>
    <g transform="translate(128 80)"><rect x="-26" y="-34" width="52" height="30" rx="8" fill="#D2693F"/><rect x="-30" y="-44" width="12" height="42" rx="6" fill="#B85A34"/><rect x="18" y="-44" width="12" height="42" rx="6" fill="#B85A34"/><rect x="-22" y="-62" width="44" height="32" rx="10" fill="#B85A34"/></g>
    <g id="owlWrap" transform="translate(128 44)"><g id="owl">
      <ellipse cx="0" cy="0" rx="16" ry="20" fill="#8A6A4E"/><ellipse cx="0" cy="6" rx="10" ry="12" fill="#D9C2A5"/>
      <circle cx="-7" cy="-8" r="7" fill="#fff"/><circle cx="7" cy="-8" r="7" fill="#fff"/><circle cx="-7" cy="-8" r="3.2" fill="#3A2A33"/><circle cx="7" cy="-8" r="3.2" fill="#3A2A33"/>
      <g fill="none" stroke="#3A2A33" stroke-width="1.4"><circle cx="-7" cy="-8" r="8.5"/><circle cx="7" cy="-8" r="8.5"/></g>
      <path d="M-3 -1 l3 5 l3 -5z" fill="#F2A93B"/><path d="M-14 -18 l4 -8 l4 6 M14 -18 l-4 -8 l-4 6" fill="#8A6A4E"/>
      <g id="owlYawn" opacity="0"><ellipse cx="0" cy="4" rx="4" ry="5" fill="#3A2A33"/></g></g></g>`;
}

// --- Bucket, jars and graph --------------------------------------------------------------------
const BK = { top: 22, bottom: 232, left: 34, right: 150, scale: 105 };
function bucketFrame() {
  return `<defs><clipPath id="bclip"><path d="M${BK.left + 2} ${BK.top} H${BK.right - 2} L${BK.right - 14} ${BK.bottom} H${BK.left + 12}Z"/></clipPath>
      <pattern id="glass" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="rgba(126,195,234,.10)"/></pattern></defs>
    <path d="M${BK.left} ${BK.top - 4} H${BK.right} L${BK.right - 14} ${BK.bottom + 2} H${BK.left + 12}Z" fill="url(#glass)" stroke="#9A8791" stroke-width="3" stroke-linejoin="round"/>
    <g id="bZones"></g>
    <g clip-path="url(#bclip)"><g id="bLayers"></g><g id="bSludge"></g><g id="bDrops"></g></g>
    <g id="bLines"></g><g id="bSparks"></g><g id="bOver"></g>
    <path d="M${BK.left - 4} ${BK.top - 6} H${BK.right + 4}" stroke="#6B5560" stroke-width="5" stroke-linecap="round"/>
    <text id="bMask" x="92" y="16" text-anchor="middle" font-size="11" font-weight="700" fill="#6C4B8C" opacity="0">🎭 hidden inside</text>`;
}
const yOf = v => BK.bottom - Math.min(v, BK.scale * 1.12) / BK.scale * (BK.bottom - BK.top);

function jarSVG(key, n, big) {
  const j = CT.JARS[key], w = big ? 84 : 64, h = big ? 100 : 82;
  let marbles = '';
  const per = big ? 4 : 3, r = big ? 8 : 7.4;
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per), col = i % per;
    const x = w / 2 - (per - 1) * r * 1.05 + col * r * 2.1 + (row % 2 ? r * .35 : 0), y = h - 12 - r - row * r * 1.8;
    marbles += `<g class="marble" data-jar="${key}" data-i="${i}"><circle cx="${x}" cy="${y}" r="${r}" fill="${j.color}" stroke="rgba(0,0,0,.18)"/><circle cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .3}" fill="#fff" opacity=".7"/></g>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true">
    <rect x="${w * .22}" y="2" width="${w * .56}" height="10" rx="4" fill="#9A8791"/>
    <path d="M${w * .2} 12 Q${w * .06} 20 ${w * .08} 34 V${h - 10} Q${w * .08} ${h - 2} ${w * .2} ${h - 2} H${w * .8} Q${w * .92} ${h - 2} ${w * .92} ${h - 10} V34 Q${w * .94} 20 ${w * .8} 12Z" fill="rgba(126,195,234,.14)" stroke="#9A8791" stroke-width="2.5"/>
    ${marbles}
    <text x="${w / 2}" y="30" text-anchor="middle" font-size="${big ? 16 : 13}">${j.glyph}</text></svg>`;
}

function rubyZh(zh, py) {
  return `<ruby lang="zh-TW">${[...zh].map((ch, i) => `${ch}<rt>${py[i] || ''}</rt>`).join('')}</ruby>`;
}

function icebergSVG(feelings) {
  const under = feelings.filter(f => f !== 'angry').slice(0, 5);
  const pos = [[150, 160], [300, 160], [450, 160], [225, 234], [375, 234]];
  const f = CT.FEELINGS.angry;
  let words = '';
  under.forEach((k, i) => {
    const F = CT.FEELINGS[k]; if (!F) return;
    const [x, y] = pos[i];
    words += `<g data-feel="${k}" style="cursor:pointer"><rect x="${x - 64}" y="${y - 22}" width="128" height="44" rx="14" fill="#FFFFFF" opacity=".92"/>
      <text x="${x}" y="${y - 3}" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="700" font-size="16" fill="#2F5D8A">${F.en}</text>
      <text x="${x}" y="${y + 15}" text-anchor="middle" font-family="Noto Serif TC, Songti TC, serif" font-weight="700" font-size="13" fill="#6B5560" lang="zh-TW">${F.zh} · ${F.py.join(' ')}</text></g>`;
  });
  return `<svg class="iceberg" viewBox="0 0 600 290" role="img" aria-label="The iceberg: mad on top, other feelings underneath">
    <rect width="600" height="290" fill="#CDEBF7"/><rect y="92" width="600" height="198" fill="#3F93E0"/>
    <path d="M0 92 q30 -6 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" stroke="#FFFFFF" stroke-width="3" fill="none" opacity=".7"/>
    <path d="M250 92 L290 30 L320 44 L350 92Z" fill="#FFFFFF"/><path d="M100 92 L250 92 L350 92 L520 92 L470 280 L140 280Z" fill="#BFE3F5" opacity=".75"/>
    <text x="300" y="80" text-anchor="middle" font-family="Baloo 2, sans-serif" font-weight="800" font-size="22" fill="#E0493E">MAD</text>
    <text x="400" y="56" font-family="Noto Serif TC, Songti TC, serif" font-weight="700" font-size="16" fill="#E0493E" lang="zh-TW">${f.zh} ${f.py.join(' ')}</text>
    ${words}</svg>`;
}
