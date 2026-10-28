/* =========================================================
   NOTEBOOK 1 · part B — timer concepts
   ========================================================= */

/* ---------- the timer engine ---------- */
BUILD.push(function wEngine() {
  const w = W('w-engine', 'timer engine', 'PCLK → PC → TC → match');
  let PR = 1, MR = 3, I = 0, Rr = 0, S = 0, EMC = 0;
  let pc = 0, tc = 0, en = true, rstPend = false, em = 0, ir = 0, ticks = 0, hist = [], speed = 2.5, run = true, acc = 0, ring = 0, flash = 0;
  const vis = el('div'), ctl = el('div', { class: 'engctl' }); w.append(vis, ctl);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 600 210' }); vis.appendChild(s);
  // PCLK lamp
  const lamp = sv('circle', { cx: 42, cy: 70, r: 18, class: 'lampc' }, s);
  sv('text', { x: 42, y: 112, 'text-anchor': 'middle', class: 'lbl' }, s).textContent = 'PCLK';
  sv('text', { x: 42, y: 128, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, s).textContent = '3 MHz';
  sv('path', { d: 'M64 70 H86', class: 'ink', 'marker-end': 'url(#ah)' }, s);
  // PC dial
  const dial = sv('g', { transform: 'translate(150 78)' }, s);
  sv('circle', { r: 56, class: 'ink', style: 'fill:var(--paper);stroke-width:2.2' }, dial);
  const hand = sv('line', { x1: 0, y1: 0, x2: 0, y2: -44, class: 'hand' }, dial); const marks = sv('g', {}, dial);
  sv('circle', { r: 5, style: 'fill:var(--pink)' }, dial);
  sv('text', { x: 150, y: 156, 'text-anchor': 'middle', class: 'lbl' }, s).textContent = 'PC (prescale counter)';
  const pcTxt = sv('text', { x: 150, y: 176, 'text-anchor': 'middle', class: 'mono' }, s);
  const arW = sv('g', {}, s);
  sv('path', { d: 'M212 78 Q232 60 250 78', class: 'ink', 'marker-end': 'url(#ah)' }, arW);
  sv('text', { x: 232, y: 50, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:12px;fill:var(--ink2)' }, arW).textContent = 'every PR+1';
  const arN = sv('g', { style: 'display:none' }, s); // narrow layout: TC ruler moves under the dial
  sv('path', { d: 'M206 100 Q292 150 262 238', class: 'ink', 'marker-end': 'url(#ah)' }, arN);
  sv('text', { x: 268, y: 118, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:13px;fill:var(--ink2)' }, arN).textContent = 'every PR+1';
  // TC ruler
  const tcG = sv('g', {}, s);
  const rg = sv('g', {}, tcG); const bead = sv('g', {}, tcG);
  sv('circle', { r: 12, class: 'bead' }, bead); const beadT = sv('text', { y: 5, 'text-anchor': 'middle', class: 'mono', style: 'font-size:12px' }, bead);
  const flag = sv('g', {}, tcG); sv('path', { d: 'M0 0 V-40 L18 -33 L0 -26', style: 'fill:var(--red);stroke:var(--ink);stroke-width:1.5' }, flag); sv('text', { x: 0, y: 14, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:13px;fill:var(--red)' }, flag).textContent = 'MR0';
  const bell = sv('g', { class: 'bellg' }, tcG); sv('use', { href: '#st-bell', x: -16, y: -16, width: 32, height: 32 }, bell);
  sv('text', { x: 410, y: 156, 'text-anchor': 'middle', class: 'lbl' }, tcG).textContent = 'TC (timer counter)';
  const tcTxt = sv('text', { x: 410, y: 176, 'text-anchor': 'middle', class: 'mono' }, tcG);
  const X0 = 270, X1 = 580;
  // status lamps
  const lamps = el('div', { class: 'row small' }); vis.appendChild(lamps);
  const mkL = (t, cls) => { const d = el('span', { class: 'row', style: 'gap:6px' }); const l = el('span', { class: 'led ' + (cls || '') }); d.append(l, el('span', { class: 'gae' }, t)); lamps.appendChild(d); return l; };
  const lEn = mkL('TCR bit0 · counting', 'g'), lEm = mkL('EM0 → MAT0.0 pin'), lIr = mkL('MR0 interrupt flag', 'y');
  // controls
  ruler(ctl, 'PR (prescale)', 0, 4, PR, 1, v => v, v => { PR = v; reset(); });
  ruler(ctl, 'MR0 (match value)', 1, 8, MR, 1, v => v, v => { MR = v; reset(); });
  const mc = el('div', { class: 'chips' }); ctl.appendChild(mc); mc.appendChild(el('span', { class: 'gae small' }, 'MCR on MR0:'));
  [['I', 'interrupt', v => I = v], ['R', 'reset TC', v => Rr = v], ['S', 'stop', v => S = v]].forEach(([k, t, f]) => { const c = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-p)' }, `${k} · ${t}`); c.onclick = () => { c.classList.toggle('on'); f(c.classList.contains('on') ? 1 : 0); reset(); }; mc.appendChild(c); });
  const ec = el('div'); ctl.appendChild(ec); ec.appendChild(el('span', { class: 'gae small' }, 'EMC0 (what EM0 does on a match):'));
  chipGroup(ec, [[0, '00 nothing'], [1, '01 clear'], [2, '10 set'], [3, '11 toggle']], 0, v => { EMC = +v; reset(); });
  ruler(ctl, 'speed', 1, 40, 10, 1, v => (v / 4).toFixed(2) + ' ticks/s', v => { speed = v / 4; });
  const bt = el('div', { class: 'row' }); ctl.appendChild(bt);
  const bR = el('button', { class: 'btn sm y', type: 'button' }, '❚❚ pause'), b1 = el('button', { class: 'btn sm', type: 'button' }, '+1 PCLK tick'), b0 = el('button', { class: 'btn sm g', type: 'button' }, 'TCR = 2 (reset)');
  bt.append(bR, b1, b0);
  bR.onclick = () => { run = !run; bR.textContent = run ? '❚❚ pause' : '▶ run'; };
  b1.onclick = () => { run = false; bR.textContent = '▶ run'; tick(); draw(); };
  b0.onclick = () => reset();
  const stat = el('div', { class: 'say b' }); w.appendChild(stat);
  // timing diagram
  const td = sv('svg', { class: 'dg td', viewBox: '0 0 640 178' }); w.appendChild(td);
  let NT = 22; const DX = 25, LX = 62;
  ['PCLK', 'PC', 'TC', 'match', 'EM0'].forEach((t, i) => sv('text', { x: 4, y: 22 + i * 34, class: 'lbl', style: 'font-size:13px' }, td).textContent = t);
  const tdG = sv('g', {}, td);
  function reset() { pc = 0; tc = 0; en = true; rstPend = false; em = 0; ir = 0; ticks = 0; hist = []; draw(); }
  function tick() {
    if (!en) { hist.push({ pc, tc, m: 0, em, off: 1 }); trim(); return; }
    ticks++; flash = 1; let m = 0;
    if (pc >= PR) { pc = 0; if (rstPend) { tc = 0; rstPend = false; } else tc++; if (tc === MR) { m = 1; match(); } }
    else pc++;
    hist.push({ pc, tc, m, em }); trim();
  }
  function trim() { if (hist.length > NT) hist.shift(); }
  function match() { ring = 1; if (I) ir = 1; if (Rr) rstPend = true; if (S) en = false; if (EMC === 1) em = 0; else if (EMC === 2) em = 1; else if (EMC === 3) em ^= 1; }
  function draw() {
    // PC dial
    marks.innerHTML = ''; const n = PR + 1;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 - Math.PI / 2; sv('circle', { cx: Math.cos(a) * 46, cy: Math.sin(a) * 46, r: 3.2, style: `fill:${i === pc ? 'var(--pink)' : 'var(--ink3)'}` }, marks); sv('text', { x: Math.cos(a) * 31, y: Math.sin(a) * 31 + 4, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px;paint-order:stroke;stroke:var(--paper);stroke-width:3px' }, marks).textContent = i; }
    hand.setAttribute('transform', `rotate(${pc / n * 360})`);
    pcTxt.textContent = `PC = ${pc}  (PR = ${PR})`;
    // TC ruler
    const top = Math.max(MR + 3, 6), sx = (X1 - X0) / top;
    rg.innerHTML = '';
    sv('path', { d: `M${X0 - 6} 96 H${X1 + 6}`, class: 'ink', style: 'stroke-width:2.2' }, rg);
    for (let i = 0; i <= top; i++) { const x = X0 + i * sx; sv('path', { d: `M${x} ${96} v${i % 5 === 0 ? 12 : 8}`, class: 'ink' }, rg); sv('text', { x, y: 124, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, rg).textContent = i; }
    const shown = Math.min(tc, top); bead.setAttribute('transform', `translate(${X0 + shown * sx} 80)`); beadT.textContent = tc;
    flag.setAttribute('transform', `translate(${X0 + MR * sx} 92)`); bell.setAttribute('transform', `translate(${X0 + MR * sx + 34} 42)`); bell.classList.toggle('ringing', ring > 0);
    tcTxt.textContent = `TC = ${tc}${tc > top ? ' (off the ruler)' : ''}`;
    lamp.classList.toggle('on', flash > 0.5); lEn.classList.toggle('on', en); lEm.classList.toggle('on', !!em); lIr.classList.toggle('on', !!ir);
    const cyc = (PR + 1) * (MR + 1);
    stat.innerHTML = `TC moves every <b>PR+1 = ${PR + 1}</b> PCLK tick${PR ? 's' : ''} · TC reaches MR0 after <b>(PR+1)×MR0 = ${(PR + 1) * MR}</b> ticks${Rr ? ` · with reset, one full cycle = <b>(PR+1)(MR0+1) = ${cyc}</b> ticks` : ''}${S ? ' · <span class="p-red">stop on match: TC freezes at MR0</span>' : ''}${!Rr && !S ? ' · no reset/stop: TC just keeps counting past MR0' : ''}`;
    // timing diagram
    tdG.innerHTML = ''; const base = LX;
    hist.forEach((h, i) => {
      const x = base + i * DX;
      if (!h.off) sv('path', { d: `M${x} 26 V8 H${x + DX / 2} V26 H${x + DX}`, class: 'ink2' }, tdG); else sv('path', { d: `M${x} 26 H${x + DX}`, class: 'ink2' }, tdG);
      const prevPc = i ? hist[i - 1].pc : -1, prevTc = i ? hist[i - 1].tc : -1;
      sv('rect', { x: x + 1, y: 38, width: DX - 2, height: 20, rx: 4, style: `fill:${h.pc === 0 ? 'var(--n-p)' : 'var(--paper)'};stroke:var(--faint)` }, tdG);
      sv('text', { x: x + DX / 2, y: 52, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, tdG).textContent = h.pc;
      sv('rect', { x: x + 1, y: 72, width: DX - 2, height: 20, rx: 4, style: `fill:${h.tc === MR ? 'var(--hl-y)' : 'var(--paper)'};stroke:var(--faint)` }, tdG);
      if (h.tc !== prevTc || i === 0) sv('text', { x: x + DX / 2, y: 86, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px;font-weight:700' }, tdG).textContent = h.tc;
      if (h.m) { sv('path', { d: `M${x + DX / 2} 126 V104`, style: 'stroke:var(--red);stroke-width:3;stroke-linecap:round' }, tdG); sv('circle', { cx: x + DX / 2, cy: 104, r: 3.5, style: 'fill:var(--red)' }, tdG); }
      const pe = i ? hist[i - 1].em : h.em; sv('path', { d: `M${x} ${pe ? 142 : 166} V${h.em ? 142 : 166} H${x + DX}`, style: 'fill:none;stroke:var(--purple);stroke-width:2.2' }, tdG);
    });
    if (hist.length) sv('path', { d: `M${base + hist.length * DX - DX / 2} 2 V172`, style: 'stroke:var(--pink);stroke-width:1.5;stroke-dasharray:3 4' }, tdG);
  }
  widthWatch(w, 600, narrow => { // phone: stack the TC ruler under the PC dial, show fewer columns in the timing diagram
    s.setAttribute('viewBox', narrow ? '0 0 340 384' : '0 0 600 210'); tcG.setAttribute('transform', narrow ? 'translate(-250 190)' : '');
    arW.style.display = narrow ? 'none' : ''; arN.style.display = narrow ? '' : 'none';
    NT = narrow ? 11 : 22; td.setAttribute('viewBox', `0 0 ${narrow ? 350 : 640} 178`); while (hist.length > NT) hist.shift(); draw();
  });
  const lp = Loop(s, dt => { flash = Math.max(0, flash - dt * 4); ring = Math.max(0, ring - dt * 1.4); if (run) { acc += dt * speed; while (acc >= 1) { acc -= 1; tick(); } } draw(); });
  lp.start(); reset();
});

/* ---------- delay calculator ---------- */
BUILD.push(function wDelay() {
  const w = W('w-delay', 'delay calculator', 'both directions');
  const sp = el('div', { class: 'split' }); w.appendChild(sp);
  const A = el('div', { class: 'col' }), B = el('div', { class: 'col' }); sp.append(A, B);
  A.appendChild(el('div', { class: 'gae' }, 'PR & MR → delay'));
  const fIn = el('input', { class: 'inp', type: 'number', value: 3, step: 'any', min: 0.001, 'aria-label': 'PCLK MHz' });
  const prIn = el('input', { class: 'inp', type: 'number', value: 2999, min: 0, 'aria-label': 'PR' });
  const mrIn = el('input', { class: 'inp', type: 'number', value: 999, min: 0, 'aria-label': 'MR' });
  const g = el('div', { class: 'kv' }); A.appendChild(g);
  g.append(el('span', {}, 'f<sub>PCLK</sub> (MHz)'), fIn, el('span', {}, 'PR'), prIn, el('span', {}, 'MR'), mrIn);
  const outA = el('div', { class: 'say g' }); A.appendChild(outA);
  const chk = el('div', { class: 'chips' }); A.appendChild(chk); chk.appendChild(el('span', { class: 'cav p-soft' }, 'check the slides:'));
  [[999, 2999], [2999, 999], [1000, 3000], [3000, 1000], [2999, 1500], [2999, 500], [0, 3000000], [0, 2999]].forEach(([p, m]) => { const c = el('button', { class: 'chip', type: 'button' }, `${p} / ${m}`); c.onclick = () => { prIn.value = p; mrIn.value = m; fIn.value = 3; calcA(); }; chk.appendChild(c); });
  B.appendChild(el('div', { class: 'gae' }, 'delay → PR & MR'));
  const tIn = el('input', { class: 'inp', type: 'number', value: 500, min: 0, step: 'any', 'aria-label': 'target delay' });
  let unit = 1e-3; const tr = el('div', { class: 'row' }); B.appendChild(tr); tr.appendChild(tIn);
  chipGroup(tr, [[1e-6, 'µs'], [1e-3, 'ms'], [1, 's']], unit, v => { unit = +v; calcB(); });
  const outB = el('div', { class: 'col' }); B.appendChild(outB);
  const fmtT = s => s >= 1 ? (+s.toFixed(6)) + ' s' : s >= 1e-3 ? (+(s * 1e3).toFixed(4)) + ' ms' : (+(s * 1e6).toFixed(3)) + ' µs';
  function calcA() { const f = +fIn.value * 1e6, p = Math.max(0, Math.floor(+prIn.value)), m = Math.max(0, Math.floor(+mrIn.value)); const td = (p + 1) * (m + 1) / f; outA.innerHTML = `T<sub>d</sub> = (${p}+1) × (${m}+1) / ${(+fIn.value)} MHz = <b>${fmtT(td)}</b><br><span class="small p-soft">one TC step = ${fmtT((p + 1) / f)}</span>`; }
  function calcB() {
    const f = +fIn.value * 1e6, T = +tIn.value * unit, N = Math.round(T * f); outB.innerHTML = '';
    const rec = (title, p, m, ok) => { const d = el('div', { class: 'recipe' + (ok ? '' : ' bad') }); d.innerHTML = `<span class="gae">${title}</span><br>${ok ? `<code>PR = ${p}</code> <code>MR0 = ${m}</code> → ${fmtT((p + 1) * (m + 1) / f)}` : '<span class="p-faint">not possible here</span>'}`; outB.appendChild(d); };
    const msT = Math.round(T * 1e3), usT = Math.round(T * 1e6);
    rec('1 TC step = 1 ms', Math.round(f / 1e3) - 1, msT - 1, msT >= 1 && Math.abs(msT - T * 1e3) < 1e-6);
    rec('1 TC step = 1 µs', Math.round(f / 1e6) - 1, usT - 1, usT >= 1 && f >= 1e6 && Math.abs(usT - T * 1e6) < 1e-6 && Number.isInteger(f / 1e6));
    rec('no prescale (PR = 0)', 0, N - 1, N >= 1 && N - 1 <= 4294967295);
  }
  [fIn, prIn, mrIn].forEach(i => i.addEventListener('input', () => { calcA(); calcB(); })); tIn.addEventListener('input', calcB);
  calcA(); calcB();
});

/* ---------- TCR ---------- */
BUILD.push(function wTcr() {
  const w = W('w-tcr', 'TCR builder', 'Timer Control Register · 2 useful bits');
  RegBuilder(w, {
    name: 'TCR', reg: 'LPC_TIM0->TCR', width: 2, value: 2, fields: [
      { bit: 0, name: 'Counter Enable', desc: '1 → TC and PC count. 0 → both disabled (frozen).', opts: { 0: '0 · off', 1: '1 · counting' }, say: { 1: 'TC &amp; PC are <b>counting</b>', 0: 'TC &amp; PC are <b>frozen</b>' } },
      { bit: 1, name: 'Counter Reset', desc: '1 → TC and PC reset on the next +ve PCLK edge and <b>stay</b> 0 until this bit is 0 again.', opts: { 0: '0 · normal', 1: '1 · hold at 0' }, say: { 1: 'TC &amp; PC are <b>held at 0</b>' } }
    ], presets: [[2, 'reset'], [1, 'start']]
  });
});

/* ---------- CTCR + edge conveyor ---------- */
BUILD.push(function wCtcr() {
  const w = W('w-ctcr', 'CTCR: what makes TC move?', 'pick a mode, watch which edges get counted');
  let mode = 0, t = 0, tc = 0, stars = [];
  RegBuilder(w, {
    name: 'CTCR', reg: 'LPC_TIM0->CTCR', width: 4, value: 0, fields: [
      { lo: 0, hi: 1, name: 'Counter/Timer Mode', desc: 'what increments TC', opts: { 0: '00 timer', 1: '01 rising', 2: '10 falling', 3: '11 both' }, say: { 0: '<b>Timer mode</b>: TC + 1 each time PC matches PR (PCLK ticks)', 1: '<b>Counter</b>: TC + 1 on each <b>rising</b> edge of the CAP pin', 2: '<b>Counter</b>: TC + 1 on each <b>falling</b> edge of the CAP pin', 3: '<b>Counter</b>: TC + 1 on <b>both</b> edges of the CAP pin' } },
      { lo: 2, hi: 3, name: 'Count Input Select', desc: 'which CAP pin (used only when bits 1:0 ≠ 00)', opts: { 0: '00 CAPn.0', 1: '01 CAPn.1', 2: '10 reserved', 3: '11 reserved' }, say: (x, v) => (v & 3) ? (x < 2 ? `counting pin = <b>CAPn.${x}</b>` : '<span class="p-red">reserved — don\'t use</span>') : 'bits 3:2 ignored in timer mode' }
    ], presets: [[0x00, 'timer'], [0x01, 'P5: rising CAP1.0'], [0x02, 'P4: falling CAP1.0'], [0x05, 'rising CAP0.1']], onchange: v => { mode = v; tc = 0; stars = []; }
  });
  const s = sv('svg', { class: 'dg conv', viewBox: '0 0 620 196' }); w.appendChild(s);
  const tracks = [['prescaled PCLK', 0.25], ['CAPn.0 pin', 1.2], ['CAPn.1 pin', 0.7]];
  const NOW = 520, LX = 130, WIN = 6;
  const lab = tracks.map((tk, i) => { const tx = sv('text', { x: 4, y: 40 + i * 52, class: 'lbl', style: 'font-size:13px' }, s); tx.textContent = tk[0]; return tx; });
  const paths = tracks.map((tk, i) => sv('path', { class: 'trk', style: 'fill:none;stroke-width:2.2' }, s));
  sv('path', { d: `M${NOW} 10 V170`, style: 'stroke:var(--pink);stroke-width:2;stroke-dasharray:4 4' }, s);
  sv('text', { x: NOW, y: 188, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:12px;fill:var(--pink)' }, s).textContent = 'now';
  const starG = sv('g', {}, s);
  const tcBox = sv('g', { transform: 'translate(572 88)' }, s); sv('rect', { x: -38, y: -28, width: 76, height: 56, rx: 10, style: 'fill:var(--n-b);stroke:var(--ink);stroke-width:1.8' }, tcBox);
  sv('text', { y: -9, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:12px' }, tcBox).textContent = 'TC';
  const tcT = sv('text', { y: 17, 'text-anchor': 'middle', class: 'mono', style: 'font-size:20px' }, tcBox);
  const lv = (per, x) => (Math.floor(x / (per / 2)) % 2 === 0) ? 1 : 0; // starts HIGH
  function src() { const m = mode & 3, sel = (mode >> 2) & 3; return m === 0 ? 0 : (sel < 2 ? sel + 1 : -1); }
  function edges(per, a, b) { const out = []; const h = per / 2; for (let k = Math.ceil(a / h); k * h <= b; k++) out.push([k * h, k % 2 === 0 ? 1 : 0]); return out; } // [time, newLevel]
  const lp = Loop(s, dt => {
    const t0 = t; t += dt; const sI = src(), m = mode & 3;
    edges(tracks[Math.max(0, sI)][1], t0 + 1e-9, t).forEach(([et, nl]) => { if (sI < 0) return; const ok = sI === 0 ? nl === 1 : (m === 3 || (m === 1 && nl === 1) || (m === 2 && nl === 0)); if (ok) { tc++; stars.push([et, sI]); } });
    stars = stars.filter(st => t - st[0] < WIN);
    tracks.forEach((tk, i) => {
      const y = 40 + i * 52, per = tk[1], a = t - WIN * (NOW - LX) / (NOW - LX), X = tt => LX + (tt - (t - WIN)) / WIN * (NOW - LX);
      const pts = [[t - WIN, lv(per, t - WIN)]].concat(edges(per, t - WIN, t).map(e => [e[0], e[1]])).concat([[t, lv(per, t)]]);
      paths[i].setAttribute('d', digi(pts, X, y - 14, y + 14));
      const on = i === sI; paths[i].style.stroke = on ? 'var(--blue)' : 'var(--ink3)'; paths[i].style.opacity = on ? 1 : .35; lab[i].style.opacity = on ? 1 : .45;
    });
    starG.innerHTML = stars.map(([et, i]) => { const x = LX + (et - (t - WIN)) / WIN * (NOW - LX), y = 40 + i * 52 - 22; return `<text x="${x}" y="${y}" text-anchor="middle" style="fill:var(--orange);font-size:15px">★</text>`; }).join('');
    tcT.textContent = tc;
  });
  lp.start();
});

/* ---------- CAP / MAT pin board ---------- */
BUILD.push(function wPins() {
  const w = W('w-pins', 'timer pin map', 'n = timer number, x = channel · tap a tag');
  const CAP = [['CAP0.0', 'P1.26', 'P6 (capture)'], ['CAP0.1', 'P1.27', 'P6 (capture) · counter interrupt (notebook ②)'], ['CAP1.0', 'P1.18 / P1.28 / P2.6', 'P4 (÷8) and P5 (frequency meter)'], ['CAP1.1', 'P1.19 / P1.29'], ['CAP2.0', 'P0.4'], ['CAP2.1', 'P0.5'], ['CAP3.0', 'P0.23'], ['CAP3.1', 'P0.24']];
  const MAT = [['MAT0.0', 'P1.28 / P3.25', 'P3 (hardware square wave)'], ['MAT0.1', 'P1.29 / P3.26'], ['MAT1.0', 'P1.22'], ['MAT1.1', 'P1.25', 'P4 (÷8 output)'], ['MAT2.0', 'P0.6 / P4.28'], ['MAT2.1', 'P0.7 / P4.29'], ['MAT2.2', 'P0.8'], ['MAT2.3', 'P0.9'], ['MAT3.0', 'P0.10'], ['MAT3.1', 'P0.11']];
  const sp = el('div', { class: 'split' }); w.appendChild(sp);
  const info = el('div', { class: 'say b mt' });
  [[CAP, 'CAP = inputs (capture / count)', 'var(--n-b)'], [MAT, 'MAT = outputs (match)', 'var(--n-p)']].forEach(([L, t, c]) => {
    const col = el('div'); sp.appendChild(col); col.appendChild(el('div', { class: 'gae' }, t));
    const box = el('div', { class: 'tags' }); col.appendChild(box);
    L.forEach(([n, p, used]) => { const b = el('button', { class: 'ptag' + (used ? ' used' : ''), type: 'button', style: `--tg:${c}` }, `<b>${n}</b><span>${p}</span>`); b.onclick = () => { $$('.ptag', w).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); info.innerHTML = `<b>${n}</b> = timer ${n[3]}, ${n.startsWith('CAP') ? 'capture/count input' : 'match output'} channel ${n[5]} · pin ${p}${used ? `<br>used in: ${used}` : ''}`; }; box.appendChild(b); });
  });
  w.appendChild(info); info.textContent = '★ tags with a star are used in the programs';
});

/* ---------- MCR grid ---------- */
BUILD.push(function wMcr() {
  const w = W('w-mcr', 'MCR builder', 'Match Control Register · click the I / R / S boxes');
  GridBuilder(w, {
    name: 'MCR', reg: 'LPC_TIM0->MCR', rows: ['MR0', 'MR1', 'MR2', 'MR3'], width: 12, value: 4,
    cols: [{ n: 'I', d: 'interrupt', say: (r, i) => `TC = ${r} → <b>interrupt</b> (IR bit ${i} set)` }, { n: 'R', d: 'reset TC', say: (r) => `TC = ${r} → TC <b>resets</b> to 0` }, { n: 'S', d: 'stop', say: (r) => `TC = ${r} → TC &amp; PC <b>stop</b>, TCR bit 0 → 0` }],
    bitOf: (r, c) => r * 3 + c,
    presets: [[0x04, 'stop on MR0'], [0x02, 'reset on MR0'], [0x10, 'reset on MR1'], [0x03, 'int + reset MR0'], [0x05, 'int + stop MR0']]
  });
});

/* ---------- EMR ---------- */
BUILD.push(function wEmr() {
  const w = W('w-emr', 'EMR builder', 'External Match Register');
  const demo = sv('svg', { class: 'dg', viewBox: '0 0 620 150' });
  const acts = ['00 do nothing', '01 clear to 0', '10 set to 1', '11 toggle'];
  const rows = acts.map((a, i) => { const g = sv('g', { transform: `translate(0 ${10 + i * 34})` }, demo); sv('text', { x: 4, y: 18, class: 'lbl', style: 'font-size:13px' }, g).textContent = a; const p = sv('path', { style: 'fill:none;stroke-width:2.4' }, g); return { g, p }; });
  const M = [200, 290, 380, 470, 560];
  M.forEach((x, k) => { sv('path', { d: `M${x} 4 V146`, style: 'stroke:var(--red);stroke-width:1.4;stroke-dasharray:3 4' }, demo); sv('text', { x: x, y: 150, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:11px;fill:var(--red)' }, demo).textContent = 'match ' + (k + 1); });
  rows.forEach((r, i) => { let lv = i === 1 ? 1 : 0; const pts = [[150, lv]]; M.forEach(x => { if (i === 1) lv = 0; else if (i === 2) lv = 1; else if (i === 3) lv ^= 1; pts.push([x, lv]); }); pts.push([610, lv]); r.p.setAttribute('d', digi(pts, x => x, 4, 26)); });
  const pick = v => rows.forEach((r, i) => { r.p.style.stroke = i === ((v >> 4) & 3) ? 'var(--purple)' : 'var(--ink3)'; r.g.style.opacity = i === ((v >> 4) & 3) ? 1 : .45; });
  const emc = n => ({ lo: 4 + 2 * n, hi: 5 + 2 * n, name: 'EMC' + n, desc: `what EM${n} does when MR${n} matches`, opts: { 0: '00 nothing', 1: '01 clear', 2: '10 set', 3: '11 toggle' }, say: x => [null, `on MR${n} match: EM${n} → <b>0</b> (MATn.${n} LOW)`, `on MR${n} match: EM${n} → <b>1</b> (MATn.${n} HIGH)`, `on MR${n} match: EM${n} <b>toggles</b>`][x] });
  const em = n => ({ bit: n, name: 'EM' + n, desc: `current level of external match ${n} (drives MATn.${n} if pinned out)`, opts: { 0: '0', 1: '1' }, say: x => x ? `EM${n} is 1 right now` : null });
  RegBuilder(w, { name: 'EMR', reg: 'LPC_TIM0->EMR', width: 12, value: 0x20, fields: [em(0), em(1), em(2), em(3), emc(0), emc(1), emc(2), emc(3)], presets: [[0x20, 'P1/P2: set EM0'], [0x30, 'P3: toggle EM0'], [0xC0, 'P4: toggle EM1'], [0x00, 'nothing']], onchange: pick });
  w.appendChild(el('div', { class: 'gae mt' }, 'EM0 over 5 matches, for each EMC0 option (EM0 starts at 0 — at 1 for "clear", so you can see it drop):'));
  w.appendChild(demo); pick(0x20);
});

/* ---------- CCR + capture camera ---------- */
BUILD.push(function wCcr() {
  const w = W('w-ccr', 'CCR + capture camera', 'Capture Control Register · CRx = snapshot of TC');
  let ccr = 9;
  const cap = n => [{ bit: 3 * n, name: `CAP${n}RE`, desc: `rising edge (0→1) on CAPn.${n} → load CR${n} with TC`, opts: { 0: 'off', 1: 'on' }, say: x => x ? `rising edge on CAPn.${n} → <b>CR${n} = TC</b>` : null }, { bit: 3 * n + 1, name: `CAP${n}FE`, desc: `falling edge (1→0) on CAPn.${n} → load CR${n} with TC`, opts: { 0: 'off', 1: 'on' }, say: x => x ? `falling edge on CAPn.${n} → <b>CR${n} = TC</b>` : null }, { bit: 3 * n + 2, name: `CAP${n}I`, desc: `a CR${n} load also generates an interrupt`, opts: { 0: 'off', 1: 'on' }, say: x => x ? `CR${n} load → <b>interrupt</b> (IR bit ${4 + n})` : null }];
  RegBuilder(w, { name: 'CCR', reg: 'LPC_TIM0->CCR', width: 6, value: 9, fields: cap(0).concat(cap(1)), presets: [[0x09, 'P6: rising on both'], [0x03, 'both edges CAP0'], [0x05, 'rising + interrupt']], onchange: v => ccr = v });
  const cam = el('div', { class: 'camera mt' }); w.appendChild(cam);
  const left = el('div', { class: 'col center' }); cam.appendChild(left);
  left.innerHTML = '<div class="gae">TC (counting ms)</div>';
  const tcD = el('div', { class: 'odo' }); left.appendChild(tcD);
  const flashD = el('div', { class: 'flashfx' }); cam.appendChild(flashD);
  const pins = el('div', { class: 'col' }); cam.appendChild(pins);
  const slots = el('div', { class: 'row' }); cam.appendChild(slots);
  const mkSlot = n => { const d = el('div', { class: 'slot' }, `<div class="gae">CR${n}</div><div class="polaroid empty">—</div><div class="irl"><span class="led y"></span> IR bit ${4 + n}</div>`); slots.appendChild(d); return d; };
  const sl = [mkSlot(0), mkSlot(1)];
  let tc = 0, lvl = [0, 0];
  const pinLed = [0, 1].map(n => { const r = el('div', { class: 'row' }); pins.appendChild(r); const l = el('span', { class: 'led b' }); const b = el('button', { class: 'btn sm', type: 'button' }, `pulse CAPn.${n}`); r.append(l, el('span', { class: 'pinlbl' }, `CAPn.${n}`), b); b.onclick = () => { edge(n, 1); setTimeout(() => edge(n, 0), 450); }; return l; });
  const clr = el('button', { class: 'btn sm g', type: 'button' }, 'IR = 0x30 (clear flags)'); pins.appendChild(clr); clr.onclick = () => sl.forEach(s => s.querySelector('.led').classList.remove('on'));
  function edge(n, l) {
    lvl[n] = l; pinLed[n].classList.toggle('on', !!l);
    const re = (ccr >> (3 * n)) & 1, fe = (ccr >> (3 * n + 1)) & 1, ie = (ccr >> (3 * n + 2)) & 1;
    if ((l && re) || (!l && fe)) {
      const p = sl[n].querySelector('.polaroid'); p.classList.remove('empty'); p.textContent = tc; p.classList.remove('popin'); void p.offsetWidth; p.classList.add('popin');
      flashD.classList.remove('go'); void flashD.offsetWidth; flashD.classList.add('go');
      if (ie) sl[n].querySelector('.led').classList.add('on');
    }
  }
  const lp = Loop(cam, dt => { tc = (tc + Math.round(dt * 1000)) % 1000; tcD.textContent = String(tc).padStart(3, '0'); });
  lp.start();
});

/* ---------- block diagram explorer ---------- */
BUILD.push(function wBlock() {
  const w = W('w-block', 'timer block diagram', 'tap a block · or play the flow');
  const sc = el('div', { class: 'hscroll' }); w.appendChild(sc); w.appendChild(el('div', { class: 'swipe-hint' }, '← swipe the diagram →'));
  const s = sv('svg', { class: 'dg blk', viewBox: '0 0 720 480' }); sc.appendChild(s);
  const info = el('div', { class: 'note blue', style: 'margin:14px 0 0' }, '<div class="nh">tap a block</div>Each box is one register or part of the timer.'); w.appendChild(info);
  const B = {};
  const box = (id, x, y, ww, hh, t, d, fill) => { const g = sv('g', { class: 'hov bk', 'data-id': id }, s); sv('rect', { x, y, width: ww, height: hh, rx: 6, class: 'ink', style: `fill:${fill || 'var(--card)'}` }, g); t.split('\n').forEach((ln, i, a) => sv('text', { x: x + ww / 2, y: y + hh / 2 + 5 + (i - (a.length - 1) / 2) * 15, 'text-anchor': 'middle', style: 'font-size:13px' }, g).textContent = ln); g.addEventListener('click', () => sel(id)); B[id] = { g, d, t }; return g; };
  const wire = (d, id, mk = 'url(#ah)') => { const p = sv('path', { d, class: 'ink2 wr', 'marker-end': mk, 'data-w': id || '' }, s); return p; };
  // match regs + comparators
  [0, 1, 2, 3].forEach(i => {
    const x = 300 + i * 100;
    box('mr' + i, x - 40, 18, 84, 30, 'MATCH REG ' + i, `<b>MR${i}</b> — the target value you load. Compared with TC all the time.`, 'var(--n-y)');
    const c = sv('g', { class: 'hov', 'data-id': 'cmp' }, s); sv('circle', { cx: x, cy: 98, r: 15, class: 'ink', style: 'fill:var(--paper)' }, c); sv('text', { x, y: 104, 'text-anchor': 'middle', style: 'font-size:17px' }, c).textContent = '='; c.addEventListener('click', () => sel('cmp'));
    wire(`M${x} 48 V80`, 'm' + i); wire(`M${x} 166 V116`, 'tcb'); wire(`M${x + 15} 98 H${x + 30} V230`, 'cmpo');
  });
  B.cmp = { d: '<b>Comparators (=)</b> — one per match register. Output goes HIGH the moment TC = MRx → a <b>match event</b> for the control logic.', t: 'comparator' };
  sv('path', { d: 'M250 166 H660', class: 'ink wr', 'data-w': 'tcb', style: 'stroke-width:2.6' }, s); // .wr = no wobble filter (a flat line has a 0-height box → filtered away)
  box('tc', 110, 150, 140, 34, 'TIMER COUNTER', '<b>TC</b> — the 32-bit count. +1 each time the prescaler overflows (CE pulse), or on CAP edges in counter mode.', 'var(--n-b)');
  box('pc', 110, 268, 140, 34, 'PRESCALE COUNTER', '<b>PC</b> — counts PCLK ticks. When PC = PR it sends a <b>TCI</b> pulse and starts again from 0.', 'var(--n-g)');
  box('pr', 110, 350, 140, 34, 'PRESCALE REG', '<b>PR</b> — the max value for PC (MAXVAL). TC moves once every PR + 1 ticks.', 'var(--n-g)');
  box('tcr', 110, 428, 140, 34, 'TIMER CONTROL REG', '<b>TCR</b> — bit 0 <b>enable</b> (gates the counting), bit 1 <b>reset</b> (holds TC &amp; PC at 0).', 'var(--n-p)');
  const ctlBox = box('ctl', 300, 230, 380, 128, 'CONTROL', '<b>Control logic</b> — gets the match events and capture pin edges. Using MCR/EMR/CCR settings it produces: MAT[3:0] outputs, INTERRUPT, STOP ON MATCH, RESET ON MATCH, and LOAD[1:0] (copy TC into a capture register).', 'var(--n-l)');
  ctlBox.querySelector('text').setAttribute('y', 254); ctlBox.querySelector('text').style.fontSize = '16px';
  ['MAT[3:0] → pins', 'INTERRUPT → NVIC', 'STOP / RESET on match', 'LOAD → capture regs'].forEach((t, i) => sv('text', { x: 490, y: 282 + i * 19, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11.5px' }, s).textContent = t);
  box('mcr', 300, 392, 86, 30, 'MCR', '<b>MCR</b> — for each MR: interrupt / reset / stop on match.');
  box('emr', 396, 392, 86, 30, 'EMR', '<b>EMR</b> — what each external match pin does on a match (nothing / clear / set / toggle).');
  box('ir', 492, 392, 86, 30, 'IR', '<b>IR</b> — interrupt flags (MR0–MR3, CR0, CR1). Write 1 to clear.');
  box('ccr', 588, 392, 92, 30, 'CCR', '<b>CCR</b> — capture on rising/falling edge, and interrupt on capture.');
  ['mcr', 'emr', 'ir', 'ccr'].forEach((k, i) => wire(`M${343 + i * 96} 392 V362`, 'reg'));
  box('cr', 110, 40, 140, 56, 'CAPTURE REG 0\nCAPTURE REG 1', '<b>CR0 / CR1</b> — hold a snapshot of TC taken when a selected edge arrives on CAPn.0 / CAPn.1.', 'var(--n-o)');
  wire('M180 150 V100', 'cap'); wire('M300 300 H274 V72 H254', 'load');
  sv('text', { x: 262, y: 66, class: 'mono', style: 'font-size:11px' }, s).textContent = 'LOAD';
  sv('text', { x: 196, y: 128, class: 'mono', style: 'font-size:11px' }, s).textContent = 'TC value';
  wire('M684 300 H712', 'out'); wire('M712 330 H684', 'capin');
  sv('text', { x: 690, y: 292, class: 'mono', style: 'font-size:11px' }, s).textContent = 'MAT';
  sv('text', { x: 690, y: 348, class: 'mono', style: 'font-size:11px' }, s).textContent = 'CAP';
  // prescaler chain
  sv('text', { x: 30, y: 280, class: 'lbl' }, s).textContent = 'PCLK';
  wire('M40 290 H108', 'pclk');
  wire('M180 350 V304', 'maxval'); sv('text', { x: 186, y: 334, class: 'mono', style: 'font-size:11px' }, s).textContent = 'MAXVAL';
  const and = sv('g', { class: 'hov', 'data-id': 'and' }, s); sv('path', { d: 'M160 208 h20 a14 14 0 0 1 0 28 h-20 z', class: 'ink', style: 'fill:var(--paper)' }, and); and.addEventListener('click', () => sel('and'));
  B.and = { d: '<b>AND gate</b> — lets the TCI pulse through to TC only while TCR bit 0 (enable) = 1. That pulse is <b>CE</b> (count enable).', t: 'AND' };
  wire('M180 268 V238', 'tci'); sv('text', { x: 186, y: 258, class: 'mono', style: 'font-size:11px' }, s).textContent = 'TCI';
  wire('M180 208 V186', 'ce'); sv('text', { x: 186, y: 200, class: 'mono', style: 'font-size:11px' }, s).textContent = 'CE';
  wire('M110 445 H70 V222 H158', 'en'); sv('text', { x: 74, y: 216, class: 'mono', style: 'font-size:11px' }, s).textContent = 'enable';
  wire('M110 452 H52 V170 H108', 'rst'); sv('text', { x: 56, y: 164, class: 'mono', style: 'font-size:11px' }, s).textContent = 'reset';
  function sel(id) { const b = B[id]; if (!b) return; $$('.bk', s).forEach(g => g.classList.toggle('selb', g.dataset.id === id)); info.innerHTML = `<div class="nh">${b.t.replace(/\n/g, ' / ')}</div>${b.d}`; }
  const flow = [['pclk', 'pc', 'PCLK ticks arrive at the prescale counter.'], ['maxval', 'pr', 'PC counts up to PR (MAXVAL)…'], ['tci', 'and', '…then sends a TCI pulse; the AND gate passes it only if TCR enable = 1…'], ['ce', 'tc', '…as CE: TC + 1.'], ['tcb', 'cmp', 'TC is compared with MR0–MR3 all the time.'], ['cmpo', 'ctl', 'On a match the control logic acts, using MCR / EMR settings…'], ['out', 'ctl', '…drives MAT pins, raises an INTERRUPT, or stops/resets TC.'], ['capin', 'ctl', 'A CAP pin edge (per CCR)…'], ['load', 'cr', '…makes LOAD copy the TC value into CR0/CR1.']];
  const bP = el('button', { class: 'btn sm p mt', type: 'button' }, '▶ play the signal flow'); w.insertBefore(bP, info);
  bP.onclick = () => { let i = 0; const nx = () => { $$('.wr', s).forEach(p => p.classList.remove('flow')); if (i >= flow.length) return; const [wid, bid, txt] = flow[i++]; $$(`[data-w="${wid}"]`, s).forEach(p => p.classList.add('flow')); sel(bid); info.innerHTML += `<p class="say">${txt}</p>`; setTimeout(nx, 1700); }; nx(); };
});
