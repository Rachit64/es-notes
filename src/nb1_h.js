/* =========================================================
   NOTEBOOK 1 · part H — M2: the living timer board (chapter 2)
   ========================================================= */
BUILD.push(function wM2() {
  const w = MW('w-m2', 'living timer board', 'set the registers · the block diagram runs · hover anything to see what controls it');
  const F = 3e6; // PCLK
  /* ---------- registers + hardware state ---------- */
  const C = { tcr: 1, ctcr: 0, pr: 1, mr: [3, 6], mcr: 0x02, emr: 0x30, ccr: 0 };
  const H = { pc: 0, tc: 0, rstPend: false, em: [0, 0], ir: 0, cr: [null, null], cap: [0, 0], t: 0, carry: 0 };
  let spd = 1e-6 * 2.5, run = true, gen = 0, genPh = 0, cpuLoop = false, hist = [], flashM = [0, 0], ring = 0, capFlash = [0, 0];
  const en = () => C.tcr & 1, rs = () => (C.tcr >> 1) & 1, mode = () => C.ctcr & 3, csel = () => (C.ctcr >> 2) & 3;
  const mcrb = (k, b) => (C.mcr >> (k * 3 + b)) & 1, emc = k => (C.emr >> (4 + 2 * k)) & 3;

  function incTC() {
    if (H.rstPend) { H.tc = 0; H.rstPend = false; } else H.tc = (H.tc + 1) >>> 0;
    for (let k = 0; k < 2; k++) if (H.tc === C.mr[k]) match(k);
  }
  function match(k) {
    flashM[k] = 1; const a = emc(k);
    if (a === 1) H.em[k] = 0; else if (a === 2) H.em[k] = 1; else if (a === 3) H.em[k] ^= 1;
    C.emr = (C.emr & ~3) | H.em[0] | (H.em[1] << 1);
    if (mcrb(k, 0)) { H.ir |= 1 << k; ring = 1; }
    if (mcrb(k, 1)) H.rstPend = true;
    if (mcrb(k, 2)) { C.tcr &= ~1; H.pc = 0; }
    pulseMatch(k); rec();
  }
  function distToMatch() { let d = Infinity; for (let k = 0; k < 2; k++) if (C.mr[k] > H.tc) d = Math.min(d, C.mr[k] - H.tc); return d; }
  function runTicks(n) { // timer mode: n PCLK ticks
    while (n > 0 && en() && !rs()) {
      const to = C.pr - H.pc + 1;
      if (n < to) { H.pc += n; return; }
      n -= to; H.pc = 0; incTC(); tickPulse();
      const steps = Math.floor(n / (C.pr + 1));
      if (steps > 1 && !H.rstPend) { const j = Math.min(steps - 1, distToMatch() - 1); if (j > 0) { H.tc = (H.tc + j) >>> 0; n -= j * (C.pr + 1); } }
    }
  }
  function advance(dt) { // dt = simulated seconds
    if (rs()) { H.pc = 0; H.tc = 0; H.rstPend = false; }
    let left = dt;
    while (left > 0) {
      let step = left;
      if (gen) { const half = .5 / gen, next = (Math.floor(genPh / half) + 1) * half; step = Math.min(left, next - genPh + 1e-12); }
      if (mode() === 0) { const x = H.carry + step * F; const n = Math.floor(x); H.carry = x - n; runTicks(n); }
      H.t += step; left -= step;
      if (gen) { const half = .5 / gen, before = Math.floor(genPh / half); genPh += step; if (Math.floor(genPh / half) !== before) setCap(0, H.cap[0] ^ 1); }
    }
    if (cpuLoop && !en() && H.em[0]) { // the CPU's polling loop saw EM0 = 1 → it restarts the delay
      C.tcr = 2; H.pc = 0; H.tc = 0; H.rstPend = false; C.tcr = 1; H.em[0] = 0; C.emr &= ~1; cpuKick = 1; paintPanel();
    }
  }
  let cpuKick = 0;
  function setCap(i, lv) {
    if (H.cap[i] === lv) return; H.cap[i] = lv; capFlash[i] = 1;
    const rise = lv === 1, m = mode();
    if (m && csel() === i && en() && !rs() && (m === 3 || (m === 1 && rise) || (m === 2 && !rise))) { incTC(); tickPulse(true); }
    if ((C.ccr >> (3 * i + (rise ? 0 : 1))) & 1) { H.cr[i] = H.tc; capPulse(i); if ((C.ccr >> (3 * i + 2)) & 1) { H.ir |= 1 << (4 + i); ring = 1; } }
    rec();
  }
  function rec() { hist.push({ t: H.t, tc: H.tc, e0: H.em[0], e1: H.em[1], c0: H.cap[0], c1: H.cap[1] }); }

  /* ---------- layout ---------- */
  const scn = el('div', { class: 'chips mb' }); w.appendChild(scn);
  const wrap = el('div', { class: 'm2wrap' }); w.appendChild(wrap);
  const panel = el('div', { class: 'm2panel' }); wrap.appendChild(panel);
  const right = el('div', { class: 'm2right' }); wrap.appendChild(right);
  const S = sv('svg', { class: 'dg m2d', viewBox: '0 0 440 530', role: 'img', 'aria-label': 'live timer block diagram' }); right.appendChild(S);
  const tctl = el('div', { class: 'row m2time' }); right.appendChild(tctl);
  const scope = sv('svg', { class: 'dg m2scope', viewBox: '0 0 640 172' }); w.appendChild(scope);
  const bottom = el('div', { class: 'm2bottom' }); w.appendChild(bottom);
  const formula = el('div', { class: 'm2f mbox' }); bottom.appendChild(formula);
  const codeBox = el('div', { class: 'm2code' }); bottom.appendChild(codeBox);

  /* ---------- the panel ---------- */
  const sec = (blk, title, sub) => { const d = el('div', { class: 'm2sec', 'data-blk': blk }); d.innerHTML = `<div class="m2st"><b>${title}</b><small>${sub}</small></div>`; panel.appendChild(d); return d; };
  const UI = {};
  const sT = sec('tcr', 'TCR', 'start / reset');
  UI.tcr = chipGroup(sT, [[2, '2 · hold at 0'], [1, '1 · count'], [0, '0 · frozen']], C.tcr, v => { C.tcr = +v; if (C.tcr === 2) { H.pc = 0; H.tc = 0; H.rstPend = false; } changed(); });
  const sC = sec('ctcr', 'CTCR', 'what moves TC');
  UI.mode = chipGroup(sC, [[0, '00 PCLK (timer)'], [1, '01 CAP ↑'], [2, '10 CAP ↓'], [3, '11 CAP ↕']], 0, v => { C.ctcr = (C.ctcr & ~3) | +v; changed(); });
  UI.sel = chipGroup(sC, [[0, 'CAPn.0'], [1, 'CAPn.1']], 0, v => { C.ctcr = (C.ctcr & 3) | (+v << 2); changed(); }, 'm2small');
  const num = (blk, lab, get, setv, max) => { const r = el('div', { class: 'm2num' }); const i = el('input', { class: 'inp', type: 'number', min: 0, max, 'aria-label': lab }); r.append(el('span', { class: 'gae' }, lab), i); i.oninput = () => { const v = clamp(Math.floor(+i.value || 0), 0, max); setv(v); changed(true); }; blk.appendChild(r); return { i, upd() { if (document.activeElement !== i) i.value = get(); } }; };
  const sP = sec('pr', 'PR', 'TC + 1 every PR+1 ticks');
  UI.pr = num(sP, 'PR =', () => C.pr, v => { C.pr = v; H.pc = Math.min(H.pc, v); }, 4294967295);
  const sM = sec('mr', 'MR0 · MR1', 'targets compared with TC');
  UI.mr0 = num(sM, 'MR0 =', () => C.mr[0], v => C.mr[0] = v, 4294967295); UI.mr1 = num(sM, 'MR1 =', () => C.mr[1], v => C.mr[1] = v, 4294967295);
  const sMC = sec('mcr', 'MCR', 'on a match: Interrupt · Reset · Stop');
  const mg = el('div', { class: 'm2grid' }); sMC.appendChild(mg); UI.mcr = [];
  ['MR0', 'MR1'].forEach((n, k) => { mg.appendChild(el('span', { class: 'gae' }, n)); ['I', 'R', 'S'].forEach((t, b) => { const c = el('button', { class: 'gcell m2g', type: 'button', 'aria-label': `${n} ${t}` }, `<span>${t}</span><small>bit ${k * 3 + b}</small>`); c.onclick = () => { C.mcr ^= 1 << (k * 3 + b); changed(); }; mg.appendChild(c); UI.mcr[k * 3 + b] = c; }); });
  const sE = sec('emr', 'EMR', 'what EM0 / EM1 do on a match');
  UI.emc = [0, 1].map(k => { const r = el('div', { class: 'row m2emr' }); sE.appendChild(r); r.appendChild(el('span', { class: 'gae' }, `EMC${k}`)); return chipGroup(r, [[0, 'nothing'], [1, 'clear'], [2, 'set'], [3, 'toggle']], emc(k), v => { C.emr = (C.emr & ~(3 << (4 + 2 * k))) | (+v << (4 + 2 * k)); changed(); }, 'm2small'); });
  const sCC = sec('ccr', 'CCR', 'capture TC on a CAP edge');
  const cg = el('div', { class: 'm2grid' }); sCC.appendChild(cg); UI.ccr = [];
  ['CAP0', 'CAP1'].forEach((n, k) => { cg.appendChild(el('span', { class: 'gae' }, n)); ['RE ↑', 'FE ↓', 'I'].forEach((t, b) => { const c = el('button', { class: 'gcell m2g', type: 'button', 'aria-label': `${n} ${t}` }, `<span>${t}</span><small>bit ${k * 3 + b}</small>`); c.onclick = () => { C.ccr ^= 1 << (k * 3 + b); changed(); }; cg.appendChild(c); UI.ccr[k * 3 + b] = c; }); });
  const sX = sec('cap', 'outside world', 'pins + the CPU');
  const gx = el('div', { class: 'chips' }); sX.appendChild(gx);
  UI.gen = chipGroup(gx, [[0, 'generator off'], [2, '2 Hz on CAPn.0'], [4, '4 Hz on CAPn.0']], 0, v => { gen = +v; }, 'm2small');
  const px = el('div', { class: 'row', style: 'gap:6px' }); sX.appendChild(px);
  [0, 1].forEach(i => { const b = el('button', { class: 'btn sm', type: 'button' }, `pulse CAPn.${i}`); b.onclick = () => { setCap(i, 1); setTimeout(() => setCap(i, 0), 260); }; px.appendChild(b); });
  const irb = el('button', { class: 'btn sm g', type: 'button' }, 'IR = 0x33 (clear flags)'); irb.onclick = () => { H.ir = 0; paintAll(); }; px.appendChild(irb);
  UI.cpu = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-o)' }, 'CPU loop: restart when EM0 = 1 (P1 / P6)'); sX.appendChild(UI.cpu);
  UI.cpu.onclick = () => { cpuLoop = !cpuLoop; UI.cpu.classList.toggle('on', cpuLoop); };

  /* ---------- time controls ---------- */
  const fmtS = s => s >= 1 ? (+s.toPrecision(4)) + ' s' : s >= 1e-3 ? (+(s * 1e3).toPrecision(4)) + ' ms' : (+(s * 1e6).toPrecision(4)) + ' µs';
  const spR = ruler(tctl, 'time lens', 0, 60, 4, 1, v => { const tps = 10 ** (-6 + v / 10) * F; return tps < 1e3 ? (+tps.toPrecision(2)) + ' PCLK ticks / s' : tps >= F * .99 ? 'real time (3 MHz)' : '×' + (+(10 ** (-6 + v / 10)).toPrecision(2)) + ' real time'; }, v => { spd = 10 ** (-6 + v / 10); });
  const bRun = el('button', { class: 'btn sm y', type: 'button' }, '❚❚ pause'), b1 = el('button', { class: 'btn sm', type: 'button' }, '+1 PCLK');
  tctl.append(bRun, b1);
  bRun.onclick = () => { run = !run; bRun.textContent = run ? '❚❚ pause' : '▶ run'; };
  b1.onclick = () => { run = false; bRun.textContent = '▶ run'; if (mode() === 0) { if (rs()) { H.pc = 0; H.tc = 0; } runTicks(1); H.t += 1 / F; } rec(); paintAll(); };
  const setSpeed = v => { spR.value = v; spR.dispatchEvent(new Event('input')); };

  /* ---------- the diagram ---------- */
  const R = rng(22), g = sv('g', {}, S);
  const B = (blk, x, y, ww, hh, fill) => { const e = sv('g', { class: 'm2blk', 'data-blk': blk }, g); sv('path', { d: Pen.rect(x, y, ww, hh, R, .9), class: 'bx' }, e); sv('rect', { x, y, width: ww, height: hh, rx: 6, class: 'bf', style: `fill:${fill}` }, e).parentNode.insertBefore(e.lastChild, e.firstChild); return e; };
  const TX = (x, y, t, cls = '', a = 'middle', par = g) => { const e = sv('text', { x, y, 'text-anchor': a, class: cls }, par); e.textContent = t; return e; };
  const WR = (id, d, mk = true) => { const p = sv('path', { d, class: 'm2w', 'data-w': id, 'marker-end': mk ? 'url(#ah)' : '' }, g); return p; };
  // wires first (under the blocks)
  const W = {
    pclk: WR('pclk', 'M50 38 H150'), cap0: WR('cap0', 'M330 38 H272'), cap1: WR('cap1', 'M400 52 V64 H262'),
    pcin: WR('pcin', 'M180 70 V88 H105 V102'), byp: WR('byp', 'M240 70 V108'), tci: WR('tci', 'M190 128 H220'), en: WR('en', 'M300 128 H266'),
    ce: WR('ce', 'M242 146 V174'), bus: WR('bus', 'M170 232 V250 M124 250 H316 M124 250 V264 M316 250 V264', false),
    mr0: WR('mr0', 'M92 280 H108'), mr1: WR('mr1', 'M348 280 H332'), m0: WR('m0', 'M124 296 V338'), m1: WR('m1', 'M316 296 V338'),
    rst: WR('rst', 'M40 372 H20 V204 H58'), stop: WR('stop', 'M400 372 H426 V160 H332 V154'),
    mat0: WR('mat0', 'M90 412 V448'), mat1: WR('mat1', 'M200 412 V448'), irq: WR('irq', 'M326 412 V440'),
    cc0: WR('cc0', 'M340 52 V80 H404 V102'), cc1: WR('cc1', 'M400 66 V80'), tcv: WR('tcv', 'M280 204 H306 V186 H316 M306 204 V222 H316', false), load: WR('load', 'M404 154 V166', true)
  };
  // blocks
  const bPCLK = sv('g', { 'data-blk': 'pclk', class: 'm2blk' }, g); const lamp = sv('circle', { cx: 34, cy: 38, r: 15, class: 'm2lamp' }, bPCLK); TX(34, 70, 'PCLK', 'lb', 'middle', bPCLK); TX(34, 86, '3 MHz', 'sm', 'middle', bPCLK);
  const bMux = sv('g', { 'data-blk': 'ctcr', class: 'm2blk' }, g); sv('path', { d: 'M150 20 H272 L254 70 H168 Z', class: 'bx', style: 'fill:var(--n-l)' }, bMux); TX(211, 38, 'CTCR mux', 'lb', 'middle', bMux); const tMux = TX(211, 58, '', 'sm', 'middle', bMux);
  const capG = [0, 1].map(i => { const e = sv('g', { 'data-blk': 'cap', class: 'm2blk m2pin', tabindex: 0, role: 'button', 'aria-label': `pulse CAPn.${i}` }, g); const x = i ? 400 : 340; sv('rect', { x: x - 12, y: 28, width: 24, height: 20, rx: 4, class: 'pad' }, e); TX(x, 20, `CAPn.${i}`, 'sm', 'middle', e); const pulse = ev => { ev && ev.preventDefault(); setCap(i, 1); setTimeout(() => setCap(i, 0), 260); }; e.addEventListener('click', pulse); e.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') pulse(ev); }); return e; });
  B('pr', 20, 104, 170, 48, 'var(--n-g)'); const tPC = TX(105, 122, '', 'mo'); const pcBar = sv('rect', { x: 30, y: 131, width: 0, height: 11, rx: 3, style: 'fill:var(--green)' }, g); sv('rect', { x: 30, y: 131, width: 150, height: 11, rx: 3, style: 'fill:none;stroke:var(--ink3)' }, g);
  TX(196, 122, 'TCI', 'sm', 'start');
  const bAnd = sv('g', { 'data-blk': 'tcr', class: 'm2blk' }, g); sv('path', { d: 'M222 110 H262 V128 A20 18 0 0 1 242 146 A20 18 0 0 1 222 128 Z', class: 'bx', style: 'fill:var(--paper)' }, bAnd); TX(242, 130, '&', 'lb', 'middle', bAnd);
  B('tcr', 300, 104, 64, 48, 'var(--n-p)'); TX(332, 120, 'TCR', 'lb'); const lEn = sv('circle', { cx: 318, cy: 138, r: 6, class: 'm2led g' }, g), lRs = sv('circle', { cx: 346, cy: 138, r: 6, class: 'm2led r' }, g); TX(318, 99, 'en', 'xs'); TX(346, 99, 'rst', 'xs');
  B('ccr', 374, 104, 60, 48, 'var(--n-o)'); TX(404, 122, 'CCR', 'lb'); const tCCR = TX(404, 142, '', 'xs');
  B('tc', 58, 176, 222, 56, 'var(--n-b)'); TX(72, 196, 'TC', 'lb', 'start'); const tTC = TX(268, 216, '0', 'odo', 'end');
  const crT = [0, 1].map(i => { B('ccr', 316, 170 + i * 36, 104, 30, 'var(--card)'); return TX(368, 190 + i * 36, `CR${i} = —`, 'mo'); });
  TX(420, 326, 'stop', 'xs', 'end'); TX(22, 196, 'reset', 'xs', 'start');
  const cmp = [124, 316].map((x, k) => { const e = sv('g', { 'data-blk': 'mr', class: 'm2blk' }, g); const c = sv('circle', { cx: x, cy: 280, r: 15, class: 'bx', style: 'fill:var(--paper)' }, e); TX(x, 286, '=', 'lb', 'middle', e); return c; });
  const mrT = [0, 1].map(k => { B('mr', k ? 348 : 6, 266, 86, 28, 'var(--n-y)'); return TX(k ? 391 : 49, 285, '', 'mo'); });
  B('mcr', 40, 338, 360, 74, 'var(--n-l)'); TX(220, 356, 'match control  ·  MCR + EMR', 'lb');
  const ctlT = [0, 1].map(k => TX(220, 380 + k * 22, '', 'mo'));
  const matL = [0, 1].map(k => { const x = k ? 200 : 90, e = sv('g', { 'data-blk': 'emr', class: 'm2blk' }, g); const c = sv('circle', { cx: x, cy: 464, r: 15, class: 'm2out' }, e); TX(x, 498, `MAT0.${k}`, 'lb', 'middle', e); TX(x, 514, `= EM${k}`, 'xs', 'middle', e); return c; });
  const bell = sv('g', { 'data-blk': 'mcr', class: 'm2blk' }, g); const bellU = sv('use', { href: '#st-bell', x: 306, y: 440, width: 40, height: 40 }, bell); const tIR = TX(326, 498, 'IR = 0x00', 'mo', 'middle', bell); TX(326, 514, 'interrupt → NVIC (nb ②)', 'xs', 'middle', bell);
  const tCpu = TX(14, 527, '', 'sm cpu', 'start');
  const walker = Walker(S);
  function tickPulse(counter) { if (spd * F > 40) return; if (counter) walker.go([[mode() && csel() ? 400 : 340, 48], [240, 70], [242, 146], [242, 174]], { speed: 400 }); else if (H.pc === 0) walker.go([[190, 128], [222, 128], [242, 146], [242, 174]], { speed: 300, cls: 'g' }); }
  function pulseMatch(k) { if (spd * F > 3e5 && Math.random() > .3) return; const x = k ? 316 : 124; walker.go([[x, 296], [x, 338]], { speed: 220, cls: 'r' }); }
  function capPulse(i) { walker.go([[i ? 400 : 340, 48], [i ? 400 : 340, 80], [404, 80], [404, 104]], { speed: 300, cls: 'b' }); }

  /* ---------- painting ---------- */
  function paintPanel() {
    UI.tcr.set(C.tcr); UI.mode.set(mode()); UI.sel.set(csel());
    UI.pr.upd(); UI.mr0.upd(); UI.mr1.upd();
    UI.mcr.forEach((c, b) => c.classList.toggle('on', !!((C.mcr >> b) & 1))); UI.ccr.forEach((c, b) => c.classList.toggle('on', !!((C.ccr >> b) & 1)));
    UI.emc.forEach((u, k) => u.set(emc(k)));
    const L = (blk, t) => `<span data-blk="${blk}">${hlC(t)}</span>`;
    codeBox.innerHTML = `<div class="mlab">the setup this board is running</div><div class="mcode">${[
      L('tcr', 'LPC_TIM0->TCR  = 2;       // reset'), L('ctcr', `LPC_TIM0->CTCR = ${hx(C.ctcr)};`), L('pr', `LPC_TIM0->PR   = ${C.pr};`), L('mr', `LPC_TIM0->MR0  = ${C.mr[0]};`), L('mr', `LPC_TIM0->MR1  = ${C.mr[1]};`),
      L('mcr', `LPC_TIM0->MCR  = ${hx(C.mcr)};`), L('emr', `LPC_TIM0->EMR  = ${hx(C.emr & 0xFF0)};`), L('ccr', `LPC_TIM0->CCR  = ${hx(C.ccr)};`), L('tcr', `LPC_TIM0->TCR  = ${C.tcr};       // ${C.tcr === 1 ? 'go!' : C.tcr === 2 ? 'held at 0' : 'frozen'}`)].join('\n')}</div>`;
    paintFormula();
  }
  function paintFormula() {
    const st = (C.pr + 1) / F, m0 = C.mr[0];
    formula.innerHTML = mode() ? `<b>counter mode</b>: TC + 1 on every ${['', 'rising', 'falling', 'rising and falling'][mode()]} edge of <b>CAPn.${csel()}</b> — PR is not used.${C.mr[1] && mcrb(1, 1) ? ` TC counts 0 … ${C.mr[1]} → ${C.mr[1] + 1} edges per round.` : ''}`
      : `1 TC step = (PR+1) / 3 MHz = <b>${fmtS(st)}</b> · TC reaches MR0 after (PR+1)×MR0 = <b>${fmtS(st * m0)}</b>${mcrb(0, 1) ? ` · with reset, 1 cycle = (PR+1)(MR0+1) / 3 MHz = <b>${fmtS(st * (m0 + 1))}</b>${emc(0) === 3 ? ` → MAT0.0 square wave, period <b>${fmtS(2 * st * (m0 + 1))}</b>` : ''}` : mcrb(0, 2) ? ' · then it <b>stops</b>' : ''}`;
  }
  function wireOn(id, on, cls = 'on') { W[id].setAttribute('class', 'm2w' + (on ? ' ' + cls : ' off')); }
  function paintAll() {
    const m = mode(), tm = m === 0, go = en() && !rs(), fast = spd * F > 40;
    lamp.classList.toggle('on', tm && go && (fast || H.pc === 0));
    tMux.textContent = tm ? 'timer mode' : `count CAPn.${csel()} ${['', '↑', '↓', '↕'][m]}`;
    wireOn('pclk', tm, fast && go ? 'on flow' : 'on'); wireOn('pcin', tm && go, fast ? 'on flow' : 'on'); wireOn('tci', tm && go); wireOn('byp', !tm && go);
    wireOn('cap0', !tm && csel() === 0); wireOn('cap1', !tm && csel() === 1); wireOn('en', en()); wireOn('ce', go, fast && tm ? 'on flow' : 'on');
    wireOn('bus', true); wireOn('mr0', true); wireOn('mr1', true); wireOn('m0', !!(C.mcr & 7) || emc(0)); wireOn('m1', !!(C.mcr & 0x38) || emc(1));
    wireOn('rst', mcrb(0, 1) || mcrb(1, 1)); wireOn('stop', mcrb(0, 2) || mcrb(1, 2)); wireOn('mat0', emc(0) > 0); wireOn('mat1', emc(1) > 0); wireOn('irq', mcrb(0, 0) || mcrb(1, 0) || (C.ccr & 0x24));
    wireOn('cc0', !!(C.ccr & 3)); wireOn('cc1', !!(C.ccr & 0x18)); wireOn('tcv', !!(C.ccr & 0x1B)); wireOn('load', !!(C.ccr & 0x1B));
    tPC.textContent = tm ? `PC ${fmtN(H.pc)} / PR ${fmtN(C.pr)}` : 'PC not used';
    pcBar.setAttribute('width', tm ? 150 * (H.pc + (fast && go ? .5 : 0)) / (C.pr + 1) : 0);
    lEn.classList.toggle('on', !!en()); lRs.classList.toggle('on', !!rs());
    tCCR.textContent = C.ccr ? hx(C.ccr) : 'off';
    tTC.textContent = fmtN(H.tc);
    crT.forEach((t, i) => t.textContent = `CR${i} = ${H.cr[i] == null ? '—' : fmtN(H.cr[i])}`);
    cmp.forEach((c, k) => c.classList.toggle('hit', flashM[k] > 0));
    mrT.forEach((t, k) => t.textContent = `MR${k} ${fmtN(C.mr[k])}`);
    ctlT.forEach((t, k) => { const f = ['I', 'R', 'S'].map((x, b) => mcrb(k, b) ? x : '·').join(' '); t.textContent = `MR${k}:  ${f}   ·   EM${k} → ${['nothing', 'clear', 'set', 'toggle'][emc(k)]}`; });
    matL.forEach((c, k) => c.classList.toggle('on', !!H.em[k]));
    bellU.classList.toggle('ringing', ring > 0); tIR.textContent = `IR = ${hx(H.ir)}`;
    capG.forEach((e, i) => e.classList.toggle('hi', !!H.cap[i]));
    tCpu.textContent = cpuLoop ? (cpuKick > 0 ? 'CPU: TCR=2, EMR=0x20, TCR=1' : 'CPU: polling EMR & 1…') : '';
    paintScope();
  }
  function paintScope() {
    const WD = +scope.getAttribute('viewBox').split(' ')[2], X0 = 62, Wd = WD - X0 - 8, win = 6 * spd, t1 = H.t, t0 = t1 - win;
    while (hist.length > 2 && hist[1].t < t0) hist.shift();
    const top = Math.max(C.mr[0], C.mr[1], 1) * 1.12, X = t => X0 + (t - t0) / win * Wd, Y = v => 62 - Math.min(1, v / top) * 54;
    let o = `<text x="4" y="40" class="lb">TC</text><text x="4" y="86" class="sm">MAT0.0</text><text x="4" y="108" class="sm">MAT0.1</text><text x="4" y="130" class="sm">CAPn.0</text><text x="4" y="146" class="sm">CAPn.1</text>`;
    [0, 1].forEach(k => { const y = Y(C.mr[k]); o += `<path d="M${X0} ${y} H${X0 + Wd}" class="mrl${k}"/><text x="${X0 - 4}" y="${y + 4}" text-anchor="end" class="xs mrt${k}">MR${k}</text>`; });
    const pts = hist.filter(h => h.t >= t0).concat([{ t: t1, tc: H.tc, e0: H.em[0], e1: H.em[1], c0: H.cap[0], c1: H.cap[1] }]);
    if (pts.length > 1) {
      let d = '', p0 = null; pts.forEach(h => { const x = X(Math.max(h.t, t0)).toFixed(1), y = Y(h.tc).toFixed(1); d += (p0 ? (h.tc < p0.tc ? `H${x}V${y}` : `L${x} ${y}`) : `M${x} ${y}`); p0 = h; });
      o += `<path d="${d}" class="tcl"/>`;
      [['e0', 92, 'em'], ['e1', 114, 'em'], ['c0', 136, 'cp'], ['c1', 152, 'cp']].forEach(([k, y, c]) => { const dd = digi(pts.map(h => [Math.max(h.t, t0), h[k]]), X, y - 12, y); o += `<path d="${dd}" class="${c}"/>`; });
    }
    o += `<text x="${X0 + Wd}" y="168" text-anchor="end" class="xs">← the last ${fmtS(win)} of simulated time · now →|</text>`;
    scope.innerHTML = o;
  }
  function changed(soft) { paintPanel(); paintAll(); }

  /* ---------- hover links: panel ↔ diagram ↔ code ---------- */
  w.addEventListener('pointerover', e => { const t = e.target.closest('[data-blk]'); $$('.lk', w).forEach(x => x.classList.remove('lk')); if (t) $$(`[data-blk="${t.dataset.blk}"]`, w).forEach(x => x.classList.add('lk')); });
  w.addEventListener('pointerleave', () => $$('.lk', w).forEach(x => x.classList.remove('lk')));

  /* ---------- scenarios ---------- */
  const SC = [
    ['engine · PR 1, MR0 3, reset + toggle', { tcr: 1, ctcr: 0, pr: 1, mr: [3, 6], mcr: 0x02, emr: 0x30, ccr: 0 }, 4, 0, false],
    ['P1 · 1 s delay (stop, set EM0)', { tcr: 1, ctcr: 0, pr: 1000, mr: [3000, 0], mcr: 0x04, emr: 0x20, ccr: 0 }, 58, 0, false],
    ['P1 loop · CPU restarts it', { tcr: 1, ctcr: 0, pr: 1000, mr: [3000, 0], mcr: 0x04, emr: 0x20, ccr: 0 }, 58, 0, true],
    ['P3 · square wave on MAT0.0', { tcr: 1, ctcr: 0, pr: 0, mr: [3000000, 0], mcr: 0x02, emr: 0x30, ccr: 0 }, 58, 0, false],
    ['P4 · counter ÷ 8 (slide: Timer1)', { tcr: 1, ctcr: 0x02, pr: 0, mr: [0, 3], mcr: 0x10, emr: 0xC0, ccr: 0 }, 60, 4, false],
    ['P6 · capture (tap CAP pins)', { tcr: 1, ctcr: 0, pr: 3000, mr: [1000, 0], mcr: 0x04, emr: 0x20, ccr: 0x09 }, 60, 0, true]
  ];
  SC.forEach(([t, c, sp, g2, cpu]) => { const b = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-b)' }, t); b.onclick = () => { $$('.chip', scn).forEach(x => x.classList.remove('on')); b.classList.add('on'); load(c, sp, g2, cpu); }; scn.appendChild(b); });
  scn.insertAdjacentHTML('afterbegin', '<span class="cav p-soft">load a setup:</span>');
  function load(c, sp, g2, cpu) {
    Object.assign(C, JSON.parse(JSON.stringify(c))); Object.assign(H, { pc: 0, tc: 0, rstPend: false, em: [0, 0], ir: 0, cr: [null, null], cap: [0, 0], carry: 0 }); C.emr &= ~3;
    hist = []; gen = g2; genPh = 0; UI.gen.set(g2); cpuLoop = cpu; UI.cpu.classList.toggle('on', cpu); walker.clear(); setSpeed(sp); rec(); changed();
  }
  widthWatch(w, 640, n => { scope.setAttribute('viewBox', `0 0 ${n ? 380 : 640} 172`); paintScope(); });

  const loop = Loop(w, dt => {
    flashM = flashM.map(f => Math.max(0, f - dt * 2.5)); ring = Math.max(0, ring - dt * 1.2); cpuKick = Math.max(0, cpuKick - dt);
    if (run) { const before = H.tc; advance(dt * spd); if (H.tc !== before || dt) rec(); }
    walker.step(dt); paintAll();
    if (UI.pr.i !== document.activeElement) UI.pr.upd();
  });
  $$('.chip', scn)[0].classList.add('on'); load(SC[0][1], SC[0][2], 0, false); loop.start();
});
