/* =========================================================
   NOTEBOOK 2 · part F — master widgets for ch 7–9
   ========================================================= */

/* ===================================================================
   M7 · chapter 7 in one widget — the punched-tape stepper sequencer
   =================================================================== */
const COIL_DIR = { A: -90, B: 0, C: 90, D: 180 };
const coilsOf = c => ({ C: (c >> 3) & 1, D: (c >> 2) & 1, A: (c >> 1) & 1, B: c & 1 });
function codeAngle(c) { const on = coilsOf(c); let x = 0, y = 0; Object.keys(on).forEach(k => { if (on[k]) { x += Math.cos(COIL_DIR[k] * Math.PI / 180); y += Math.sin(COIL_DIR[k] * Math.PI / 180); } }); return Math.hypot(x, y) < .01 ? null : Math.atan2(y, x) * 180 / Math.PI; }
BUILD.push(function wM7() {
  const w = MW('w-m7', 'the punched-tape stepper', 'punch holes = 1s · the tape drives P0.3–P0.0 → transistors → coils → shaft');
  let tape = [0x3, 0x9, 0xC, 0x6], row = 0, code = 0x3, shaft = 0, steps = 0, run = null, diodes = true, zaps = 0, fly = [0, 0, 0, 0], hist = [], ang = 6, rpm = 60, rev = 2.5, slowMode = true, stall = 0;
  const top = el('div', { class: 'row mb' }); w.appendChild(top); top.appendChild(el('span', { class: 'gae' }, 'load a tape:'));
  const pre = chipGroup(top, [['cw', '↻ clockwise 3,9,C,6'], ['ccw', '↺ anticlockwise 3,6,C,9'], ['bad', '✗ wrong order 3,C,9,6'], ['opp', '✗ opposite coils 5,A']], 'cw', v => { tape = { cw: [3, 9, 0xC, 6], ccw: [3, 6, 0xC, 9], bad: [3, 0xC, 9, 6], opp: [5, 0xA] }[v].slice(); row = tape.length - 1; paintTape(); mSay.innerHTML = 'New tape loaded — press <b>one step ▸</b> or <b>run</b>.'; });
  const grid = el('div', { class: 'm7-grid' }); w.appendChild(grid);
  // the tape
  const cT = el('div', { class: 'm7-tapebox' }); grid.appendChild(cT);
  cT.innerHTML = '<div class="m7-th"><span>row</span><span>C<small>P0.3</small></span><span>D<small>P0.2</small></span><span>A<small>P0.1</small></span><span>B<small>P0.0</small></span><span>hex</span></div>';
  const tapeEl = el('div', { class: 'm7-tape' }); cT.appendChild(tapeEl);
  const tr = el('div', { class: 'row', style: 'gap:6px;margin-top:6px' }); cT.appendChild(tr);
  const bAdd = el('button', { class: 'btn sm', type: 'button' }, '+ row'), bDel = el('button', { class: 'btn sm', type: 'button' }, '− row'); tr.append(bAdd, bDel);
  bAdd.onclick = () => { if (tape.length < 8) { tape.push(0); paintTape(); } }; bDel.onclick = () => { if (tape.length > 1) { tape.pop(); row %= tape.length; paintTape(); } };
  // the driver
  const cD = el('div', { class: 'mn sk m7-drv' }); grid.appendChild(cD); cD.innerHTML = '<div class="mn-h">driver: 4 × (10 kΩ → transistor → coil, + diode)</div>';
  const ds = sv('svg', { class: 'dg m7-dsv', viewBox: '0 0 400 206' }); cD.appendChild(ds);
  const tD = Tog(cD, 'flyback diodes fitted', true, v => { diodes = v; paintDrv(); });
  // the motor
  const cM = el('div', { class: 'mn sk m7-mot' }); grid.appendChild(cM); cM.innerHTML = '<div class="mn-h">4-coil picture · real shaft</div>';
  const mr = el('div', { class: 'm7-mrow' }); cM.appendChild(mr);
  const mh = el('div', { class: 'm7-mh' }); mr.appendChild(mh); const m = motorSvg(mh);
  const dial = sv('svg', { class: 'dg m7-dial', viewBox: '0 0 160 160' }); mr.appendChild(dial);
  const mSay = el('div', { class: 'small' }); cM.appendChild(mSay);
  // logic analyser
  const la = el('div', { class: 'm7-la' }); w.appendChild(la); const las = sv('svg', { class: 'dg' }); la.appendChild(las);
  // calculator + run
  const calc = el('div', { class: 'm7-calc' }); w.appendChild(calc);
  const kn = el('div', { class: 'm2-knobs' }); calc.appendChild(kn);
  ruler(kn, 'step angle', 1.8, 30, ang, 0.2, v => (+v).toFixed(1) + '°', v => { ang = v; paintCalc(); });
  ruler(kn, 'speed', 5, 120, rpm, 5, v => v + ' rpm', v => { rpm = v; paintCalc(); });
  ruler(kn, 'revolutions', 0.5, 5, rev, 0.5, v => v, v => { rev = v; paintCalc(); });
  const work = el('div', { class: 'icard m7-work' }); calc.appendChild(work);
  const rb = el('div', { class: 'row' }); calc.appendChild(rb);
  const bStep = el('button', { class: 'btn sm', type: 'button' }, 'one step ▸'), bRun = el('button', { class: 'btn p', type: 'button' }, '▶ run the for loop'); rb.append(bStep, bRun);
  const sp = chipGroup(rb, [[1, 'slow motion (0.4 s / step)'], [0, 'real delay']], 1, v => { slowMode = +v === 1; });
  const prog = el('div', { class: 'say' }); calc.appendChild(prog);
  const codeH = el('div', { class: 'mt' }); w.appendChild(codeH); const cd = MCode(codeH);

  function paintTape() {
    tapeEl.innerHTML = '';
    tape.forEach((c, r) => { const rw = el('div', { class: 'm7-row' + (r === row ? ' cur' : '') }); rw.appendChild(el('span', { class: 'm7-ri' }, r)); [3, 2, 1, 0].forEach(b => { const h = el('button', { class: 'm7-hole' + ((c >> b) & 1 ? ' on' : ''), type: 'button', 'aria-label': `row ${r} bit ${b}` }); h.onclick = () => { tape[r] ^= 1 << b; pre.set(''); paintTape(); }; rw.appendChild(h); }); rw.appendChild(el('b', { class: 'm7-hex' }, hx(c, 1).slice(2))); tapeEl.appendChild(rw); });
    genCode();
  }
  // driver schematic
  const CH = [['C', 3, 'Q4'], ['D', 2, 'Q3'], ['A', 1, 'Q2'], ['B', 0, 'Q1']];
  (function buildDrv() {
    let s = '<path d="M8 14 H392" class="ink" style="stroke-width:2.4"/><text x="392" y="11" text-anchor="end" class="lbl" style="font-size:12px">+12 V</text>';
    CH.forEach(([k, bit, q], i) => { const cx = 60 + i * 92;
      s += `<g class="m7-ch" data-i="${i}"><path class="m7-cur" d="M${cx} 14 V28 M${cx} 70 V100 M${cx} 132 V146"/><path class="m7-fly" d="M${cx} 70 H${cx + 26} V14 M${cx} 14"/>`;
      s += `<rect class="coil m7-coil" x="${cx - 12}" y="28" width="24" height="42" rx="5"/>`; for (let j = 0; j < 4; j++) s += `<path d="M${cx - 12} ${33 + j * 9} q12 5 24 0" class="ink2"/>`;
      s += `<text x="${cx - 18}" y="54" text-anchor="end" class="lbl" style="font-size:15px">${k}</text>`;
      s += `<g class="m7-diode"><path d="M${cx + 26} 46 l-7 10 h14 z" class="ink" style="fill:var(--card)"/><path d="M${cx + 19} 45 h14" class="ink"/></g>`;
      s += `<circle class="m7-q" cx="${cx}" cy="116" r="15"/><path d="M${cx - 6} 106 V126 M${cx - 6} 112 L${cx} 101 M${cx - 6} 120 L${cx} 131" class="ink"/><text x="${cx + 18}" y="121" class="mono" style="font-size:10px">${q}</text>`;
      s += `<path d="M${cx - 9} 147 h18 M${cx - 5} 151 h10 M${cx - 2} 155 h4" class="ink"/>`;
      s += `<path class="m7-base" d="M${cx - 34} 176 V116 H${cx - 15}"/><path d="M${cx - 34} 160 l-5 -3 l10 -4 l-10 -4 l10 -4 l-5 -3" class="ink" style="fill:none"/>`;
      s += `<rect class="m7-pin" x="${cx - 54}" y="176" width="40" height="22" rx="5"/><text x="${cx - 34}" y="191" text-anchor="middle" class="mono" style="font-size:11px">P0.${bit}</text>`;
      s += `<text class="m7-zap" x="${cx + 14}" y="98" style="font-size:22px">⚡</text></g>`; });
    ds.innerHTML = s;
  })();
  const chs = $$('.m7-ch', ds);
  function paintDrv() {
    const on = coilsOf(code); CH.forEach(([k], i) => { const g = chs[i]; g.classList.toggle('on', !!on[k]); g.classList.toggle('fly', fly[i] > 0 && diodes); g.classList.toggle('zap', fly[i] > 0 && !diodes); g.querySelector('.m7-diode').style.opacity = diodes ? 1 : .12; });
  }
  function paintDial() {
    const n = Math.min(200, Math.round(360 / ang)); let s = '<circle cx="80" cy="80" r="70" class="m7-dface"/>';
    for (let k = 0; k < n; k++) { const a = k * ang * Math.PI / 180 - Math.PI / 2, r1 = k % 5 ? 64 : 58; s += `<path d="M${80 + Math.cos(a) * r1} ${80 + Math.sin(a) * r1} L${80 + Math.cos(a) * 70} ${80 + Math.sin(a) * 70}" style="stroke:var(--ink3);stroke-width:${k % 5 ? .8 : 1.4}"/>`; }
    const a = shaft * Math.PI / 180 - Math.PI / 2; s += `<path d="M80 80 L${80 + Math.cos(a) * 56} ${80 + Math.sin(a) * 56}" style="stroke:var(--red);stroke-width:4;stroke-linecap:round"/><circle cx="80" cy="80" r="6" style="fill:var(--ink)"/>`;
    s += `<text x="80" y="112" text-anchor="middle" class="mono" style="font-size:12px">${shaft.toFixed(1)}°</text><text x="80" y="126" text-anchor="middle" class="mono" style="font-size:10px;fill:var(--ink3)">${(shaft / 360).toFixed(2)} rev</text>`;
    dial.innerHTML = s;
  }
  function paintLA() {
    const Wd = Math.max(260, la.clientWidth), H = 118, L = 46, R = Wd - 6, n = Wd < 500 ? 8 : 12; las.setAttribute('viewBox', `0 0 ${Wd} ${H}`); las.setAttribute('height', H);
    const hs = hist.slice(-n); let s = ''; const X = k => L + k * (R - L) / n;
    ['A', 'B', 'C', 'D'].forEach((k, r) => { const y0 = 6 + r * 27; s += `<text x="4" y="${y0 + 15}" class="lbl" style="font-size:13px">coil ${k}</text>`; if (!hs.length) return; const pts = hs.map((c, j) => [j, coilsOf(c)[k]]); s += `<path d="${digi(pts.concat([[hs.length, pts[pts.length - 1][1]]]), X, y0, y0 + 18)}" style="fill:none;stroke:${['var(--pink)', 'var(--blue)', 'var(--green)', 'var(--orange)'][r]};stroke-width:2.4"/>`; });
    hs.forEach((c, j) => { s += `<text x="${(X(j) + X(j + 1)) / 2}" y="${H - 2}" text-anchor="middle" class="mono" style="font-size:10px;fill:var(--ink3)">${hx(c, 1).slice(2)}</text>`; });
    las.innerHTML = s;
  }
  const calcV = () => { const spr = 360 / ang, tRev = 60 / rpm, ms = tRev / spr * 1000, N = Math.round(rev * spr); return { spr, tRev, ms, N }; };
  function paintCalc() {
    const { spr, tRev, ms, N } = calcV();
    work.innerHTML = `<div class="ih">exam working (S1)</div><div class="m7-wk">1 revolution at ${rpm} rpm takes 60 / ${rpm} = <b>${tRev.toFixed(3)} s</b><br>steps per revolution = 360° / ${(+ang).toFixed(1)}° = <b>${+spr.toFixed(2)}</b><br>delay per step = ${tRev.toFixed(3)} s / ${+spr.toFixed(2)} = <b>${ms.toFixed(2)} ms</b> → Timer0: PR = 0, MR0 = ${ms.toFixed(2)} ms × 3 MHz = <b>${Math.round(ms * 3000)}</b><br>steps needed = ${rev} × ${+spr.toFixed(2)} = <b>${N}</b> → <code>for(i = 0; i &lt; ${N}; i++)</code></div>`;
    genCode();
  }
  function genCode() { const { ms, N } = calcV(); cd.set([`unsigned int step_pos[] = { ${tape.map(c => hx(c, 1)).join(', ')} };   // the tape`, 'LPC_GPIO0->FIODIR = 0x0F;                  // P0.3–P0.0 outputs', `for(i = 0; i < ${N}; i++) {`, `    LPC_GPIO0->FIOPIN = step_pos[i % ${tape.length}];`, `    delay();          // Timer0, MR0 = ${Math.round(ms * 3000)} → ${ms.toFixed(2)} ms`, '}']); }
  function stepOnce() {
    const prev = code; row = (row + 1) % tape.length; code = tape[row];
    const on0 = coilsOf(prev), on1 = coilsOf(code); CH.forEach(([k], i) => { if (on0[k] && !on1[k]) { fly[i] = .5; if (!diodes) zaps++; } });
    const a0 = codeAngle(prev), a1 = codeAngle(code); let txt;
    if (a1 == null) { stall++; txt = 'opposite coils pull against each other → <b>no step</b> (the rotor just sits)'; }
    else if (a0 == null) txt = 'rotor snaps to the new coils';
    else { const d = ((a1 - a0) % 360 + 540) % 360 - 180; if (Math.abs(Math.abs(d) - 180) < 1) { stall++; txt = '<span class="p-red">jump of 180° — the rotor can\'t tell which way → it stalls / jitters</span>'; } else if (Math.abs(d) < 1) txt = 'same position — no movement'; else { shaft += d / 90 * ang; txt = d > 0 ? `one step <b>clockwise</b> (+${(+ang).toFixed(1)}°)` : `one step <b>anticlockwise</b> (−${(+ang).toFixed(1)}°)`; } }
    m.set(code, !run || !slowMode ? false : true); steps++; hist.push(code); if (hist.length > 40) hist.shift();
    mSay.innerHTML = `FIOPIN = <b>${hx(code, 1)}</b> = ${bin(code, 4)} → coils ${Object.entries(on1).filter(([, v]) => v).map(([k]) => k).join(' + ') || 'none'} ON · ${txt}${zaps ? `<br><span class="p-red">⚡ ${zaps} voltage spike${zaps > 1 ? 's' : ''} hit the transistors (no diodes!)</span>` : ''}`;
    paintTape(); paintDrv(); paintDial(); paintLA();
  }
  bStep.onclick = () => { if (run) stop(); stepOnce(); };
  function stop() { clearTimeout(run); run = null; bRun.textContent = '▶ run the for loop'; }
  bRun.onclick = () => {
    if (run) return stop(); const { ms, N } = calcV(); let i = 0; const start = shaft; bRun.textContent = '❚❚ stop';
    const tick = () => { if (i >= N) { stop(); prog.innerHTML = `Done: ${N} steps → shaft turned <b>${(shaft - start).toFixed(1)}°</b> = ${((shaft - start) / 360).toFixed(2)} rev${stall ? ' (with stalls — check the tape order!)' : ''}.`; return; } stepOnce(); i++; prog.innerHTML = `i = ${i} / ${N} · FIOPIN = step_pos[${(i - 1) % tape.length}] = ${hx(code, 1)} · turned ${(shaft - start).toFixed(1)}° · ${slowMode ? 'slow motion' : `real speed: ${ms.toFixed(1)} ms per step`}`; run = setTimeout(tick, slowMode ? 400 : Math.max(16, ms)); };
    stall = 0; row = tape.length - 1; tick();
  };
  const lp = Loop(w, dt => { let ch = false; fly.forEach((f, i) => { if (f > 0) { fly[i] = Math.max(0, f - dt); ch = true; } }); if (ch) paintDrv(); });
  new ResizeObserver(() => paintLA()).observe(la);
  paintTape(); paintCalc(); m.set(code, false); hist.push(code); paintDrv(); paintDial(); paintLA(); lp.start();
  mSay.innerHTML = 'FIOPIN = 0x3 → coils A + B ON. Press <b>one step ▸</b>.';
});

/* ===================================================================
   M8 · chapter 8 in one widget — the PWM record player (dial + mixing desk)
   =================================================================== */
const PWM_PIN = ['', 'P1.18', 'P1.20', 'P1.21', 'P1.23', 'P1.24', 'P1.26'];
BUILD.push(function wM8() {
  const w = MW('w-m8', 'the PWM record player', 'one turn = one period · the hand is TC · pegs are MR1–MR6 · drag a peg');
  let MR0 = 100, tc = 0, per = 3, run = true, lerAuto = false, ler = 0, breathe = false, bdir = 1, pwmEn = true, frozen = false, irFlash = 0, irq = 0;
  const MCR = { I: 1, R: 1, S: 0 };
  const mr = [100, 41, 78, 53, 27, 65, 90], sh = mr.slice(), sel = [0, 0, 1, 0, 1, 0, 0], ena = [0, 0, 1, 0, 1, 1, 0], flash = Array(7).fill(0);
  const top = el('div', { class: 'm8-top' }); w.appendChild(top);
  const c1 = el('div', { class: 'col' }); top.appendChild(c1); c1.appendChild(el('span', { class: 'gae small' }, 'load:'));
  chipGroup(c1, [['slide', 'slide example (MR0 = 100)'], ['w1', 'W1 · breathing LED on PWM1.4']], 'slide', v => load(v));
  const c2 = el('div', { class: 'col' }); top.appendChild(c2); c2.appendChild(el('span', { class: 'gae small' }, 'PWM1MCR for MR0 (tap)'));
  const mcrC = el('div', { class: 'chips' }); c2.appendChild(mcrC);
  [['I', 'interrupt'], ['R', 'reset'], ['S', 'stop']].forEach(([k, t]) => { const b = el('button', { class: 'chip' + (MCR[k] ? ' on' : ''), type: 'button', style: '--cc:var(--n-p)' }, t); b.onclick = () => { MCR[k] ^= 1; b.classList.toggle('on', !!MCR[k]); if (MCR.R && !MCR.S && frozen) { frozen = false; tc = 0; } genCode(); }; mcrC.appendChild(b); b._k = k; });
  const c3 = el('div', { class: 'row', style: 'gap:6px' }); top.appendChild(c3);
  const tEn = Tog(c3, '<code>PWM1TCR</code> bit 3 · PWM enable', true, v => { pwmEn = v; genCode(); });
  const tAuto = Tog(c3, 'set LER after every write', false, v => { lerAuto = v; });
  const bLer = el('button', { class: 'btn sm y', type: 'button' }, 'LER = 0x7F'); c3.appendChild(bLer); bLer.onclick = () => { ler = 0x7F; };
  const tBr = Tog(c3, 'ISR: <code>MR4 ± step; LER</code> (W1)', false, v => { breathe = v; });
  ruler(top, 'one period on screen', 1, 8, per, .5, v => v + ' s (slow motion)', v => per = v);
  const main = el('div', { class: 'm8-main' }); w.appendChild(main);
  const dWrap = el('div', { class: 'm8-dialw' }); main.appendChild(dWrap);
  const dial = sv('svg', { class: 'dg m8-dial', viewBox: '0 0 300 300', 'aria-label': 'PWM dial: drag the numbered pegs' }); dWrap.appendChild(dial);
  const dInfo = el('div', { class: 'm8-dinfo' }); dWrap.appendChild(dInfo);
  const desk = el('div', { class: 'm8-desk' }); main.appendChild(desk);
  const strips = [null];
  for (let n = 1; n <= 6; n++) {
    const s = el('div', { class: 'm8-strip' }); desk.appendChild(s);
    s.innerHTML = `<div class="m8-sh"><b>PWM1.${n}</b><small>${PWM_PIN[n]}</small></div>`;
    const row = el('div', { class: 'm8-sw' }); s.appendChild(row);
    const bS = el('button', { class: 'm8-b', type: 'button' }); if (n === 1) { bS.disabled = true; } bS.onclick = () => { sel[n] ^= 1; genCode(); }; row.appendChild(bS);
    const bE = el('button', { class: 'm8-b', type: 'button' }); bE.onclick = () => { ena[n] ^= 1; genCode(); }; row.appendChild(bE);
    const r = el('input', { type: 'range', class: 'm8-fader', min: 0, max: MR0, value: mr[n], 'aria-label': `MR${n}` }); s.appendChild(r); r.oninput = () => write(n, +r.value);
    const v = el('div', { class: 'm8-v' }); s.appendChild(v);
    const bL = el('button', { class: 'm8-b ler', type: 'button' }, `LER bit ${n}`); bL.onclick = () => { ler |= 1 << n; }; s.appendChild(bL);
    const led = el('div', { class: 'm8-led' }, '<span class="led"></span><small></small>'); s.appendChild(led);
    strips.push({ s, bS, bE, r, v, bL, led });
  }
  const irRow = el('div', { class: 'm8-ir' }); w.appendChild(irRow);
  const unroll = el('div', { class: 'm8-un' }); w.appendChild(unroll); const us = sv('svg', { class: 'dg' }); unroll.appendChild(us);
  const log = el('div', { class: 'say m8-log' }); w.appendChild(log);
  const codeH = el('div', { class: 'mt' }); w.appendChild(codeH); const cd = MCode(codeH);

  function load(k) {
    if (k === 'w1') { MR0 = 30000; mr.splice(0, 7, 30000, 15000, 15000, 15000, 50, 15000, 15000); sel.fill(0); ena.fill(0); ena[4] = 1; breathe = true; lerAuto = false; MCR.I = 1; MCR.R = 1; MCR.S = 0; }
    else { MR0 = 100; mr.splice(0, 7, 100, 41, 78, 53, 27, 65, 90); sel.fill(0); sel[2] = sel[4] = 1; ena.fill(0); ena[2] = ena[4] = ena[5] = 1; breathe = false; }
    for (let i = 0; i < 7; i++) sh[i] = mr[i]; tc = 0; frozen = false; ler = 0; tBr.set(breathe); tAuto.set(lerAuto); $$('.chip', mcrC).forEach(b => b.classList.toggle('on', !!MCR[b._k]));
    strips.forEach((s, n) => { if (s) { s.r.max = MR0; s.r.value = mr[n]; } });
    say(k === 'w1' ? 'W1: MR0 = 30000 → 10 ms period. Every Match 0 the <b>interrupt</b> runs PWM1_IRQHandler: MR4 += step and LER — so the duty of PWM1.4 slowly sweeps up and down.' : 'The slide example: MR0 = 100, PWM2 and PWM4 double edge, PWM5 single edge. <b>Drag a peg</b> or a fader.');
    genCode();
  }
  function write(n, v) { mr[n] = clamp(Math.round(v), 0, MR0); strips[n].r.value = mr[n]; if (lerAuto) ler |= 1 << n; }
  const say = h => log.innerHTML = h;
  const lv = (n, t) => { if (!sel[n] || n === 1) return t < sh[n] ? 1 : 0; const a = sh[n - 1], b = sh[n]; if (a === b) return 0; return a < b ? (t >= a && t < b ? 1 : 0) : (t >= a || t < b ? 1 : 0); };
  const duty = n => { if (!ena[n] || !pwmEn) return 0; let h = 0; const N = 200; for (let k = 0; k < N; k++) h += lv(n, (k + .5) / N * MR0); return h / N; };
  let outs = Array(7).fill(0);
  const ang = v => (v / MR0) * 360 - 90, P = (r, a) => [150 + r * Math.cos(a * Math.PI / 180), 150 + r * Math.sin(a * Math.PI / 180)];
  const arc = (r, a0, a1) => { if (a1 - a0 >= 359.9) return `M${150 - r} 150 a${r} ${r} 0 1 1 ${2 * r} 0 a${r} ${r} 0 1 1 ${-2 * r} 0`; const [x0, y0] = P(r, a0), [x1, y1] = P(r, a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const CC = ['', 'var(--pink)', 'var(--blue)', 'var(--green)', 'var(--orange)', 'var(--purple)', 'var(--teal)'];
  function drawDial() {
    let s = `<circle cx="150" cy="150" r="146" class="m8-rec"/><circle cx="150" cy="150" r="140" class="m8-groove"/>`;
    for (let n = 1; n <= 6; n++) { const r = 118 - (n - 1) * 15; s += `<circle cx="150" cy="150" r="${r}" class="m8-track"/>`;
      if (ena[n] && pwmEn) { let a = null; const N = 240; for (let k = 0; k <= N; k++) { const t = k / N * MR0, h = k < N && lv(n, t); if (h && a === null) a = t; if ((!h || k === N) && a !== null) { s += `<path d="${arc(r, ang(a), ang(t))}" style="fill:none;stroke:${CC[n]};stroke-width:10;stroke-linecap:butt;opacity:.85"/>`; a = null; } } }
      else s += `<circle cx="150" cy="150" r="${r}" style="fill:none;stroke:var(--ink3);stroke-width:1;stroke-dasharray:2 5"/>`;
      const [lx, ly] = P(r, -97); s += `<text x="${lx}" y="${ly + 4}" text-anchor="end" class="mono" style="font-size:9.5px;fill:var(--ink3)">${n}</text>`; }
    // MR0 at the top
    s += `<rect x="140" y="0" width="20" height="18" rx="4" class="m8-peg0${flash[0] > 0 ? ' fl' : ''}"/><text x="150" y="13" text-anchor="middle" class="mono" style="font-size:11px">0</text>`;
    const used = n => ena[n] || (n < 6 && sel[n + 1] && ena[n + 1]);
    for (let n = 1; n <= 6; n++) { if (!used(n)) continue; if (mr[n] !== sh[n]) { const [gx, gy] = P(136, ang(mr[n])); s += `<circle cx="${gx}" cy="${gy}" r="9" class="m8-ghost"/>`; }
      const [x, y] = P(136, ang(Math.min(sh[n], MR0))); s += `<g class="m8-peg${flash[n] > 0 ? ' fl' : ''}" data-n="${n}"><circle cx="${x}" cy="${y}" r="10" style="fill:${CC[n]}"/><text x="${x}" y="${y + 4}" text-anchor="middle">${n}</text></g>`; }
    const ta = ang(Math.min(tc, MR0)); const [hx_, hy] = P(132, ta); s += `<path d="M150 150 L${hx_.toFixed(1)} ${hy.toFixed(1)}" class="m8-hand"/><circle cx="150" cy="150" r="22" class="m8-hub"/><text x="150" y="147" text-anchor="middle" class="mono" style="font-size:10px">TC</text><text x="150" y="160" text-anchor="middle" class="mono" style="font-size:12px;font-weight:700">${Math.round(tc)}</text>`;
    dial.innerHTML = s;
  }
  // drag pegs
  let drag = null;
  dial.addEventListener('pointerdown', e => { const g = e.target.closest('.m8-peg'); if (!g) return; drag = +g.dataset.n; dial.setPointerCapture(e.pointerId); e.preventDefault(); });
  dial.addEventListener('pointermove', e => { if (!drag) return; const r = dial.getBoundingClientRect(); const a = Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2) * 180 / Math.PI + 90; write(drag, ((a % 360) + 360) % 360 / 360 * MR0); if (!lerAuto && !(ler >> drag & 1)) say(`MR${drag} = ${mr[drag]} written — but the <b>shadow</b> still holds ${sh[drag]} (solid peg). Hollow peg = waiting. Press <b>LER bit ${drag}</b>; it latches at the next Match 0.`); });
  ['pointerup', 'pointercancel'].forEach(k => dial.addEventListener(k, () => drag = null));
  function paintDesk() {
    for (let n = 1; n <= 6; n++) { const S = strips[n], d = duty(n), dbl = n > 1 && sel[n];
      S.bS.innerHTML = n === 1 ? 'single only' : `PWMSEL${n}: <b>${dbl ? 'double' : 'single'}</b>`; S.bS.classList.toggle('on', !!dbl);
      S.bE.innerHTML = `PWMENA${n}: <b>${ena[n] ? 'on' : 'off'}</b>`; S.bE.classList.toggle('on', !!ena[n]);
      S.v.innerHTML = `MR${n} = <b>${mr[n]}</b>${mr[n] !== sh[n] ? ` <span class="p-red">(shadow ${sh[n]})</span>` : ''}<br><span class="p-faint">set: Match ${dbl ? n - 1 : 0} · reset: Match ${n}</span>`;
      S.bL.classList.toggle('on', !!(ler >> n & 1));
      const L = S.led.querySelector('.led'); L.classList.toggle('on', d > 0.01); L.style.opacity = (0.25 + 0.75 * d).toFixed(2); S.led.querySelector('small').innerHTML = ena[n] && pwmEn ? `duty ${(d * 100).toFixed(0)}% · V<sub>AVG</sub> ${(d * 3.3).toFixed(2)} V` : 'output off';
      S.s.classList.toggle('dead', !ena[n]); S.s.classList.toggle('hi', !!outs[n]); }
  }
  function drawUnroll() {
    const Wd = Math.max(260, unroll.clientWidth), on = [1, 2, 3, 4, 5, 6].filter(n => ena[n] && pwmEn), rh = 24, H = 40 + on.length * (rh + 8) + 14, L = 64, R = Wd - 8;
    us.setAttribute('viewBox', `0 0 ${Wd} ${H}`); us.setAttribute('height', H); const X = t => L + t / (2 * MR0) * (R - L);
    let s = `<text x="4" y="24" class="lbl" style="font-size:13px">TC</text><path d="M${X(0)} 34 L${X(MR0)} 8 V34 L${X(2 * MR0)} 8 V34" style="fill:var(--hl-b);stroke:var(--blue);stroke-width:1.6"/>`;
    for (let n = 1; n <= 6; n++) s += `<path d="M${X(sh[n])} 4 V${H - 12} M${X(MR0 + sh[n])} 4 V${H - 12}" style="stroke:${CC[n]};stroke-dasharray:3 4;opacity:.55"/>`;
    on.forEach((n, k) => { const y = 42 + k * (rh + 8); const pts = []; let p = null; for (let q = 0; q <= 400; q++) { const t = q / 400 * 2 * MR0, l = lv(n, t % MR0); if (l !== p) { pts.push([t, l]); p = l; } } pts.push([2 * MR0, p]); s += `<text x="4" y="${y + 16}" class="lbl" style="font-size:13px">PWM1.${n}</text><path d="${digi(pts, X, y, y + rh)}" style="fill:none;stroke:${CC[n]};stroke-width:2.4"/>`; });
    s += `<path d="M${X(tc % MR0)} 4 V${H - 12}" style="stroke:var(--red);stroke-width:2"/><text x="${R}" y="${H - 1}" text-anchor="end" class="mono" style="font-size:10.5px;fill:var(--ink3)">${Wd < 560 ? '' : 'two periods, unrolled · '}period = MR0 × (PR+1) / 3 MHz = ${MR0 >= 1000 ? (MR0 / 3000).toFixed(2) + ' ms' : (MR0 / 3).toFixed(1) + ' µs'}</text>`;
    us.innerHTML = s;
  }
  function genCode() {
    const pcr = [2, 3, 4, 5, 6].reduce((a, n) => a | (sel[n] << n), 0) | [1, 2, 3, 4, 5, 6].reduce((a, n) => a | (ena[n] << (8 + n)), 0), mcr = MCR.I | MCR.R << 1 | MCR.S << 2;
    cd.set([`LPC_PWM1->PR  = 0;                 // count every PCLK (3 MHz)`, `LPC_PWM1->MR0 = ${mr[0]};            // the period`, ...[1, 2, 3, 4, 5, 6].filter(n => ena[n] || (n < 6 && sel[n + 1] && ena[n + 1])).map(n => `LPC_PWM1->MR${n} = ${mr[n]};`), `LPC_PWM1->PCR = ${hex(pcr)};      // PWMSEL${[2, 3, 4, 5, 6].filter(n => sel[n]).join(',') || '–'} · PWMENA${[1, 2, 3, 4, 5, 6].filter(n => ena[n]).join(',') || '–'}`, `LPC_PWM1->MCR = ${hx(mcr)};             // MR0: ${[MCR.I && 'interrupt', MCR.R && 'reset', MCR.S && 'stop'].filter(Boolean).join(' + ') || 'nothing'}`, 'LPC_PWM1->LER = 0x7F;              // latch MR0–MR6 at the next Match 0', `LPC_PWM1->TCR = ${pwmEn ? '0x09;              // counter + PWM enable' : '0x01;              // counter only: NO PWM outputs!'}`, ...(breathe ? ['NVIC_EnableIRQ(PWM1_IRQn);  // ISR: IR = 1; MR4 ± step; LER = 0x7F;'] : [])]);
  }
  const lp = Loop(w, dt => {
    if (!run) return; flash.forEach((f, i) => flash[i] = Math.max(0, f - dt)); irFlash = Math.max(0, irFlash - dt);
    if (!frozen) {
      const old = tc; tc += dt / per * MR0;
      for (let n = 1; n <= 6; n++) if (old < sh[n] && tc >= sh[n]) flash[n] = .3;
      if (tc >= MR0) {
        flash[0] = .4; if (MCR.I) { irFlash = .5; irq++; }
        if (MCR.S) { tc = MR0; frozen = true; say('<span class="p-red">MCR stop bit: TC stops at MR0 → no more periods → the outputs freeze.</span>'); }
        else if (!MCR.R) { frozen = true; tc = MR0; say('<span class="p-red">No reset on MR0: TC runs on past MR0 (towards 2³²) → no new period starts → the outputs freeze.</span>'); }
        else { tc -= MR0; // Match 0: new period, latch shadows
          if (ler) { const l = []; for (let n = 0; n <= 6; n++) if (ler >> n & 1) { if (sh[n] !== mr[n]) l.push(n); sh[n] = mr[n]; } if (l.length) say(`Match 0 + LER → shadow register${l.length > 1 ? 's' : ''} for MR${l.join(', MR')} updated → the new values start <b>with this period</b>. LER clears itself.`); ler = 0; }
          if (breathe && MCR.I) { const st = Math.round(MR0 / 12); mr[4] = clamp(mr[4] + bdir * st, 0, MR0); if (mr[4] >= MR0 - st / 2 || mr[4] <= st / 2) bdir *= -1; ler |= 0x7F; strips[4].r.value = mr[4]; }
        }
      }
    }
    for (let n = 1; n <= 6; n++) outs[n] = ena[n] && pwmEn ? lv(n, frozen && n > 0 ? (sel[n] ? tc : 0) : tc) : 0;
    drawDial(); paintDesk(); drawUnroll();
    dInfo.innerHTML = `TC counts 0 → MR0 (${MR0}) then resets: <b>Match 0</b> starts every period${pwmEn ? '' : ' <span class="p-red">· PWM disabled: plain timer, pins idle</span>'}${breathe && !MCR.I ? '<br><span class="p-red">W1 needs the MR0 interrupt bit — no interrupt, no breathing!</span>' : ''}`;
    irRow.innerHTML = `<span class="gae">PWM1IR</span>${[['MR0', 0], ['MR1', 1], ['MR2', 2], ['MR3', 3], ['CAP0', 4], ['CAP1', 5], ['MR4', 8], ['MR5', 9], ['MR6', 10]].map(([k, b]) => `<span class="${b === 0 && irFlash > 0 ? 'one' : ''}${b && b !== 0 ? ' dim' : ''}"><small>bit ${b}</small><b>${b === 0 && irFlash > 0 ? 1 : 0}</b><i>${k}</i></span>`).join('')}<span class="small p-soft">MR0 interrupts so far: <b>${irq}</b>${MCR.I ? ' → PWM1_IRQHandler (write 1 to clear)' : ' (interrupt bit off)'}</span>`;
  });
  new ResizeObserver(() => drawUnroll()).observe(unroll);
  load('slide'); lp.start();
});

/* ===================================================================
   M9 · chapter 9 in one widget — the UART link (init checklist + wire scope)
   =================================================================== */
const lcrFmt = L => ({ nb: (L & 3) + 5, stop: L & 4 ? 2 : 1, par: L & 8 ? ['odd', 'even', '1', '0'][(L >> 4) & 3] : 'none' });
const fmtTxt = f => `${f.nb}${{ none: 'N', odd: 'O', even: 'E', 1: '1', 0: '0' }[f.par]}${f.stop}`;
function uartDecode(tx, rx) { // tx = {bits:[v...], baud}, rx = {nb, par, stop, baud}; idle = 1 before/after
  const Tt = 1 / tx.baud, lvl = t => { const k = Math.floor(t / Tt) - 1; return k >= 0 && k < tx.bits.length ? tx.bits[k] : 1; };
  const t0 = Tt; // falling edge of the start bit
  const Tr = 1 / rx.baud, smp = [], at = k => t0 + (k + .5) * Tr;
  const s0 = lvl(at(0)); smp.push({ t: at(0), v: s0, role: 'start' });
  if (s0 !== 0) return { falseStart: true, smp, lvl, Tt, end: (tx.bits.length + 2) * Tt };
  let d = 0, ones = 0; for (let i = 0; i < rx.nb; i++) { const v = lvl(at(1 + i)); smp.push({ t: at(1 + i), v, role: 'D' + i }); d |= v << i; ones += v; }
  let pe = 0, k = 1 + rx.nb; if (rx.par !== 'none') { const v = lvl(at(k)); smp.push({ t: at(k), v, role: 'P' }); const want = rx.par === 'odd' ? (ones % 2 ? 0 : 1) : rx.par === 'even' ? ones % 2 : rx.par === '1' ? 1 : 0; pe = v !== want ? 1 : 0; k++; }
  const sv_ = lvl(at(k)); smp.push({ t: at(k), v: sv_, role: 'stop' }); const fe = sv_ === 0 ? 1 : 0;
  return { d, pe, fe, smp, lvl, Tt, end: Math.max((tx.bits.length + 2) * Tt, at(k) + Tr) };
}
BUILD.push(function wM9() {
  const w = MW('w-m9', 'the UART link', 'tick the init lines · type on the PC · watch where the receiver samples each bit');
  const fmt = { nb: 8, par: 'none', stop: 1 }; let dll = 0x13, pc = { baud: 9600, nb: 8, par: 'none', stop: 1 }, noise = false;
  const on = { pin: 1, lcr1: 1, dlm: 1, dll: 1, lcr2: 1, fcr: 1, ier: 1, nvic: 1 };
  let R, lsr, fifo, term = '', frame = null, queue = [], T = 0, journey = -1, lastNote = '';
  const lcrOf = () => (fmt.nb - 5) | (fmt.stop === 2 ? 4 : 0) | (fmt.par !== 'none' ? 8 | ({ odd: 0, even: 1 }[fmt.par] << 4) : 0);
  const grid = el('div', { class: 'm9-grid' }); w.appendChild(grid);
  /* LPC side: init checklist */
  const cI = el('div', { class: 'mn sk m9-init' }); grid.appendChild(cI); cI.innerHTML = '<div class="mn-h">LPC1768 · <code>UART0_Init()</code> — tick the lines it runs</div>';
  const fRow = el('div', { class: 'm9-fmt' }); cI.appendChild(fRow);
  const fc = (lab, items, cur, f) => { const c = el('div', { class: 'col' }); fRow.appendChild(c); c.appendChild(el('span', { class: 'gae small' }, lab)); chipGroup(c, items, cur, v => { f(v); reinit(); }); };
  fc('word length', [[5, '5'], [6, '6'], [7, '7'], [8, '8']], 8, v => fmt.nb = +v);
  fc('parity', [['none', 'none'], ['odd', 'odd'], ['even', 'even']], 'none', v => fmt.par = v);
  fc('stop', [[1, '1'], [2, '2']], 1, v => fmt.stop = +v);
  const dr = el('div', { class: 'row', style: 'gap:8px;margin:4px 0' }); cI.appendChild(dr);
  const dIn = el('input', { class: 'inp', type: 'number', min: 1, max: 255, value: dll, style: 'width:5em', 'aria-label': 'DLL value' }); dr.append(el('span', { class: 'gae small' }, 'DLL ='), dIn, el('span', { class: 'small p-soft' }, '(19 = 0x13 in U1)')); dIn.oninput = () => { dll = clamp(+dIn.value || 1, 1, 255); reinit(); };
  const list = el('div', { class: 'm9-list' }); cI.appendChild(list);
  const LINES = [['pin', () => 'LPC_PINCON->PINSEL0 |= 0x50;', 'P0.2 = TXD0, P0.3 = RXD0'], ['lcr1', () => `LPC_UART0->LCR = ${hx(0x80 | lcrOf())};`, `${fmtTxt(fmt)} + DLAB = 1`], ['dlm', () => 'LPC_UART0->DLM = 0x00;', 'divisor, high byte'], ['dll', () => `LPC_UART0->DLL = ${hx(dll)};`, `divisor, low byte`], ['lcr2', () => `LPC_UART0->LCR = ${hx(lcrOf())};`, 'DLAB back to 0'], ['fcr', () => 'LPC_UART0->FCR = 0x07;', 'FIFOs on + reset'], ['ier', () => 'LPC_UART0->IER = 0x03;', 'RDA + THRE interrupts'], ['nvic', () => 'NVIC_EnableIRQ(UART0_IRQn);', 'NVIC']];
  const lineEls = LINES.map(([k, f, n]) => { const b = el('button', { class: 'm9-line', type: 'button' }); b.onclick = () => { on[k] ^= 1; reinit(); }; list.appendChild(b); return { k, f, n, b }; });
  const initSay = el('div', { class: 'small m9-isay' }); cI.appendChild(initSay);
  /* LPC registers */
  const cR = el('div', { class: 'mn sk m9-regs' }); grid.appendChild(cR); cR.innerHTML = '<div class="mn-h">UART0 registers (after init)</div>';
  const regB = el('div'); cR.appendChild(regB);
  const lsrB = el('div', { class: 'm9-lsr' }); cR.appendChild(lsrB);
  const iirB = el('div', { class: 'small' }); cR.appendChild(iirB);
  /* PC side */
  const cP = el('div', { class: 'mn sk m9-pc' }); grid.appendChild(cP); cP.innerHTML = '<div class="mn-h">PC · terminal program</div>';
  const pcF = el('div', { class: 'm9-fmt' }); cP.appendChild(pcF);
  const pcc = (lab, items, cur, f) => { const c = el('div', { class: 'col' }); pcF.appendChild(c); c.appendChild(el('span', { class: 'gae small' }, lab)); chipGroup(c, items, cur, v => { f(v); paint(); }); };
  pcc('baud', [[2400, '2400'], [4800, '4800'], [9600, '9600'], [19200, '19200']], 9600, v => pc.baud = +v);
  pcc('format', [['8N1', '8N1'], ['7E1', '7E1'], ['8O1', '8O1']], '8N1', v => Object.assign(pc, { '8N1': { nb: 8, par: 'none', stop: 1 }, '7E1': { nb: 7, par: 'even', stop: 1 }, '8O1': { nb: 8, par: 'odd', stop: 1 } }[v]));
  const termEl = el('div', { class: 'term m9-term' }); cP.appendChild(termEl);
  const kr = el('div', { class: 'row', style: 'gap:8px' }); cP.appendChild(kr);
  const kIn = el('input', { class: 'inp', maxlength: 1, placeholder: 'type', style: 'width:5em', 'aria-label': 'PC keyboard' }); kr.append(el('span', { class: 'gae small' }, 'PC keyboard:'), kIn);
  kIn.addEventListener('input', () => { const c = kIn.value; kIn.value = ''; if (c) pcSends(c); });
  const qb = el('div', { class: 'chips' }); kr.appendChild(qb); ['A', 'U', 'z'].forEach(c => { const b = el('button', { class: 'chip', type: 'button' }, `'${c}'`); b.onclick = () => pcSends(c); qb.appendChild(b); });
  const nz = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-p)' }, '⚡ noise on next frame'); kr.appendChild(nz); nz.onclick = () => { noise = !noise; nz.classList.toggle('on', noise); };
  /* journey + scope */
  const jr = el('div', { class: 'm9-jr' }); w.appendChild(jr);
  const scope = el('div', { class: 'm9-scope' }); w.appendChild(scope); const ssv = sv('svg', { class: 'dg' }); scope.appendChild(ssv);
  const log = el('div', { class: 'say m9-log' }); w.appendChild(log);

  function reinit() { // run the ticked init lines in order, with DLAB deciding where each write lands
    R = { LCR: 0x00, DLL: 0x01, DLM: 0x00, IER: 0, FCR: 0, pin: 0, nvic: 0 }; const notes = []; const sent = [];
    const dlab = () => (R.LCR >> 7) & 1;
    if (on.pin) R.pin = 1; else notes.push('P0.2/P0.3 are still GPIO → the UART is not connected to the pins at all.');
    if (on.lcr1) R.LCR = 0x80 | lcrOf();
    if (on.dlm) { if (dlab()) R.DLM = 0; else { R.IER = 0; notes.push('DLM = 0 was written with DLAB = 0 → it landed in <b>IER</b>.'); } }
    if (on.dll) { if (dlab()) R.DLL = dll; else { sent.push(dll); notes.push(`DLL = ${hx(dll)} was written with DLAB = 0 → it landed in <b>THR</b>: the UART just <b>sent the byte ${hx(dll)}</b>! The divisor stays at its reset value 1.`); } }
    if (on.lcr2) R.LCR = lcrOf(); else if (on.lcr1) notes.push('DLAB is <b>still 1</b> → every THR write goes into DLL and every RBR read returns DLL. IER writes go into DLM!');
    if (on.fcr) R.FCR = 7; else notes.push('FCR bit 0 = 0: the manual says the FIFOs must be enabled for proper operation (here: a 1-byte buffer).');
    if (on.ier) { if (dlab()) { R.DLM = 3; notes.push('IER = 0x03 written with DLAB = 1 → it went into <b>DLM</b>: divisor = 3×256 + DLL!'); } else R.IER = 3; }
    if (on.nvic) R.nvic = 1;
    if (!on.lcr1 && !on.lcr2) notes.push('LCR never written → reset value 0x00 = <b>5-bit</b> words, no parity, 1 stop.');
    lsr = { RDR: 0, OE: 0, PE: 0, FE: 0, BI: 0, THRE: 1, TEMT: 1, RXFE: 0 }; fifo = []; queue = []; frame = null; journey = -1;
    initSay.innerHTML = notes.length ? notes.map(n => `<div>⚠ ${n}</div>`).join('') : '<div class="p-green">✓ exactly the U1 init: 8N1, 9600-ish baud, interrupts on.</div>';
    lineEls.forEach(({ k, f, n, b }) => { b.classList.toggle('off', !on[k]); b.innerHTML = `<span class="ck">${on[k] ? '✓' : '✗'}</span><code>${esc(f())}</code><small>${k === 'dll' ? `${n} → divisor ${R.DLM * 256 + R.DLL}` : n}</small>`; });
    if (sent.length && R.pin) setTimeout(() => lpcSends(sent[0], 'init'), 300);
    say(sent.length ? '' : 'Type a key on the PC keyboard (or tap a letter). The PC sends it; UART0 receives it; the ISR echoes it back.');
    paint();
  }
  const lpcFmt = () => lcrFmt(R.LCR), lpcBaud = () => 3e6 / (16 * Math.max(1, R.DLM * 256 + R.DLL)), dlab = () => (R.LCR >> 7) & 1;
  const say = h => { if (h) log.innerHTML = h; };
  function sched(dt, f) { queue.push({ at: T + dt, f }); }
  function mkFrame(byte, f, baud, dir) { let bits = frameBits(byte, f.nb, f.par, f.stop).map(b => b.v); if (noise) { bits[1 + Math.min(3, f.nb - 1)] ^= 1; noise = false; nz.classList.remove('on'); } return { bits, baud, f, dir, byte }; }
  function pcSends(c) {
    if (frame) { say('One character at a time — wait for this frame to finish.'); return; }
    const code = c.charCodeAt(0) & 0xFF; const fr = mkFrame(code, pc, pc.baud, 'in'); frame = fr; fr.t0 = T; fr.dec = R.pin ? uartDecode(fr, { ...lpcFmt(), baud: lpcBaud() }) : null; journey = 0;
    say(`The PC sends '${esc(c)}' = ${hx(code)} as ${fmtTxt(pc)} at ${pc.baud} baud → MAX232 → RxD0 (P0.3).`);
    sched(1.7, () => lpcReceives(fr));
  }
  function lpcReceives(fr) {
    journey = 4; const d = fr.dec;
    if (!R.pin) { say('<span class="p-red">Nothing arrives: P0.3 is still a GPIO pin (PINSEL0 line skipped).</span>'); frame = null; paint(); return; }
    if (d.falseStart) { say('The receiver saw a "start bit" that was already over at its sampling point → ignored.'); frame = null; paint(); return; }
    const mask = (1 << lpcFmt().nb) - 1, byte = d.d & mask;
    if (fifo.length >= (R.FCR & 1 ? 16 : 1)) { lsr.OE = 1; say(`<span class="p-red">RX FIFO full → this byte is <b>lost</b> → OE = 1 (overrun).</span>`); frame = null; paint(); return; }
    fifo.push(byte); lsr.RDR = 1; lsr.PE = d.pe; lsr.FE = d.fe; lsr.RXFE = (d.pe || d.fe) ? 1 : lsr.RXFE;
    say(`UART0 sampled ${lpcFmt().nb} data bits at its own speed (${lpcBaud().toFixed(0)} baud) → RBR = <b>${hx(byte)}</b>${byte >= 32 && byte < 127 ? ` ('${esc(String.fromCharCode(byte))}')` : ''}${d.pe ? ' · <span class="p-red">parity error: PE = 1</span>' : ''}${d.fe ? ' · <span class="p-red">stop bit read as 0: FE = 1</span>' : ''} · RDR = 1.`);
    frame = null; paint();
    if ((R.IER & 1) && R.nvic && !dlab()) sched(.9, isrRx);
    else sched(.2, () => say(`${lastLog()} <span class="p-red">— but ${dlab() ? 'DLAB = 1 (IER is unreachable)' : !(R.IER & 1) ? 'IER bit 0 = 0' : 'the NVIC is not enabled'} → no RDA interrupt → main waits forever on rx0_flag. No echo.</span>`));
  }
  const lastLog = () => log.innerHTML;
  function isrRx() {
    journey = 5; const b = fifo.shift(); lsr.RDR = fifo.length ? 1 : 0; const rd = dlab() ? R.DLL : b; R.lastIIR = (R.FCR & 1 ? 0xC0 : 0) | 0x04;
    say(`RDA interrupt → <code>UART0_IRQHandler</code>: IIR = ${hx(R.lastIIR)} → &amp; 0x06 = 0x04 → receive: recv_data = RBR = <b>${hx(rd)}</b>, rx0_flag = 0xFF. Reading RBR clears RDR.`);
    paint(); sched(.9, () => mainEcho(rd));
  }
  function mainEcho(b) { journey = 6; if (dlab()) { R.DLL = b; say(`main: THR = ${hx(b)} — <span class="p-red">but DLAB = 1, so it overwrote DLL: nothing is sent and the baud rate just changed!</span>`); paint(); return; } say(`main: rx0_flag set → <b>THR = ${hx(b)}</b> → TSR shifts it out on TxD0 (P0.2).`); lsr.THRE = 1; lsr.TEMT = 0; sched(.5, () => lpcSends(b, 'echo')); paint(); }
  function lpcSends(b, why) {
    const fr = mkFrame(b & ((1 << lpcFmt().nb) - 1), lpcFmt(), lpcBaud(), 'out'); frame = fr; fr.t0 = T; fr.dec = uartDecode(fr, pc); journey = 7; fr.why = why;
    if (why === 'init') say(`<span class="p-red">The stray DLL write is being transmitted: ${hx(b)} as ${fmtTxt(lpcFmt())} at ${lpcBaud().toFixed(0)} baud…</span>`);
    sched(1.7, () => pcReceives(fr));
  }
  function pcReceives(fr) {
    journey = 9; const d = fr.dec; lsr.TEMT = 1; frame = null;
    if (d.falseStart) { say(`${fr.why === 'init' ? 'The stray byte' : 'The echo'} was too short for the PC at ${pc.baud} baud → its first sample saw idle 1 → ignored.`); paint(); return; }
    const ch = d.d & ((1 << pc.nb) - 1); const ok = !d.pe && !d.fe; term += ok && ch >= 32 && ch < 127 ? String.fromCharCode(ch) : '�'; term = term.slice(-60);
    if (fr.why !== 'init') { R.lastIIR = (R.FCR & 1 ? 0xC0 : 0) | 0x02; }
    say(`${fr.why === 'init' ? 'The stray byte reached the PC: ' : 'Echo received by the PC: '}${ok ? `'<b>${esc(String.fromCharCode(ch))}</b>' (${hx(ch)})` : `<span class="p-red">garbage (${hx(ch)}${d.pe ? ', parity error' : ''}${d.fe ? ', framing error' : ''})</span>`}${fr.why !== 'init' ? ' · THR empty → THRE interrupt (IIR & 0x06 = 0x02) → tx0_flag = 0xFF.' : ''}`);
    paint();
  }
  const JR = [['PC TxD', 'j-in'], ['cable ±10 V', 'j-in'], ['MAX232 R1', 'j-in'], ['RxD0 · TTL', 'j-in'], ['RSR → RBR · LSR', 'j-in'], ['IIR → ISR', 'j-cpu'], ['main → THR', 'j-cpu'], ['TSR → TxD0', 'j-out'], ['MAX232 T1 → cable', 'j-out'], ['PC terminal', 'j-out']];
  function paint() {
    const f = lpcFmt(), div = Math.max(1, R.DLM * 256 + R.DLL), b = lpcBaud(), err = (b - pc.baud) / pc.baud * 100;
    regB.innerHTML = `<div class="m9-kv"><span>LCR</span><b>${hx(R.LCR)}</b><span>${fmtTxt(f)} · DLAB = ${dlab()}</span><span>DLM : DLL</span><b>${R.DLM} : ${R.DLL}</b><span>divisor ${div}${R.DLM ? '' : ''}</span><span>baud</span><b>${b.toFixed(0)}</b><span>= 3 MHz / (16 × ${div}) <span class="${Math.abs(err) < 3 ? 'p-green' : 'p-red'}">${err >= 0 ? '+' : ''}${err.toFixed(1)}% vs PC</span></span><span>IER</span><b>${hx(R.IER)}</b><span>${R.IER & 1 ? 'RDA' : '–'}${R.IER & 2 ? ' + THRE' : ''}</span><span>FCR</span><b>${hx(R.FCR)}</b><span>${R.FCR & 1 ? 'FIFOs on' : 'FIFOs off'}</span><span>RX FIFO</span><b>${fifo.length}</b><span>${fifo.map(x => hx(x)).join(' ') || 'empty'}</span></div>`;
    lsrB.innerHTML = [['RXFE', 7], ['TEMT', 6], ['THRE', 5], ['BI', 4], ['FE', 3], ['PE', 2], ['OE', 1], ['RDR', 0]].map(([k, bit]) => `<span class="${lsr[k] ? (/FE|PE|OE|BI|RXFE/.test(k) ? 'bad' : 'one') : ''}"><small>${bit}</small><b>${lsr[k]}</b><i>${k}</i></span>`).join('');
    iirB.innerHTML = `IIR (last read) = <b>${R.lastIIR != null ? hx(R.lastIIR) : '—'}</b>${R.lastIIR != null ? ` → &amp; 0x06 = ${hx(R.lastIIR & 6)} = ${R.lastIIR & 4 ? 'RDA (receive)' : 'THRE (transmit)'}` : ''}`;
    termEl.innerHTML = `<span class="tp">PC terminal · ${pc.baud} ${fmtTxt(pc)}</span><pre>${esc(term)}<i class="cur">▌</i></pre>`;
    jr.innerHTML = JR.map(([t, k], i) => `<span class="${i === journey ? 'on' : i < journey ? 'done' : ''} ${k}">${t}</span>`).join('<em>→</em>');
    drawScope();
  }
  function drawScope() {
    const Wd = Math.max(280, scope.clientWidth), H = 212, L = 70, Rr = Wd - 10; ssv.setAttribute('viewBox', `0 0 ${Wd} ${H}`); ssv.setAttribute('height', H);
    let s = '';
    const fr = frame || drawScope.last; if (frame) drawScope.last = frame;
    if (!fr) { s += `<text x="${Wd / 2}" y="${H / 2}" text-anchor="middle" class="lbl" style="font-size:15px;fill:var(--ink3)">the wire is idle (1) — send a character</text>`; ssv.innerHTML = s; return; }
    const d = fr.dec, span = d ? d.end : (fr.bits.length + 2) / fr.baud, X = t => L + t / span * (Rr - L), Tt = 1 / fr.baud;
    const pts = [[0, 1]]; fr.bits.forEach((v, k) => pts.push([(k + 1) * Tt, v])); pts.push([(fr.bits.length + 1) * Tt, 1]); pts.push([span, 1]);
    const ttl = [16, 52], rs = [100, 150];
    s += `<text x="4" y="30" class="lbl" style="font-size:12.5px">TTL</text><text x="4" y="44" class="mono" style="font-size:10px">0 / 3.3 V</text><text x="4" y="120" class="lbl" style="font-size:12.5px">RS-232</text><text x="4" y="134" class="mono" style="font-size:10px">1 = −10 V</text>`;
    s += `<rect x="${L}" y="${(rs[0] + rs[1]) / 2 - 7}" width="${Rr - L}" height="14" style="fill:url(#hatch-y)"/>`;
    s += `<path d="${digi(pts, X, ttl[0], ttl[1])}" style="fill:none;stroke:var(--green);stroke-width:2.4"/><path d="${digi(pts, X, rs[1], rs[0])}" style="fill:none;stroke:var(--purple);stroke-width:2.4"/>`;
    fr.bits.forEach((v, k) => { const lab = k === 0 ? 'S' : k <= fr.f.nb ? 'D' + (k - 1) : (fr.f.par !== 'none' && k === fr.f.nb + 1) ? 'P' : 'E'; s += `<text x="${X((k + 1.5) * Tt)}" y="${ttl[1] + 13}" text-anchor="middle" class="mono" style="font-size:10px;fill:var(--ink3)">${lab}</text>`; });
    if (d) d.smp.forEach(q => { s += `<path d="M${X(q.t)} 14 V${H - 38}" style="stroke:var(--pink);stroke-width:1.3;stroke-dasharray:2 3;opacity:.8"/><circle cx="${X(q.t)}" cy="${H - 34}" r="4" style="fill:var(--pink)"/><text x="${X(q.t)}" y="${H - 20}" text-anchor="middle" class="mono" style="font-size:10px">${q.v}</text>`; });
    const prog = frame ? clamp((T - fr.t0) / 1.6, 0, 1) : 1; s += `<rect x="${X(prog * span)}" y="10" width="${Math.max(0, Rr - X(prog * span))}" height="${rs[1] - 4}" style="fill:var(--card);opacity:.82"/>`;
    const nar = Wd < 560, rb = (fr.dir === 'in' ? lpcBaud() : pc.baud).toFixed(0);
    s += `<text x="${nar ? 4 : L}" y="${H - 3}" class="lbl" style="font-size:12px;fill:var(--pink)">${nar ? `● = receiver samples (its clock: ${rb} baud)` : `● = where the receiver samples (middle of each bit, using its own clock: ${rb} baud)`}</text>`;
    s += `<text x="${nar ? 4 : L}" y="10" class="mono" style="font-size:10.5px;fill:var(--ink2)">${fr.dir === 'in' ? 'PC → LPC' : 'LPC → PC'} · ${hx(fr.byte)} ${fmtTxt(fr.f)} @ ${fr.baud.toFixed(0)}${nar ? '' : ` baud · 1 bit = ${(1e6 / fr.baud).toFixed(1)} µs`}</text>`;
    ssv.innerHTML = s;
  }
  new ResizeObserver(() => drawScope()).observe(scope);
  const lp = Loop(w, dt => { T += dt; const due = queue.filter(q => q.at <= T); queue = queue.filter(q => q.at > T); due.forEach(q => q.f()); if (frame) { const p = (T - frame.t0) / 1.6; journey = frame.dir === 'in' ? Math.min(3, Math.floor(p * 4)) : 7 + Math.min(2, Math.floor(p * 3)); paint(); } });
  reinit(); lp.start();
});
