/* =========================================================
   NOTEBOOK 1 · part J — M4: the LCD X-ray (chapter 4)
   ========================================================= */
BUILD.push(function wM4() {
  const w = MW('w-m4', 'LCD X-ray', 'power on · init (or forget to!) · type — follow every byte down to the pixels');
  const lcd = new HD44780(); // fresh power-on: 8-bit mode, display off
  const Q = []; let cur = null, ph = 0, nibDur = .9, run = true, hist = [], lastDesc = 'just powered on: 8-bit mode, display OFF, DDRAM full of spaces', lastByte = null, ddFlash = -1;
  const CMDS = [[0x01, 'clear'], [0x02, 'home'], [0x06, 'entry →'], [0x04, 'entry ←'], [0x0C, 'display on'], [0x0E, '+ cursor'], [0x0F, '+ blink'], [0x80, 'line 1'], [0xC0, 'line 2'], [0x10, 'cursor ←'], [0x14, 'cursor →'], [0x18, 'shift ←'], [0x1C, 'shift →'], [0x28, '4-bit, 2 lines'], [0x08, 'display off']];
  function queueByte(rs, x, src) { Q.push({ rs, nib: x >> 4, byte: x, half: 'high', src }); Q.push({ rs, nib: x & 15, byte: x, half: 'low', src }); }
  function queueInit() { [0x30, 0x30, 0x30, 0x20].forEach(c => Q.push({ rs: 0, nib: c >> 4, byte: c, half: 'only', src: 'init' })); [0x28, 0x0C, 0x06, 0x01, 0x80].forEach(c => queueByte(0, c, 'init')); }

  /* ---------- controls ---------- */
  const top = el('div', { class: 'm4top' }); w.appendChild(top);
  const r1 = el('div', { class: 'row' }); top.appendChild(r1);
  const bPow = el('button', { class: 'btn sm o', type: 'button' }, '⚡ power on (reset LCD)'), bInit = el('button', { class: 'btn sm p', type: 'button' }, '① send the init sequence'), bSkip = el('button', { class: 'btn sm', type: 'button' }, '⏭ finish the queue');
  r1.append(bPow, bInit, bSkip);
  const r2 = el('div', { class: 'row' }); top.appendChild(r2);
  const inp = el('input', { class: 'inp', value: 'Hi LPC!', maxlength: 24, 'aria-label': 'text to send as data', spellcheck: 'false' }); const bTx = el('button', { class: 'btn sm g', type: 'button' }, '② type it (RS = 1)');
  r2.append(el('span', { class: 'gae' }, 'text:'), inp, bTx);
  const r3 = el('div', { class: 'chips' }); top.appendChild(r3); r3.appendChild(el('span', { class: 'cav p-soft' }, 'commands (RS = 0):'));
  CMDS.forEach(([c, t]) => { const b = el('button', { class: 'chip mn', type: 'button' }, `${hx(c)} <small>${t}</small>`); b.onclick = () => { queueByte(0, c, 'cmd'); paint(); }; r3.appendChild(b); });
  const r4 = el('div', { class: 'row' }); top.appendChild(r4);
  ruler(r4, 'speed (one nibble)', 1, 10, 5, 1, v => (+(2.6 / Math.pow(1.38, v - 1)).toFixed(2)) + ' s', v => { nibDur = 2.6 / Math.pow(1.38, v - 1); });
  nibDur = 2.6 / Math.pow(1.38, 4);
  const bRun = el('button', { class: 'btn sm y', type: 'button' }, '❚❚ pause'); r4.appendChild(bRun);
  bRun.onclick = () => { run = !run; bRun.textContent = run ? '❚❚ pause' : '▶ run'; };
  bPow.onclick = () => { Q.length = 0; cur = null; lcd.powerOn(); hist = []; lastDesc = 'power on: 8-bit mode, 1 line, display OFF — it knows nothing about our 4-bit wiring yet'; lastByte = null; paint(); view.draw(); };
  bInit.onclick = () => { queueInit(); paint(); };
  bTx.onclick = () => { for (const ch of inp.value) queueByte(1, ch.charCodeAt(0) & 0xFF, 'text'); paint(); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') bTx.onclick(); });
  bSkip.onclick = () => { if (cur && !cur.latched) finishLatch(); cur = null; while (Q.length) { cur = Q.shift(); finishLatch(); cur = null; } paint(); view.draw(); };

  /* ---------- the six stages ---------- */
  const grid = el('div', { class: 'm4grid' }); w.appendChild(grid);
  const card = (cls, n, title, sub) => { const c = el('div', { class: 'm4c ' + cls }); c.innerHTML = `<div class="m4h"><i>${n}</i><b>${title}</b><small>${sub}</small></div>`; grid.appendChild(c); return c; };
  const cA = card('a', 1, 'lcd_write()', 'the byte · flag1 = RS · split in two'); const aBody = el('div', { class: 'm4byte' }); cA.appendChild(aBody); const qv = el('div', { class: 'm4q' }); cA.appendChild(qv);
  const cB = card('b', 2, 'port_write()', 'the nibble on P0.23–P0.28'); const pins = el('div', { class: 'm4pins' }); cB.appendChild(pins); const bTxt = el('div', { class: 'm4small' }); cB.appendChild(bTxt);
  const PN = [['EN', 'P0.28'], ['RS', 'P0.27'], ['D7', 'P0.26'], ['D6', 'P0.25'], ['D5', 'P0.24'], ['D4', 'P0.23']];
  const pinEl = PN.map(([n, p]) => { const d = el('div', { class: 'm4pin' }, `<span class="led"></span><b>${n}</b><small>${p}</small>`); pins.appendChild(d); return d; });
  const cC = card('c', 3, 'logic analyser', 'what the wires do · ▼ = EN falls → LCD latches'); const LA = sv('svg', { class: 'dg m4la', viewBox: '0 0 560 172' }); cC.appendChild(LA);
  const cD = card('d', 4, 'LCD controller', 'its own little brain'); const ctl = el('div', { class: 'm4ctl' }); cD.appendChild(ctl);
  const cF = card('f', 6, 'pixels', '5×8 dots per box, drawn from DDRAM'); const view = LCDView(cF, lcd); const fTxt = el('div', { class: 'm4small' }); cF.appendChild(fTxt);
  const cE = card('e', 5, 'DDRAM', 'the LCD\'s memory · frame = the 16 boxes you can see'); const dd = el('div', { class: 'm4dd' }); cE.appendChild(dd);
  const ddCells = [[], []];
  for (let r = 0; r < 2; r++) { const row = el('div', { class: 'm4ddr' }); dd.appendChild(row); row.appendChild(el('span', { class: 'm4ddl' }, r ? 'line 2' : 'line 1')); for (let c = 0; c < 40; c++) { const cell = el('span', { class: 'm4ddc' }, '<b></b><small></small>'); row.appendChild(cell); ddCells[r][c] = cell; } }

  /* ---------- running one nibble ---------- */
  function finishLatch() { // EN falls: the LCD takes the nibble
    const n = cur; n.latched = true; const before = lcd.bus8 ? '8-bit' : '4-bit'; let res;
    if (lcd.bus8) { const b = (n.nib & 15) << 4; res = { byte: b, w: 8 }; }
    else if (lcd.half === null) { lcd.half = n.nib & 15; res = { half: lcd.half }; }
    else { const b = (lcd.half << 4) | (n.nib & 15); lcd.half = null; res = { byte: b, w: 4 }; }
    if (res.byte != null) {
      const b = res.byte;
      if (n.rs) { const a = lcd.ac; lcd.data(b); ddFlash = a; lastDesc = `data ${hx(b)}${b >= 32 && b < 127 ? ` '${String.fromCharCode(b)}'` : ' (not a letter → junk box)'} stored at DDRAM ${hx(a)}, cursor → ${hx(lcd.ac)}`; }
      else lastDesc = (res.w === 8 ? `8-bit read: D7–D4 = ${bin(n.nib, 4)}, D3–D0 = 0000 (grounded) → ${hx(b)} → ` : '') + lcd.cmd(b);
      if (res.w === 8 && n.half !== 'only') lastDesc += ` <span class="p-red">— the LCD is still in 8-bit mode, so this ${n.half} nibble was taken as a whole byte!</span>`;
      lastByte = { b, rs: n.rs };
    } else lastDesc = `4-bit mode: high half ${hx(res.half, 1)} stored — waiting for the low half`;
    hist.push({ rs: n.rs, nib: n.nib, tag: res.half != null ? 'H' : res.w === 8 ? '8' : 'L', mode: before });
    if (hist.length > 14) hist.shift();
  }
  function step(dt) {
    if (!cur) { if (!Q.length) return; cur = Q.shift(); ph = 0; }
    const p0 = ph; ph += dt / nibDur;
    if (p0 < .68 && ph >= .68) { finishLatch(); view.draw(); }
    if (ph >= 1) { cur = null; ph = 0; }
    paint();
  }

  /* ---------- painting ---------- */
  function paint() {
    const n = cur, p = n ? ph : 1;
    // stage glow
    const act = !n ? -1 : p < .2 ? 0 : p < .42 ? 1 : p < .68 ? 2 : p < .8 ? 3 : 4;
    [cA, cB, cC, cD, cE, cF].forEach((c, i) => c.classList.toggle('act', act >= 0 && (i === act || (act === 3 && i === 3) || (act === 4 && i >= 4))));
    // A: the byte
    if (n) {
      const x = n.byte, hi = x >> 4, lo = x & 15, ch = n.rs && x >= 32 && x < 127 ? `'${String.fromCharCode(x)}'` : '';
      aBody.innerHTML = `<div class="m4bx"><span class="hx">${hx(x)}</span> ${ch}<span class="pill ${n.rs ? 'y' : 'l'}">${n.rs ? 'data · RS = 1' : 'command · RS = 0'}</span></div>
        <div class="m4nib"><span class="${n.half === 'low' ? '' : 'on'}">${bin(hi, 4)}<small>high</small></span><span class="${n.half === 'low' ? 'on' : n.half === 'only' ? 'skip' : ''}">${bin(lo, 4)}<small>${n.half === 'only' ? 'not sent (flag2 = 1)' : 'low'}</small></span></div>
        <div class="m4small">${n.half === 'only' ? 'init command: <b>flag2 = 1</b> → only the high nibble is sent' : `sending the <b>${n.half}</b> nibble: <code>temp2 = (temp1 &amp; ${n.half === 'high' ? '0xF0) &lt;&lt; 19' : '0x0F) &lt;&lt; 23'}</code>`}</div>`;
    } else aBody.innerHTML = `<div class="m4small">${Q.length ? 'next byte coming…' : 'idle — press <b>init</b>, type text or tap a command'}</div>`;
    qv.innerHTML = Q.filter(q => q.half !== 'low').slice(0, 9).map(q => `<span class="${q.rs ? 'd' : 'c'}">${q.rs && q.byte > 32 && q.byte < 127 ? esc(String.fromCharCode(q.byte)) : q.rs && q.byte === 32 ? '␣' : hx(q.byte)}</span>`).join('') + (Q.length ? ' <small>← queue</small>' : '');
    // B: pins
    const set = n && p >= .05, rsOn = n && p >= .25 ? n.rs : 0, en = n && p >= .42 && p < .68;
    const lv = [en ? 1 : 0, rsOn, ...[3, 2, 1, 0].map(b => set ? (n.nib >> b) & 1 : 0)];
    pinEl.forEach((d, i) => d.firstChild.classList.toggle('on', !!lv[i]));
    const t2 = n ? (n.half === 'low' ? (n.byte & 15) << 23 : (n.byte & 0xF0) << 19) >>> 0 : 0;
    bTxt.innerHTML = (n ? `<div class="m4t2">temp2 = <b>${hex(t2)}</b> → only bits 26–23 can be 1</div>` : '') + (!n ? 'all quiet' : p < .25 ? `<code>FIOPIN = temp2</code> → D7–D4 = <b>${bin(n.nib, 4)}</b> (RS, EN = 0)` : p < .42 ? `<code>${n.rs ? 'FIOSET' : 'FIOCLR'} = RS_CTRL</code> → RS = ${n.rs}` : p < .68 ? '<code>FIOSET = EN_CTRL</code> → EN HIGH …' : `<code>FIOCLR = EN_CTRL</code> → EN LOW: latched! then <code>delay_lcd(5000)</code>`);
    // C: analyser
    drawLA(n, p);
    // D: controller
    ctl.innerHTML = `<div class="row" style="gap:6px 10px"><span class="pill ${lcd.bus8 ? 'p' : 'g'}">${lcd.bus8 ? '8-bit interface' : '4-bit interface'}</span><span class="pill">${lcd.N ? '2 lines' : '1 line'}</span><span class="pill ${lcd.D ? 'y' : ''}">display ${lcd.D ? 'ON' : 'OFF'}</span></div>
      <div class="m4half">${lcd.bus8 ? 'reads D7–D0 in one go (D3–D0 are grounded = 0000)' : lcd.half === null ? 'waiting for a <b>high</b> half' : `holding high half <b>${hx(lcd.half, 1)}</b> — waiting for the low half`}</div>
      <div class="m4last">${lastDesc}</div>
      <div class="kv m4kv"><span>cursor (AC)</span><span><b>${hx(lcd.ac)}</b> → ${lcd.N ? `line ${lcd.ac >= 0x40 ? 2 : 1}, box ${(lcd.ac & 0x3F) + 1}` : 'box ' + (lcd.ac + 1)}</span><span>entry mode</span><span>I/D = ${lcd.id} (${lcd.id ? 'move right' : 'move left'}) · S = ${lcd.S}</span><span>D · C · B</span><span>${lcd.D} · ${lcd.C} · ${lcd.B}</span><span>display shift</span><span>${lcd.sh}</span></div>`;
    // E: DDRAM
    const base = lcd.N ? [0, 0x40] : [0, 40], vis = new Set();
    for (let l = 0; l < 2; l++) for (let c = 0; c < 16; c++) { const a = lcd.cell(l, c); if (a >= 0) vis.add(a); }
    for (let r = 0; r < 2; r++) for (let c = 0; c < 40; c++) { const a = base[r] + c, ch = lcd.dd[a], cell = ddCells[r][c]; cell.firstChild.textContent = ch === 32 ? '' : ch >= 32 && ch < 127 ? String.fromCharCode(ch) : '▯'; cell.lastChild.textContent = hx(a).slice(2); cell.className = 'm4ddc' + (vis.has(a) ? ' vis' : '') + (a === lcd.ac ? ' cur' : '') + (a === ddFlash ? ' new' : '') + (!lcd.N && r === 1 && !vis.has(a) ? ' n1' : ''); }
    fTxt.innerHTML = lcd.D ? 'the controller copies the framed DDRAM boxes onto the glass' : '<span class="p-red">display OFF (D = 0)</span> — DDRAM may hold text, but nothing is shown. Send 0x0C!';
  }
  function drawLA(n, p) {
    const X0 = 50, WW = 64, NW = laN, L = [['RS', 22], ['EN', 50], ['D7', 80], ['D6', 100], ['D5', 120], ['D4', 140]];
    let o = L.map(([t, y]) => `<text x="4" y="${y + 4}" class="lb">${t}</text>`).join('');
    const wins = hist.slice(Math.max(0, hist.length - (n ? NW - 1 : NW))).map(h => Object.assign({ done: 1 }, h));
    if (n) wins.push({ rs: n.rs, nib: n.nib, cur: 1, tag: '' });
    let prevRS = 0;
    wins.forEach((h, k) => {
      const x = X0 + k * WW, F = f => (x + f * WW).toFixed(1), q = h.cur ? p : 1;
      const tr = (yH, yL, pts) => { let d = `M${F(0)} ${pts[0][1] ? yH : yL}`; pts.slice(1).forEach(([f, v]) => { if (f <= q) d += `H${F(f)}V${v ? yH : yL}`; }); return d + `H${F(Math.min(q, 1))}`; };
      o += `<path d="${tr(14, 28, [[0, prevRS], [.05, 0], [.25, h.rs]])}" class="t rs"/>`;
      o += `<path d="${tr(42, 56, [[0, 0], [.42, 1], [.68, 0]])}" class="t en"/>`;
      [3, 2, 1, 0].forEach((b, i) => { const y = 80 + i * 20; o += `<path d="${tr(y - 7, y + 6, [[0, 0], [.05, (h.nib >> b) & 1]])}" class="t d"/>`; });
      if (q >= .68) o += `<text x="${F(.68)}" y="160" text-anchor="middle" class="lat">▼ ${hx(h.nib, 1).slice(2)}</text><path d="M${F(.68)} 36 V146" class="latl"/>`;
      if (h.tag) o += `<text x="${F(.5)}" y="9" text-anchor="middle" class="tag">${h.tag === 'H' ? 'high ½' : h.tag === 'L' ? 'low ½' : '8-bit'}</text>`;
      prevRS = h.rs;
    });
    if (!wins.length) o += `<text x="${X0 + 10}" y="84" class="tag" style="font-size:19px">no transfers yet — press ① init</text><text x="${X0 + 10}" y="108" class="tag" style="font-size:19px">and watch RS, EN, D7–D4 move</text>`;
    LA.innerHTML = o;
  }
  let laN = 7; widthWatch(w, 760, nr => { laN = nr ? 4 : 12; LA.setAttribute('viewBox', `0 0 ${56 + laN * 64} 172`); paint(); });
  const loop = Loop(w, dt => { if (run) step(dt); });
  paint(); loop.start();
});
