/* =========================================================
   NOTEBOOK 1 · part A — toolkit + keypad + 7-seg
   ========================================================= */
const KEYLAB = '0123456789AbcdEF'.split('');

/* ---------- bit playground ---------- */
BUILD.push(function wBits() {
  const w = W('w-bits', 'bit playground', 'type a C expression, or click any bit');
  const row = el('div', { class: 'row' }); w.appendChild(row);
  const inp = el('input', { class: 'inp', value: '3<<24', style: 'width:15em', 'aria-label': 'expression', spellcheck: 'false' });
  row.append(el('span', { class: 'gae' }, 'x ='), inp);
  const hexo = el('span', { class: 'ro big' }), deco = el('span', { class: 'ro' }); row.append(hexo, deco);
  let v = 0;
  const strip = RegStrip(w, { bits: 32, click: b => { v = (v ^ (1 << b)) >>> 0; inp.value = hx(v, 8); show(); } });
  const msg = el('div', { class: 'say' }); w.appendChild(msg);
  const ch = el('div', { class: 'chips mt' }); w.appendChild(ch);
  ch.appendChild(el('span', { class: 'cav p-soft' }, 'seen in the slides:'));
  ['1<<10', '0x3C00', '0x07800000', '(3<<20)|(3<<22)', '0xFFF87FFF', '0xFFFFF00F', '(1<<4)|(1<<21)|(1<<24)'].forEach(t => { const c = el('button', { class: 'chip', type: 'button' }, esc(t)); c.onclick = () => { inp.value = t; calc(); }; ch.appendChild(c); });
  function show() { strip.set(v); hexo.textContent = hex(v); deco.textContent = '= ' + v.toString(10); const on = []; for (let b = 31; b >= 0; b--) if ((v >>> b) & 1) on.push(b); msg.className = 'say'; msg.textContent = on.length ? (on.length > 10 ? `${on.length} bits are 1 — zeros at: ${[...Array(32).keys()].filter(b => !((v >>> b) & 1)).reverse().join(', ') || 'none'}` : 'bits that are 1: ' + on.join(', ')) : 'all bits are 0'; }
  function calc() { try { v = safeEval(inp.value); show(); } catch (e) { msg.className = 'say r'; msg.textContent = '✗ ' + e.message; } }
  inp.addEventListener('input', calc); calc();
});

/* ---------- GPIO port playground ---------- */
BUILD.push(function wGpio() {
  const w = W('w-gpio', 'GPIO port playground', 'type a value, write it into a register · P0.7 … P0.0 shown');
  let dir = 0x0F, mask = 0, lat = 0x05, ext = 0x40, rd = null, chg = 0, row = '';
  const lv = () => ((dir & lat) | (~dir & ext)) & 0xFF; // real pin levels
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  const inp = el('input', { class: 'inp', value: '0x04', style: 'width:6.5em', 'aria-label': 'value', spellcheck: 'false' });
  const vb = el('span', { class: 'ro' }); ctl.append(el('span', { class: 'gae' }, 'value ='), inp, vb);
  const qc = el('div', { class: 'chips' }); ctl.appendChild(qc);
  ['0x04', '0x01', '0x0F', '0xF0', '0x00'].forEach(t => { const c = el('button', { class: 'chip', type: 'button' }, t); c.onclick = () => { inp.value = t; showV(); }; qc.appendChild(c); });
  const bt = el('div', { class: 'row' }); w.appendChild(bt);
  const g = el('div', { class: 'gpg' }); w.appendChild(g);
  const say = el('div', { class: 'say' }); w.appendChild(say);
  const val = () => { try { return safeEval(inp.value) & 0xFF; } catch (e) { return null; } };
  const showV = () => { const v = val(); vb.textContent = v == null ? '?' : '= ' + bin(v, 8); };
  const pins = v => { const a = []; for (let b = 7; b >= 0; b--) if ((v >> b) & 1) a.push('P0.' + b); return a.join(', ') || 'none'; };
  const A = [
    ['FIODIR', 'dir', v => { chg = dir ^ v; dir = v; return `1-bits → <b>outputs</b> (${pins(v)}); 0-bits → inputs.`; }],
    ['FIOMASK', 'mask', v => { chg = mask ^ v; mask = v; return v ? `${pins(v)} now <b>protected</b>: FIOPIN / FIOSET / FIOCLR skip them, and they read as 0.` : 'nothing masked — all pins normal.'; }],
    ['FIOSET', 'pin', v => { const m = v & ~mask & 0xFF; chg = m & ~lat & dir; lat |= m; return `1-bits → HIGH (${pins(m)}). 0-bits → <b>no change</b>.${m & ~dir ? ' An input pin just ignores it — the outside world sets its level.' : ''}`; }],
    ['FIOCLR', 'pin', v => { const m = v & ~mask & 0xFF; chg = m & lat & dir; lat &= ~m & 0xFF; return `1-bits → LOW (${pins(m)}). 0-bits → <b>no change</b>.`; }],
    ['FIOPIN', 'pin', v => { const n = ((lat & mask) | (v & ~mask)) & 0xFF, low = lat & ~n & dir; chg = (n ^ lat) & dir; lat = n; return `<b>every</b> unmasked pin copies its bit → changed: ${pins(chg)}.${low ? ` <span class="p-red">The 0-bits pulled ${pins(low)} LOW too!</span>` : ''}`; }]
  ];
  A.forEach(([n, r, f]) => { const b = el('button', { class: 'btn sm p', type: 'button' }, n + ' = value'); b.onclick = () => { const v = val(); if (v == null) { say.textContent = '✗ not a number'; return; } rd = null; row = r; say.innerHTML = `<code>LPC_GPIO0-&gt;${n} = ${hx(v)};</code> → ` + f(v); paint(); }; bt.appendChild(b); });
  const br = el('button', { class: 'btn sm g', type: 'button' }, 'x = FIOPIN (read)'); bt.appendChild(br);
  br.onclick = () => { rd = lv() & ~mask & 0xFF; row = 'read'; chg = 0xFF; say.innerHTML = `<code>x = LPC_GPIO0-&gt;FIOPIN;</code> → x = <b>${hx(rd)}</b>: the real level of every pin (inputs = what the outside gives${mask ? ', masked pins = 0' : ''}).`; paint(); };
  inp.addEventListener('input', showV);
  function paint() {
    const L = lv(); g.innerHTML = '';
    const add = (cls, h) => { const d = el('div', { class: cls }, h); g.appendChild(d); return d; };
    const cell = (r, bitv, b) => add('gc' + (bitv === 1 ? ' one' : '') + (row === r && (chg >> b) & 1 ? ' chg' : ''), bitv);
    add('gl', ''); for (let b = 7; b >= 0; b--) add('gh', 'P0.' + b);
    add('gl', 'FIODIR'); for (let b = 7; b >= 0; b--) cell('dir', (dir >> b) & 1, b);
    add('gl', 'FIOMASK'); for (let b = 7; b >= 0; b--) cell('mask', (mask >> b) & 1, b);
    add('gl', 'pin'); for (let b = 7; b >= 0; b--) {
      const p = add('gp' + (row === 'pin' && (chg >> b) & 1 ? ' chg' : ''), '');
      if ((dir >> b) & 1) p.innerHTML = `<span class="led${(L >> b) & 1 ? ' on' : ''}"></span><small>out</small>`;
      else { const k = el('button', { class: 'gin' + ((ext >> b) & 1 ? ' on' : ''), type: 'button', title: 'input: click to change what the outside world puts here', 'aria-label': 'input P0.' + b }, (ext >> b) & 1); k.onclick = () => { ext ^= 1 << b; rd = null; row = ''; say.innerHTML = `outside world: P0.${b} is now ${(ext >> b) & 1 ? 'HIGH' : 'LOW'} (it's an input, so only the outside can change it).`; paint(); }; p.append(k, el('small', {}, 'in')); }
    }
    add('gl', 'x = FIOPIN'); for (let b = 7; b >= 0; b--) cell('read', rd == null ? '·' : (rd >> b) & 1, b);
  }
  showV(); paint();
  say.innerHTML = 'P0.3–P0.0 are outputs (LEDs), P0.7–P0.4 inputs (click to flip them). Try <b>FIOSET = 0x04</b>, then <b>FIOPIN = 0x01</b> — spot the difference.';
});

/* ---------- PINSEL finder ---------- */
BUILD.push(function wPinsel() {
  const w = W('w-pinsel', 'PINSEL finder', 'pick a pin + function → register, bits, code');
  const KNOWN = { '1.28': { 3: 'MAT0.0 (timer 0 match out)' }, '1.18': { 3: 'CAP1.0 (timer 1 capture/count in)' }, '1.25': { 3: 'MAT1.1 (timer 1 match out)' }, '1.26': { 3: 'CAP0.0' }, '1.27': { 3: 'CAP0.1' }, '2.10': { 1: 'EINT0' }, '2.11': { 1: 'EINT1' }, '2.12': { 1: 'EINT2' }, '2.13': { 1: 'EINT3' }, '0.26': { 1: 'AD0.3', 2: 'AOUT (DAC output)' }, '0.23': { 1: 'AD0.0' }, '1.30': { 3: 'AD0.4' }, '1.31': { 3: 'AD0.5' }, '0.2': { 1: 'TXD0 (UART0)' }, '0.3': { 1: 'RXD0 (UART0)' }, '1.23': { 2: 'PWM1.4' } };
  let port = 1, pin = 28, fn = 3;
  const top = el('div', { class: 'row' }); w.appendChild(top);
  const pc = el('div', { class: 'col' }); top.appendChild(pc); pc.appendChild(el('span', { class: 'gae' }, 'port'));
  const pg = chipGroup(pc, [[0, 'P0'], [1, 'P1'], [2, 'P2']], port, v => { port = +v; upd(); });
  const pr = ruler(top, 'pin number', 0, 31, pin, 1, v => 'P' + port + '.' + v, v => { pin = v; upd(); });
  const fc = el('div', { class: 'col' }); top.appendChild(fc); fc.appendChild(el('span', { class: 'gae' }, 'function'));
  const fg = chipGroup(fc, [[0, '00 GPIO'], [1, '01 fn 1'], [2, '10 fn 2'], [3, '11 fn 3']], fn, v => { fn = +v; upd(); });
  const res = el('div', { class: 'mt' }); w.appendChild(res);
  const head = el('div', { class: 'say b' }); res.appendChild(head);
  const strip = RegStrip(res, { bits: 32, name: 'PINSEL' });
  const code = el('div', { class: 'row mt' }); res.appendChild(code);
  const q = el('div', { class: 'chips mt' }); w.appendChild(q);
  q.appendChild(el('span', { class: 'cav p-soft' }, 'pins used in these notes:'));
  [[1, 28, 3, 'P1.28 MAT0.0'], [1, 18, 3, 'P1.18 CAP1.0'], [1, 25, 3, 'P1.25 MAT1.1'], [1, 26, 3, 'P1.26 CAP0.0'], [1, 27, 3, 'P1.27 CAP0.1'], [2, 12, 1, 'P2.12 EINT2'], [0, 26, 2, 'P0.26 AOUT']].forEach(([a, b, c, t]) => { const x = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-g)' }, t); x.onclick = () => { port = a; pin = b; fn = c; pr.value = b; pr.dispatchEvent(new Event('input')); pg.set(a); fg.set(c); upd(); }; q.appendChild(x); });
  function upd() {
    const reg = port * 2 + (pin >= 16 ? 1 : 0), lo = 2 * (pin % 16), val = (fn << lo) >>> 0;
    const k = KNOWN[port + '.' + pin]; const nm = fn === 0 ? 'plain GPIO' : (k && k[fn]) ? k[fn] : `function ${fn}`;
    head.innerHTML = `P${port}.${pin} lives in <b>PINSEL${reg}</b>, bits <b>${lo + 1}:${lo}</b> → value <b>${bin(fn, 2)}</b> = ${nm}`;
    strip.el.querySelector('.rname').textContent = 'LPC_PINCON->PINSEL' + reg;
    strip.set(val, [{ lo, hi: lo + 1, color: 'var(--green)' }]);
    code.innerHTML = fn ? `<span class="ro">LPC_PINCON-&gt;PINSEL${reg} |= (${fn}&lt;&lt;${lo});</span><span class="ro">${fn}&lt;&lt;${lo} = ${hex(val)}</span>` : `<span class="ro">LPC_PINCON-&gt;PINSEL${reg} &amp;= ~(3&lt;&lt;${lo});</span><span class="cav p-soft">clear both bits → GPIO</span>`;
  }
  upd();
});

/* ---------- keypad scanner ---------- */
BUILD.push(function wScan() {
  const w = W('w-scan', 'keypad scanner', 'tap keys to hold them · slow the scan to watch');
  const wrap = el('div', { class: 'split scanwrap' }); w.appendChild(wrap);
  const left = el('div'), right = el('div', { class: 'col' }); wrap.append(left, right);
  const X = [250, 340, 430, 520], Y = [112, 182, 252, 322];
  const svg = sv('svg', { class: 'dg scan', viewBox: '0 0 580 440', role: 'img', 'aria-label': 'keypad matrix schematic' }); left.appendChild(svg);
  const R = rng(42);
  const g = sv('g', {}, svg);
  const colW = [], rowW = [], rowW0 = [], res = [], dio = [], colPin = [], rowPin = [], keys = [];
  // columns
  X.forEach((x, c) => {
    sv('text', { x, y: 16, 'text-anchor': 'middle', class: 'lbl' }, g).textContent = 'C' + (c + 1);
    sv('text', { x, y: 31, 'text-anchor': 'middle', class: 'mono' }, g).textContent = 'P1.' + (23 + c);
    colW[c] = sv('path', { d: Pen.line(x, 58, x, 372, R, .6), class: 'wire' }, g);
    const rg = sv('g', { class: 'res' }, g); res[c] = rg;
    sv('path', { d: `M${x} 372 l0 4 l-7 3 l14 5 l-14 5 l14 5 l-14 5 l7 3 l0 4`, class: 'ink' }, rg);
    sv('path', { d: `M${x - 11} 408 h22 M${x - 7} 413 h14 M${x - 3} 418 h6`, class: 'ink' }, rg);
    sv('text', { x: x + 12, y: 394, class: 'mono', style: 'font-size:10px' }, rg).textContent = '15k';
    const pg = sv('g', {}, g); colPin[c] = pg;
    sv('circle', { cx: x, cy: 46, r: 11, class: 'pinc' }, pg); sv('text', { x, y: 51, 'text-anchor': 'middle', class: 'mono pint' }, pg).textContent = '0';
  });
  sv('text', { x: 575, y: 436, 'text-anchor': 'end', class: 'lbl', style: 'font-size:13px;fill:var(--ink3)' }, g).textContent = '15 kΩ pull-downs';
  // rows
  Y.forEach((y, r) => {
    sv('text', { x: 6, y: y - 4, class: 'lbl' }, g).textContent = 'R' + (r + 1);
    sv('text', { x: 6, y: y + 11, class: 'mono' }, g).textContent = 'P2.' + (10 + r);
    const pg = sv('g', {}, g); rowPin[r] = pg;
    sv('circle', { cx: 104, cy: y, r: 11, class: 'pinc' }, pg); sv('text', { x: 104, y: y + 5, 'text-anchor': 'middle', class: 'mono pint' }, pg).textContent = '0';
    rowW0[r] = sv('path', { d: `M115 ${y} H140`, class: 'wire' }, g);
    rowW[r] = sv('path', { d: Pen.line(160, y, 562, y, R, .6), class: 'wire' }, g);
    const dg = sv('g', { class: 'dio' }, g); dio[r] = dg;
    sv('path', { d: `M140 ${y - 8} L140 ${y + 8} L158 ${y} Z M159.5 ${y - 9} V${y + 9}`, class: 'ink', style: 'fill:var(--card)' }, dg); // bar in the same path: a lone vertical line has a 0-width box and the wobble filter would hide it
    const by = sv('path', { d: `M140 ${y} H160`, class: 'wire bypass', style: 'display:none' }, g); dg._by = by;
  });
  sv('text', { x: 150, y: 352, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:12px;fill:var(--ink3)' }, g).textContent = 'diodes';
  // keys
  const spark = sv('g', { class: 'spark', style: 'display:none' }, svg);
  sv('path', { d: 'M0 -16 L-6 -2 L4 -2 L-3 16', style: 'fill:none;stroke:#ffb400;stroke-width:3.4;stroke-linejoin:round' }, spark);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const k = sv('g', { class: 'skey', transform: `translate(${X[c] - 34},${Y[r] - 26})`, tabindex: 0, role: 'button', 'aria-label': 'key ' + KEYLAB[r * 4 + c] }, svg);
    sv('rect', { x: -20, y: -15, width: 40, height: 30, rx: 8, class: 'kc' }, k);
    sv('text', { x: 0, y: 6, 'text-anchor': 'middle', class: 'kt' }, k).textContent = KEYLAB[r * 4 + c];
    sv('path', { d: 'M20 10 L34 26', class: 'lead' }, k);
    keys.push(k);
  }
  // right panel
  const hold = new Set(); let latch = true, pull = true, diodes = true, speed = 2, running = true, row = 0, acc = 0, last = -1, flick = 0;
  const now = el('div', { class: 'say' }); right.appendChild(now);
  const rb = miniBits(right, ['P2.13', 'P2.12', 'P2.11', 'P2.10'], 'rows we drive (outputs) · FIOPIN2 bits 13…10');
  const cb = miniBits(right, ['P1.26', 'P1.25', 'P1.24', 'P1.23'], 'columns we read (inputs) · FIOPIN1 bits 26…23');
  const kv = el('div', { class: 'kv' }); right.appendChild(kv);
  const segRow = el('div', { class: 'row' }); right.appendChild(segRow);
  const seg = SevenSeg(segRow); segRow.appendChild(el('div', { class: 'cav p-soft' }, 'Digit 1<br>shows the last key'));
  const ctl = el('div', { class: 'row' }); right.appendChild(ctl);
  ruler(ctl, 'scan speed', 0, 100, 30, 1, v => sp(v).toFixed(v < 30 ? 1 : 0) + ' rows/s', v => { speed = sp(v); });
  function sp(v) { return 0.4 * Math.pow(100, v / 100); }
  speed = sp(30);
  const bts = el('div', { class: 'row' }); right.appendChild(bts);
  const bRun = el('button', { class: 'btn sm y', type: 'button' }, '❚❚ pause'); const bStep = el('button', { class: 'btn sm', type: 'button' }, 'next row ▸'); const bClr = el('button', { class: 'btn sm g', type: 'button' }, 'release all');
  bts.append(bRun, bStep, bClr);
  bRun.onclick = () => { running = !running; bRun.textContent = running ? '❚❚ pause' : '▶ run'; };
  bStep.onclick = () => { running = false; bRun.textContent = '▶ run'; advance(); };
  bClr.onclick = () => { hold.clear(); paint(); };
  const tg = el('div', { class: 'chips' }); right.appendChild(tg);
  const mk = (lab, on, f) => { const c = el('button', { class: 'chip' + (on ? ' on' : ''), type: 'button', style: '--cc:var(--n-g)' }, lab); c.onclick = () => { c.classList.toggle('on'); f(c.classList.contains('on')); paint(); }; tg.appendChild(c); return c; };
  mk('✓ pull-down resistors', true, v => { pull = v; res.forEach(r => r.style.opacity = v ? 1 : .15); });
  mk('✓ diodes', true, v => { diodes = v; dio.forEach(d => { d.querySelectorAll('path').forEach(p => p.style.opacity = v ? 1 : .12); d._by.style.display = v ? 'none' : ''; }); });
  mk('tap = keep pressed', true, v => { latch = v; if (!v) { hold.clear(); paint(); } });
  const log = el('div', { class: 'scanlog' }); right.appendChild(log);
  keys.forEach((k, i) => {
    const dn = e => { e.preventDefault(); if (latch) hold.has(i) ? hold.delete(i) : hold.add(i); else hold.add(i); paint(); };
    const up = () => { if (!latch && hold.delete(i)) paint(); };
    k.addEventListener('pointerdown', dn); k.addEventListener('pointerup', up); k.addEventListener('pointerleave', up);
    k.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hold.has(i) ? hold.delete(i) : hold.add(i); paint(); } });
  });
  function readCols() {
    const out = [], shorts = [];
    for (let c = 0; c < 4; c++) {
      const rs = [0, 1, 2, 3].filter(r => hold.has(r * 4 + c));
      if (rs.includes(row)) {
        if (!diodes && rs.length > 1) { out[c] = null; shorts.push([c, rs]); } else out[c] = 1;
      } else if (!pull) { out[c] = (!diodes && rs.length) ? 0 : (Math.random() < .5 ? 1 : 0); }
      else out[c] = 0;
    }
    return { out, shorts };
  }
  let lastRead = null;
  function advance() { row = (row + 1) % 4; paint(true); }
  function paint(stepped) {
    const { out, shorts } = readCols(); lastRead = out;
    keys.forEach((k, i) => { k.classList.toggle('down', hold.has(i)); k.classList.toggle('rowon', Math.floor(i / 4) === row); });
    rowW.forEach((p, r) => { p.classList.toggle('hot', r === row); p.classList.toggle('cold', r !== row); rowW0[r].classList.toggle('hot', r === row); rowW0[r].classList.toggle('cold', r !== row); dio[r]._by.classList.toggle('hot', r === row); rowPin[r].classList.toggle('on', r === row); rowPin[r].querySelector('text').textContent = r === row ? 1 : 0; });
    colW.forEach((p, c) => { const v = out[c]; p.classList.toggle('hot', v === 1); p.classList.toggle('float', !pull && v !== 1); p.classList.toggle('cold', pull && v === 0); p.classList.toggle('short', v === null); colPin[c].classList.toggle('on', v === 1); colPin[c].querySelector('text').textContent = v === null ? '?' : v; });
    if (shorts.length) { const [c, rs] = shorts[0]; const other = rs.find(r => r !== row); spark.style.display = ''; spark.setAttribute('transform', `translate(${X[c] + 14},${(Y[row] + Y[other]) / 2})`); }
    else spark.style.display = 'none';
    rb.set([3, 2, 1, 0].map(r => r === row ? 1 : 0));
    cb.set([3, 2, 1, 0].map(c => out[c]));
    const t3 = out.reduce((a, b, c) => a | ((b === 1 ? 1 : 0) << (23 + c)), 0) >>> 0;
    const ones = out.map((b, c) => b === 1 ? c : -1).filter(c => c >= 0);
    let flag = t3 ? 1 : 0, colTxt = '–', key = null;
    if (ones.length === 1) { colTxt = ones[0]; key = row * 4 + ones[0]; }
    kv.innerHTML = `<span>row</span><span>${row} → temp = 1&lt;&lt;${10 + row} = ${hx(1 << (10 + row), 4)}</span><span>temp3</span><span>${hex(t3)}</span><span>flag, col</span><span>${flag}, ${colTxt}</span>`;
    if (shorts.length) { now.className = 'say r'; now.textContent = `⚡ short! R${row + 1} (HIGH) is joined to R${shorts[0][1].find(r => r !== row) + 1} (LOW) through column C${shorts[0][0] + 1}`; }
    else if (key !== null) { now.className = 'say g'; now.textContent = `row ${row} (R${row + 1}) HIGH → column ${ones[0]} (C${ones[0] + 1}) answers → key "${KEYLAB[key]}" (keycode ${row}×4+${ones[0]} = ${key})`; if (stepped !== false) { seg.set(SEVEN[key]); if (last !== key || stepped === true) addLog(`R${row + 1} → C${ones[0] + 1} → <b>${KEYLAB[key]}</b>`); last = key; } }
    else if (ones.length > 1) { now.className = 'say r'; now.textContent = `${ones.length} columns HIGH at once — ${!pull ? 'floating inputs = ghost keys!' : 'two keys in this row: no if() matches'}`; }
    else { now.className = 'say'; now.textContent = `row ${row} (R${row + 1}) HIGH → all columns 0 → nothing here, next row`; }
  }
  function addLog(h) { const d = el('div', {}, h); log.prepend(d); while (log.children.length > 4) log.lastChild.remove(); }
  const loop = Loop(svg, dt => { if (!pull && ++flick % 6 === 0) paint(false); if (!running) return; acc += dt * speed; if (acc >= 1) { acc = 0; advance(); } });
  loop.start(); paint(false);
});

/* ---------- segment painter ---------- */
BUILD.push(function wSeg() {
  const w = W('w-seg', 'segment painter', 'click bars to light them — or load a key');
  const wrap = el('div', { class: 'split' }); w.appendChild(wrap);
  const L = el('div', { class: 'center', style: 'display:flex;justify-content:center' }), Rt = el('div', { class: 'col' }); wrap.append(L, Rt);
  const s = sv('svg', { class: 'dg segp', viewBox: '-16 -10 120 132', style: 'max-width:250px' }); L.appendChild(s);
  sv('rect', { x: -6, y: -4, width: 100, height: 120, rx: 10, style: 'fill:#26232b;stroke:var(--ink);stroke-width:1.6' }, s);
  const g = sv('g', { transform: 'translate(12 4) skewX(-6)' }, s);
  const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']; let code = 0x3F;
  const P = {}; const LBL = { a: [33, 24], b: [44, 36], c: [44, 78], d: [33, 88], e: [18, 78], f: [18, 36], g: [33, 66], dp: [64, 84] };
  order.forEach((k, i) => {
    const p = k === 'dp' ? sv('circle', { cx: 64, cy: 95, r: 4.6, class: 'sp' }, g) : sv('polygon', { points: SEG_POLY[k], class: 'sp' }, g);
    p.addEventListener('click', () => { code ^= 1 << i; upd(); }); P[k] = p;
    sv('text', { x: LBL[k][0], y: LBL[k][1], 'text-anchor': 'middle', class: 'segl' }, g).textContent = k;
  });
  const bitsRow = el('div', { class: 'segbits' }); Rt.appendChild(bitsRow);
  const cells = [];
  for (let b = 7; b >= 0; b--) { const c = el('button', { class: 'sbit', type: 'button' }, `<small>${order[b]}</small><i>0</i><em>bit ${b}</em>`); c.onclick = () => { code ^= 1 << b; upd(); }; bitsRow.appendChild(c); cells[b] = c; }
  const outR = el('div', { class: 'row' }); Rt.appendChild(outR);
  const ho = el('span', { class: 'ro big' }), po = el('span', { class: 'ro' }); outR.append(el('span', { class: 'gae' }, 'code ='), ho, po);
  const what = el('div', { class: 'say' }); Rt.appendChild(what);
  const ch = el('div', { class: 'chips' }); Rt.appendChild(ch);
  ch.appendChild(el('span', { class: 'cav p-soft' }, 'SEVEN_CODE:'));
  KEYLAB.forEach((k, i) => { const b = el('button', { class: 'chip', type: 'button' }, k); b.onclick = () => { code = SEVEN[i]; upd(); }; ch.appendChild(b); });
  const clr = el('button', { class: 'chip', type: 'button' }, 'clear'); clr.onclick = () => { code = 0; upd(); }; ch.appendChild(clr);
  function upd() {
    order.forEach((k, i) => P[k].classList.toggle('on', !!((code >> i) & 1)));
    for (let b = 0; b < 8; b++) { const on = (code >> b) & 1; cells[b].querySelector('i').textContent = on; cells[b].classList.toggle('one', !!on); }
    ho.textContent = hx(code, 2); po.innerHTML = `code&lt;&lt;4 = ${hx(code << 4, 3)} → P0.11…P0.4`;
    const k = SEVEN.indexOf(code);
    what.innerHTML = k >= 0 ? `that's <b>"${KEYLAB[k]}"</b> = SEVEN_CODE[${k >> 2}][${k & 3}] (key ${k})` : code ? 'not one of the 16 key shapes — your own drawing ✿' : 'all segments off';
  }
  upd();
});

/* ---------- FIOMASK stencil ---------- */
BUILD.push(function wMask() {
  const w = W('w-mask', 'FIOMASK = a stencil', 'run the 4 lines from the slide, in order');
  const N = 20; // show bits 19..0
  const grid = el('div', { class: 'stencil' }); w.appendChild(grid);
  const mk = (lab, cls) => { const r = el('div', { class: 'srow ' + cls }); r.appendChild(el('div', { class: 'sl' }, lab)); const cs = []; for (let b = N - 1; b >= 0; b--) { const c = el('div', { class: 'sc' + (b === 18 || b === 15 || b === 11 || b === 4 ? ' edge' : '') }, '<i></i>'); r.appendChild(c); cs[b] = c; } grid.appendChild(r); return cs; };
  const nums = el('div', { class: 'srow nums' }); nums.appendChild(el('div', { class: 'sl' }, 'bit')); for (let b = N - 1; b >= 0; b--) nums.appendChild(el('div', { class: 'sc' + (b >= 15 && b <= 18 ? ' gdec' : b >= 4 && b <= 11 ? ' gseg' : '') }, String(b))); grid.appendChild(nums);
  const maskC = mk('FIOMASK', 'mask'), valC = mk('FIOPIN = …', 'val'), portC = mk('port 0 pins', 'port');
  const brace = el('div', { class: 'srow nums' }); brace.appendChild(el('div', { class: 'sl' }, '')); grid.appendChild(brace);
  for (let b = N - 1; b >= 0; b--) brace.appendChild(el('div', { class: 'sc tiny' }, b >= 15 && b <= 18 ? (b === 17 ? 'decoder' : '') : (b >= 4 && b <= 11 ? (b === 8 ? 'segments' : '') : '')));
  let mask = 0, val = null, port = 0b10110000101101010110, use = true;
  const digRow = el('div', { class: 'row mt', style: 'align-items:flex-end' }); w.appendChild(digRow);
  const digs = []; [3, 2, 1, 0].forEach(i => { const d = el('div', { class: 'col center' }); digRow.appendChild(d); digs[i] = mkDig(d, i); }); function mkDig(d, i) { const s = SevenSeg(d); d.appendChild(el('span', { class: 'gae small' }, 'Digit ' + (i + 1) + (i === 0 ? ' (Y0)' : ''))); return { d, s }; }
  const dsay = el('div', { class: 'say' }); digRow.appendChild(dsay);
  const btns = el('div', { class: 'row mt' }); w.appendChild(btns);
  const key = { v: 6 };
  const steps = [
    ['① FIOMASK = 0xFFF87FFF', () => { mask = 0xFFF87FFF; val = null; return 'Holes only at bits 15–18 (the decoder lines). Everything else is protected.'; }],
    ['② FIOPIN = FIRST_SEG', () => { val = 0xFFF87FFF; writeV(); return 'FIRST_SEG has 0000 at bits 15–18 → only those fall through the holes → decoder gets 0 → Digit 1 selected.'; }],
    ['③ FIOMASK = 0xFFFFF00F', () => { mask = 0xFFFFF00F; val = null; return 'Now the holes are at bits 4–11 (the segment lines). The decoder bits are protected.'; }],
    ['④ FIOPIN = temp2', () => { val = (SEVEN[key.v] << 4) >>> 0; writeV(); return `temp2 = SEVEN_CODE<<4 = ${hx(val, 3)} → only bits 4–11 change → "${KEYLAB[key.v]}" lights on Digit 1, decoder untouched.`; }]
  ];
  const note = el('div', { class: 'say' });
  steps.forEach(([lab, f]) => { const b = el('button', { class: 'btn sm', type: 'button' }, lab); b.onclick = () => { note.textContent = f(); paint(true); }; btns.appendChild(b); });
  const b0 = el('button', { class: 'btn sm g', type: 'button' }, '⟲ messy port'); b0.onclick = () => { port = (Math.random() * (1 << 20)) >>> 0; mask = 0; val = null; note.textContent = 'Port 0 now holds random old values.'; paint(); }; btns.appendChild(b0);
  w.appendChild(note);
  const opt = el('div', { class: 'row' }); w.appendChild(opt);
  const kc = el('div', { class: 'chips' }); opt.appendChild(kc); kc.appendChild(el('span', { class: 'cav p-soft' }, 'key for step ④:'));
  [0, 3, 6, 10, 15].forEach(i => { const b = el('button', { class: 'chip' + (i === 6 ? ' on' : ''), type: 'button' }, KEYLAB[i]); b.onclick = () => { $$('.chip', kc).forEach(x => x.classList.remove('on')); b.classList.add('on'); key.v = i; }; kc.appendChild(b); });
  const nm = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-p)' }, '✗ pretend there is no mask'); nm.onclick = () => { nm.classList.toggle('on'); use = !nm.classList.contains('on'); paint(); }; opt.appendChild(nm);
  function writeV() { const m = use ? mask : 0; const keep = m & ((1 << N) - 1); port = ((port & keep) | (val & ~keep)) & ((1 << N) - 1); }
  function paint(anim) {
    const m = use ? mask : 0;
    for (let b = 0; b < N; b++) {
      const hole = !((m >>> b) & 1);
      maskC[b].className = 'sc' + (hole ? ' hole' : ' solid'); maskC[b].firstChild.textContent = (m >>> b) & 1;
      valC[b].className = 'sc' + (val === null ? ' empty' : '') + (val !== null && anim ? (hole ? ' fall' : ' blocked') : '');
      valC[b].firstChild.textContent = val === null ? '' : (val >>> b) & 1;
      const pb = (port >>> b) & 1; portC[b].className = 'sc' + (pb ? ' one' : '') + (val !== null && anim && hole ? ' got' : ''); portC[b].firstChild.textContent = pb;
    }
    const dec = (port >>> 15) & 0xF, segc = (port >>> 4) & 0xFF;
    digs.forEach((d, i) => { d.s.set(dec === i ? segc : 0); d.d.classList.toggle('sel', dec === i); });
    dsay.innerHTML = dec < 4 ? `decoder input = ${dec} → <b>Digit ${dec + 1}</b> on` : `decoder input = ${dec} → no digit selected`;
  }
  paint();
});

/* ---------- keyboard program stepper ---------- */
const KB_CODE = `#include <LPC17xx.h>
#define FIRST_SEG 0xFFF87FFF
void scan(void);
unsigned char col,row,flag;
unsigned long int i,var1,temp,temp3,temp2;
unsigned char SEVEN_CODE[4][4] = {0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F,0x77,0x7c,0x58,0x5e,0x79,0x71};
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    LPC_PINCON->PINSEL0 = 0;        //P0.4 to P0.11 GPIO data lines
    LPC_GPIO0->FIODIR = 0xFFFFFFFF; //Port 0 output
    LPC_PINCON->PINSEL3 = 0;        //P1.23 to P1.26 MADE GPIO
    LPC_PINCON->PINSEL4 = 0;        //P2.10 t P2.13 made GPIO
    LPC_GPIO2->FIODIR = 0x00003C00; //made output P2.10 to P2.13 (rows)
    LPC_GPIO1->FIODIR = 0;          //made input P1.23 to P1.26 (cols)
    while(1)
    {
        for(row=0;row<4;row++)
        {
            if(row == 0)
                temp = 1<<10;
            else if(row == 1)
                temp = 1<<11;
            else if(row == 2)
                temp = 1<<12;
            else if(row == 3)
                temp = 1<<13;
            LPC_GPIO2->FIOPIN = temp;
            flag = 0;
            scan();
            if(flag == 1)
            {
                temp2 = SEVEN_CODE[row][col];
                LPC_GPIO0->FIOMASK = 0xFFF87FFF;
                LPC_GPIO0->FIOPIN = FIRST_SEG;
                temp2 = temp2 << 4;
                LPC_GPIO0->FIOMASK = 0xFFFFF00F;
                LPC_GPIO0->FIOPIN = temp2;  // Taking Data Lines for 7-Seg
                break;
            }
        } //end for(row=1;row<5;row++)
    }//end while 1
}//end main
void scan(void)
{
    unsigned long temp3;
    temp3 = LPC_GPIO1->FIOPIN;
    temp3 &= 0x07800000;
    if(temp3 != 0x00000000)
    {
        flag = 1;
        if (temp3 == 1<<23)
            col=0;
        else if (temp3 == 1<<24)
            col=1;
        else if (temp3 == 1<<25)
            col=2;
        else if (temp3 == 1<<25)  //~ bug! should be 1<<26
            col=3;
    }//1st if(temp3 != 0x00000000)
}//end scan`;
BUILD.push(function wKbProg() {
  const w = W('w-kbprog', 'walk through the keypad program', 'choose the key you are holding');
  const pick = el('div', { class: 'chips mb' }); w.appendChild(pick);
  pick.appendChild(el('span', { class: 'cav p-soft' }, 'I am holding:'));
  const host = el('div'); w.appendChild(host);
  const Lc = t => lineOf(KB_CODE, t);
  const rowIf = r => [Lc(`if(row == ${r})`) || Lc(`else if(row == ${r})`), Lc(`temp = 1<<${10 + r}`)];
  function build(k) {
    const S = []; const kr = k < 0 ? 9 : k >> 2, kc = k < 0 ? -1 : k & 3;
    S.push({ l: [Lc('SystemInit'), Lc('SystemCoreClockUpdate')], t: 'Start-up: set up the clock system. (Every program starts like this.)', f: s => { s.ph = 'init'; } });
    S.push({ l: Lc('PINSEL0 = 0'), t: 'P0.0–P0.15 → GPIO. That includes the segment lines <b>P0.4–P0.11</b> and decoder line P0.15.' });
    S.push({ l: Lc('FIODIR = 0xFFFFFFFF'), t: 'Port 0 = all <b>outputs</b> (segments + decoder).', f: s => { s.dir0 = 1; } });
    S.push({ l: Lc('PINSEL3 = 0'), t: 'P1.16–P1.31 → GPIO: includes the <b>column</b> pins P1.23–P1.26.' });
    S.push({ l: Lc('PINSEL4 = 0'), t: 'P2.0–P2.15 → GPIO: includes the <b>row</b> pins P2.10–P2.13.' });
    S.push({ l: Lc('0x00003C00'), t: '0x3C00 = bits 13, 12, 11, 10 → the 4 row pins become <b>outputs</b>.', f: s => { s.dir2 = 1; } });
    S.push({ l: Lc('FIODIR = 0;'), t: 'Port 1 all <b>inputs</b> → we can read the columns.', f: s => { s.dir1 = 1; } });
    const last = k < 0 ? 3 : kr;
    for (let r = 0; r <= last; r++) {
      S.push({ l: [Lc('for(row=0')].concat(rowIf(r)), t: `row = ${r} → temp = 1&lt;&lt;${10 + r} = <b>${hx(1 << (10 + r), 4)}</b>`, f: s => { s.row = r; s.temp = 1 << (10 + r); s.flag = null; s.t3 = null; } });
      S.push({ l: Lc('FIOPIN = temp;'), t: `Row ${r + 1} (P2.${10 + r}) goes <span class="p-red">HIGH</span>, the other 3 rows LOW.`, f: s => { s.drive = r; } });
      const hit = r === kr;
      const t3 = hit ? (1 << (23 + kc)) >>> 0 : 0;
      S.push({ l: [Lc('flag = 0;'), Lc('scan();'), Lc('temp3 = LPC_GPIO1->FIOPIN'), Lc('temp3 &= 0x07800000')], t: `flag = 0, call scan(): read port 1 and keep bits 23–26 → temp3 = <b>${hex(t3)}</b>${hit ? ` (column ${kc} is HIGH through the pressed key!)` : ''}`, f: s => { s.flag = 0; s.t3 = t3; } });
      if (!hit) S.push({ l: [Lc('if(temp3 != 0x00000000)'), Lc('if(flag == 1)')], t: 'temp3 = 0 → skip; back in main flag is still 0 → no key in this row → next row.' });
      else {
        const bug = kc === 3;
        const colLines = bug ? [Lc('flag = 1;'), Lc('else if (temp3 == 1<<25)', 2)] : [Lc('flag = 1;'), Lc(`temp3 == 1<<${23 + kc}`), Lc(`col=${kc}`)];
        S.push({ l: colLines, t: bug ? `flag = 1. temp3 = 1&lt;&lt;26 but the last test checks <b>1&lt;&lt;25 again</b> → nothing matches → <span class="p-red">col keeps its old value (0)</span>!` : `flag = 1 and temp3 == 1&lt;&lt;${23 + kc} → <b>col = ${kc}</b>.`, f: s => { s.flag = 1; s.col = bug ? (s.col ?? 0) : kc; } });
        S.push({ l: [Lc('if(flag == 1)'), Lc('temp2 = SEVEN_CODE[row][col]')], t: bug ? `temp2 = SEVEN_CODE[${r}][0] = ${hx(SEVEN[r * 4], 2)} — the shape of "${KEYLAB[r * 4]}", not "${KEYLAB[k]}" ✗` : `Back in main: flag == 1 → temp2 = SEVEN_CODE[${r}][${kc}] = <b>${hx(SEVEN[k], 2)}</b> (shape of "${KEYLAB[k]}").`, f: s => { s.t2 = SEVEN[r * 4 + (s.col ?? 0)]; } });
        S.push({ l: [Lc('FIOMASK = 0xFFF87FFF'), Lc('FIOPIN = FIRST_SEG')], t: 'Mask allows only bits 15–18 → they become 0000 → decoder output Y0 → <b>Digit 1 selected</b>.', f: s => { s.sel = 1; s.mask = 0xFFF87FFF; } });
        S.push({ l: Lc('temp2 = temp2 << 4'), t: `${hx(SEVEN[r * 4 + (bug ? 0 : kc)], 2)} → <b>${hx(SEVEN[r * 4 + (bug ? 0 : kc)] << 4, 3)}</b>: segment a now lines up with P0.4.`, f: s => { s.t2 = s.t2 << 4; } });
        S.push({ l: [Lc('FIOMASK = 0xFFFFF00F'), Lc('FIOPIN = temp2')], t: 'Mask allows only bits 4–11 → the segment lines take the code → the digit lights up!', f: s => { s.mask = 0xFFFFF00F; s.show = s.t2 >> 4; } });
        S.push({ l: Lc('break;'), t: 'break out of the for loop → while(1) starts again from row 0 → keeps scanning (thousands of times a second).' });
      }
    }
    if (k < 0) S.push({ l: [Lc('} //end for'), Lc('}//end while')], t: 'No key in any row → the for loop ends, while(1) starts it again. The display keeps the last key.' });
    return S;
  }
  const view = (s, v, i, first) => {
    if (first) {
      v.innerHTML = '';
      const top = el('div', { class: 'row' }); v.appendChild(top);
      v._kp = el('div', { class: 'kmini' }); top.appendChild(v._kp);
      for (let i2 = 0; i2 < 16; i2++) v._kp.appendChild(el('span', {}, KEYLAB[i2]));
      const sg = el('div', { class: 'col center' }); top.appendChild(sg); v._seg = SevenSeg(sg); sg.appendChild(el('span', { class: 'gae small' }, 'Digit 1'));
      v._rb = miniBits(v, ['13', '12', '11', '10'], 'FIOPIN2 rows (P2.13…10)');
      v._cb = miniBits(v, ['26', '25', '24', '23'], 'temp3 cols (P1.26…23)');
      v._kv = el('div', { class: 'kv' }); v.appendChild(v._kv);
    }
    $$('span', v._kp).forEach((x, j) => { x.classList.toggle('held', j === cur); x.classList.toggle('rowon', s.drive != null && (j >> 2) === s.drive); });
    v._rb.set([3, 2, 1, 0].map(r => s.drive == null ? 0 : (r === s.drive ? 1 : 0)));
    v._cb.set([3, 2, 1, 0].map(c => s.t3 == null ? 0 : ((s.t3 >>> (23 + c)) & 1)));
    v._seg.set(s.show ?? 0);
    v._kv.innerHTML = `<span>row</span><span>${s.row ?? '–'}</span><span>temp</span><span>${s.temp != null ? hx(s.temp, 4) : '–'}</span><span>flag / col</span><span>${s.flag ?? '–'} / ${s.col ?? '–'}</span><span>temp2</span><span>${s.t2 != null ? hx(s.t2, 3) : '–'}</span><span>FIOMASK</span><span>${s.mask != null ? hex(s.mask) : '–'}</span>`;
  };
  let cur = 6;
  const st = Stepper(host, { code: KB_CODE, title: 'keypad.c', steps: build(cur), init: () => ({ col: 0 }), view });
  const items = [[-1, 'no key']].concat(KEYLAB.map((k, i) => [i, k]));
  chipGroup(pick, items, cur, v => { cur = +v; st.setSteps(build(cur), 7); });
});
