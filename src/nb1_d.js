/* =========================================================
   NOTEBOOK 1 · part D — LCD
   ========================================================= */

/* ---------- LCD pin explorer ---------- */
BUILD.push(function wLcdPins() {
  const w = W('w-lcdpins', 'LCD module · 16 pins', 'tap a pin');
  const P = [['VSS', 'Ground', 'GND pin of the display.', 'GND'], ['VCC', '+5 V', 'Supply voltage pin of the display.', '+V'], ['VEE', 'contrast', 'Adjusts the contrast — connected to a potentiometer.', '10 kΩ pot'], ['RS', 'register select', '<b>0 = command register</b>, <b>1 = data register</b>.', 'P0.27'], ['RW', 'read / write', '0 = write, 1 = read.', 'GND → always write'], ['E', 'enable', 'A LOW→HIGH(→LOW) pulse makes the LCD perform the read/write.', 'P0.28'],
    ['D0', 'data 0', 'Data bit 0 — only used in 8-bit mode.', 'GND'], ['D1', 'data 1', 'Data bit 1 — only used in 8-bit mode.', 'GND'], ['D2', 'data 2', 'Data bit 2 — only used in 8-bit mode.', 'GND'], ['D3', 'data 3', 'Data bit 3 — only used in 8-bit mode.', 'GND'], ['D4', 'data 4', 'Data bit 4 (used in 4-bit mode).', 'P0.23'], ['D5', 'data 5', 'Data bit 5 (used in 4-bit mode).', 'P0.24'], ['D6', 'data 6', 'Data bit 6 (used in 4-bit mode).', 'P0.25'], ['D7', 'data 7', 'Data bit 7 (used in 4-bit mode).', 'P0.26'], ['LED+', 'backlight +', '+ve pin of the backlight LED → +5 V.', '+V'], ['LED−', 'backlight −', '−ve pin of the backlight LED → GND.', 'GND']];
  const s = sv('svg', { class: 'dg lcdmod', viewBox: '0 0 640 260' }); w.appendChild(s);
  sv('rect', { x: 30, y: 60, width: 580, height: 180, rx: 12, style: 'fill:#2e8b3a;stroke:var(--ink);stroke-width:2' }, s);
  [[44, 74], [596, 74], [44, 226], [596, 226]].forEach(([x, y]) => sv('circle', { cx: x, cy: y, r: 6, style: 'fill:#d8d8de;stroke:#1d1d22' }, s));
  sv('rect', { x: 86, y: 118, width: 470, height: 96, rx: 6, style: 'fill:#1d2a12' }, s);
  sv('rect', { x: 98, y: 128, width: 446, height: 76, rx: 3, style: 'fill:#a5d63c' }, s);
  const txt = sv('text', { x: 321, y: 176, 'text-anchor': 'middle', style: 'font-family:Courier Prime;font-weight:700;font-size:26px;fill:#1d3a10;letter-spacing:4px' }, s); txt.textContent = 'tap a pin ↑';
  const info = el('div', { class: 'note lav', style: 'margin:14px 0 0' }); w.appendChild(info);
  const pins = P.map((p, i) => {
    const x = 104 + i * 27.5; const g = sv('g', { class: 'hov lpin', tabindex: 0 }, s);
    sv('rect', { x: x - 9, y: 66, width: 18, height: 18, rx: 3, style: 'fill:#e6c15a;stroke:#5a4410' }, g);
    sv('circle', { cx: x, cy: 75, r: 4, style: 'fill:#3a2a08' }, g);
    sv('text', { x, y: 102, 'text-anchor': 'middle', class: 'mono', style: 'font-size:10px;fill:#e9ffe0' }, g).textContent = i + 1;
    const lt = sv('text', { x, y: 52, 'text-anchor': 'end', transform: `rotate(-60 ${x} 52)`, class: 'lbl', style: 'font-size:12.5px' }, g); lt.textContent = p[0];
    const ct = sv('text', { x: x + 4, y: 40, 'text-anchor': 'end', transform: `rotate(-60 ${x + 4} 40)`, style: `font-size:11px;font-family:Caveat;fill:var(--purple)` }, s);
    if (/^P0/.test(p[3])) ct.textContent = p[3] + ' ·';
    const pick = () => { $$('.lpin', s).forEach(e => e.classList.remove('selb')); g.classList.add('selb'); info.innerHTML = `<div class="nh">pin ${i + 1} · ${p[0]} <span class="p-soft small">(${p[1]})</span></div>${p[2]}<br><span class="p-purple">our circuit: <b>${p[3]}</b></span>`; txt.textContent = `${i + 1}: ${p[0]}`; };
    g.addEventListener('click', pick); g.addEventListener('keydown', e => { if (e.key === 'Enter') pick(); });
    return g;
  });
  info.innerHTML = '<div class="nh">16 pins</div>Pins 1–3 power &amp; contrast · 4–6 control (RS, RW, E) · 7–14 data D0–D7 · 15–16 backlight.';
});

/* ---------- instruction builder ---------- */
BUILD.push(function wInstr() {
  const w = W('w-instr', 'instruction builder', 'RS = 0, R/W = 0 for every command');
  const T = [
    ['clear', 'Clear display', [0, 0, 0, 0, 0, 0, 0, 1], {}, 'Clears the entire display and sets DDRAM address 0 in the address counter.', '≈1.52 ms'],
    ['home', 'Return home', [0, 0, 0, 0, 0, 0, 1, '–'], {}, 'Sets DDRAM address 0 in the AC; un-shifts the display. DDRAM contents stay.', '1.52 ms'],
    ['entry', 'Entry mode set', [0, 0, 0, 0, 0, 1, 'I/D', 'S'], { 'I/D': ['decrement (←)', 'increment (→)'], S: ['no shift', 'shift display'] }, 'Sets the cursor move direction and whether the display shifts — happens during each data write.', '37 µs'],
    ['disp', 'Display on/off control', [0, 0, 0, 0, 1, 'D', 'C', 'B'], { D: ['display off', 'display on'], C: ['cursor off', 'cursor on'], B: ['no blink', 'blink'] }, 'Turns the whole display (D), the cursor (C) and the blinking of the cursor box (B) on/off.', '37 µs'],
    ['shift', 'Cursor or display shift', [0, 0, 0, 1, 'S/C', 'R/L', '–', '–'], { 'S/C': ['move cursor', 'shift display'], 'R/L': ['left', 'right'] }, 'Moves the cursor or shifts the whole display, without changing DDRAM.', '37 µs'],
    ['func', 'Function set', [0, 0, 1, 'DL', 'N', 'F', '–', '–'], { DL: ['4-bit', '8-bit'], N: ['1 line', '2 lines'], F: ['5×7 dots', '5×10 dots'] }, 'Sets the interface data length (DL), number of lines (N) and font (F).', '37 µs'],
    ['ddram', 'Set DDRAM address', [1, 'A', 'A', 'A', 'A', 'A', 'A', 'A'], {}, 'Moves the cursor: 0x80 | address (line 1 = 0x00–0x0F, line 2 = 0x40–0x4F).', '37 µs']
  ];
  let ti = 3, opt = { 'I/D': 1, S: 0, D: 1, C: 1, B: 0, 'S/C': 0, 'R/L': 1, DL: 0, N: 1, F: 0 }, addr = 0x40;
  const lcd = new HD44780().ready(); lcd.print('Hi! build a cmd'); lcd.cmd(0x0E);
  const tp = el('div'); w.appendChild(tp);
  chipGroup(tp, T.map((t, i) => [i, t[1]]), ti, v => { ti = +v; upd(); });
  const grid = el('div', { class: 'ibits mt' }); w.appendChild(grid);
  const leg = el('div', { class: 'small p-soft mt' }); w.appendChild(leg);
  const out = el('div', { class: 'row mt' }); w.appendChild(out);
  const ho = el('span', { class: 'ro big' }); const desc = el('div', { class: 'say' });
  const send = el('button', { class: 'btn p', type: 'button' }, 'send to LCD ▸');
  out.append(el('span', { class: 'gae' }, 'command ='), ho, send);
  w.appendChild(desc);
  const lv = el('div', { class: 'row mt' }); w.appendChild(lv); const view = LCDView(lv, lcd); const lg = el('div', { class: 'say g' }); lv.appendChild(lg);
  const ar = el('div', { class: 'row', style: 'display:none' }); w.insertBefore(ar, leg);
  ruler(ar, 'address', 0, 0x4F, addr, 1, v => hx(v) + (v >= 0x40 ? ` (line 2, box ${v - 0x40 + 1})` : v < 0x10 ? ` (line 1, box ${v + 1})` : ' (off-screen)'), v => { addr = v; upd(); });
  send.onclick = () => { const c = val(); lg.textContent = '→ ' + lcd.cmd(c); view.draw(); };
  function val() { const t = T[ti]; if (t[0] === 'ddram') return 0x80 | addr; let v = 0; t[2].forEach((b, i) => { const bit = 7 - i; const x = typeof b === 'number' ? b : (opt[b] ?? 0); if (b !== 'A' && x) v |= 1 << bit; }); return v; }
  function upd() {
    const t = T[ti]; grid.innerHTML = '';
    ['RS', 'R/W'].forEach(n => grid.appendChild(el('div', { class: 'ib fixed' }, `<small>${n}</small><b>0</b>`)));
    t[2].forEach((b, i) => {
      const bit = 7 - i; let c;
      if (typeof b === 'number') c = el('div', { class: 'ib fixed' + (b ? ' one' : '') }, `<small>DB${bit}</small><b>${b}</b>`);
      else if (b === '–') c = el('div', { class: 'ib dc' }, `<small>DB${bit}</small><b>–</b>`);
      else if (b === 'A') { const x = (addr >> bit) & 1; c = el('div', { class: 'ib opt' + (x ? ' one' : '') }, `<small>DB${bit}</small><b>${x}</b><em>A${bit}</em>`); }
      else { const x = opt[b]; c = el('button', { class: 'ib opt' + (x ? ' one' : ''), type: 'button' }, `<small>DB${bit}</small><b>${x}</b><em>${b}</em>`); c.onclick = () => { opt[b] ^= 1; upd(); }; }
      grid.appendChild(c);
    });
    ar.style.display = t[0] === 'ddram' ? '' : 'none';
    leg.innerHTML = Object.entries(t[3]).map(([k, o]) => `<b>${k}</b>: 1 = ${o[1]}, 0 = ${o[0]}`).join(' · ') || (t[0] === 'ddram' ? 'A6…A0 = the DDRAM address' : '– = don\'t care');
    const v = val(); ho.textContent = hx(v);
    desc.innerHTML = `${t[4]} <span class="pill">${t[5]}</span>`;
  }
  upd();
});

/* ---------- command code playground ---------- */
BUILD.push(function wLcdPlay() {
  const w = W('w-lcdplay', 'LCD playground', 'the slide\'s command table — click to send');
  const lcd = new HD44780().ready(); lcd.cmd(0x0E); lcd.print('ES notes :)'); lcd.cmd(0xC0); lcd.print('LPC1768');
  const sp = el('div', { class: 'split' }); w.appendChild(sp);
  const L = el('div', { class: 'col' }), R = el('div', { class: 'col' }); sp.append(L, R);
  const view = LCDView(L, lcd);
  const st = el('div', { class: 'small mono' }); L.appendChild(st);
  const log = el('div', { class: 'say g' }); L.appendChild(log);
  const tr = el('div', { class: 'row' }); L.appendChild(tr);
  const ti = el('input', { class: 'inp', value: 'Hi', maxlength: 20, 'aria-label': 'text to write' }); const tb = el('button', { class: 'btn sm p', type: 'button' }, 'write text (RS = 1)');
  tr.append(ti, tb); tb.onclick = () => { lcd.print(ti.value); log.textContent = `→ wrote "${ti.value}" as data, cursor moved ${ti.value.length} boxes`; paint(); };
  const rs = el('button', { class: 'btn sm g', type: 'button' }, '⟲ restart'); tr.appendChild(rs); rs.onclick = () => { lcd.ready(); lcd.cmd(0x0E); lcd.print('ES notes :)'); lcd.cmd(0xC0); lcd.print('LPC1768'); log.textContent = ''; paint(); };
  const C = [[0x01, 'Clear display screen'], [0x02, 'Return home'], [0x04, 'Decrement cursor (shift cursor to left)'], [0x06, 'Increment cursor (shift cursor to right)'], [0x05, 'Shift display right'], [0x07, 'Shift display left'], [0x08, 'Display off, cursor off'], [0x0A, 'Display off, cursor on'], [0x0C, 'Display on, cursor off'], [0x0E, 'Display on, cursor on, blinking OFF'], [0x0F, 'Display on, cursor blinking ON'], [0x10, 'Shift cursor position to left'], [0x14, 'Shift cursor position to right'], [0x18, 'Shift the entire display to the left'], [0x1C, 'Shift the entire display to the right'], [0x80, 'Force cursor to beginning of 1st line'], [0xC0, 'Force cursor to beginning of 2nd line'], [0x38, '2 lines and 5×7 matrix (8-bit)']];
  const list = el('div', { class: 'cmdlist' }); R.appendChild(list);
  C.forEach(([c, d]) => { const b = el('button', { class: 'cmdb', type: 'button' }, `<b>${hx(c)}</b><span>${d}</span>`); b.onclick = () => { if (c === 0x38) { log.innerHTML = '→ function set: 8-bit, 2 lines, 5×7. <span class="p-soft">(our circuit uses 0x28 = same but 4-bit)</span>'; paint(); return; } log.textContent = '→ ' + lcd.cmd(c) + ((c === 0x05 || c === 0x07 || c === 0x04 || c === 0x06) ? ' — now type text to see it' : ''); paint(); }; list.appendChild(b); });
  function paint() { view.draw(); st.textContent = `cursor addr = ${hx(lcd.ac)} · I/D=${lcd.id} S=${lcd.S} · D=${lcd.D} C=${lcd.C} B=${lcd.B} · shift=${lcd.sh}`; }
  paint();
});

/* ---------- DDRAM address map ---------- */
BUILD.push(function wDdram() {
  const w = W('w-ddram', 'cursor address map', 'tap a box → its "set cursor" command');
  const lcd = new HD44780().ready(); lcd.cmd(0x0F);
  const g = el('div', { class: 'ddgrid' }); w.appendChild(g);
  const out = el('div', { class: 'row mt' }); w.appendChild(out);
  const big = el('span', { class: 'ro big' }); const ex = el('span', { class: 'say' }); out.append(el('span', { class: 'gae' }, 'command ='), big, ex);
  const lv = el('div', { class: 'row mt' }); w.appendChild(lv); const view = LCDView(lv, lcd);
  const tr = el('div', { class: 'col' }); lv.appendChild(tr);
  const ti = el('input', { class: 'inp', value: '*', maxlength: 16, 'aria-label': 'text' }); const tb = el('button', { class: 'btn sm p', type: 'button' }, 'write here'); tr.append(el('span', { class: 'gae small' }, 'then write:'), ti, tb);
  tb.onclick = () => { lcd.print(ti.value); view.draw(); };
  for (let L = 0; L < 2; L++) for (let k = 0; k < 16; k++) {
    const a = (L ? 0x40 : 0) + k; const c = el('button', { class: 'dd', type: 'button' }, `<small>${hx(a)}</small><b>${hx(0x80 | a)}</b>`);
    c.onclick = () => { $$('.dd', g).forEach(x => x.classList.remove('sel')); c.classList.add('sel'); lcd.cmd(0x80 | a); view.draw(); big.textContent = hx(0x80 | a); ex.innerHTML = `= 0x80 | ${hx(a)} → line ${L + 1}, box ${k + 1}${a === 0x0A ? ' (used in notebook ② as 0x8A)' : ''}`; };
    g.appendChild(c);
  }
  g.firstChild.click();
});

/* ---------- lcd_write / port_write for one byte ---------- */
const LW_CODE = `void lcd_write(void)
{
    flag2 = (flag1 == 1) ? 0 :((temp1 == 0x30) || (temp1 == 0x20)) ? 1 : 0;
    temp2 = temp1 & 0xf0;
    temp2 = temp2 << 19;   //data lines from 23 to 26
    port_write();          // Output the higher digit on P0.26-P0.23
    if (!flag2)            // Other than command 0x30, send the lower 4-bit also
    {
        temp2 = temp1 & 0x0f;  //26-4+1
        temp2 = temp2 << 23;
        port_write();          // Output the lower digit on P0.26-P0.23
    }
}
void port_write(void)
{
    LPC_GPIO0->FIOPIN = temp2;
    if (flag1 == 0)
        LPC_GPIO0->FIOCLR = RS_CTRL;  // Select command register
    else
        LPC_GPIO0->FIOSET = RS_CTRL;  //Select data register
    LPC_GPIO0->FIOSET = EN_CTRL;      //Apply -ve edge on Enable
    delay_lcd(25);
    LPC_GPIO0->FIOCLR = EN_CTRL;
    delay_lcd(5000);
}`;
BUILD.push(function wNibble() {
  const w = W('w-nibble', 'one byte → two nibbles', 'pick what to send, then step');
  const pick = el('div', { class: 'mb' }); w.appendChild(pick);
  const host = el('div'); w.appendChild(host); const L = t => lineOf(LW_CODE, t);
  const opts = [['W', 1, 0x57], ['A', 1, 0x41], ['cmd 0x01', 0, 0x01], ['cmd 0xC0', 0, 0xC0], ['cmd 0x30 (init)', 0, 0x30]];
  let cur = 0;
  const pwSteps = (half, x, f1) => {
    const t2 = half === 'high' ? ((x & 0xF0) << 19) >>> 0 : ((x & 0x0F) << 23) >>> 0;
    return [
      { l: L('FIOPIN = temp2'), t: `port_write(): <b>FIOPIN = ${hex(t2)}</b> → P0.26–P0.23 = <b>${bin(half === 'high' ? x >> 4 : x & 15, 4)}</b>; RS and EN are 0 in temp2, so they go LOW too.`, f: s => set(s, { pins: t2, rs: 0, en: 0 }) },
      { l: f1 ? [L('else'), L('FIOSET = RS_CTRL')] : [L('if (flag1 == 0)'), L('FIOCLR = RS_CTRL')], t: f1 ? '<b>RS = 1</b> → this goes to the <b>data</b> register.' : '<b>RS = 0</b> → this goes to the <b>command</b> register.', f: s => set(s, { rs: f1 }) },
      { l: L('FIOSET = EN_CTRL'), t: '<b>EN HIGH</b> …', f: s => set(s, { en: 1, tl: s.tl.concat([[s.ti++, 'hi']]) }) },
      { l: L('delay_lcd(25)'), t: '… hold it a moment (delay_lcd(25)) so the LCD sees the data steady …' },
      { l: L('FIOCLR = EN_CTRL'), t: `… <b>EN LOW</b> → falling edge → the LCD <b>latches</b> the ${half} nibble <b>${hx(half === 'high' ? x >> 4 : x & 15, 1)}</b>.`, f: s => { s.en = 0; s.got = s.got.concat([half === 'high' ? x >> 4 : x & 15]); s.tl = s.tl.concat([[s.ti++, 'lo']]); } },
      { l: L('delay_lcd(5000)'), t: 'delay_lcd(5000): give the LCD time to finish (we can\'t read its busy flag — RW is grounded).' }
    ];
  };
  function build() {
    const [nm, f1, x] = opts[cur]; const f2 = !f1 && (x === 0x30 || x === 0x20) ? 1 : 0;
    const S = [
      { l: L('flag2 ='), t: `temp1 = ${hx(x)}${f1 ? ` ('${String.fromCharCode(x)}')` : ''}, flag1 = ${f1} (${f1 ? 'data' : 'command'}) → <b>flag2 = ${f2}</b> ${f2 ? '→ send only the high nibble (special init command)' : '→ send both nibbles'}.`, f: s => set(s, { x, f1, f2 }) },
      { l: L('temp2 = temp1 & 0xf0'), t: `Keep the high nibble: ${hx(x)} &amp; 0xF0 = <b>${hx(x & 0xF0)}</b>.`, f: s => set(s, { t2: x & 0xF0 }) },
      { l: L('temp2 = temp2 << 19'), t: `Shift left 19 → bit 7 lands on bit 26 (P0.26 = D7), bit 4 on bit 23 (P0.23 = D4): <b>${hex((x & 0xF0) << 19)}</b>.`, f: s => set(s, { t2: ((x & 0xF0) << 19) >>> 0 }) },
      ...pwSteps('high', x, f1)
    ];
    if (!f2) S.push(
      { l: [L('if (!flag2)'), L('temp2 = temp1 & 0x0f')], t: `flag2 = 0 → now the low nibble: ${hx(x)} &amp; 0x0F = <b>${hx(x & 15)}</b>.`, f: s => set(s, { t2: x & 15 }) },
      { l: L('temp2 = temp2 << 23'), t: `Shift left 23 → bit 3 lands on bit 26: <b>${hex((x & 15) << 23)}</b>.`, f: s => set(s, { t2: ((x & 15) << 23) >>> 0 }) },
      ...pwSteps('low', x, f1),
      { l: [L('port_write();          // Output the lower')], t: f1 ? `Both halves received → the LCD joins them: <b>${hx(x)}</b> = '${String.fromCharCode(x)}' appears!` : `Both halves received → command <b>${hx(x)}</b> executes: ${new HD44780().ready().cmd(x)}.`, f: s => set(s, { done: 1 }) }
    ); else S.push({ l: L('if (!flag2)'), t: 'flag2 = 1 → skip the low nibble. (During init the LCD is still in 8-bit mode and reads 0x30 from just D7–D4.)', f: s => set(s, { done: 1 }) });
    return S;
  }
  const view = (s, v, k, first) => {
    if (first) {
      v.innerHTML = '';
      v._byte = miniBits(v, ['b7', 'b6', 'b5', 'b4', 'b3', 'b2', 'b1', 'b0'], 'temp1 (the byte)');
      v._port = miniBits(v, ['EN·28', 'RS·27', 'D7·26', 'D6·25', 'D5·24', 'D4·23'], 'port 0 pins P0.28 … P0.23');
      v._td = sv('svg', { class: 'dg', viewBox: '0 0 420 96' }); v.appendChild(v._td);
      const r = el('div', { class: 'row' }); v.appendChild(r);
      v._lcd = new HD44780().ready(); v._lcd.print('>'); v._lv = LCDView(r, v._lcd);
      v._got = el('div', { class: 'say' }); r.appendChild(v._got);
    }
    v._byte.set([7, 6, 5, 4, 3, 2, 1, 0].map(b => (s.x >> b) & 1));
    const p = s.pins || 0; v._port.set([s.en ? 1 : 0, s.rs ? 1 : 0, (p >>> 26) & 1, (p >>> 25) & 1, (p >>> 24) & 1, (p >>> 23) & 1]);
    const g = v._td; g.innerHTML = '';
    ['EN', 'RS', 'D7–D4'].forEach((n, i) => sv('text', { x: 2, y: 22 + i * 30, class: 'lbl', style: 'font-size:12px' }, g).textContent = n);
    let d = 'M50 30'; let x = 50; s.tl.forEach(([i, e]) => { x = 70 + i * 70; d += `H${x}V${e === 'hi' ? 10 : 30}`; }); d += `H${Math.max(x + 30, 80)}`;
    sv('path', { d, style: 'fill:none;stroke:var(--red);stroke-width:2.4' }, g);
    sv('path', { d: `M50 ${s.rs ? 40 : 60} H410`, style: 'fill:none;stroke:var(--blue);stroke-width:2.2' }, g);
    s.got.forEach((n, i) => { const xx = 70 + i * 140; sv('rect', { x: xx - 20, y: 68, width: 110, height: 22, rx: 8, style: 'fill:var(--hl-y);stroke:var(--ink)' }, g); sv('text', { x: xx + 35, y: 84, 'text-anchor': 'middle', class: 'mono', style: 'font-size:12px' }, g).textContent = (i ? 'low ' : 'high ') + bin(n, 4); sv('path', { d: `M${xx + 70} 34 v30`, style: 'stroke:var(--pink);stroke-width:1.5;stroke-dasharray:2 3' }, g); });
    v._lcd.ready(); v._lcd.cmd(0x0E); v._lcd.print('>'); if (s.done) { if (s.f1) v._lcd.data(s.x); else if (s.f2) v._lcd.print(' (8-bit cmd)'); else v._lcd.cmd(s.x); } v._lv.draw();
    v._got.innerHTML = s.got.length ? `LCD received: ${s.got.map(n => hx(n, 1)).join(' + ')}${s.got.length === 2 ? ` = <b>${hx(s.x)}</b>` : s.f2 && s.done ? ' (8-bit mode reads it as 0x30)' : ' … waiting for the other half'}` : 'LCD waiting…';
  };
  const st = Stepper(host, { code: LW_CODE, title: 'lcd_write + port_write', steps: build(), init: () => ({ x: opts[cur][2], tl: [], ti: 0, got: [] }), view });
  chipGroup(pick, opts.map((o, i) => [i, o[0]]), cur, v => { cur = +v; st.setSteps(build()); });
});

/* ---------- init: why 3,3,3,2 ---------- */
BUILD.push(function wInit() {
  const w = W('w-init', 'the init handshake', 'pick the LCD\'s unknown starting state, then send nibbles');
  const SC = [['fresh power-on: 8-bit mode', l => { l.powerOn(); }], ['4-bit mode, in step (only the micro was reset)', l => { l.powerOn(); l.bus8 = false; l.DL = 0; }], ['4-bit mode, already holding half a byte', l => { l.powerOn(); l.bus8 = false; l.DL = 0; l.half = 0xA; }]];
  let sc = 0; const seq = [3, 3, 3, 2, 2, 8]; let k = 0; const lcd = new HD44780();
  chipGroup(w, SC.map((s, i) => [i, s[0]]), sc, v => { sc = +v; reset(); });
  const row = el('div', { class: 'row mt' }); w.appendChild(row);
  const bN = el('button', { class: 'btn p', type: 'button' }, 'send next nibble ▸'); const bR = el('button', { class: 'btn sm g', type: 'button' }, '⟲'); row.append(bN, bR);
  const mode = el('span', { class: 'pill' }); row.appendChild(mode);
  const tbl = el('table', { class: 'tbl' }); w.appendChild(el('div', { class: 'tblwrap' })).appendChild(tbl);
  const say = el('div', { class: 'say' }); w.appendChild(say);
  const ms = () => lcd.bus8 ? '8-bit mode' : (lcd.half === null ? '4-bit · expects HIGH half' : `4-bit · holding high half ${hx(lcd.half, 1)}`);
  function reset() { SC[sc][1](lcd); k = 0; tbl.innerHTML = '<tr><th>#</th><th>nibble on D7–D4</th><th>LCD was in</th><th>it understood</th></tr>'; mode.textContent = ms(); say.textContent = 'We don\'t know which state the LCD is in — that\'s the point.'; bN.disabled = false; }
  bR.onclick = reset;
  bN.onclick = () => {
    if (k >= seq.length) return; const n = seq[k++]; const before = ms(); const r = lcd.bus(0, n);
    let what; if (r.half !== undefined) what = `stored ${hx(n, 1)} as the high half, waits for more`; else { const b = r.byte; const dsc = b >> 4 === 3 || b >> 4 === 2 ? new HD44780().cmd(b) : 'some other command (harmless)'; what = `byte ${hx(b)} → ${dsc}`; }
    const tr = el('tr'); tr.innerHTML = `<td>${k}</td><td class="m">${bin(n, 4)} (${n})</td><td>${before}</td><td>${what}</td>`; tbl.appendChild(tr);
    mode.textContent = ms();
    if (k === 3) say.innerHTML = 'After three 3s, the LCD is in <b>8-bit mode</b> — in every starting case!';
    if (k === 4) say.innerHTML = '0x2 in 8-bit mode = "function set: <b>4-bit</b>". From now on every byte comes as two halves.';
    if (k === 6) { say.innerHTML = '0x2 + 0x8 = <b>0x28</b>: 4-bit, 2 lines, 5×7 → initialisation done ✓ (try the other starting states!)'; bN.disabled = true; }
  };
  reset();
});

/* ---------- main LCD program ---------- */
const LCD_MAIN = `#define RS_CTRL 0x08000000  //P0.27
#define EN_CTRL 0x10000000  //P0.28
#define DT_CTRL 0x07800000  //P0.23 to P0.26 data lines
unsigned long int temp1=0, temp2=0, i, j;
unsigned char flag1 =0, flag2 =0;
unsigned char msg[] = {"WELCOME "};
void lcd_write(void);
void port_write(void);
void delay_lcd(unsigned int);
unsigned long int init_command[] = {0x30,0x30,0x30,0x20,0x28,0x0c,0x06,0x01,0x80};
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    LPC_GPIO0->FIODIR = DT_CTRL | RS_CTRL | EN_CTRL; //Config output
    flag1 =0;//Command
    for (i=0; i<9;i++)
    {
        temp1 = init_command[i];
        lcd_write(); //send Init commands to LCD
    }
    flag1 =1;//Data
    i =0;
    while (msg[i++] != '\\0')
    {
        temp1 = msg[i];
        lcd_write();//Send data bytes
    }
    while(1);
}`;
const LCD_MAIN_FIX = LCD_MAIN.replace(`    while (msg[i++] != '\\0')
    {
        temp1 = msg[i];
        lcd_write();//Send data bytes
    }`, `    while (msg[i] != '\\0')         //~ fixed
    {
        temp1 = msg[i];
        lcd_write();//Send data bytes
        i++;
    }`);
BUILD.push(function wLcdProg() {
  const w = W('w-lcdprog', 'run the WELCOME program', 'watch the LCD come alive');
  const pick = el('div', { class: 'mb' }); w.appendChild(pick);
  const host = el('div'); w.appendChild(host);
  const CMDTXT = { 0x30: 'nibble 3 (8-bit function set) — 1st of 3', 0x20: 'nibble 2 → switch to <b>4-bit</b> mode', 0x28: '<b>4-bit, 2 lines, 5×7</b>', 0x0c: '<b>display ON</b>, cursor off', 0x06: 'entry mode: cursor <b>moves right</b> after each char', 0x01: '<b>clear</b> display, cursor home', 0x80: 'cursor → <b>line 1, box 1</b>' };
  const ICMD = [0x30, 0x30, 0x30, 0x20, 0x28, 0x0c, 0x06, 0x01, 0x80];
  function build(fix) {
    const code = fix ? LCD_MAIN_FIX : LCD_MAIN, L = t => lineOf(code, t);
    const S = [
      { l: [L('#define RS_CTRL'), L('#define EN_CTRL'), L('#define DT_CTRL')], t: 'Masks for the pins: RS = bit 27, EN = bit 28, data = bits 23–26 (0x07800000).', f: s => s },
      { l: [L('SystemInit'), L('SystemCoreClockUpdate')], t: 'Clock setup.' },
      { l: L('FIODIR = DT_CTRL'), t: 'P0.23–P0.28 → outputs (OR of the three masks). The LCD is powered but still blank.' },
      { l: L('flag1 =0'), t: '<b>flag1 = 0</b> → everything sent next is a <b>command</b>.' }
    ];
    ICMD.forEach((c, i) => S.push({ l: [L('temp1 = init_command[i]'), L('lcd_write(); //send Init')], t: `i = ${i}: temp1 = <b>${hx(c)}</b> → ${CMDTXT[c]}${c === 0x30 || c === 0x20 ? ' <span class="pill">only high nibble (flag2 = 1)</span>' : ''}`, f: s => { const f2 = c === 0x30 || c === 0x20; s.lcd.bus(0, c >> 4); if (!f2) s.lcd.bus(0, c & 15); set(s, { i, temp1: c, flag1: 0, flag2: f2 ? 1 : 0 }); } }));
    S.push({ l: [L('flag1 =1'), L('i =0;')], t: '<b>flag1 = 1</b> → now sending <b>data</b> (characters). i = 0.', f: s => set(s, { flag1: 1, i: 0 }) });
    const msg = 'WELCOME \0';
    if (!fix) {
      for (let i = 0; i < 8; i++) { const ch = msg.charCodeAt(i + 1); S.push({ l: [L('while (msg[i++]'), L('temp1 = msg[i]'), L('lcd_write();//Send')], t: `test msg[${i}] = '${msg[i]}' ≠ '\\0' → i++ → i = ${i + 1} → temp1 = msg[${i + 1}] = <b>${ch === 32 ? "' ' (space)" : ch ? "'" + msg[i + 1] + "'" : "'\\0' (0x00!)"}</b>${i === 0 ? ' — <span class="p-red">"W" got skipped!</span>' : ''}${!ch ? ' → a junk box appears' : ''}`, f: s => { s.lcd.bus(1, ch >> 4); s.lcd.bus(1, ch & 15); set(s, { i: i + 1, temp1: ch }); } }); }
      S.push({ l: [L('while (msg[i++]'), L('while(1);')], t: 'msg[8] = \'\\0\' → loop ends. Result: <b>"ELCOME "</b> + junk. Flip to the fixed loop to compare.', f: s => set(s, { i: 9 }) });
    } else {
      for (let i = 0; i < 8; i++) { const ch = msg.charCodeAt(i); S.push({ l: [L('while (msg[i] !='), L('temp1 = msg[i]'), L('lcd_write();//Send'), L('i++;')], t: `msg[${i}] = <b>${ch === 32 ? "' ' (space)" : "'" + msg[i] + "'"}</b> → send it, then i = ${i + 1}.`, f: s => { s.lcd.bus(1, ch >> 4); s.lcd.bus(1, ch & 15); set(s, { i: i + 1, temp1: ch }); } }); }
      S.push({ l: [L('while (msg[i] !='), L('while(1);')], t: 'msg[8] = \'\\0\' → stop. <b>"WELCOME "</b> ✓ — then <code>while(1);</code> keeps the program parked.', f: s => set(s, { i: 8 }) });
    }
    return { code, S };
  }
  let fix = false, st;
  const view = (s, v, k, first) => {
    if (first) { v.innerHTML = ''; v._lcd = new HD44780(); v._lv = LCDView(v, v._lcd); v._kv = el('div', { class: 'kv small mt' }); v.appendChild(v._kv); }
    Object.assign(v._lcd, s.lcd); v._lcd.dd = s.lcd.dd.slice(); v._lv.draw();
    v._kv.innerHTML = `<span>i</span><span>${s.i ?? '–'}</span><span>temp1</span><span>${s.temp1 != null ? hx(s.temp1) + (s.flag1 && s.temp1 >= 32 ? ` '${String.fromCharCode(s.temp1)}'` : '') : '–'}</span><span>flag1 / flag2</span><span>${s.flag1 ?? '–'} / ${s.flag2 ?? '–'}</span><span>LCD mode</span><span>${s.lcd.bus8 ? '8-bit' : '4-bit'} · display ${s.lcd.D ? 'ON' : 'off'}</span>`;
  };
  function make() { host.innerHTML = ''; host.className = ''; const b = build(fix); st = Stepper(host, { code: b.code, title: fix ? 'welcome.c (fixed loop)' : 'welcome.c (slide)', steps: b.S, init: () => ({ lcd: new HD44780() }), view, speed: 1300 }); }
  chipGroup(pick, [[0, 'slide version'], [1, 'fixed message loop']], 0, v => { fix = v === '1'; make(); });
  make();
});
