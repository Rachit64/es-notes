/* =========================================================
   NOTEBOOK 1 · part K — M5: the trainer board + 5 program cartridges (chapter 5)
   ========================================================= */
BUILD.push(function wM5() {
  const w = MW('w-m5', 'trainer board · 5 cartridges', 'slide a cartridge in · use the board · watch which building blocks light up');
  const CALC = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '−', '×', '÷', 'E', 'CLR'];
  const BLK = [
    ['scan', 'keypad scan', 'get_key(): rows P2.10–13 out, columns P1.23–26 in', 'ch 1', 'st-keypad'],
    ['p212', 'P2.12 key', '!(LPC_GPIO2->FIOPIN & (1<<12)) → pressed = 0', 'ch 0', 'st-plug'],
    ['tmr', 'Timer0 delay_ms()', 'PR = 2999 → 1 TC step = 1 ms, MR0 = ms, stop + EM0', 'ch 2', 'st-clock'],
    ['logic', 'program logic', '', 'ch 5', 'st-gear'],
    ['ascii', 'number → ASCII', '', 'ch 4', 'st-sparkle'],
    ['lcd', 'LCD driver', 'lcd_init · lcd_cmd · lcd_char · lcd_str (RS, EN, nibbles)', 'ch 4', 'st-lcd']
  ];
  const CARTS = [
    { id: 'Q1', name: 'keypad → LCD', title: 'KEY PRESSED:', uses: ['scan', 'logic', 'ascii', 'lcd'], logic: 'key_ascii[16] lookup table', ascii: 'table holds the characters', flow: ['scan rows', 'key found?', "key_ascii[row*4+col]", 'lcd_cmd(0xC0) · lcd_char', 'wait for release'] },
    { id: 'Q2', name: 'BCD counter', title: 'BCD COUNTER', uses: ['tmr', 'logic', 'ascii', 'lcd'], logic: 'd[3]++ and ripple carry', ascii: "digit + 0x30 ('0')", flow: ['lcd_cmd(0xC0)', "print d[k] + 0x30", 'delay_ms(500)', 'd[3]++ · carry'] },
    { id: 'Q3', name: 'digital clock', title: 'DIGITAL CLOCK', uses: ['tmr', 'logic', 'ascii', 'lcd'], logic: 'ss → mm → hh roll-overs', ascii: "v/10 + '0', v%10 + '0'", flow: ['lcd_cmd(0xC0)', 'show2(hh) : mm : ss', 'delay_ms(1000)', 'ss++ · roll-overs'] },
    { id: 'Q4', name: 'die toss', title: 'DIE TOSS: P2.12', uses: ['p212', 'logic', 'ascii', 'lcd'], logic: 'dice spins 1→6 non-stop', ascii: "dice + '0'", flow: ['dice++ (1…6)', 'P2.12 pressed?', 'print YOU GOT: n', 'wait for release'] },
    { id: 'Q5', name: 'calculator', title: '', uses: ['scan', 'logic', 'ascii', 'lcd'], logic: 'state: 0 = a, 1 = op, 2 = b', ascii: "digit + '0' · sprintf(result)", flow: ['get_key()', 'state 0: a', 'state 1: operator', 'state 2: b → result'] }
  ];
  let cart = null, lcd = new HD44780(), view, kp, speed = 1, acc = 0, dice = 1, bytes = [];
  let st = {};
  /* ---------- layout ---------- */
  const shelf = el('div', { class: 'm5shelf' }); w.appendChild(shelf);
  shelf.appendChild(el('span', { class: 'cav p-soft' }, 'cartridges:'));
  CARTS.forEach((c, i) => { const b = el('button', { class: 'm5cart', type: 'button' }, `<i></i><b>${c.id}</b><span>${c.name}</span>`); b.onclick = () => insert(i); shelf.appendChild(b); c.btn = b; });
  const main = el('div', { class: 'm5main' }); w.appendChild(main);
  const board = el('div', { class: 'm5board' }); main.appendChild(board);
  const slot = el('div', { class: 'm5slot' }, '<span>insert a cartridge ↑</span>'); board.appendChild(slot);
  const lcdHost = el('div', { class: 'm5lcd' }); board.appendChild(lcdHost); view = LCDView(lcdHost, lcd);
  const row = el('div', { class: 'm5row' }); board.appendChild(row);
  const kpHost = el('div', { class: 'm5kp' }); row.appendChild(kpHost);
  const side = el('div', { class: 'm5side' }); row.appendChild(side);
  const key = el('button', { class: 'bigkey m5key', type: 'button' }, 'P2.12<br><small>key</small>'); side.appendChild(key);
  const dz = el('div', { class: 'm5dice' }, '<small>dice =</small><b>1</b>'); side.appendChild(dz);
  const hb = el('div', { class: 'm5hb' }, '<span class="led g"></span><small>Timer0<br>delay done</small>'); side.appendChild(hb);
  const spdBox = el('div', { class: 'm5spd' }); side.appendChild(spdBox);
  chipGroup(spdBox, [[1, 'real time'], [12, 'fast ×12']], 1, v => speed = +v, 'm5s');
  const bus = el('div', { class: 'm5bus' }); board.appendChild(bus);
  const right = el('div', { class: 'm5right' }); main.appendChild(right);
  right.appendChild(el('div', { class: 'mlab' }, 'the main loop of this cartridge'));
  const flow = el('div', { class: 'm5flow' }); right.appendChild(flow);
  right.appendChild(el('div', { class: 'mlab', style: 'margin-top:8px' }, 'building blocks (every program is made of these)'));
  const blocks = el('div', { class: 'm5blocks' }); right.appendChild(blocks);
  const B = {};
  BLK.forEach(([k, n, d, ch, stk]) => { const e = el('div', { class: 'm5b' }, `<svg class="m5i"><use href="#${stk}"/></svg><div><div class="m5bn">${n} <span class="pill">${ch}</span></div><div class="m5bd">${d}</div><div class="m5bv"></div></div>`); blocks.appendChild(e); B[k] = { e, d: $('.m5bd', e), v: $('.m5bv', e) }; });
  const note = el('div', { class: 'msay' }); right.appendChild(note);

  /* ---------- LCD driver (logs every byte) ---------- */
  const drv = {
    cmd(c) { lcd.cmd(c); log(0, c); }, ch(ch) { const b = typeof ch === 'number' ? ch : ch.charCodeAt(0); lcd.data(b); log(1, b); },
    str(s) { for (const c of s) drv.ch(c); }, init() { lcd.ready(); lcd.cmd(0x0C); lcd.cmd(0x06); lcd.cmd(0x01); lcd.cmd(0x80); }
  };
  function log(rs, b) { bytes.push(rs ? `<span class="d">'${b === 32 ? '␣' : esc(String.fromCharCode(b))}' ${hx(b)}</span>` : `<span class="c">cmd ${hx(b)}</span>`); if (bytes.length > 9) bytes.splice(0, bytes.length - 9); }
  function showBus() { bus.innerHTML = '<span class="mlab">bytes on the LCD wires (newest last):</span> ' + (bytes.join(' ') || '—'); }
  /* ---------- glow a chain of blocks ---------- */
  let tmo = [];
  function chain(keys, vals, node) {
    tmo.forEach(clearTimeout); tmo = [];
    Object.entries(vals || {}).forEach(([k, v]) => B[k].v.innerHTML = v);
    $$('.m5fn', flow).forEach((n, i) => n.classList.toggle('on', i === node));
    keys.forEach((k, i) => tmo.push(setTimeout(() => { B[k].e.classList.add('hot'); tmo.push(setTimeout(() => B[k].e.classList.remove('hot'), 700)); }, i * 170)));
    view.draw(); showBus();
  }
  /* ---------- the cartridges' programs ---------- */
  const p2 = n => String(n).padStart(2, '0');
  function insert(i) {
    cart = CARTS[i]; CARTS.forEach((c, j) => c.btn.classList.toggle('on', i === j));
    slot.innerHTML = `<b>${cart.id}</b> ${cart.name}`; slot.classList.remove('in'); void slot.offsetWidth; slot.classList.add('in');
    bytes = []; drv.init(); bytes.push('<span class="c">lcd_init(): 0x30 0x30 0x30 0x20 0x28 0x0C 0x06 0x01 0x80</span>');
    if (cart.title) drv.str(cart.title);
    BLK.forEach(([k]) => { B[k].e.classList.toggle('off', !cart.uses.includes(k)); B[k].v.innerHTML = ''; });
    B.logic.d.innerHTML = cart.logic; B.ascii.d.innerHTML = cart.ascii;
    flow.innerHTML = cart.flow.map((f, j) => `<span class="m5fn">${f}</span>${j < cart.flow.length - 1 ? '<i>→</i>' : '<i class="loop">↺</i>'}`).join('');
    kpHost.innerHTML = ''; kp = Keypad(kpHost, { labels: cart.id === 'Q5' ? CALC : KEYLAB, onchange: (p, k, how) => { if (how === 'down' || how === undefined) onKey(k); } });
    kpHost.classList.toggle('off', !cart.uses.includes('scan')); key.classList.toggle('off', !cart.uses.includes('p212')); dz.style.display = cart.id === 'Q4' ? '' : 'none'; hb.classList.toggle('off', !cart.uses.includes('tmr'));
    st = { d: [0, 0, 0, 0], hh: 23, mm: 59, ss: 50, state: 0, a: 0, b: 0, op: 0 }; acc = 0;
    if (cart.id === 'Q2') { drv.cmd(0xC0); drv.str('0000'); }
    if (cart.id === 'Q3') { drv.cmd(0xC0); drv.str('23:59:50'); }
    chain(['lcd'], { lcd: `lcd_init() + lcd_str("${cart.title || ''}")` }, -1);
    note.innerHTML = { Q1: 'Tap a key on the keypad.', Q2: 'It counts by itself — every 500 ms Timer0 says "go on". Try fast ×12 to see the carries.', Q3: 'Starts at 23:59:50 — wait for midnight (or go fast).', Q4: 'The dice variable spins non-stop. Press P2.12 to catch it.', Q5: 'Type a one-digit sum: e.g. 7 × 8, then CLR.' }[cart.id];
  }
  function onKey(k) {
    if (!cart) { note.textContent = 'Insert a cartridge first ↑'; return; }
    const r = k >> 2, c = k & 3, scanV = `key ${k}: row ${r} (P2.${10 + r} HIGH) → column ${c} (P1.${23 + c}) answers`;
    if (cart.id === 'Q1') { drv.cmd(0xC0); drv.ch(KEYLAB[k]); chain(['scan', 'logic', 'ascii', 'lcd'], { scan: scanV, logic: `key_ascii[${k}]`, ascii: `'${KEYLAB[k]}' = ${hx(KEYLAB[k].charCodeAt(0))}`, lcd: `lcd_cmd(0xC0) · lcd_char('${KEYLAB[k]}')` }, 3); return; }
    if (cart.id !== 'Q5') { note.innerHTML = `<span class="p-red">${cart.id} never scans the keypad</span> — the key press is ignored.`; chain([], {}, -1); return; }
    // calculator
    const s = st, lab = CALC[k];
    if (k === 15) { drv.cmd(0x01); s.state = 0; chain(['scan', 'logic', 'lcd'], { scan: scanV, logic: 'F = clear → state = 0', lcd: 'lcd_cmd(0x01)' }, 0); return; }
    if (s.state === 0 && k <= 9) { s.a = k; drv.cmd(0x01); drv.ch(48 + k); s.state = 1; chain(['scan', 'logic', 'ascii', 'lcd'], { scan: scanV, logic: `a = ${k}, state → 1`, ascii: `${k} + '0' = '${k}'`, lcd: `lcd_cmd(0x01) · lcd_char('${k}')` }, 1); return; }
    if (s.state === 1 && k >= 10 && k <= 13) { s.op = k - 10; drv.ch('+-*/'[s.op]); s.state = 2; chain(['scan', 'logic', 'lcd'], { scan: scanV, logic: `op = ${k} − 10 = ${s.op} ('${'+-*/'[s.op]}'), state → 2`, lcd: `lcd_char('${'+-*/'[s.op]}')` }, 2); return; }
    if (s.state === 2 && k <= 9) {
      s.b = k; drv.ch(48 + k); drv.ch('='); let res, err = false;
      if (s.op === 0) res = s.a + k; else if (s.op === 1) res = s.a - k; else if (s.op === 2) res = s.a * k; else if (k === 0) err = true; else res = Math.trunc(s.a / k);
      drv.str(err ? 'ERR' : String(res)); s.state = 0;
      chain(['scan', 'logic', 'ascii', 'lcd'], { scan: scanV, logic: err ? 'b = 0 → ÷ by zero → "ERR"' : `${s.a} ${'+-*/'[s.op]} ${k} = ${res}`, ascii: err ? '"ERR"' : `sprintf(buf, "%d", ${res}) → "${res}"`, lcd: `lcd_char('${k}') · lcd_char('=') · lcd_str("${err ? 'ERR' : res}")` }, 3); return;
    }
    note.innerHTML = `key "${lab}" doesn't fit state ${s.state} → ignored.`; chain(['scan', 'logic'], { scan: scanV, logic: `state ${s.state}: "${lab}" ignored` }, s.state + 1);
  }
  function tick() { // a delay_ms() finished
    hb.firstChild.classList.add('on'); setTimeout(() => hb.firstChild.classList.remove('on'), 160);
    if (cart.id === 'Q2') {
      const d = st.d; let k = 3; d[k]++; while (k > 0 && d[k] > 9) { d[k] = 0; k--; d[k]++; } if (d[0] > 9) d[0] = 0;
      drv.cmd(0xC0); drv.str(d.join(''));
      chain(['tmr', 'logic', 'ascii', 'lcd'], { tmr: 'delay_ms(500): TC counted 0 → 500 (1 ms steps)', logic: `d[] = {${d.join(', ')}}${k < 3 ? ` · carried into d[${k}]` : ''}`, ascii: d.map(x => `${x}→'${x}'`).join(' '), lcd: `lcd_cmd(0xC0) · 4 × lcd_char` }, 3);
    } else if (cart.id === 'Q3') {
      st.ss++; let roll = ''; if (st.ss === 60) { st.ss = 0; st.mm++; roll = 'ss 60 → 0, mm + 1'; } if (st.mm === 60) { st.mm = 0; st.hh++; roll = 'mm 60 → 0, hh + 1'; } if (st.hh === 24) { st.hh = 0; roll = 'hh 24 → 0 · midnight!'; }
      const t = `${p2(st.hh)}:${p2(st.mm)}:${p2(st.ss)}`; drv.cmd(0xC0); drv.str(t);
      chain(['tmr', 'logic', 'ascii', 'lcd'], { tmr: 'delay_ms(1000): 1000 TC steps of 1 ms', logic: `ss++${roll ? ' → ' + roll : ''}`, ascii: `${st.ss} → '${Math.floor(st.ss / 10)}' (v/10) '${st.ss % 10}' (v%10)`, lcd: `lcd_cmd(0xC0) · "${t}"` }, roll ? 3 : 1);
    }
  }
  const toss = e => { e && e.preventDefault(); if (!cart) { note.textContent = 'Insert a cartridge first ↑'; return; } key.classList.add('down'); setTimeout(() => key.classList.remove('down'), 160);
    if (cart.id !== 'Q4') { note.innerHTML = `<span class="p-red">${cart.id} never reads P2.12</span> — nothing happens.`; return; }
    const n = dice; drv.cmd(0xC0); drv.str('YOU GOT: '); drv.ch(48 + n);
    chain(['p212', 'logic', 'ascii', 'lcd'], { p212: 'P2.12 reads 0 → pressed', logic: `caught dice = ${n}`, ascii: `${n} + '0' = '${n}' (${hx(48 + n)})`, lcd: 'lcd_cmd(0xC0) · lcd_str("YOU GOT: ") · lcd_char' }, 2);
  };
  key.addEventListener('pointerdown', toss); key.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toss(e); });
  const loop = Loop(w, (dt, t) => {
    if (!cart) return;
    if (cart.id === 'Q4') { dice = dice % 6 + 1; dz.lastChild.textContent = dice; }
    if (cart.id === 'Q2' || cart.id === 'Q3') { acc += dt * speed; const per = cart.id === 'Q2' ? .5 : 1; while (acc >= per) { acc -= per; tick(); } }
  });
  insert(0); loop.start();
});
