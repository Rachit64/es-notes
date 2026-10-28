/* =========================================================
   NOTEBOOK 2 · part E — master widgets for ch 4–6
   ========================================================= */

/* ===================================================================
   M4 · chapter 4 in one widget — "who rang?" detective corkboard
   =================================================================== */
const GPIO_OK = (p, n) => (p === 0 && ((n >= 0 && n <= 11) || (n >= 15 && n <= 30))) || (p === 2 && n >= 0 && n <= 13);
const stringDraw = (d, w) => `<path class="str-s" d="${d}"/><path class="str" d="${d}" data-track="1"/><circle class="pinhead" cx="${w.p1[0]}" cy="${w.p1[1]}" r="5"/><circle class="pinhead" cx="${w.p2[0]}" cy="${w.p2[1]}" r="5"/>`;
BUILD.push(function wM4() {
  const w = MW('w-m4', '“who rang?” — the EINT3 detective board', 'make an edge on a pin · the ISR has to find out which pin it was');
  let scen = 'G1', clr = true, nvic = true, speed = 1;
  const st = { R: { 0: 0, 2: 0 }, F: { 0: 0, 2: 0 }, enR: { 0: 0, 2: 0 }, enF: { 0: 0, 2: 0 }, clrW: { 0: null, 2: null } };
  let pins = [], led = 0, code2 = 0, rows = 3, scanRow = null, job = null, runs = 0;
  const top = el('div', { class: 'row mb' }); w.appendChild(top);
  chipGroup(top, [['G1', 'G1 · two pins, one LED'], ['G2', 'G2 · 2×2 keypad'], ['FREE', 'free play · any pin']], scen, v => { scen = v; load(); });
  const t2 = el('div', { class: 'row', style: 'gap:8px' }); top.appendChild(t2);
  const tNv = Tog(t2, '<code>NVIC_EnableIRQ(EINT3_IRQn)</code>', true, v => { nvic = v; kick(); paint(); });
  const tCl = Tog(t2, 'ISR writes <code>IOxIntClr</code>', true, v => { clr = v; buildCode(); paint(); });
  const cork = el('div', { class: 'm4-cork' }); w.appendChild(cork);
  const cPins = el('div', { class: 'mn m4-card m4-pins' }); cork.appendChild(cPins);
  const files = { 0: el('div', { class: 'mn m4-card m4-file' }), 2: el('div', { class: 'mn m4-card m4-file' }) }; cork.append(files[0], files[2]);
  const cStat = el('div', { class: 'mn m4-card m4-stat' }); cork.appendChild(cStat);
  const cBell = el('div', { class: 'mn m4-card m4-bell' }); cork.appendChild(cBell);
  const cDet = el('div', { class: 'mn m4-card m4-det' }); cork.appendChild(cDet);
  cDet.innerHTML = '<div class="mn-h">🔎 the detective: <code>EINT3_IRQHandler</code></div>';
  const code = MCode(cDet); const caseLog = el('ol', { class: 'm4-log' }); cDet.appendChild(caseLog); const out = el('div', { class: 'row m4-out' }); cDet.appendChild(out);
  cBell.innerHTML = '<div class="mn-h">EINT3 line → NVIC</div><svg class="m4-bellsvg" viewBox="0 0 100 100" width="58" height="58"><use href="#st-bell" width="100" height="100"/></svg><div class="small bs"></div>';
  const WR = Wires(cork); let strs = [];
  const say = el('div', { class: 'say m4-say' }); w.appendChild(say);

  function load() {
    st.R = { 0: 0, 2: 0 }; st.F = { 0: 0, 2: 0 }; st.clrW = { 0: null, 2: null }; job = null; runs = 0; led = 0; code2 = 0; rows = 3; scanRow = null; caseLog.innerHTML = '';
    if (scen === 'G1') pins = [{ p: 0, n: 0, lvl: 0, kind: 'push' }, { p: 0, n: 1, lvl: 0, kind: 'push' }];
    else if (scen === 'G2') pins = [{ p: 2, n: 10, lvl: 0, kind: 'col' }, { p: 2, n: 11, lvl: 0, kind: 'col' }];
    else pins = [{ p: 0, n: 0, lvl: 0, kind: 'sw' }, { p: 0, n: 15, lvl: 0, kind: 'sw' }, { p: 2, n: 10, lvl: 0, kind: 'sw' }, { p: 1, n: 23, lvl: 0, kind: 'sw' }];
    st.enR = { 0: scen === 'G1' ? 3 : scen === 'FREE' ? 1 : 0, 2: scen === 'G2' ? (1 << 10 | 1 << 11) : scen === 'FREE' ? 1 << 10 : 0 }; st.enF = { 0: scen === 'FREE' ? 1 << 15 : 0, 2: 0 };
    buildPins(); buildCode(); rewire();
    say.innerHTML = { G1: 'G1: rising edges on P0.0 and P0.1 are enabled (IO0IntEnR = 0x3). Press a pin button.', G2: 'G2: both rows are driven HIGH; pressing a key pulls its column HIGH → a <b>rising edge</b> on P2.10 or P2.11. Press a key.', FREE: 'Free play: pick any pin, choose which edges may interrupt (R / F tabs), flip the pin. Try P1.23 or P0.12 — can they interrupt?' }[scen];
    paint();
  }
  function buildPins() {
    cPins.innerHTML = `<div class="mn-h">${scen === 'G2' ? 'keypad (rows P1.0/P1.1 → HIGH)' : 'the suspects (pins)'}</div>`;
    if (scen === 'G2') {
      const kp = Keypad(cPins, { rows: 2, cols: 2, labels: ['0', '1', '2', '3'], onchange: (p, i, how) => { if (how === 'down' || how === undefined) keyPress(i); else if (how === 'up') keyUp(i); } }); kp.el.style.maxWidth = '150px'; cPins._kp = kp;
      pins.forEach(pn => { pn.el = el('div', { class: 'm4-pin col' }, `<b>P2.${pn.n}</b> <span class="lv"></span> <small>column ${pn.n - 10}</small>`); cPins.appendChild(pn.el); });
      return;
    }
    pins.forEach((pn, i) => {
      const card = el('div', { class: 'm4-pin' }); cPins.appendChild(card); pn.el = card;
      const head = el('div', { class: 'row', style: 'gap:6px' }); card.appendChild(head);
      if (scen === 'FREE') { const sel = el('select', { class: 'sel', 'aria-label': 'pin' }); [0, 1, 2].forEach(p => { for (let n = 0; n < 32; n++) { if (p === 2 && n > 13) break; sel.appendChild(el('option', { value: p + '.' + n }, `P${p}.${n}${GPIO_OK(p, n) ? '' : ' ✗'}`)); } }); sel.value = pn.p + '.' + pn.n; sel.onchange = () => { const [p, n] = sel.value.split('.').map(Number); clearPin(pn); pn.p = p; pn.n = n; pn.lvl = 0; rewire(); paint(); }; head.appendChild(sel); }
      else head.appendChild(el('b', { class: 'mono' }, `P${pn.p}.${pn.n}`));
      head.appendChild(el('span', { class: 'lv' }));
      const act = el('div', { class: 'row', style: 'gap:6px' }); card.appendChild(act);
      if (pn.kind === 'push') { const b = el('button', { class: 'btn sm p', type: 'button' }, '↑ pulse'); b.onclick = () => { setLvl(pn, 1); setTimeout(() => { setLvl(pn, 0); }, 450); }; act.appendChild(b); }
      else { const b = el('button', { class: 'tsw', type: 'button', 'aria-label': 'pin level' }, '<i></i>'); b.onclick = () => { setLvl(pn, pn.lvl ^ 1); b.classList.toggle('on', !!pn.lvl); }; act.appendChild(b); }
      ['R', 'F'].forEach(k => { const t = el('button', { class: 'm4-tab ' + k, type: 'button', title: k === 'R' ? 'IOxIntEnR bit' : 'IOxIntEnF bit' }, k === 'R' ? 'EnR ↗' : 'EnF ↘'); t.onclick = () => { if (!GPIO_OK(pn.p, pn.n)) return; const reg = k === 'R' ? st.enR : st.enF; reg[pn.p] = (reg[pn.p] ^ (1 << pn.n)) >>> 0; paint(); }; act.appendChild(t); pn['t' + k] = t; });
      pn.warn = el('div', { class: 'tiny p-red' }); card.appendChild(pn.warn);
    });
  }
  function clearPin(pn) { if (!GPIO_OK(pn.p, pn.n)) return; const m = ~(1 << pn.n); st.enR[pn.p] &= m; st.enF[pn.p] &= m; st.R[pn.p] &= m; st.F[pn.p] &= m; }
  function setLvl(pn, v) {
    if (pn.lvl === v) return; const rise = v === 1; pn.lvl = v;
    if (GPIO_OK(pn.p, pn.n)) { const b = 1 << pn.n; if (rise && st.enR[pn.p] & b) st.R[pn.p] |= b; if (!rise && st.enF[pn.p] & b) st.F[pn.p] |= b;
      const caught = (rise ? st.enR : st.enF)[pn.p] & b; if (!job) say.innerHTML = caught ? `P${pn.p}.${pn.n}: ${rise ? 'rising ↗' : 'falling ↘'} edge → <b>IO${pn.p}IntStat${rise ? 'R' : 'F'} bit ${pn.n} = 1</b> → IOIntStatus bit ${pn.p} → EINT3 rings.` : `P${pn.p}.${pn.n}: ${rise ? 'rising' : 'falling'} edge — but IO${pn.p}IntEn${rise ? 'R' : 'F'} bit ${pn.n} is 0 → <b>ignored</b>.`; }
    else if (!job) say.innerHTML = `P${pn.p}.${pn.n} changed, but ${pn.p === 1 ? 'port 1 has <b>no</b> GPIO interrupts' : 'this pin has no interrupt hardware (only P0.0–11, P0.15–30, P2.0–13)'} → nothing happens.`;
    kick(); paint();
  }
  // G2 keypad: rows driven high; a pressed key in a driven row pulls its column high
  let held = new Set(), lastKey = null;
  function colLevels() { [0, 1].forEach(cIdx => { const pn = pins[cIdx]; let v = 0; held.forEach(k => { const r = k >> 1, c = k & 1; if (c === cIdx && (rows >> r) & 1) v = 1; }); setLvl(pn, v); }); }
  function keyPress(k) { held.add(k); lastKey = k; colLevels(); }
  function keyUp(k) { held.delete(k); colLevels(); }

  /* ---- the ISR (one step every ~0.85 s) ---- */
  const CODES = {
    G1: () => ['void EINT3_IRQHandler(void)', '{', '    unsigned int x = LPC_GPIOINT->IO0IntStatR;', clr ? '    LPC_GPIOINT->IO0IntClr = x;' : '    /* forgot: IO0IntClr = x; */', '    if(x == 0x00000001)', '        LPC_GPIO1->FIOSET = 1<<23;   // LED on', '    else', '        LPC_GPIO1->FIOCLR = 1<<23;   // LED off', '}'],
    G2: () => ['void EINT3_IRQHandler(void)', '{', '    temp3 = LPC_GPIOINT->IO2IntStatR;', '    if(temp3 == 1<<10) col = 0;', '    else if(temp3 == 1<<11) col = 1;', clr ? '    LPC_GPIOINT->IO2IntClr = 1<<10 | 1<<11;' : '    /* forgot: IO2IntClr = ...; */', '    for(row = 0; row < 2; row++) {', '        LPC_GPIO1->FIOPIN = 1 << row;    // one row HIGH', '        if(LPC_GPIO2->FIOPIN & (3<<10)) {', '            LPC_GPIO0->FIOPIN = row*2 + col;', '            LPC_GPIO1->FIOSET = 0x03; break; } }', '}'],
    FREE: () => ['void EINT3_IRQHandler(void)', '{', '    if(LPC_GPIOINT->IntStatus & 1) {        // IOIntStatus: port 0?', '        r = LPC_GPIOINT->IO0IntStatR;  f = LPC_GPIOINT->IO0IntStatF;', clr ? '        LPC_GPIOINT->IO0IntClr = r | f;  }' : '        /* forgot IO0IntClr */  }', '    if(LPC_GPIOINT->IntStatus & 4) {        // port 2?', '        r = LPC_GPIOINT->IO2IntStatR;  f = LPC_GPIOINT->IO2IntStatF;', clr ? '        LPC_GPIOINT->IO2IntClr = r | f;  }' : '        /* forgot IO2IntClr */  }', '}']
  };
  function buildCode() { code.set(CODES[scen]().map(l => l.replace(/^( {4})+/, m => '  '.repeat(m.length / 4)))); }
  const pending = () => !!(st.R[0] | st.F[0] | st.R[2] | st.F[2]);
  const pinsOf = (p, m) => { const L = []; for (let b = 0; b < 32; b++) if ((m >>> b) & 1) L.push(`P${p}.${b}`); return L.join(', ') || 'none'; };
  function plan() {
    const S = []; const lg = (t, l, card, f) => S.push({ t, l, card, f });
    lg('🔔 EINT3 rang. Every GPIO interrupt arrives here — but which pin?', 0, cBell);
    if (scen === 'G1') {
      const x = st.R[0];
      lg(`x = IO0IntStatR = <b>${hex(x)}</b> → ${pinsOf(0, x)}`, 2, files[0]);
      lg(clr ? `IO0IntClr = ${hex(x)} → those status bits cleared` : '<span class="p-red">no clear → the status bits stay 1</span>', 3, files[0], () => { if (clr) { st.R[0] &= ~x; st.F[0] &= ~x; st.clrW[0] = x; } });
      lg(x === 1 ? 'x == 1 → it was <b>P0.0</b> → LED <b>ON</b>' : x === 2 ? 'x ≠ 1 → else → (P0.1) → LED <b>OFF</b>' : `x = ${hex(x)} ≠ 1 → else → LED <b>OFF</b> (both pins were pending — the slide's code can't tell!)`, x === 1 ? [4, 5] : [6, 7], cDet, () => { led = x === 1 ? 1 : 0; });
    } else if (scen === 'G2') {
      const t3 = st.R[2], col = t3 === 1 << 10 ? 0 : t3 === 1 << 11 ? 1 : null;
      lg(`temp3 = IO2IntStatR = <b>${hex(t3)}</b>`, 2, files[2]);
      lg(col == null ? `temp3 = ${hex(t3)} matches neither → col keeps its old value` : `→ <b>col = ${col}</b> (P2.${10 + col})`, col === 1 ? 4 : 3, files[2]);
      lg(clr ? 'IO2IntClr = (1<<10)|(1<<11) → both column flags cleared' : '<span class="p-red">no clear → the flag stays</span>', 5, files[2], () => { if (clr) { st.R[2] &= ~(3 << 10); st.clrW[2] = 3 << 10; } });
      let found = null; const k = lastKey;
      for (let r = 0; r < 2 && found == null; r++) {
        lg(`row = ${r}: drive only P1.${r} HIGH`, 7, cPins, () => { rows = 1 << r; scanRow = r; colLevelsQuiet(); });
        const hit = k != null && (k >> 1) === r; if (hit) found = r;
        lg(hit ? `a column reads 1 → the key is in <b>row ${r}</b>` : 'both columns read 0 → not this row', 8, cPins);
      }
      if (found != null) lg(`keycode = ${found}×2 + ${col ?? 0} = <b>${found * 2 + (col ?? 0)}</b> → LEDs P0.1 P0.0 = ${bin(found * 2 + (col ?? 0), 2)}; rows HIGH again`, [9, 10], cDet, () => { code2 = found * 2 + (col ?? 0); rows = 3; scanRow = null; colLevelsQuiet(); });
      else lg('key already released — nothing found; rows HIGH again', 10, cDet, () => { rows = 3; scanRow = null; colLevelsQuiet(); });
    } else {
      const has0 = !!(st.R[0] | st.F[0]), has2 = !!(st.R[2] | st.F[2]);
      lg(`IOIntStatus = ${hx((has0 ? 1 : 0) | (has2 ? 4 : 0), 2)} → ${[has0 && 'port 0', has2 && 'port 2'].filter(Boolean).join(' and ')} has news`, 2, cStat);
      if (has0) { const r = st.R[0], f = st.F[0]; lg(`r = ${hex(r)} (${pinsOf(0, r)} rising) · f = ${hex(f)} (${pinsOf(0, f)} falling)`, 3, files[0]); lg(clr ? `IO0IntClr = ${hex(r | f)} → cleared` : '<span class="p-red">no clear!</span>', 4, files[0], () => { if (clr) { st.R[0] &= ~(r | f); st.F[0] &= ~(r | f); st.clrW[0] = r | f; } }); }
      if (has2) { const r = st.R[2], f = st.F[2]; lg(`r = ${hex(r)} (${pinsOf(2, r)} rising) · f = ${hex(f)} (${pinsOf(2, f)} falling)`, 6, files[2]); lg(clr ? `IO2IntClr = ${hex(r | f)} → cleared` : '<span class="p-red">no clear!</span>', 7, files[2], () => { if (clr) { st.R[2] &= ~(r | f); st.F[2] &= ~(r | f); st.clrW[2] = r | f; } }); }
    }
    lg(pending() && !clr ? '<span class="p-red">return… but a status bit is still 1 → EINT3 rings again at once!</span>' : 'return → back to main (case closed ✓)', code.el.children.length - 1, cDet);
    return S;
  }
  // during the (slow-motion) ISR your finger is still on the key — the real ISR takes microseconds
  function colLevelsQuiet() { [0, 1].forEach(cIdx => { const k = lastKey; pins[cIdx].lvl = (k != null && (k & 1) === cIdx && (rows >> (k >> 1)) & 1) ? 1 : 0; }); }
  function kick() { if (!job && nvic && pending()) { job = { S: plan(), i: -1, t: 9 }; runs++; caseLog.innerHTML = ''; } }
  const lp = Loop(w, dt => {
    if (!job) return; job.t += dt * speed;
    if (job.t < .85) return; job.t = 0; job.i++;
    if (job.i >= job.S.length) { job = null; $$('.m4-card', cork).forEach(c => c.classList.remove('look')); if (scen === 'G2') { pins.forEach(p => p.lvl = 0); colLevels(); } kick(); paint(); return; }
    const s = job.S[job.i]; s.f && s.f(); code.hi(s.l); $$('.m4-card', cork).forEach(c => c.classList.toggle('look', c === s.card));
    caseLog.insertAdjacentHTML('beforeend', `<li>${s.t}</li>`); while (caseLog.children.length > 6) caseLog.firstChild.remove();
    if (runs > 3 && !clr) say.innerHTML = `<span class="p-red">The detective has been called ${runs}× for the same edge — the status bit is never cleared, so EINT3 keeps ringing. Main never gets the CPU back.</span>`;
    paint();
  });
  function rewire() {
    WR.clear(); strs = [];
    pins.forEach(pn => { if (GPIO_OK(pn.p, pn.n)) pn.wire = WR.add(pn.el, files[pn.p], { draw: stringDraw }); else pn.wire = null; });
    strs = pins.map(p => p.wire).filter(Boolean);
    const sw = [WR.add(files[0], cStat, { draw: stringDraw }), WR.add(files[2], cStat, { draw: stringDraw }), WR.add(cStat, cBell, { draw: stringDraw }), WR.add(cBell, cDet, { draw: stringDraw })];
    files[0]._w = sw[0]; files[2]._w = sw[1]; cStat._w = sw[2]; cBell._w = sw[3]; strs.push(...sw); WR.layout();
  }
  function fileHTML(p) {
    const rowsH = [['EnR', st.enR[p], 'enable rising'], ['EnF', st.enF[p], 'enable falling'], ['StatR', st.R[p], 'rising seen'], ['StatF', st.F[p], 'falling seen']].map(([k, v, d]) => `<div class="m4-reg${k.startsWith('Stat') && v ? ' set' : ''}"><i>IO${p}Int${k}</i><b>${hex(v)}</b><small>${v ? pinsOf(p, v) : d}</small></div>`).join('');
    return `<div class="mn-h">📁 port ${p} file</div>${rowsH}<div class="m4-reg clr"><i>IO${p}IntClr</i><b>${st.clrW[p] == null ? '—' : hex(st.clrW[p])}</b><small>write-only: 1 = clear</small></div>`;
  }
  function paint() {
    files[0].innerHTML = fileHTML(0); files[2].innerHTML = fileHTML(2);
    const p0 = !!(st.R[0] | st.F[0]), p2 = !!(st.R[2] | st.F[2]);
    cStat.innerHTML = `<div class="mn-h">IOIntStatus</div><div class="m4-bits"><span class="${p0 ? 'one' : ''}"><small>bit 0</small><b>${+p0}</b><small>P0Int</small></span><span class="dim"><small>bit 1</small><b>–</b><small>&nbsp;</small></span><span class="${p2 ? 'one' : ''}"><small>bit 2</small><b>${+p2}</b><small>P2Int</small></span></div><div class="small">= ${hx((p0 ? 1 : 0) | (p2 ? 4 : 0), 2)}</div>`;
    const ring = (p0 || p2) && nvic; cBell.querySelector('svg').classList.toggle('ringing', !!(p0 || p2));
    cBell.querySelector('.bs').innerHTML = (p0 || p2) ? (nvic ? 'ringing → ISR' : '<span class="p-red">ringing, but NVIC off → waits</span>') : 'quiet';
    pins.forEach(pn => {
      const ok = GPIO_OK(pn.p, pn.n), b = 1 << pn.n; pn.el.querySelector('.lv').innerHTML = `<span class="lampd ${pn.lvl ? 'on' : ''}"></span> ${pn.lvl}`;
      if (pn.tR) { pn.tR.classList.toggle('on', ok && !!(st.enR[pn.p] & b)); pn.tF.classList.toggle('on', ok && !!(st.enF[pn.p] & b)); pn.tR.disabled = pn.tF.disabled = !ok; }
      if (pn.warn) pn.warn.textContent = ok ? '' : (pn.p === 1 ? 'port 1: no GPIO interrupts' : 'no interrupt on this pin');
      pn.el.classList.toggle('bad', !ok);
      if (pn.wire) pn.wire.g.classList.toggle('taut', !!((st.R[pn.p] | st.F[pn.p]) & b));
    });
    if (files[0]._w) { files[0]._w.g.classList.toggle('taut', p0); files[2]._w.g.classList.toggle('taut', p2); cStat._w.g.classList.toggle('taut', p0 || p2); cBell._w.g.classList.toggle('taut', !!job); }
    if (cPins._kp) { cPins._kp.row(scanRow); }
    out.innerHTML = scen === 'G1' ? `<span class="led ${led ? 'on' : ''}"></span><span class="pinlbl">P1.23 LED</span>` : scen === 'G2' ? `<span class="led y ${code2 & 2 ? 'on' : ''}"></span><span class="led y ${code2 & 1 ? 'on' : ''}"></span><span class="pinlbl">P0.1 P0.0 = keycode ${code2}</span><span class="pinlbl">rows P1.1 P1.0 = ${bin(rows, 2)}</span>` : `<span class="pinlbl">ISR runs: ${runs}</span>`;
    if (!job) code.hi([]);
  }
  load(); lp.start();
});

/* ===================================================================
   M5 · chapter 5 in one widget — the ADC factory (a voltage on a conveyor)
   =================================================================== */
const ADC_PINS = [['P0.23', '01', 1, 14], ['P0.24', '01', 1, 16], ['P0.25', '01', 1, 18], ['P0.26', '01', 1, 20], ['P1.30', '11', 3, 28], ['P1.31', '11', 3, 30], ['P0.3', '10', 0, 6], ['P0.2', '10', 0, 4]]; // pin, fn, PINSELx, low bit
const beltDraw = d => `<path class="belt-o" d="${d}"/><path class="belt" d="${d}" data-track="1"/>`;
BUILD.push(function wM5() {
  const w = MW('w-m5', 'the ADC factory', 'set voltages · choose channels · START (or burst) · follow the parcel to the LCD');
  const V = [0.4, 1.2, 2.0, 0.9, 1.1, 2.5, 3.0, 1.6], use = [0, 0, 0, 0, 1, 1, 0, 0];
  let burst = false, inten = false, pdn = true, pconp = true, clkdiv = 0, repeat = true, slow = 2;
  const R = Array.from({ length: 8 }, () => ({ res: 0, done: 0, ovr: 0 })); let gdr = { res: 0, ch: 0, done: 0, ovr: 0 }, temps = {}, adint = 0;
  let adc = null, cpu = null, lastCh = -1, swCh = -1, waiting = false, msg = '';
  // controls
  const cr = el('div', { class: 'm5-ctl' }); w.appendChild(cr);
  const c1 = el('div', { class: 'col' }); cr.appendChild(c1); c1.appendChild(el('span', { class: 'gae small' }, 'ADCR bit 16 · BURST'));
  chipGroup(c1, [[0, 'software (START = 001)'], [1, 'burst (START = 000)']], 0, v => { burst = +v === 1; adc = null; cpu = null; waiting = false; R.forEach(r => set(r, { done: 0, ovr: 0 })); refresh(); if (burst) kickBurst(); });
  const c2 = el('div', { class: 'row', style: 'gap:6px' }); cr.appendChild(c2);
  const tInt = Tog(c2, 'interrupt on DONE: <code>ADINTEN</code> + NVIC', false, v => { inten = v; refresh(); });
  const tPd = Tog(c2, '<code>ADCR</code> PDN (bit 21) = 1', true, v => { pdn = v; if (!v) { adc = null; } refresh(); if (v && burst) kickBurst(); });
  const tPc = Tog(c2, '<code>PCONP |= 1&lt;&lt;12</code> (ADC power)', true, v => { pconp = v; if (!v) adc = null; refresh(); if (v && burst) kickBurst(); });
  const c3 = el('div', { class: 'row', style: 'gap:10px' }); cr.appendChild(c3);
  ruler(c3, 'CLKDIV', 0, 15, 0, 1, v => `${v} → ADC clock ${(3 / (v + 1)).toFixed(2)} MHz`, v => { clkdiv = v; refresh(); });
  ruler(c3, 'slow motion', 1, 4, slow, 1, v => '×' + v, v => slow = v);
  const sb = el('div', { class: 'row', style: 'gap:8px' }); cr.appendChild(sb);
  const bStart = el('button', { class: 'btn p', type: 'button' }, '▶ START = 001'); sb.appendChild(bStart);
  const tRep = Tog(sb, 'keep looping (<code>while(1)</code>)', true, v => { repeat = v; });
  bStart.onclick = () => { if (burst) return; startSoftware(true); };
  // stations
  const fac = el('div', { class: 'm5-fac' }); w.appendChild(fac);
  const shelf = el('div', { class: 'mn m5-shelf' }); fac.appendChild(shelf);
  shelf.innerHTML = '<div class="mn-h">8 analog inputs AD0.0–AD0.7 · tap a name = SEL bit</div>';
  const tiles = el('div', { class: 'm5-tiles' }); shelf.appendChild(tiles);
  const T = V.map((v, i) => { const t = el('div', { class: 'm5-tile' }); tiles.appendChild(t);
    const b = el('button', { class: 'm5-selb', type: 'button' }, `AD0.${i}`); b.onclick = () => { use[i] ^= 1; R[i].done = 0; R[i].ovr = 0; refresh(); if (burst && !adc) kickBurst(); }; t.appendChild(b);
    t.appendChild(el('small', {}, `${ADC_PINS[i][0]} · fn ${ADC_PINS[i][1]}`));
    const r = el('input', { type: 'range', class: 'm5-r', min: 0, max: 3300, value: v * 1000, 'aria-label': `voltage on AD0.${i}` }); t.appendChild(r);
    const vb = el('b', {}, v.toFixed(2) + ' V'); t.appendChild(vb); r.oninput = () => { V[i] = +r.value / 1000; vb.textContent = V[i].toFixed(2) + ' V'; refreshMath(); };
    return { t, b }; });
  const st = (cls, h) => { const n = el('div', { class: 'mn sk m5-st ' + cls }); n.innerHTML = `<div class="mn-h">${h}</div>`; fac.appendChild(n); return n; };
  const sMux = st('m5-mux', '<span class="step">1</span>MUX'), sSar = st('m5-sar', '<span class="step">2</span>SAR · 12 steps'), sReg = st('m5-reg', '<span class="step">3</span>data registers');
  const sCpu = st('m5-cpu', '<span class="step">4</span>CPU'), sMath = st('m5-math', '<span class="step">5</span>number → volts → text'), sLcd = st('m5-lcd', '<span class="step">6</span>LCD');
  const muxB = el('div', { class: 'small' }); sMux.appendChild(muxB);
  const sarBits = el('div', { class: 'm5-bits' }); sSar.appendChild(sarBits); const sarTxt = el('div', { class: 'small' }); sSar.appendChild(sarTxt);
  const regB = el('div'); sReg.appendChild(regB);
  const cpuB = el('div'); sCpu.appendChild(cpuB);
  const mathB = el('div', { class: 'small m5-mth' }); sMath.appendChild(mathB);
  const lcdV = LCDView(sLcd, lcdWith('', ''), { blue: true });
  const WR = Wires(fac);
  const wIn = WR.add(shelf, sMux, { draw: beltDraw, fa: .17 }), wMs = WR.add(sMux, sSar, { draw: beltDraw }), wSr = WR.add(sSar, sReg, { draw: beltDraw }), wRc = WR.add(sReg, sCpu, { draw: beltDraw }), wCm = WR.add(sCpu, sMath, { draw: beltDraw }), wMl = WR.add(sMath, sLcd, { draw: beltDraw });
  const mkParcel = cls => { const g = sv('g', { class: 'parcel ' + cls, style: 'display:none' }, WR.front); sv('rect', { x: -38, y: -13, width: 76, height: 26, rx: 5 }, g); sv('text', { x: 0, y: 5, 'text-anchor': 'middle' }, g); return g; };
  const pA = mkParcel('pa'), pC = mkParcel('pc');
  const log = el('div', { class: 'say m5-log' }); w.appendChild(log);
  const adcrRow = el('div', { class: 'm5-adcr' }); w.appendChild(adcrRow);
  const codeH = el('div', { class: 'mt' }); w.appendChild(codeH); const code = MCode(codeH);

  const code12 = v => Math.min(4095, Math.floor(v / 3.3 * 4096));
  const chans = () => use.map((u, i) => u ? i : -1).filter(i => i >= 0);
  const say = h => { msg = h; log.innerHTML = h; };
  const powered = () => pdn && pconp;
  const convTime = () => 65 / (3e6 / (clkdiv + 1));
  function startSoftware(user) {
    const cs = chans(); if (!cs.length) { say('No channel selected — tap an AD0.n name on the shelf.'); return; }
    if (!powered()) { say(`<span class="p-red">Nothing happens: the ADC is ${!pconp ? 'not powered (PCONP bit 12 = 0 after reset!)' : 'in power-down (PDN = 0)'}. DONE never comes → the CPU waits forever.</span>`); waiting = !inten; refresh(); return; }
    if (adc || cpu) { if (user) say('Busy — wait for this conversion to finish.'); return; }
    swCh = cs[(cs.indexOf(swCh) + 1) % cs.length] ?? cs[0]; if (!cs.includes(swCh)) swCh = cs[0];
    newConv(swCh); waiting = !inten;
    say(`CPU writes <b>ADCR = ${hex(adcrVal(swCh, 1))}</b>: SEL = AD0.${swCh} only, PDN = 1, START = 001 → convert now.${inten ? ' Then the CPU is free — DONE will interrupt it.' : ' Then it <b>polls</b>: <code>while(!(ADDR' + swCh + ' &amp; 1&lt;&lt;31));</code>'}`);
  }
  function kickBurst() { if (!burst || adc || !powered()) return; const cs = chans(); if (!cs.length) return; const nx = cs.find(c => c > lastCh) ?? cs[0]; newConv(nx); }
  function newConv(ch) { adc = { ch, v: V[ch], code: code12(V[ch]), ph: 'in', t: 0, k: -1 }; lastCh = ch; }
  const adcrVal = (ch, start) => ((burst ? use.reduce((a, u, i) => a | (u << i), 0) : (1 << ch)) | clkdiv << 8 | (burst ? 1 << 16 : 0) | (pdn ? 1 << 21 : 0) | (start ? 1 << 24 : 0)) >>> 0;
  // timings (seconds of animation, × slow)
  const D = { in: .45, mux: .25, ms: .35, sar: .11, sr: .35 };
  const lp = Loop(w, dt => {
    const k = slow / 2, cf = burst ? .45 : 1;
    if (adc) { adc.t += dt; const a = adc;
      if (a.ph === 'in' && a.t > D.in * k) { a.ph = 'mux'; a.t = 0; }
      else if (a.ph === 'mux' && a.t > D.mux * k) { a.ph = 'ms'; a.t = 0; }
      else if (a.ph === 'ms' && a.t > D.ms * k) { a.ph = 'sar'; a.t = 0; a.k = 0; }
      else if (a.ph === 'sar' && a.t > D.sar * k) { a.t = 0; a.k++; if (a.k >= 12) { a.ph = 'sr'; } }
      else if (a.ph === 'sr' && a.t > D.sr * k) { finish(a); }
    }
    if (cpu) { cpu.t += dt; const c = cpu, d = (burst ? .3 : .45) * k * cf;
      if (c.ph === 'rc' && c.t > d) { c.ph = 'read'; c.t = 0; readReg(c); }
      else if (c.ph === 'read' && c.t > d * 1.6) { c.ph = 'cm'; c.t = 0; }
      else if (c.ph === 'cm' && c.t > d) { c.ph = 'math'; c.t = 0; }
      else if (c.ph === 'math' && c.t > d * 1.6) { c.ph = 'ml'; c.t = 0; }
      else if (c.ph === 'ml' && c.t > d) { lcdShow(); cpu = null; if (!burst && repeat) setTimeout(() => startSoftware(false), 250 * k); else if (burst) serveNext(); }
    }
    paint();
  });
  function finish(a) {
    const r = R[a.ch]; if (r.done) r.ovr = 1; r.res = a.code; r.done = 1; gdr = { res: a.code, ch: a.ch, done: 1, ovr: r.ovr }; adc = null; adint = inten ? 1 : 0;
    if (burst) { if (!inten) say(`AD0.${a.ch} done → result in <b>ADDR${a.ch}</b> (DONE = 1). Nobody reads it in burst mode without the interrupt… ${r.ovr ? `<span class="p-red">→ the next result overwrote it: <b>OVERRUN${a.ch} = 1</b></span>` : 'the next one will overwrite it!'}`); kickBurst(); }
    else say(`12 steps done → <b>ADDR${a.ch}</b> = ${hex(regVal(a.ch))}: DONE = 1, RESULT (bits 15:4) = ${hx(a.code, 3)}. ${inten ? 'ADINTEN bit ' + a.ch + ' → ADINT = 1 → <b>ADC interrupt</b>.' : 'The polling loop sees DONE = 1 and exits.'}`);
    if (!burst || inten) { if (!cpu) serve(a.ch); }
  }
  function serve(ch) { cpu = { ch, ph: 'rc', t: 0 }; }
  function serveNext() { const p = chans().find(c => R[c].done); if (p != null && inten) serve(p); }
  function readReg(c) { const r = R[c.ch]; temps[c.ch] = r.res; c.code = r.res; c.ovr = r.ovr; r.done = 0; r.ovr = 0; if (gdr.ch === c.ch) gdr.done = 0; adint = chans().some(x => R[x].done) && inten ? 1 : 0; waiting = false;
    say(`${inten ? '<code>ADC_IRQHandler</code>' : 'CPU'} reads ADDR${c.ch} → <b>(x &gt;&gt; 4) &amp; 0xFFF = ${c.code}</b>. Reading clears DONE${c.ovr ? ' and OVERRUN' : ''}.`); }
  const regVal = ch => ((R[ch].done ? 1 << 31 : 0) | (R[ch].ovr ? 1 << 30 : 0) | (R[ch].res << 4)) >>> 0; // ADDRn has no CHN bits
  const gdrVal = () => ((gdr.done ? 1 << 31 : 0) | (gdr.ovr ? 1 << 30 : 0) | (gdr.ch << 24) | (gdr.res << 4)) >>> 0;
  function lcdShow() {
    const cs = chans().filter(c => temps[c] != null); const L = new HD44780().ready();
    if (cs.length <= 1 && cs.length) { const c = cs[0], x = temps[c]; L.print('ANALOG IP:' + (x * 3.3 / 4096).toFixed(2) + 'V'); L.cmd(0xC0); L.print('ADC OUTPUT:' + x.toString(16)); }
    else cs.slice(0, 2).forEach((c, i) => { if (i) L.cmd(0xC0); const x = temps[c]; L.print(`AD0.${c} ${(x * 3.3 / 4096).toFixed(2)}V ${x.toString(16)}`); });
    lcdV.lcd = L; lcdV.draw();
  }
  function refreshMath() { paintMath(); }
  function paintMath() {
    const c = cpu && cpu.code != null ? cpu.ch : [...chans()].reverse().find(x => temps[x] != null); if (c == null) { mathB.innerHTML = '<span class="p-faint">waiting for a result…</span>'; return; }
    const x = cpu && cpu.code != null ? cpu.code : temps[c], v = x * 3.3 / 4096;
    mathB.innerHTML = `x = (ADDR${c} &gt;&gt; 4) &amp; 0xFFF = <b>${x}</b><br>V = x × 3.3 / 4096 = <b>${v.toFixed(3)} V</b><br>sprintf → "<b>${v.toFixed(2)}V</b>", "<b>${x.toString(16)}</b>"<br><span class="p-faint">resolution 3.3/4096 = 0.806 mV · input now ${V[c].toFixed(3)} V</span>`;
  }
  function refresh() { tInt.set(inten); tPd.set(pdn); tPc.set(pconp); bStart.disabled = burst; tRep.el.style.display = burst ? 'none' : ''; genCode(); paint(); }
  function genCode() {
    const cs = chans(); const pins = {}; cs.forEach(c => { const [, fn, px, lo] = ADC_PINS[c]; pins[px] = (pins[px] || []).concat(`(${parseInt(fn, 2)}<<${lo})`); });
    const L = [pconp ? 'LPC_SC->PCONP |= (1<<12);                 // power the ADC' : '/* PCONP bit 12 not set: ADC unpowered! */'];
    Object.entries(pins).forEach(([px, a]) => L.push(`LPC_PINCON->PINSEL${px} |= ${a.join(' | ')};   // ${cs.filter(c => ADC_PINS[c][2] === +px).map(c => ADC_PINS[c][0] + '→AD0.' + c).join(', ')}`));
    if (burst) { L.push(`LPC_ADC->ADCR = ${hex(adcrVal(0, 0))};        // SEL = ${cs.map(c => c).join(',') || '-'}, BURST, PDN${clkdiv ? ', CLKDIV ' + clkdiv : ''}`); L.push(`LPC_ADC->ADINTEN = ${inten ? hx(use.reduce((a, u, i) => a | (u << i), 0)) : '0'};`); if (inten) L.push('NVIC_EnableIRQ(ADC_IRQn);   // ISR: ch = (ADGDR>>24)&7; temp = (ADDRch>>4)&0xFFF;'); L.push('while(1);');
    } else { L.push(`LPC_ADC->ADINTEN = ${inten ? hx(use.reduce((a, u, i) => a | (u << i), 0)) : '0'};${inten ? '  NVIC_EnableIRQ(ADC_IRQn);' : ''}`); L.push('while(1) {'); cs.forEach(c => { L.push(`    LPC_ADC->ADCR = ${hex(adcrVal(c, 1))};   // AD0.${c}, PDN, START now`); L.push(inten ? `    /* ADC_IRQHandler reads ADDR${c} */` : `    while(((x = LPC_ADC->ADDR${c}) & (1<<31)) == 0);   // poll DONE`); L.push(`    x = (x >> 4) & 0xFFF;  → volts → sprintf → LCD`); }); L.push('}'); }
    code.set(L);
  }
  function paint() {
    T.forEach(({ t, b }, i) => { t.classList.toggle('sel', !!use[i]); t.classList.toggle('now', !!adc && adc.ch === i); b.setAttribute('aria-pressed', !!use[i]); });
    sMux.classList.toggle('off', !powered()); sSar.classList.toggle('off', !powered());
    muxB.innerHTML = `8 inputs → 1 converter<br>now: <b>${adc ? 'AD0.' + adc.ch : '—'}</b>${adc ? ` · ${adc.v.toFixed(3)} V` : ''}`;
    // SAR
    const a = adc && (adc.ph === 'sar' || adc.ph === 'sr') ? adc : null; let html = '';
    for (let b = 11; b >= 0; b--) { const i = 11 - b; let cls = '', txt = '?'; if (a) { if (i < a.k || a.ph === 'sr') { const bit = (a.code >> b) & 1; cls = bit ? 'one' : 'zero'; txt = bit; } else if (i === a.k) cls = 'next'; } html += `<span class="${cls}">${txt}</span>`; }
    sarBits.innerHTML = html;
    if (a && a.ph === 'sar') { const b = 11 - a.k, base = (a.code >> (b + 1)) << (b + 1), guess = (base + (1 << b)) * 3.3 / 4096; sarTxt.innerHTML = `bit ${b}: DAC guess ${guess.toFixed(3)} V → V<sub>in</sub> ${a.v >= guess ? '≥' : '&lt;'} guess → <b>${a.v >= guess ? 1 : 0}</b>`; }
    else sarTxt.innerHTML = a ? `result = ${bin(a.code, 12)} = <b>${hx(a.code, 3)}</b>` : `one conversion = 65 ADC clocks = <b>${(convTime() * 1e6).toFixed(1)} µs</b>`;
    // registers
    const ch = adc && adc.ph !== 'in' ? adc.ch : (cpu ? cpu.ch : gdr.ch); const rv = regVal(ch);
    regB.innerHTML = `<div class="m5-rv"><span>ADDR${ch}</span><b>${hex(rv)}</b></div><div class="m5-flds"><span class="${R[ch].done ? 'on' : ''}">DONE<b>${R[ch].done}</b><small>bit 31</small></span><span class="${R[ch].ovr ? 'bad' : ''}">OVR<b>${R[ch].ovr}</b><small>bit 30</small></span><span>RESULT<b>${hx(R[ch].res, 3)}</b><small>bits 15:4</small></span></div><div class="m5-rv small"><span>ADGDR (latest)</span><b>${hex(gdrVal())}</b></div><div class="small p-faint">ADGDR also has CHN (bits 26:24) = ${gdr.ch}: which channel that was</div><div class="m5-adstat">ADSTAT: DONE ${use.map((u, i) => `<i class="${R[i].done ? 'on' : ''}${u ? '' : ' dim'}">${i}</i>`).join('')} · OVR ${use.map((u, i) => `<i class="${R[i].ovr ? 'bad' : ''}${u ? '' : ' dim'}">${i}</i>`).join('')} · ADINT <i class="${adint ? 'on' : ''}">${adint}</i></div>`;
    // cpu
    const busy = !!cpu, ph = cpu && cpu.ph;
    cpuB.innerHTML = inten ? `<div class="small">${busy ? `<b class="p-pink">ADC_IRQHandler ⚡</b> reading ADDR${cpu.ch}` : 'main free for other work · <span class="p-faint">ISR idle</span>'}</div><div class="small p-faint">ADINTEN → ADINT → NVIC → ADC_IRQHandler (ch. 1)</div>`
      : burst ? '<div class="small p-red">no ADINTEN → in burst mode nobody collects the results</div>'
      : `<div class="small">${waiting ? `<b>polling…</b> <code>while(!(ADDR${swCh} &amp; DONE))</code> <span class="m5-spin">⟳</span>` : busy ? `read ADDR${cpu.ch} (DONE = 1)` : 'idle'}</div><div class="small p-faint">software mode: the CPU waits for DONE</div>`;
    sCpu.classList.toggle('hot', busy);
    paintMath();
    // parcels
    const place = (g, wire, t, txt) => { const [x, y] = WR.at(wire, t); g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`); g.style.display = ''; g.querySelector('text').textContent = txt; };
    if (adc) { const k = slow / 2; if (adc.ph === 'in') place(pA, wIn, adc.t / (D.in * k), adc.v.toFixed(2) + ' V'); else if (adc.ph === 'mux') place(pA, wIn, 1, adc.v.toFixed(2) + ' V'); else if (adc.ph === 'ms') place(pA, wMs, adc.t / (D.ms * k), adc.v.toFixed(2) + ' V'); else if (adc.ph === 'sar') place(pA, wMs, 1, '…' + adc.k + '/12'); else place(pA, wSr, adc.t / (D.sr * k), hx(adc.code, 3)); } else pA.style.display = 'none';
    if (cpu) { const d = (burst ? .3 : .45) * slow / 2 * (burst ? .45 : 1); if (cpu.ph === 'rc') place(pC, wRc, cpu.t / d, 'ADDR' + cpu.ch); else if (cpu.ph === 'read') place(pC, wRc, 1, String(cpu.code)); else if (cpu.ph === 'cm') place(pC, wCm, cpu.t / d, String(cpu.code)); else if (cpu.ph === 'math') place(pC, wCm, 1, (cpu.code * 3.3 / 4096).toFixed(2) + 'V'); else place(pC, wMl, cpu.t / d, '"' + (cpu.code * 3.3 / 4096).toFixed(2) + 'V"'); } else pC.style.display = 'none';
    [wIn, wMs, wSr].forEach(x => x.g.classList.toggle('run', !!adc)); [wRc, wCm, wMl].forEach(x => x.g.classList.toggle('run', !!cpu));
    adcrRow.innerHTML = `<span class="gae">ADCR =</span> <b class="mono">${hex(adcrVal(adc ? adc.ch : (swCh >= 0 ? swCh : chans()[0] ?? 0), !burst && !!adc))}</b> <span class="small p-soft">SEL ${burst ? 'all used channels' : 'one channel'} · CLKDIV ${clkdiv} · BURST ${+burst} · PDN ${+pdn} · START ${!burst && adc ? '001' : '000'}</span> · <span class="small p-soft">${burst ? `burst: up to ${(3e6 / (clkdiv + 1) / 65 / 1000).toFixed(1)} k conversions/s shared by ${chans().length || 0} channel(s), lowest first` : 'software: one START → one conversion'}</span>`;
  }
  say('Two channels (AD0.4 on P1.30, AD0.5 on P1.31) are selected, like A1/A2. Press <b>▶ START</b>, or switch to <b>burst</b>.');
  refresh(); lcdShow(); lp.start();
});

/* ===================================================================
   M6 · chapter 6 in one widget — the DAC music box (draw a wave, play it)
   =================================================================== */
BUILD.push(function wM6() {
  const w = MW('w-m6', 'the DAC music box', 'draw a wave with your finger · it becomes a table · the DAC plays it');
  let N = 12, wave = [], preset = 'sine', cnt = 80, bias = 0, dbl = true, loop = true, i = 0, ph = 0, play = true, spd = 2;
  const PRE = { sine: k => Math.round(1024 * (1.25 + 1.25 * Math.sin(2 * Math.PI * k / N)) / 3.3), saw: k => Math.round(k * 1023 / (N - 1)), tri: k => Math.round(1023 * (1 - Math.abs(2 * k / N - 1))), square: k => k < N / 2 ? 1023 : 0 };
  const top = el('div', { class: 'row mb' }); w.appendChild(top);
  const pg = chipGroup(top, [['sine', 'D2 · sine 1.25 ± 1.25 V'], ['saw', 'D1 · sawtooth 0–3.3 V'], ['tri', 'triangle'], ['square', 'square'], ['custom', '✎ my own']], preset, v => { preset = v; if (v !== 'custom') fill(); refresh(); });
  const nc = el('div', { class: 'col' }); top.appendChild(nc); nc.appendChild(el('span', { class: 'gae small' }, 'samples per period N'));
  chipGroup(nc, [[8, '8'], [12, '12'], [16, '16'], [32, '32']], N, v => { const old = wave.slice(); N = +v; if (preset === 'custom') wave = Array.from({ length: N }, (_, k) => old[Math.floor(k * old.length / N)]); else fill(); i = 0; refresh(); });
  const roll = el('div', { class: 'm6-roll' }); w.appendChild(roll);
  const rsv = sv('svg', { class: 'dg m6-rsv', 'aria-label': 'draw the wave: drag up and down' }); roll.appendChild(rsv);
  const eng = el('div', { class: 'm6-eng' }); w.appendChild(eng);
  const box = (cls, h) => { const b = el('div', { class: 'mn sk m6-box ' + cls }); b.innerHTML = `<div class="mn-h">${h}</div>`; eng.appendChild(b); return b; };
  const bTab = box('tab', '<span class="step">1</span>table → DACR'), bBuf = box('buf', '<span class="step">2</span>double buffer'), bLad = box('lad', '<span class="step">3</span>resistor string'), bOut = box('out', '<span class="step">4</span>AOUT = P0.26');
  const tabB = el('div'); bTab.appendChild(tabB);
  const bufB = el('div'); bBuf.appendChild(bufB);
  const ladS = sv('svg', { class: 'dg', viewBox: '0 0 150 150', style: 'max-width:170px;margin:auto' }); bLad.appendChild(ladS); const ladT = el('div', { class: 'small center' }); bLad.appendChild(ladT);
  const outB = el('div'); bOut.appendChild(outB);
  const WR = Wires(eng); [[bTab, bBuf], [bBuf, bLad], [bLad, bOut]].forEach(([a, b]) => WR.add(a, b, { draw: d => `<path class="wline2" d="${d}" data-track="1"/>` }));
  const knobs = el('div', { class: 'm6-knobs' }); w.appendChild(knobs);
  const lg = v => Math.max(1, Math.round(Math.pow(3000, v / 1000))), ilg = c => Math.round(Math.log(c) / Math.log(3000) * 1000);
  const kc = el('div', { class: 'col' }); knobs.appendChild(kc);
  const cr = ruler(kc, 'DACCNTVAL (PCLK ticks per sample)', 0, 1000, ilg(cnt), 1, v => `${lg(v)} → ${fmtUs(lg(v) / 3)} per sample`, v => { cnt = lg(v); refresh(); });
  const cp = el('div', { class: 'chips' }); kc.appendChild(cp); [[80, '0x50 = 80 (D1 slide)'], [2500, '2500 → 10 ms period (D2, N = 12)']].forEach(([v, t]) => { const b = el('button', { class: 'chip', type: 'button' }, t); b.onclick = () => { cr.value = ilg(v); cr.dispatchEvent(new Event('input')); cnt = v; refresh(); }; cp.appendChild(b); });
  const kb = el('div', { class: 'col' }); knobs.appendChild(kb); kb.appendChild(el('span', { class: 'gae small' }, 'DACR bit 16 · BIAS'));
  chipGroup(kb, [[0, '0 · settles in 1 µs (≤ 1 MHz)'], [1, '1 · 2.5 µs, low power (≤ 400 kHz)']], 0, v => { bias = +v; refresh(); });
  const kd = el('div', { class: 'row', style: 'gap:8px' }); knobs.appendChild(kd);
  Tog(kd, 'DACCTRL: <code>DBLBUF_ENA</code> + <code>CNT_ENA</code>', true, v => { dbl = v; refresh(); });
  Tog(kd, 'loop AOUT back into the ADC (AD0.5)', true, v => { loop = v; refresh(); });
  const scope = el('div', { class: 'scope m6-scope' }); w.appendChild(scope); const ssv = sv('svg', {}); scope.appendChild(ssv);
  const meas = el('div', { class: 'm6-meas' }); w.appendChild(meas);
  const pl = el('div', { class: 'row mt' }); w.appendChild(pl);
  const bP = el('button', { class: 'btn sm y', type: 'button' }, '❚❚ pause'); pl.appendChild(bP); bP.onclick = () => { play = !play; bP.textContent = play ? '❚❚ pause' : '▶ play'; };
  ruler(pl, 'music-box speed (slow motion)', 1, 8, spd, 1, v => v + ' samples/s', v => spd = v);
  const codeH = el('div', { class: 'mt' }); w.appendChild(codeH); const code = MCode(codeH);
  function fmtUs(us) { return us >= 1000 ? (us / 1000).toFixed(2) + ' ms' : us.toFixed(us < 10 ? 2 : 1) + ' µs'; }
  function fill() { wave = Array.from({ length: N }, (_, k) => clamp(PRE[preset](k), 0, 1023)); }
  const Vof = d => d * 3.3 / 1024;
  // drawing on the roll
  let drawing = false;
  const rollXY = e => { const r = rsv.getBoundingClientRect(), Wd = r.width, H = r.height; const L = 46, Rr = Wd - 8, T = 14, B = H - 22; const k = clamp(Math.floor((e.clientX - r.left - L) / ((Rr - L) / N)), 0, N - 1); const v = clamp(Math.round((B - (e.clientY - r.top)) / (B - T) * 1023), 0, 1023); return [k, v]; };
  rsv.addEventListener('pointerdown', e => { drawing = true; rsv.setPointerCapture(e.pointerId); drawAt(e); });
  rsv.addEventListener('pointermove', e => { if (drawing) drawAt(e); });
  ['pointerup', 'pointercancel'].forEach(k => rsv.addEventListener(k, () => drawing = false));
  function drawAt(e) { const [k, v] = rollXY(e); wave[k] = v; if (preset !== 'custom') { preset = 'custom'; pg.set('custom'); } refresh(); }
  function drawRoll() {
    const Wd = Math.max(280, roll.clientWidth), H = Wd < 520 ? 190 : 230, L = 46, Rr = Wd - 8, T = 14, B = H - 22, cw = (Rr - L) / N;
    rsv.setAttribute('viewBox', `0 0 ${Wd} ${H}`); rsv.setAttribute('height', H);
    const Y = v => B - v / 1023 * (B - T); let s = `<rect x="${L}" y="${T - 6}" width="${Rr - L}" height="${B - T + 12}" rx="6" class="m6-paper"/>`;
    [0, 1.65, 3.3].forEach(v => { const y = Y(v / 3.3 * 1023); s += `<path d="M${L} ${y} H${Rr}" style="stroke:var(--faint);stroke-dasharray:3 4"/><text x="${L - 4}" y="${y + 4}" text-anchor="end" class="mono" style="font-size:11px">${v}V</text>`; });
    for (let k = 0; k < N; k++) { const x = L + k * cw; s += `<rect x="${x + 1}" y="${T - 6}" width="${cw - 2}" height="${B - T + 12}" rx="3" class="m6-col${k === i ? ' now' : ''}"/>`; }
    let d = ''; wave.forEach((v, k) => { const x = L + k * cw; d += (k ? `V${Y(v).toFixed(1)}` : `M${x} ${Y(v).toFixed(1)}`) + `H${(x + cw).toFixed(1)}`; }); s += `<path d="${d}" style="fill:none;stroke:var(--orange);stroke-width:2.6"/>`;
    wave.forEach((v, k) => { const x = L + k * cw + cw / 2; s += `<circle cx="${x}" cy="${Y(v)}" r="${Math.min(8, cw / 3)}" class="m6-hole${k === i ? ' now' : ''}"/>`; if (cw > 30) s += `<text x="${x}" y="${H - 6}" text-anchor="middle" class="mono" style="font-size:10.5px;fill:var(--ink3)">${v}</text>`; });
    s += `<text x="${Rr - 4}" y="${T + 6}" text-anchor="end" class="lbl" style="font-size:13px;fill:var(--ink3)">drag to draw ✎</text>`;
    rsv.innerHTML = s;
  }
  function settleOf() { return bias ? 2.5e-6 : 1e-6; }
  function drawScope() {
    const Wd = Math.max(260, scope.clientWidth - 16), H = 170; ssv.setAttribute('viewBox', `0 0 ${Wd} ${H}`);
    const Ts = cnt / 3e6, P = N * Ts, span = 2.5 * P, tau = settleOf() / 3, Y = v => H - 12 - v / 3.3 * (H - 26);
    let s = ''; for (let k = 1; k < 10; k++) s += `<path class="sg" d="M${Wd * k / 10} 0V${H}"/>`; for (let k = 1; k < 5; k++) s += `<path class="sg" d="M0 ${H * k / 5}H${Wd}"/>`;
    const R = rng(7); let t = 0, y = Vof(wave[N - 1]), d = `M0 ${Y(y).toFixed(1)}`, k = 0; const X = tt => tt / span * Wd;
    while (t < span && k < 4000) { const tgt = Vof(wave[k % N]); const dt = dbl ? Ts : Ts * (0.45 + 1.1 * R()); const steps = 14; for (let j = 1; j <= steps; j++) { const tt = t + dt * j / steps; const yy = tgt + (y - tgt) * Math.exp(-(dt * j / steps) / tau); d += `L${X(Math.min(tt, span)).toFixed(1)} ${Y(yy).toFixed(1)}`; } y = tgt + (y - tgt) * Math.exp(-dt / tau); t += dt; k++; }
    s += `<path d="${d}" class="trace"/>`;
    // ideal staircase (faint) + ADC sample dots
    if (loop) { let tt = 0; for (let q = 0; tt < span && q < 120; q++) { const dt = Ts; s += `<circle cx="${X(tt + dt * .9)}" cy="${Y(Vof(wave[q % N]))}" r="2.6" style="fill:#ffd23f"/>`; tt += dt; } }
    s += `<text x="${Wd - 6}" y="14" text-anchor="end" style="fill:#7dffb8;font:700 11px Courier Prime">${fmtUs(span * 1e6 / 10)} / div · 0.66 V / div</text>`;
    ssv.innerHTML = s;
  }
  function paintEng() {
    const v = wave[i], dacr = (v << 6 | bias << 16) >>> 0, V = Vof(v);
    tabB.innerHTML = `<div class="small">wave[<b>${i}</b>] = <b>${v}</b></div><div class="m6-dacr">${[...bin(dacr, 17)].map((b, k) => { const bit = 16 - k; return `<i class="${bit === 16 ? 'bi' : bit >= 6 ? 'va' : 'rs'}${b === '1' ? ' one' : ''}">${b}</i>`; }).join('')}</div><div class="small">DACR = (${v} &lt;&lt; 6)${bias ? ' | 1&lt;&lt;16' : ''} = <b>${hx(dacr, 5)}</b><br><span class="p-faint">bit 16 BIAS · 15:6 VALUE · 5:0 reserved</span></div>`;
    const c = Math.max(0, Math.ceil(cnt * (1 - ph)));
    bufB.innerHTML = dbl ? `<div class="m6-bf"><span>CPU wrote</span><b>${wave[(i + 1) % N]}</b><em>→ pre-buffer</em></div><div class="m6-cnt"><span>counter</span><b>${c}</b><i style="width:${(1 - ph) * 100}%"></i></div><div class="small">counts DACCNTVAL → 0, then pre-buffer → DACR and reload. Output changes on a <b>steady beat</b>.</div>` : `<div class="small p-red">no double buffer: DACR changes the moment the CPU writes it → uneven steps (look at the scope).</div>`;
    const n = 16, tap = v / 1024 * n; let s = ''; for (let k = 0; k < n; k++) { const y = 12 + k * 7.6; s += `<path d="M40 ${y} l5 1.9 l-10 1.9 l10 1.9 l-5 1.9" class="ink" style="stroke-width:1.3"/>`; }
    const ty = 12 + (n - tap) * 7.6; s += `<path d="M40 ${ty.toFixed(1)} H96" style="stroke:var(--orange);stroke-width:2.4"/><circle cx="40" cy="${ty.toFixed(1)}" r="3.6" style="fill:var(--orange)"/><path d="M96 ${ty - 12} L96 ${ty + 12} L120 ${ty} Z" class="ink" style="fill:var(--card)"/><text x="8" y="10" class="mono" style="font-size:10px">VREFP</text><text x="8" y="146" class="mono" style="font-size:10px">VREFN</text>`;
    ladS.innerHTML = s; ladT.innerHTML = `tap ${v} of 1024 · buffer amp`;
    outB.innerHTML = `<div class="m6-v">${V.toFixed(3)}<small> V</small></div><div class="small">V = ${v} × 3.3 / 1024</div>${loop ? `<div class="small m6-rt">wire → P1.31 (AD0.5) → ADC reads <b>${Math.min(4095, Math.floor(V / 3.3 * 4096))}</b> = 4 × ${v} <span class="p-faint">(12-bit vs 10-bit, ch. 5)</span></div>` : ''}`;
  }
  function paintMeas() {
    const Ts = cnt / 3e6, f = 1 / (N * Ts), mx = Math.max(...wave), mn = Math.min(...wave), lim = bias ? 2.5e-6 : 1e-6;
    meas.innerHTML = `<span>sample period T<sub>s</sub> = DACCNTVAL / 3 MHz = <b>${fmtUs(Ts * 1e6)}</b></span><span>wave frequency = 1 / (N × T<sub>s</sub>) = 1 / (${N} × ${fmtUs(Ts * 1e6)}) = <b>${f >= 1000 ? (f / 1000).toFixed(2) + ' kHz' : f.toFixed(1) + ' Hz'}</b></span><span>peak-to-peak = (${mx} − ${mn}) × 3.3/1024 = <b>${((mx - mn) * 3.3 / 1024).toFixed(2)} V</b></span>${Ts < lim ? `<span class="p-red">⚠ T<sub>s</sub> is shorter than the ${bias ? '2.5' : '1'} µs settling time (BIAS = ${bias}) → the output can't keep up: rounded, smaller wave</span>` : ''}`;
  }
  function genCode() {
    code.set([`unsigned int wave[${N}] = { ${wave.join(', ')} };`, 'LPC_PINCON->PINSEL1 |= 2<<20;               // P0.26 = AOUT', dbl ? `LPC_DAC->DACCNTVAL = ${cnt};                    // one sample every ${cnt} PCLK = ${fmtUs(cnt / 3)}` : '/* no DACCNTVAL: timing = however fast the loop runs */', dbl ? 'LPC_DAC->DACCTRL = (1<<1) | (1<<2);         // DBLBUF_ENA + CNT_ENA' : 'LPC_DAC->DACCTRL = 0;', `while(1) for(i = 0; i < ${N}; i++) {`, `    LPC_DAC->DACR = (wave[i] << 6)${bias ? ' | (1<<16)' : ''};   // VALUE bits 15:6${bias ? ', BIAS = 1' : ''}`, dbl ? '    while(!(LPC_DAC->DACCTRL & 1));         // wait for INT_DMA_REQ (counter hit 0)' : '    delay();                                // software delay → uneven', '}']);
  }
  function refresh() { drawRoll(); drawScope(); paintEng(); paintMeas(); genCode(); }
  new ResizeObserver(() => { drawRoll(); drawScope(); }).observe(roll);
  const lp = Loop(w, dt => { if (!play) return; ph += dt * spd; if (ph >= 1) { ph = 0; i = (i + 1) % N; drawRoll(); } paintEng(); });
  fill(); refresh(); lp.start();
});
