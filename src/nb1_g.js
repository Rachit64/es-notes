/* =========================================================
   NOTEBOOK 1 · part G — M1: the key-press conveyor (chapter 1)
   ========================================================= */
BUILD.push(function wM1() {
  const w = MW('w-m1', 'key-press conveyor', 'hold a key in the matrix · the scan loop carries it to the display');
  const KL = KEYLAB, held = new Set([6]);
  let row = 0, colVar = 0, stn = 0, acc = 0, dur = 1.0, run = true, pull = true, diodes = true, bug = false;
  let pass = null, last = null; // pass = this row's trip, last = last trip that found a key (the display keeps it)

  /* ---------- controls ---------- */
  const ctl = el('div', { class: 'm1ctl' }); w.appendChild(ctl);
  const sc = el('div', { class: 'chips' }); ctl.appendChild(sc);
  sc.appendChild(el('span', { class: 'cav p-soft' }, 'hold:'));
  [['6', [6]], ['7 (column 3)', [7]], ['5 + 7 (same row)', [5, 7]], ['2 + 6 (same column)', [2, 6]], ['F', [15]], ['nothing', []]].forEach(([t, ks]) => { const c = el('button', { class: 'chip', type: 'button' }, t); c.onclick = () => { held.clear(); ks.forEach(k => held.add(k)); paintAll(); }; sc.appendChild(c); });
  const fc = el('div', { class: 'chips' }); ctl.appendChild(fc);
  fc.appendChild(el('span', { class: 'cav p-soft' }, 'faults:'));
  const tgl = (t, f) => { const c = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-p)' }, t); c.onclick = () => { c.classList.toggle('on'); f(c.classList.contains('on')); paintAll(); }; fc.appendChild(c); return c; };
  tgl('✗ remove pull-downs', v => pull = !v); tgl('✗ remove diodes', v => diodes = !v); tgl('✗ slide bug (1<<25 twice)', v => bug = v);
  const rc = el('div', { class: 'row', style: 'gap:8px 14px' }); ctl.appendChild(rc);
  ruler(rc, 'conveyor speed', 1, 10, 4, 1, v => ['', 'crawl', 'slow', 'slow', 'normal', 'normal', 'quick', 'quick', 'fast', 'fast', 'scan!'][v], v => { dur = 2.4 / Math.pow(1.45, v - 1); });
  dur = 2.4 / Math.pow(1.45, 3);
  const bP = el('button', { class: 'btn sm y', type: 'button' }, '❚❚ pause'), bS = el('button', { class: 'btn sm', type: 'button' }, 'next station ▸');
  rc.append(bP, bS);
  bP.onclick = () => { run = !run; bP.textContent = run ? '❚❚ pause' : '▶ run'; };
  bS.onclick = () => { run = false; bP.textContent = '▶ run'; advance(); };

  /* ---------- the stations ---------- */
  const grid = el('div', { class: 'm1grid' }); w.appendChild(grid);
  const belt = sv('svg', { class: 'm1belt', 'aria-hidden': 'true' }); grid.appendChild(belt);
  const tok = el('div', { class: 'm1tok' }, 'row 0'); grid.appendChild(tok);
  const ticker = el('div', { class: 'm1tick mbox' }); w.appendChild(ticker);
  const STN = [];
  function station(name, sticker, hue) {
    const c = el('div', { class: 'm1st', style: `--sh:var(${hue})` });
    c.innerHTML = `<div class="m1h"><i>${STN.length + 1}</i><span>${name}</span>${sticker ? `<svg class="m1stk"><use href="#${sticker}"/></svg>` : ''}</div>`;
    const body = el('div', { class: 'm1b' }), val = el('div', { class: 'm1v' }); c.append(body, val); grid.appendChild(c);
    const o = { c, body, val }; STN.push(o); return o;
  }
  // 1 row driver
  const s0 = station('row driver', 'st-bolt', '--n-p');
  const rLamps = [0, 1, 2, 3].map(r => { const d = el('div', { class: 'm1lamp' }, `<span class="led"></span><small>R${r + 1}<br>P2.${10 + r}</small>`); s0.body.appendChild(d); return d; });
  s0.body.classList.add('m1lamps');
  // 2 matrix (also the keypad you tap)
  const s1 = station('keypad matrix', 'st-keypad', '--n-p');
  const mx = sv('svg', { class: 'dg m1mx', viewBox: '0 0 176 150', role: 'group', 'aria-label': '4 by 4 key matrix — tap keys to hold them' }); s1.body.appendChild(mx);
  const MX = c => 34 + c * 38, MY = r => 22 + r * 34, Rr = rng(7);
  const rowW = [0, 1, 2, 3].map(r => sv('path', { d: Pen.line(4, MY(r), 172, MY(r), Rr, .5), class: 'mw' }, mx));
  const colW = [0, 1, 2, 3].map(c => sv('path', { d: Pen.line(MX(c), 6, MX(c), 146, Rr, .5), class: 'mw' }, mx));
  const kb = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const k = r * 4 + c, g = sv('g', { class: 'm1k', tabindex: 0, role: 'button', 'aria-label': 'key ' + KL[k] }, mx);
    sv('rect', { x: MX(c) - 14, y: MY(r) - 12, width: 28, height: 24, rx: 6 }, g); const t = sv('text', { x: MX(c), y: MY(r) + 5, 'text-anchor': 'middle' }, g); t.textContent = KL[k];
    const tog = e => { e && e.preventDefault(); held.has(k) ? held.delete(k) : held.add(k); paintAll(); };
    g.addEventListener('click', tog); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') tog(e); }); kb[k] = g;
  }
  const spark = sv('text', { class: 'm1spark', 'text-anchor': 'middle', style: 'display:none' }, mx); spark.textContent = '⚡';
  // 3 column read
  const s2 = station('column read', 'st-meter', '--n-b');
  s2.body.classList.add('m1lamps');
  const cLamps = [3, 2, 1, 0].map(c => { const d = el('div', { class: 'm1lamp' }, `<span class="led b"></span><small>C${c + 1}<br>P1.${23 + c}</small>`); s2.body.appendChild(d); return d; }).reverse();
  const pdn = el('div', { class: 'm1note' }); s2.body.appendChild(pdn);
  // 4 scan()
  const s3 = station('scan()', 'st-q', '--n-b');
  const ifs = [0, 1, 2, 3].map(c => { const d = el('div', { class: 'm1if' }); s3.body.appendChild(d); return d; });
  // 5 keycode
  const s4 = station('keycode', 'st-sparkle', '--n-y');
  const kc = el('div', { class: 'm1big' }); s4.body.appendChild(kc);
  // 6 SEVEN_CODE
  const s5 = station('SEVEN_CODE[row][col]', 'st-gear', '--n-y');
  const tb = el('div', { class: 'm1tab' }); s5.body.appendChild(tb);
  const cells = SEVEN.map((v, i) => { const d = el('span', {}, `<b>${KL[i]}</b>${hx(v, 2).slice(2)}`); tb.appendChild(d); return d; });
  // 7 shift
  const s6 = station('temp2 << 4', 'st-wave', '--n-g');
  const sh = el('div', { class: 'm1sh' }); s6.body.appendChild(sh);
  // 8 FIOMASK
  const s7 = station('FIOMASK stencil', 'st-cam', '--n-g');
  const mk = el('div', { class: 'm1mk' }); s7.body.appendChild(mk);
  // 9 decoder + digits
  const s8 = station('decoder → Digit 1', 'st-check', '--n-l');
  const dg = el('div', { class: 'm1dg' }); s8.body.appendChild(dg);
  const digs = [3, 2, 1, 0].map(i => { const d = el('div', { class: 'col center' }); dg.appendChild(d); const s = SevenSeg(d); d.appendChild(el('small', {}, 'D' + (i + 1))); return { d, s, i }; });

  /* ---------- physics + the C logic ---------- */
  function readCols(r) {
    const bits = [], why = []; let short = false, ghost = false;
    for (let c = 0; c < 4; c++) {
      const rs = [0, 1, 2, 3].filter(q => held.has(q * 4 + c));
      if (rs.includes(r)) { if (!diodes && rs.length > 1) { short = true; bits[c] = Math.random() < .5 ? 1 : 0; why[c] = 'short'; } else { bits[c] = 1; why[c] = 'key'; } }
      else if (!pull) { if (!diodes && rs.length) { bits[c] = 0; why[c] = 'low'; } else { bits[c] = Math.random() < .5 ? 1 : 0; why[c] = 'float'; if (bits[c]) ghost = true; } }
      else { bits[c] = 0; why[c] = 'pd'; }
    }
    const t3 = bits.reduce((a, b, c) => a | (b << (23 + c)), 0) >>> 0;
    return { bits, why, short, ghost, t3 };
  }
  function newPass() { pass = { row, temp: 1 << (10 + row), cols: null }; }
  function enter(i) { // the token arrives at station i: work out its value
    const p = pass;
    if (i === 2) Object.assign(p, readCols(p.row));
    if (i === 3) {
      p.flag = p.t3 ? 1 : 0; p.hit = -1;
      const tests = [1 << 23, 1 << 24, 1 << 25, bug ? 1 << 25 : 1 << 26];
      if (p.flag) { for (let c = 0; c < 4; c++) if (p.t3 === tests[c] >>> 0) { p.hit = c; break; } if (p.hit >= 0) colVar = p.hit; }
      p.col = colVar;
    }
    if (i === 4) { p.key = p.row * 4 + p.col; p.real = [...held].filter(k => (k >> 2) === p.row); }
    if (i === 5) p.code = SEVEN[p.key];
    if (i === 6) p.t2 = p.code << 4;
    if (i === 8) last = Object.assign({}, p);
  }
  function advance() {
    if (!pass) newPass();
    if (stn === 3 && !pass.flag) { row = (row + 1) % 4; stn = 0; newPass(); enter(0); }
    else if (stn === 8) { row = 0; stn = 0; newPass(); enter(0); }
    else { stn++; enter(stn); }
    acc = 0; paintAll(); moveTok();
  }

  /* ---------- painting ---------- */
  const CODE = ['temp = 1<<(10+row);  LPC_GPIO2->FIOPIN = temp;', '/* hardware: a pressed key joins its row wire to its column wire */', 'temp3 = LPC_GPIO1->FIOPIN;  temp3 &= 0x07800000;', 'if(temp3 != 0) { flag = 1; if(temp3 == 1<<23) col=0; … }', '/* SEVEN_CODE[row][col] is entry 4*row + col of the 16 codes */', 'temp2 = SEVEN_CODE[row][col];', 'temp2 = temp2 << 4;', 'FIOMASK = 0xFFF87FFF; FIOPIN = FIRST_SEG; FIOMASK = 0xFFFFF00F; FIOPIN = temp2;', 'break;   // → while(1) scans again from row 0'];
  function paintAll() {
    if (!pass) { newPass(); enter(0); }
    const p = pass, L = last, reached = i => i <= stn;
    STN.forEach((s, i) => { s.c.classList.toggle('act', i === stn); s.c.classList.toggle('wait', i > stn && !(i >= 4 && L)); s.c.classList.remove('bad'); });
    // 1 row driver
    rLamps.forEach((d, r) => d.firstChild.classList.toggle('on', r === p.row));
    s0.val.innerHTML = `row = ${p.row} → temp = 1&lt;&lt;${10 + p.row} = <b>${hx(p.temp, 4)}</b>`;
    // 2 matrix
    rowW.forEach((e, r) => e.setAttribute('class', 'mw ' + (r === p.row ? 'hi' : 'lo')));
    const cr = reached(2) && p.bits ? p : null;
    colW.forEach((e, c) => { const live = held.has(p.row * 4 + c); e.setAttribute('class', 'mw ' + (live ? 'hi' : !pull ? 'fl' : 'lo')); });
    kb.forEach((g, k) => { g.classList.toggle('down', held.has(k)); g.classList.toggle('live', held.has(k) && (k >> 2) === p.row); });
    const shortCol = [0, 1, 2, 3].find(c => !diodes && [0, 1, 2, 3].filter(q => held.has(q * 4 + c)).length > 1 && held.has(p.row * 4 + c));
    spark.style.display = shortCol != null ? '' : 'none'; if (shortCol != null) { spark.setAttribute('x', MX(shortCol) + 14); spark.setAttribute('y', MY(p.row) + 22); }
    const inRow = [...held].filter(k => (k >> 2) === p.row);
    s1.val.innerHTML = inRow.length ? `R${p.row + 1} HIGH → key${inRow.length > 1 ? 's' : ''} <b>${inRow.map(k => KL[k]).join(' + ')}</b> pass${inRow.length > 1 ? '' : 'es'} it to C${inRow.map(k => (k & 3) + 1).join(' + C')}` : `R${p.row + 1} HIGH → no key held in this row`;
    if (shortCol != null) { s1.c.classList.add('bad'); s1.val.innerHTML = `⚡ short! R${p.row + 1} (HIGH) meets a LOW row through C${shortCol + 1} — no diodes`; }
    // 3 column read
    cLamps.forEach((d, c) => { const v = cr ? cr.bits[c] : 0, why = cr ? cr.why[c] : 'pd'; d.firstChild.classList.toggle('on', !!v); d.classList.toggle('fl', why === 'float' || why === 'short'); });
    pdn.innerHTML = pull ? '15 kΩ pull-downs hold idle columns at 0' : '<span class="p-red">no pull-downs: idle columns float → random bits!</span>';
    s2.val.innerHTML = cr ? `temp3 = <b>${hex(cr.t3)}</b>` : 'temp3 = …';
    if (cr && (cr.ghost || cr.short)) s2.c.classList.add('bad');
    // 4 scan()
    const tests = ['1<<23', '1<<24', '1<<25', bug ? '1<<25' : '1<<26'];
    ifs.forEach((d, c) => { d.innerHTML = `== ${tests[c]} → col=${c}`; d.className = 'm1if' + (bug && c === 3 ? ' bug' : '') + (reached(3) && p.hit === c ? ' hit' : ''); });
    s3.val.innerHTML = reached(3) && p.flag != null ? (p.flag ? `flag = 1 · col = <b>${p.col}</b>${p.hit < 0 ? ' <span class="p-red">(no test matched — old col kept!)</span>' : ''}` : 'temp3 = 0 → flag = 0 → <b>next row</b>') : 'flag = 0 …';
    if (reached(3) && p.flag && p.hit < 0) s3.c.classList.add('bad');
    // stations 5..9: this trip once the token got there, otherwise the last trip that found a key (the display keeps it)
    const src = i => (stn >= i ? p : L), q4 = src(4), q5 = src(5), q6 = src(6), q7 = src(7), q8 = src(8);
    kc.innerHTML = q4 && q4.key != null ? `4×${q4.row} + ${q4.col} = <b>${q4.key}</b><small>key "${KL[q4.key]}"</small>` : '—';
    let m4 = 'row + column → which key', bad4 = false;
    if (q4 && q4.key != null && q4.real) {
      if (!q4.real.length) { m4 = '<span class="p-red">ghost key — nothing is held in this row!</span>'; bad4 = true; }
      else if (q4.real.length > 1) { m4 = '<span class="p-red">two keys in one row → temp3 has 2 bits → wrong key</span>'; bad4 = true; }
      else if (q4.real[0] !== q4.key) { m4 = `<span class="p-red">but you hold "${KL[q4.real[0]]}"!</span>`; bad4 = true; }
    }
    s4.val.innerHTML = q4 && q4.key != null ? m4 : 'waiting for a key';
    if (q4 === p && bad4) s4.c.classList.add('bad');
    cells.forEach((d, i) => d.classList.toggle('on', !!q5 && q5.key === i));
    s5.val.innerHTML = q5 && q5.code != null ? `temp2 = <b>${hx(q5.code, 2)}</b> = ${bin(q5.code, 8)}` : 'temp2 = …';
    sh.innerHTML = !q6 || q6.t2 == null ? '<span class="p-faint">—</span>' : `<div>${bitsHtml(q6.code, 12)}<span>${hx(q6.code, 3)}</span></div><div class="m1arrow">↙ every bit moves 4 places left</div><div>${bitsHtml(q6.t2, 12, true)}<span>${hx(q6.t2, 3)}</span></div>`;
    s6.val.innerHTML = !q6 || q6.t2 == null ? 'temp2 &lt;&lt; 4 …' : 'bit 0 (segment a) now sits on <b>P0.4</b>';
    mk.innerHTML = `<div class="${q7 ? 'ok' : ''}">① FIOMASK = 0xFFF87FFF<br>&nbsp;&nbsp;FIOPIN = FIRST_SEG → <b>P0.15–18 = 0000</b></div><div class="${q7 ? 'ok' : ''}">② FIOMASK = 0xFFFFF00F<br>&nbsp;&nbsp;FIOPIN = temp2 → <b>P0.4–11 = ${q7 ? bin(q7.code, 8) : '…'}</b></div>`;
    s7.val.innerHTML = 'each write only changes the mask\'s 0-bits';
    const show = q8 ? q8.code : null;
    digs.forEach(d => { d.s.set(d.i === 0 && show != null ? show : 0); d.d.classList.toggle('sel', d.i === 0); });
    s8.val.innerHTML = show != null ? `decoder input 0 → Y0 → <b>Digit 1</b> shows "${KL[q8.key]}"${q8 !== p ? ' (kept from the last key found)' : ''}` : 'display still blank';
    ticker.innerHTML = `<span class="mlab">now: station ${stn + 1}</span> <span class="mcode">${hlC(CODE[stn])}</span>`;
    tok.textContent = [`row ${p.row}`, inRow.length ? `R${p.row + 1}→C${(inRow[0] & 3) + 1}` : 'no key', cr ? hx(cr.t3 >>> 23, 1) + '<<23' : '…', p.flag ? `col ${p.col}` : 'flag 0', `key ${p.key ?? ''}`, hx(p.code ?? 0, 2), hx(p.t2 ?? 0, 3), 'mask ✓', `"${KL[p.key ?? 0]}"`][stn];
  }
  const bitsHtml = (v, n, sh) => { let s = ''; for (let b = n - 1; b >= 0; b--) s += `<i class="${(v >> b) & 1 ? 'one' : ''}${sh && b < 4 ? ' new' : ''}${b === 3 || b === 7 ? ' nb' : ''}">${(v >> b) & 1}</i>`; return s; };

  /* ---------- the belt (arrows between stations) + token ---------- */
  let cols = 3;
  function layout() {
    const W = grid.clientWidth; cols = W > 820 ? 3 : 2;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0,1fr))`;
    STN.forEach((s, i) => { const r = Math.floor(i / cols); let c = i % cols; if (r % 2) c = cols - 1 - c; s.c.style.gridRow = r + 1; s.c.style.gridColumn = c + 1; s.c.dataset.dir = r % 2 ? 'l' : 'r'; });
    requestAnimationFrame(drawBelt);
  }
  function box(i) { const c = STN[i].c; return { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight }; }
  function drawBelt() {
    const W = grid.clientWidth, H = grid.clientHeight; belt.setAttribute('viewBox', `0 0 ${W} ${H}`); belt.style.width = W + 'px'; belt.style.height = H + 'px';
    const R = rng(3); let d = '';
    for (let i = 0; i < 8; i++) {
      const a = box(i), b = box(i + 1);
      if (Math.abs(a.y - b.y) < 4) { const y = a.y + 22, x1 = a.x < b.x ? a.x + a.w : a.x, x2 = a.x < b.x ? b.x : b.x + b.w, dir = x2 > x1 ? 1 : -1; d += Pen.line(x1 + 2 * dir, y, x2 - 3 * dir, y, R, .5) + `M${x2 - 3 * dir - 7 * dir} ${y - 5}L${x2 - 3 * dir} ${y}L${x2 - 3 * dir - 7 * dir} ${y + 5}`; }
      else { const x = a.x + a.w / 2, y1 = a.y + a.h, y2 = b.y; d += Pen.line(x, y1 + 2, x, y2 - 3, R, .5) + `M${x - 5} ${y2 - 10}L${x} ${y2 - 3}L${x + 5} ${y2 - 10}`; }
    }
    // the "no key → next row" loop from scan() back to the row driver
    const a = box(3), b = box(0); let rp;
    if (cols === 3) { const x0 = a.x + a.w - 30, y0 = a.y + a.h, yb = a.y + a.h + 14; rp = `M${x0} ${y0} V${yb} H${b.x - 12} V${b.y + 44} H${b.x - 2}`; }
    else { const x0 = a.x - 2, y0 = a.y + a.h - 26; rp = `M${x0} ${y0} H${a.x - 14} V${b.y + 44} H${b.x - 2}`; }
    const lab = cols === 3 ? `<text class="m1rett" x="${a.x + a.w - 34}" y="${a.y + a.h + 30}" text-anchor="end">flag = 0 → next row</text>` : `<text class="m1rett" x="${a.x - 18}" y="${(b.y + 44 + a.y + a.h - 26) / 2}" text-anchor="middle" transform="rotate(-90 ${a.x - 18} ${(b.y + 44 + a.y + a.h - 26) / 2})">flag = 0 → next row</text>`;
    belt.innerHTML = `<path d="${d}" class="m1arr"/><path d="${rp}" class="m1ret"/>${lab}`;
    moveTok(true);
  }
  function moveTok(now) { const b = box(stn); tok.style.transition = now ? 'none' : ''; tok.style.transitionDuration = now ? '' : Math.min(.45, dur * .7).toFixed(2) + 's'; grid.style.setProperty('--m1t', Math.min(.25, dur * .5).toFixed(2) + 's'); tok.style.left = (b.x + b.w - 8) + 'px'; tok.style.top = (b.y - 12) + 'px'; }
  let lastW = 0; new ResizeObserver(() => { const W = grid.clientWidth; if (W && W !== lastW) { lastW = W; layout(); } }).observe(w);

  const loop = Loop(w, dt => { if (!run) return; acc += dt; if (acc >= dur) advance(); });
  newPass(); enter(0); layout(); paintAll(); loop.start();
});
