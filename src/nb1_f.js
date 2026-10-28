/* =========================================================
   NOTEBOOK 1 · part F — master-widget helpers + M0 (toolkit)
   ========================================================= */

/* master widget shell: normal widget header + a star sticker */
function MW(id, title, info) {
  const w = W(id, title, info);
  w.insertAdjacentHTML('afterbegin', '<svg class="sticker mst" aria-hidden="true"><use href="#st-star"/></svg>');
  return w;
}
/* call cb(narrow) now and whenever the node crosses the width breakpoint */
function widthWatch(node, bp, cb) {
  let last = null;
  const f = () => { const wd = node.clientWidth; if (!wd) return; const n = wd < bp; if (n !== last) { last = n; cb(n); } };
  new ResizeObserver(f).observe(node); f();
}
/* little glowing dots that run along polylines [[x,y,name?],…]; on(name) fires as named points are passed */
function Walker(svg) {
  const L = [];
  function go(pts, o = {}) {
    const segs = []; let tot = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); tot += d; }
    const c = sv('circle', { r: o.r || 6, class: 'mpulse ' + (o.cls || ''), cx: pts[0][0], cy: pts[0][1] }, svg);
    const wk = { pts, segs, tot, s: 0, i: 0, c, o }; L.push(wk); return wk;
  }
  function step(dt) {
    for (const wk of L.slice()) {
      if (!L.includes(wk)) continue; // cleared by a callback
      wk.s += dt * (wk.o.speed || 280);
      let acc = 0, i = 0;
      while (i < wk.segs.length && acc + wk.segs[i] <= wk.s) { acc += wk.segs[i]; i++; }
      while (wk.i < i) { wk.i++; const nm = wk.pts[wk.i][2]; if (nm && wk.o.on) wk.o.on(nm, wk); if (!L.includes(wk)) break; }
      if (!L.includes(wk)) continue;
      if (i >= wk.segs.length) { wk.c.remove(); L.splice(L.indexOf(wk), 1); wk.o.end && wk.o.end(); continue; }
      const f = (wk.s - acc) / (wk.segs[i] || 1), a = wk.pts[i], b = wk.pts[i + 1];
      wk.c.setAttribute('cx', (a[0] + (b[0] - a[0]) * f).toFixed(1)); wk.c.setAttribute('cy', (a[1] + (b[1] - a[1]) * f).toFixed(1));
    }
  }
  return { go, step, clear() { L.forEach(wk => wk.c.remove()); L.length = 0; }, kill(wk) { const i = L.indexOf(wk); if (i >= 0) { wk.c.remove(); L.splice(i, 1); } }, get busy() { return L.length > 0; } };
}
/* a red "stopped here" ring */
function ringAt(svg, x, y, cls = '') { const c = sv('circle', { cx: x, cy: y, r: 4, class: 'mring ' + cls }, svg); setTimeout(() => c.remove(), 800); }
/* one line of C, syntax-coloured (uses the core highlighter) */
const cLine = t => hlC(t);
const fmtN = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/* =========================================================
   M0 · the pin X-ray bench
   ========================================================= */
BUILD.push(function wM0() {
  const w = MW('w-m0', 'pin X-ray bench', 'compose a C line → run it → follow it into the pin');
  const FN = {
    '0.2': { 1: ['TXD0', 'UART0 transmit', 'out'] }, '0.3': { 1: ['RXD0', 'UART0 receive', 'in'] },
    '0.23': { 1: ['AD0.0', 'ADC input', 'an'], 3: ['CAP3.0', 'timer 3 capture in', 'in'] }, '0.26': { 1: ['AD0.3', 'ADC input', 'an'], 2: ['AOUT', 'DAC output', 'an'] },
    '1.18': { 3: ['CAP1.0', 'timer 1 count / capture in', 'in'] }, '1.25': { 3: ['MAT1.1', 'timer 1 match out', 'out'] },
    '1.26': { 3: ['CAP0.0', 'timer 0 capture in', 'in'] }, '1.27': { 3: ['CAP0.1', 'timer 0 capture in', 'in'] },
    '1.28': { 3: ['MAT0.0', 'timer 0 match out', 'mat'] }, '2.10': { 1: ['EINT0', 'external interrupt', 'in'] }, '2.12': { 1: ['EINT2', 'external interrupt', 'in'] }
  };
  const st = { port: 0, pin: 2, psel: [0, 0, 0, 0, 0], dir: [0, 0, 0], mask: [0, 0, 0], lat: [0, 0, 0], ext: [0, 0, 0], x: null };
  let reg = 'FIODIR', op = '|=', em0 = 0, ticks = 0, blink = false, blinkPh = 0;
  const pIdx = () => st.port * 2 + (st.pin >= 16 ? 1 : 0), pLo = () => 2 * (st.pin % 16);
  const fnOf = () => (st.psel[pIdx()] >>> pLo()) & 3;
  const fnInfo = f => (FN[st.port + '.' + st.pin] || {})[f] || null;
  const bit = (v, b) => (v >>> b) & 1;
  function level() { // the real level on our pin
    const f = fnOf(), n = st.pin, p = st.port;
    if (f) { const k = (fnInfo(f) || [0, 0, 'x'])[2]; return k === 'mat' ? em0 : k === 'out' ? 1 : bit(st.ext[p], n); }
    return bit(st.dir[p], n) ? bit(st.lat[p], n) : bit(st.ext[p], n);
  }
  const portLevels = () => { const p = st.port; let L = ((st.dir[p] & st.lat[p]) | (~st.dir[p] & st.ext[p])) >>> 0; L = (L & ~(1 << st.pin)) | (level() << st.pin); return L >>> 0; };
  // what the X-ray currently shows (it lags the model until the dot arrives)
  const vis = { lat: 0, dir: 0, mask: 0, fn: 0, lvl: 0, x: null, ext: 0 };
  const syncVis = (...k) => { const p = st.port, n = st.pin; const all = { lat: bit(st.lat[p], n), dir: bit(st.dir[p], n), mask: bit(st.mask[p], n), fn: fnOf(), lvl: level(), x: st.x, ext: bit(st.ext[p], n) }; (k.length ? k : Object.keys(all)).forEach(q => vis[q] = all[q]); paintX(); };

  /* ---------- layout ---------- */
  const top = el('div', { class: 'm0top' }); w.appendChild(top);
  const pick = el('div', { class: 'm0pick col' }); top.appendChild(pick);
  pick.appendChild(el('div', { class: 'mlab' }, '① the pin under the X-ray'));
  const pr = el('div', { class: 'row', style: 'gap:8px 12px' }); pick.appendChild(pr);
  const portG = chipGroup(pr, [[0, 'P0'], [1, 'P1'], [2, 'P2']], st.port, v => { st.port = +v; newPin(); });
  const pinR = ruler(pr, 'pin', 0, 31, st.pin, 1, v => 'P' + st.port + '.' + v, v => { st.pin = v; newPin(); });
  const qp = el('div', { class: 'chips' }); pick.appendChild(qp);
  [[0, 2, 'P0.2 · LED in the programs'], [1, 28, 'P1.28 · can be MAT0.0'], [2, 12, 'P2.12 · a key'], [1, 23, 'P1.23 · keypad column']].forEach(([a, b, t]) => { const c = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-g)' }, t); c.onclick = () => { st.port = a; st.pin = b; portG.set(a); pinR.value = b; pinR.dispatchEvent(new Event('input')); newPin(); }; qp.appendChild(c); });
  pick.appendChild(el('div', { class: 'mlab', style: 'margin-top:6px' }, '③ quick recipes for this pin'));
  const rec = el('div', { class: 'chips m0recipe' }); pick.appendChild(rec);

  const bench = el('div', { class: 'm0bench mbox' }); top.appendChild(bench);
  bench.appendChild(el('div', { class: 'mlab' }, '② build one C line from the tiles'));
  const tl = el('div', { class: 'm0tiles' }); bench.appendChild(tl);
  const REGS = [['PINSEL', 'PINSELn'], ['FIODIR', 'FIODIR'], ['FIOMASK', 'FIOMASK'], ['FIOSET', 'FIOSET'], ['FIOCLR', 'FIOCLR'], ['FIOPIN', 'FIOPIN ='], ['READ', 'x = FIOPIN']];
  const regG = chipGroup(tl, REGS, reg, v => { reg = v; fixOp(); showLine(); });
  const tl2 = el('div', { class: 'm0tiles' }); bench.appendChild(tl2);
  const opG = chipGroup(tl2, [['=', '='], ['|=', '|=  (switch on)'], ['&=~', '&= ~  (switch off)']], op, v => { op = v; showLine(); });
  const ln = el('div', { class: 'm0line' }); bench.appendChild(ln);
  const inp = el('input', { class: 'inp', value: '1<<2', 'aria-label': 'value', spellcheck: 'false' });
  const vch = el('div', { class: 'chips' });
  ln.append(el('span', { class: 'gae' }, 'value'), inp, vch);
  const ln2 = el('div', { class: 'm0line' }); bench.appendChild(ln2);
  const code = el('div', { class: 'mcode' }); const run = el('button', { class: 'btn p', type: 'button' }, 'run ▶');
  ln2.append(code, run);
  const err = el('div', { class: 'msay r', style: 'min-height:0' }); bench.appendChild(err);

  // the bit-maths sheet
  const sheetBox = el('div', { class: 'mbox', style: 'margin-top:14px' }); w.appendChild(sheetBox);
  sheetBox.appendChild(el('div', { class: 'mlab' }, '④ the bit maths — every 32 bits of the register (pink frame = our pin\'s bit)'));
  const sheet = el('div', { class: 'm0sheet' }); sheetBox.appendChild(sheet);
  const expl = el('div', { class: 'm0expl' }); sheetBox.appendChild(expl);

  // X-ray + register file
  const mid = el('div', { class: 'm0mid' }); w.appendChild(mid);
  const xr = el('div'); mid.appendChild(xr);
  xr.appendChild(el('div', { class: 'mlab' }, '⑤ inside the chip, around our pin'));
  const xs = el('div', { class: 'm0xs' }); xr.appendChild(xs); xr.appendChild(el('div', { class: 'swipe-hint' }, '← swipe: the pin and its LED are on the right →'));
  const S = sv('svg', { class: 'dg m0x', viewBox: '0 0 520 320', role: 'img', 'aria-label': 'cut-away of one GPIO pin' }); xs.appendChild(S);
  const follow = right => { if (xs.scrollWidth > xs.clientWidth + 4) xs.scrollTo({ left: right ? xs.scrollWidth : 0, behavior: REDUCED ? 'auto' : 'smooth' }); };
  const say = el('div', { class: 'msay' }); xr.appendChild(say);
  const side = el('div', { class: 'col' }); mid.appendChild(side);
  side.appendChild(el('div', { class: 'mlab' }, 'register file (tap to pick)'));
  const regsBox = el('div', { class: 'm0regs mbox' }); side.appendChild(regsBox);
  const beat = el('div', { class: 'm0beat mbox' }); side.appendChild(beat);

  /* ---------- the X-ray drawing ---------- */
  const R = rng(5), g = sv('g', {}, S), D = (d, cls, par = g) => sv('path', { d, class: cls }, par), T = (x, y, t, cls = 't', a = 'middle', par = g) => { const e = sv('text', { x, y, 'text-anchor': a, class: cls }, par); e.textContent = t; return e; };
  T(210, 314, 'inside the chip', 's'); T(474, 314, 'outside', 's');
  D(`M430 6 V300`, 'ink2').setAttribute('style', 'stroke-dasharray:6 5');
  // CPU bubbles
  sv('rect', { x: 6, y: 30, width: 96, height: 42, rx: 14, class: 'blk', style: 'fill:var(--n-b)' }, g);
  T(54, 47, 'CPU writes', 's'); const tW = T(54, 64, '—', 'm');
  sv('rect', { x: 6, y: 106, width: 96, height: 44, rx: 14, class: 'blk', style: 'fill:var(--n-g)' }, g);
  T(54, 123, 'x = FIOPIN', 's'); const tR = T(54, 141, 'x = ?', 'm');
  // wires
  const wW = D('M102 51 H118 M146 51 H166 M224 51 H246', 'w'), wB = D('M276 51 H318 V90 H338', 'w');
  const wR = D('M318 90 V128 H276 M246 128 H146 M118 128 H102', 'w'), wEn = D('M262 24 V40', 'w');
  // mask gates
  const gW = sv('rect', { x: 118, y: 37, width: 28, height: 28, rx: 4, class: 'gate' }, g), gR = sv('rect', { x: 118, y: 114, width: 28, height: 28, rx: 4, class: 'gate' }, g);
  T(132, 28, 'FIOMASK', 's'); const tMW = T(132, 56, '0', 'm'), tMR = T(132, 133, '0', 'm');
  // latch
  sv('rect', { x: 166, y: 29, width: 58, height: 44, rx: 6, class: 'blk' }, g); T(195, 43, 'latch', 's'); const tQ = T(195, 64, 'Q = 0', 'm');
  // buffers
  const bOut = sv('path', { d: 'M246 35 L246 67 L277 51 Z', class: 'blk' }, g), bIn = sv('path', { d: 'M276 112 L276 144 L245 128 Z', class: 'blk' }, g);
  sv('rect', { x: 192, y: 2, width: 140, height: 22, rx: 6, class: 'blk', style: 'fill:var(--n-y)' }, g); const tD = T(262, 18, 'FIODIR bit = 0', 'm');
  T(262, 84, 'out buffer ↑', 's'); T(262, 104, 'in buffer ↓', 's');
  sv('circle', { cx: 318, cy: 90, r: 3.5, style: 'fill:var(--ink)' }, g);
  // sockets
  const SY = [90, 170, 212, 254], socks = [], sockT = [];
  SY.forEach((y, f) => { socks[f] = sv('circle', { cx: 346, cy: y, r: 8, class: 'sock' }, g); sockT[f] = T(f ? 338 : 346, f ? y - 11 : y + 24, '', 's', f ? 'end' : 'middle'); });
  const wF = [1, 2, 3].map(f => D(`M262 ${SY[f]} H338`, 'w off'));
  // peripheral box (only for a known job)
  const per = sv('g', {}, g); sv('rect', { x: 104, y: 232, width: 158, height: 44, rx: 8, class: 'blk', style: 'fill:var(--n-o)' }, per);
  const tPer = T(183, 250, '', 't', 'middle', per), tPer2 = T(183, 268, '', 's', 'middle', per);
  // PINSEL tag
  const tPS = T(274, 297, '', 'm');
  // cord
  const cord = D('', 'cord'), cordi = D('', 'cordi'), plug = sv('rect', { width: 14, height: 10, rx: 3, class: 'plug' }, g);
  // pad
  sv('rect', { x: 421, y: 80, width: 18, height: 20, rx: 3, style: 'fill:#e6c15a;stroke:var(--ink);stroke-width:1.6' }, g);
  const tPad = T(430, 74, 'P0.2', 'm');
  const wPad = D('M439 90 H476', 'w');
  // outside: LED (for outputs) or a switch (for inputs)
  const gLed = sv('g', {}, g);
  D('M476 90 V106 l-7 3 l14 5 l-14 5 l14 5 l-14 5 l7 3 V144', 'w', gLed);
  const bulb = sv('circle', { cx: 476, cy: 156, r: 11, class: 'ledbulb' }, gLed);
  D('M466 149 H486 L476 163 Z M466 164 H486', 'ink', gLed); D('M476 164 V188 M466 188 H486 M470 193 H482 M474 198 H478', 'ink', gLed);
  T(500, 160, 'LED', 's', 'start', gLed);
  const gSw = sv('g', { class: 'swk', role: 'button', tabindex: 0, 'aria-label': 'flip the outside switch' }, g);
  T(476, 22, '3.3 V', 's', 'middle', gSw); D('M476 28 V46', 'w', gSw);
  const lever = D('M476 74 L476 48', 'ink', gSw); lever.style.strokeWidth = '3';
  sv('circle', { cx: 476, cy: 46, r: 3, style: 'fill:var(--ink)' }, gSw); sv('circle', { cx: 476, cy: 74, r: 3, style: 'fill:var(--ink)' }, gSw);
  D('M476 74 V90 M476 90 V112 l-7 3 l14 5 l-14 5 l14 5 l-14 5 l7 3 V158 M466 158 H486 M470 163 H482 M474 168 H478', 'ink', gSw);
  T(476, 188, 'tap to flip', 's', 'middle', gSw); const tSw = T(476, 206, 'open', 's', 'middle', gSw);
  const flipSw = () => { st.ext[st.port] ^= 1 << st.pin; syncVis('ext', 'lvl'); paintRegs(); say.innerHTML = `outside world: P${st.port}.${st.pin} is now <b>${bit(st.ext[st.port], st.pin) ? 'HIGH' : 'LOW'}</b>. Only an input pin listens to it — run <b>x = FIOPIN</b> to read it.`; };
  gSw.addEventListener('click', flipSw); gSw.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipSw(); } });
  const walker = Walker(S);

  function cordPts(f) { const y = SY[f]; return f ? [[421, 90], [408, 120], [392, y - 14], [372, y + 6], [356, y]] : [[421, 90], [404, 100], [380, 102], [356, 90]]; }
  function paintX() {
    const n = st.pin, f = vis.fn, out = !f && vis.dir, info = f ? fnInfo(f) : null, lv = vis.lvl;
    tPad.textContent = `P${st.port}.${n}`;
    tMW.textContent = vis.mask; tMR.textContent = vis.mask; gW.setAttribute('class', 'gate' + (vis.mask ? '' : ' open')); gR.setAttribute('class', 'gate' + (vis.mask ? '' : ' open'));
    tQ.textContent = 'Q = ' + vis.lat;
    tD.textContent = `FIODIR bit ${n} = ${vis.dir}`;
    bOut.setAttribute('class', 'blk' + (vis.dir ? '' : ' dim'));
    const hl = v => v ? 'w on' : 'w lo';
    wW.setAttribute('class', hl(vis.lat)); wEn.setAttribute('class', vis.dir ? 'w on' : 'w lo');
    wB.setAttribute('class', !vis.dir ? 'w off' : f ? 'w off' : hl(vis.lat));
    wR.setAttribute('class', f ? 'w off' : hl(lv)); wPad.setAttribute('class', hl(lv));
    socks.forEach((c, i) => c.setAttribute('class', 'sock' + (i === f ? ' on' : '')));
    sockT[0].textContent = '00 GPIO';
    [1, 2, 3].forEach(k => { const fi = fnInfo(k); sockT[k].textContent = `${bin(k, 2)} · ${fi ? fi[0] : 'fn ' + k}`; wF[k - 1].setAttribute('class', k === f ? (info && info[2] === 'in' ? hl(lv) : hl(lv)) : 'w off'); });
    const cp = cordPts(f); cord.setAttribute('d', Pen.catmull(cp)); cordi.setAttribute('d', Pen.catmull(cp));
    plug.setAttribute('x', 349); plug.setAttribute('y', SY[f] - 5);
    const kn = Object.entries(FN[st.port + '.' + n] || {}); const shownF = f || (kn.length ? +kn[kn.length - 1][0] : 0);
    const pi = shownF ? fnInfo(shownF) : null;
    per.style.display = pi ? '' : 'none';
    if (pi) { per.setAttribute('transform', `translate(0 ${SY[shownF] - 254})`); tPer.textContent = pi[0] + (pi[2] === 'mat' ? ' · Timer0' : ''); tPer2.textContent = pi[2] === 'mat' ? `EM0 = ${em0} · flips every 1 s` : pi[1]; }
    tPS.textContent = `PINSEL${pIdx()} · bits ${pLo() + 1}:${pLo()} = ${bin(f, 2)} → socket ${bin(f, 2)}`;
    // outside thing: LED when the pin drives it, switch when the outside drives the pin
    const drives = f ? (info && (info[2] === 'mat' || info[2] === 'out')) : vis.dir;
    gLed.style.display = drives ? '' : 'none'; gSw.style.display = drives ? 'none' : '';
    bulb.setAttribute('class', 'ledbulb' + (lv ? ' on' : ''));
    lever.setAttribute('d', vis.ext ? 'M476 74 L476 48' : 'M476 74 L496 54'); tSw.textContent = vis.ext ? 'closed → HIGH' : 'open → LOW';
    tR.textContent = vis.x == null ? 'x = ?' : `bit ${n} = ${bit(vis.x, n)}`;
  }

  /* ---------- the bench ---------- */
  function fixOp() {
    const lock = reg === 'FIOSET' || reg === 'FIOCLR' || reg === 'FIOPIN' || reg === 'READ';
    if (lock) { op = '='; opG.set('='); }
    $$('.chip', opG.el).forEach(c => { c.disabled = lock && c.dataset.v !== '='; c.style.opacity = c.disabled ? .35 : 1; });
    inp.disabled = reg === 'READ'; inp.style.opacity = reg === 'READ' ? .4 : 1;
    vch.innerHTML = ''; const k = pLo(), n = st.pin;
    const opts = reg === 'PINSEL' ? [`3<<${k}`, `1<<${k}`, `2<<${k}`] : reg === 'READ' ? [] : [`1<<${n}`, '0xFF', '0'];
    opts.forEach(t => { const c = el('button', { class: 'chip mn', type: 'button' }, esc(t)); c.onclick = () => { inp.value = t; showLine(); }; vch.appendChild(c); });
  }
  function lineText() {
    const v = inp.value.trim() || '0';
    if (reg === 'READ') return `x = LPC_GPIO${st.port}->FIOPIN;`;
    const lhs = reg === 'PINSEL' ? `LPC_PINCON->PINSEL${pIdx()}` : `LPC_GPIO${st.port}->${reg}`;
    return op === '&=~' ? `${lhs} &= ~(${v});` : `${lhs} ${op} ${v};`;
  }
  function showLine() { code.innerHTML = cLine(lineText()); err.textContent = ''; }
  inp.addEventListener('input', showLine);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doRun(); });
  run.onclick = () => doRun();

  /* ---------- the maths sheet ---------- */
  function bitsRow(lab, v, cls, prev) {
    const r = el('div', { class: 'm0r ' + (cls || '') }); r.appendChild(el('span', { class: 'lab' }, lab));
    const bx = el('div', { class: 'm0bits' }); r.appendChild(bx);
    const pins = reg === 'PINSEL' ? [pLo(), pLo() + 1] : [st.pin];
    for (let h = 1; h >= 0; h--) {
      const hf = el('div', { class: 'm0half' }); bx.appendChild(hf);
      for (let b = h * 16 + 15; b >= h * 16; b--) {
        const one = bit(v, b), c = el('i', { class: (one ? 'one' : '') + (pins.includes(b) ? ' pin' : '') + (prev != null && bit(prev, b) !== one ? ' chg' : '') }, one); c.title = 'bit ' + b; hf.appendChild(c);
      }
    }
    r.appendChild(el('span', { class: 'hx' }, hex(v))); sheet.appendChild(r);
  }
  function hdrRow(v) {
    const r = el('div', { class: 'm0r hdr' }); r.appendChild(el('span', { class: 'lab' }, 'hex digit'));
    const bx = el('div', { class: 'm0bits' }); r.appendChild(bx);
    const pinNib = (reg === 'PINSEL' ? pLo() : st.pin) >> 2;
    for (let h = 1; h >= 0; h--) { const hf = el('div', { class: 'm0half' }); bx.appendChild(hf); for (let k = h * 4 + 3; k >= h * 4; k--) hf.appendChild(el('b', { class: k === pinNib ? 'pinnib' : '' }, ((v >>> (k * 4)) & 15).toString(16).toUpperCase())); }
    r.appendChild(el('span', { class: 'hx p-faint' }, '4 bits each')); sheet.appendChild(r);
  }
  function sheetFor(rows, result, text) {
    sheet.innerHTML = ''; hdrRow(result); rows.forEach(r => bitsRow(...r)); expl.innerHTML = text;
  }

  /* ---------- running a line ---------- */
  function doRun() {
    let v = 0;
    if (reg !== 'READ') { try { v = safeEval(inp.value || '0'); } catch (e) { err.textContent = '✗ ' + e.message; return; } }
    const p = st.port, n = st.pin, mk = st.mask[p];
    walker.clear(); err.textContent = ''; follow(reg === 'READ' || reg === 'PINSEL');
    tW.textContent = reg === 'READ' ? '—' : (reg === 'PINSEL' ? 'PINSEL' : reg) + (op === '&=~' ? ' &=~' : ' ' + op);
    const wpath = [[102, 51], [132, 51, 'mask'], [195, 51, 'latch'], [261, 51, 'buf'], [318, 51], [318, 90], [346, 90, 'sock0']].concat(cordPts(0).slice().reverse().slice(1).map(q => [q[0], q[1]])).concat([[430, 90, 'pad'], [476, 90], [476, 152, 'out']]);
    const stopRing = (x, y, msg) => { ringAt(S, x, y); say.innerHTML = msg; };
    if (reg === 'PINSEL') {
      const k = pIdx(), old = st.psel[k], nw = op === '=' ? v : op === '|=' ? (old | v) >>> 0 : (old & ~v) >>> 0;
      st.psel[k] = nw;
      sheetFor([[`PINSEL${k} before`, old], [op === '&=~' ? '~(value)' : 'value', op === '&=~' ? (~v) >>> 0 : v, 'op'], [`PINSEL${k} after`, nw, 'res', old]], nw,
        `${op === '|=' ? '<b>|=</b> keeps every old 1 and adds the value\'s 1s.' : op === '&=~' ? '<b>&= ~</b>: ~ flips the value, then AND keeps only bits that are 1 in both → the value\'s bits are switched <b>off</b>.' : '<b>=</b> overwrites all 32 bits — other pins\' jobs too!'} Our pin uses <b>bits ${pLo() + 1}:${pLo()}</b> = ${bin(fnOf(), 2)}.`);
      const f = fnOf();
      walker.go([[54, 72], [54, 296], [118, 296, 'ps']], { cls: 'p', on: nm => { if (nm === 'ps') { syncVis('fn', 'lvl'); cord.classList.remove('flash'); void cord.getBBox(); cord.classList.add('flash'); } }, end: () => { const fi = fnInfo(f); say.innerHTML = f ? `The cord now plugs P${p}.${n} into socket <b>${bin(f, 2)}</b> = ${fi ? `<b>${fi[0]}</b> (${fi[1]})` : `function ${f}`}. GPIO writes no longer reach the pin.` : `Socket <b>00</b>: P${p}.${n} is a plain <b>GPIO</b> pin again.`; } });
    } else if (reg === 'FIODIR' || reg === 'FIOMASK') {
      const key = reg === 'FIODIR' ? 'dir' : 'mask', old = st[key][p], nw = op === '=' ? v : op === '|=' ? (old | v) >>> 0 : (old & ~v) >>> 0;
      st[key][p] = nw;
      sheetFor([[`${reg} before`, old], [op === '&=~' ? '~(value)' : 'value', op === '&=~' ? (~v) >>> 0 : v, 'op'], [`${reg} after`, nw, 'res', old]], nw,
        `${op === '|=' ? '<b>|=</b> switches on the value\'s bits, the rest stay.' : op === '&=~' ? '<b>&= ~</b> switches off the value\'s bits, the rest stay.' : '<b>=</b> overwrites every bit of the port.'} ${reg === 'FIODIR' ? 'FIODIR: 1 = output, 0 = input.' : 'FIOMASK: 1 = protected (writes skip it, reads give 0).'}`);
      if (key === 'dir') walker.go([[54, 30], [54, 13], [206, 13, 'dir']], { cls: 'b', on: () => syncVis('dir', 'lvl'), end: () => { say.innerHTML = bit(nw, n) ? `FIODIR bit ${n} = 1 → the <b>out buffer</b> switches on: the latch now drives P${p}.${n}. Outside: an LED.` : `FIODIR bit ${n} = 0 → out buffer off: P${p}.${n} is an <b>input</b>; the outside world sets its level (flip the switch).`; } });
      else { walker.go([[102, 51], [132, 51, 'm']], { cls: 'b', on: () => syncVis('mask'), end: () => { say.innerHTML = bit(nw, n) ? `Mask bit ${n} = 1 → both shutters <b>close</b>: FIOSET / FIOCLR / FIOPIN writes stop at the shutter, and x = FIOPIN reads 0 here.` : `Mask bit ${n} = 0 → shutters open, P${p}.${n} works normally.`; } }); walker.go([[102, 128], [132, 128]], { cls: 'b' }); }
    } else if (reg === 'READ') {
      const lv = portLevels(), x = (lv & ~mk) >>> 0; st.x = x;
      sheetFor([['pin levels', lv], ['FIOMASK', mk, 'op'], ['x = levels & ~mask', x, 'res']], x, `x gets the level of every pin of port ${p} — except masked pins, which read 0. Test our pin with <code>if (x &amp; (1&lt;&lt;${n}))</code>.`);
      const rp = [[476, 90], [430, 90]].concat(cordPts(vis.fn).slice(1).map(q => [q[0], q[1]])).concat(vis.fn ? [] : [[318, 90], [318, 128], [261, 128], [132, 128, 'mask'], [102, 128, 'cpu']]);
      walker.go(rp, { cls: 'g', on: nm => { if (nm === 'mask' && vis.mask) { walker.clear(); stopRing(132, 128, `Mask bit ${n} = 1 → the read is blocked: x has <b>0</b> at bit ${n} whatever the pin does.`); vis.x = x; paintX(); } if (nm === 'cpu') { vis.x = x; paintX(); } }, end: () => { if (vis.fn) { stopRing(346, SY[vis.fn], `The cord is in socket ${bin(vis.fn, 2)}, not GPIO — this drawing stops here (the level still shows in FIOPIN: x bit ${n} = ${bit(x, n)}).`); vis.x = x; paintX(); } else if (!vis.mask) say.innerHTML = `x = <b>${hex(x)}</b> → bit ${n} = <b>${bit(x, n)}</b>: P${p}.${n} is ${bit(x, n) ? 'HIGH' : 'LOW'}${bit(st.dir[p], n) ? ' (an output reads back its own level)' : ''}.`; } });
    } else { // FIOSET / FIOCLR / FIOPIN write
      const old = st.lat[p], eff = (v & ~mk) >>> 0;
      const nw = reg === 'FIOSET' ? (old | eff) >>> 0 : reg === 'FIOCLR' ? (old & ~eff) >>> 0 : ((old & mk) | (v & ~mk)) >>> 0;
      st.lat[p] = nw;
      const rows = [['latch before', old], [reg === 'FIOPIN' ? 'value (all bits!)' : `value (1 = ${reg === 'FIOSET' ? 'HIGH' : 'LOW'})`, v, 'op']];
      if (mk) rows.push(['FIOMASK', mk, 'op']);
      rows.push(['latch after', nw, 'res', old]);
      sheetFor(rows, nw, reg === 'FIOPIN' ? '<b>FIOPIN =</b> copies <b>every</b> unmasked bit: the 0s pull other pins LOW too!' : `<b>${reg}</b> only acts on the 1-bits; 0-bits mean "no change" — safe for the other pins.`);
      const blockedMask = bit(mk, n), touched = reg === 'FIOPIN' || bit(v, n);
      if (!touched) { say.innerHTML = `Bit ${n} of the value is 0 → ${reg} leaves P${p}.${n} alone (only the other pins' bits did something).`; syncVis(); return; }
      walker.go(wpath, {
        cls: 'r', on: (nm, wk) => {
          if (nm === 'mask' && blockedMask) { walker.clear(); stopRing(132, 51, `Stopped at the shutter: FIOMASK bit ${n} = 1 → this write <b>can't reach</b> P${p}.${n}.`); return; }
          if (nm === 'latch') { syncVis('lat'); follow(true); }
          if (nm === 'buf' && !vis.dir) { walker.clear(); stopRing(261, 51, `Latch Q = ${vis.lat}, but FIODIR bit ${n} = 0 → the out buffer is <b>off</b>: an input pin ignores writes. (Set FIODIR first!)`); return; }
          if (nm === 'sock0' && vis.fn) { walker.clear(); stopRing(346, 90, `Reached socket 00 — but PINSEL plugged the pin into socket ${bin(vis.fn, 2)}. GPIO can't drive it now.`); return; }
          if (nm === 'pad') syncVis('lvl');
        }, end: () => { syncVis(); say.innerHTML = `${reg} → latch Q = ${vis.lat} → buffer on → socket 00 → P${p}.${n} <b>${vis.lvl ? 'HIGH' : 'LOW'}</b> → LED ${vis.lvl ? 'on' : 'off'}.`; }
      });
    }
    paintRegs();
  }

  /* ---------- register file + heartbeat ---------- */
  function paintRegs() {
    const p = st.port, n = st.pin, k = pIdx(), lo = pLo();
    const rows = [['PINSEL', `PINSEL${k}`, st.psel[k], `bits ${lo + 1}:${lo} = ${bin(fnOf(), 2)}`], ['FIODIR', `FIODIR${p}`, st.dir[p], `bit ${n} = ${bit(st.dir[p], n)}`], ['FIOMASK', `FIOMASK${p}`, st.mask[p], `bit ${n} = ${bit(st.mask[p], n)}`], ['FIOSET', 'latch', st.lat[p], `bit ${n} = ${bit(st.lat[p], n)}`], ['READ', `FIOPIN${p} (read)`, portLevels(), `bit ${n} = ${level()}`]];
    regsBox.innerHTML = '';
    rows.forEach(([r, lab, v, b]) => { const bt = el('button', { type: 'button', class: reg === r ? 'on' : '' }, lab); bt.onclick = () => { reg = r; regG.set(r); fixOp(); showLine(); paintRegs(); }; regsBox.append(bt, el('span', {}, `${hex(v)} · <em>${b}</em>`)); });
  }
  const beatH = el('div', { class: 'mlab' }); const odo = el('div', { class: 'odo' }, '0'); const bt = el('div', { class: 'small' }); const bB = el('button', { class: 'btn sm y', type: 'button' }, '▶ blink this pin (1 s)');
  beat.append(beatH, odo, bt, bB);
  bB.onclick = () => { blink = !blink; bB.textContent = blink ? '❚❚ stop blinking' : '▶ blink this pin (1 s)'; if (blink) { ticks = 0; blinkPh = 0; } paintBeat(); };
  function paintBeat() {
    const mat = fnOf() && (fnInfo(fnOf()) || [])[2] === 'mat';
    beatH.textContent = mat ? 'Timer0 counts PCLK for MAT0.0 (like program P3)' : 'PCLK heartbeat · 3 MHz';
    odo.textContent = fmtN(ticks % 3000000);
    bt.innerHTML = mat ? `3 000 000 ticks = 1 s → EM0 toggles → <b>P1.28 = ${em0}</b>. No CPU writes needed.` : blink ? `loop: <code>FIOSET</code> → wait 3 000 000 ticks (1 s) → <code>FIOCLR</code> → wait …` : '3 000 ticks = 1 ms · 3 000 000 ticks = 1 s. Press blink to run a delay loop on this pin.';
    bB.style.display = mat ? 'none' : '';
  }
  const loop = Loop(w, dt => { // runs while any part of the widget is on screen
    walker.step(dt);
    const mat = fnOf() && (fnInfo(fnOf()) || [])[2] === 'mat';
    if (mat || blink) {
      const before = Math.floor(ticks / 3e6); ticks += dt * 3e6; const now = Math.floor(ticks / 3e6);
      if (now !== before) {
        if (mat) { em0 ^= 1; syncVis('lvl'); paintRegs(); }
        else if (blink) { reg = blinkPh ? 'FIOCLR' : 'FIOSET'; op = '='; inp.value = '1<<' + st.pin; regG.set(reg); fixOp(); showLine(); doRun(); blinkPh ^= 1; }
      }
      paintBeat();
    }
  });
  loop.start();

  function newPin() {
    walker.clear(); blink = false; bB.textContent = '▶ blink this pin (1 s)';
    if (reg === 'FIOPIN' || reg === 'FIOSET' || reg === 'FIOCLR') inp.value = '1<<' + st.pin;
    else if (reg === 'PINSEL') inp.value = '3<<' + pLo();
    else if (reg !== 'READ') inp.value = '1<<' + st.pin;
    pinR.parentElement.querySelector('output').textContent = `P${st.port}.${st.pin}`;
    fixOp(); showLine(); syncVis(); paintRegs(); paintBeat();
    rec.innerHTML = ''; const n = st.pin, k = pLo(), p = st.port;
    const R = [['① GPIO job', 'PINSEL', '&=~', `3<<${k}`], ['② output', 'FIODIR', '|=', `1<<${n}`], ['HIGH', 'FIOSET', '=', `1<<${n}`], ['LOW', 'FIOCLR', '=', `1<<${n}`], ['input', 'FIODIR', '&=~', `1<<${n}`], ['read', 'READ', '=', ''], ['protect', 'FIOMASK', '|=', `1<<${n}`], ['unprotect', 'FIOMASK', '&=~', `1<<${n}`]];
    Object.entries(FN[p + '.' + n] || {}).forEach(([f, fi]) => R.push([`★ ${fi[0]} job`, 'PINSEL', '|=', `${f}<<${k}`]));
    R.forEach(([t, r, o, v]) => { const c = el('button', { class: 'chip', type: 'button' }, t); c.onclick = () => { reg = r; regG.set(r); fixOp(); op = o; opG.set(o); if (v) inp.value = v; showLine(); doRun(); }; rec.appendChild(c); });
    sheetFor([], 0, 'Run a line to see its bit maths here.'); sheet.innerHTML = '';
    say.innerHTML = `P${p}.${n}: PINSEL${pIdx()} bits ${k + 1}:${k} choose its job · bit ${n} of the port-${p} registers is its switch. Try the recipes ② then HIGH.`;
  }
  newPin();
});
