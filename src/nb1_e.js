/* =========================================================
   NOTEBOOK 1 · part E — LCD questions (full solutions + sims)
   ========================================================= */

/* generic "event" exercise: code on the left, live hardware on the right.
   Each user action builds a little trace that plays through the code. */
function Exercise(id, title, info, o) {
  const w = W(id, title, info);
  const ctl = el('div', { class: 'row mb' }); w.appendChild(ctl);
  const host = el('div'); w.appendChild(host);
  let world = o.world();
  const cloneW = x => { const c = Object.assign({}, x); if (x.lcd) c.lcd = x.lcd.clone(); return c; };
  const view = (s, v, k, first) => { if (first) { v.innerHTML = ''; v._lv = LCDView(v, new HD44780()); o.setup && o.setup(v); } v._lv.lcd = s.lcd; v._lv.draw(); o.paint && o.paint(s, v); };
  const st = Stepper(host, { code: o.code, title: o.file, steps: [{ l: [], t: o.hello }], init: () => cloneW(world), view, speed: o.speed || 900, noteClass: 'orange' });
  const api = {
    w, ctl, st, get world() { return world; },
    fire(steps, play = true) { world = st.last(); st.setSteps(steps, 0); if (play) st.play(); },
    commitNow() { world = st.last(); },
    reset() { world = o.world(); st.setSteps([{ l: [], t: o.hello }]); },
    L: t => lineOf(o.code, t)
  };
  return api;
}
const lcdWith = (l1, l2) => { const l = new HD44780().ready(); l.print(l1 || ''); if (l2 != null) { l.cmd(0xC0); l.print(l2); } return l; };

/* ---------- Q1: keypad → LCD ---------- */
const Q1_CODE = `#include <LPC17xx.h>
/* + the LCD driver from above (lcd_init, lcd_cmd, lcd_char, lcd_str) */
unsigned char row, col;
unsigned long temp3;
unsigned char key_ascii[16] = {'0','1','2','3','4','5','6','7',
                               '8','9','A','b','c','d','E','F'};
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    lcd_init();
    lcd_str("KEY PRESSED:");
    LPC_GPIO2->FIODIR = 0x00003C00;   // rows P2.10-P2.13 = outputs
    LPC_GPIO1->FIODIR = 0;            // cols P1.23-P1.26 = inputs
    while(1)
    {
        for(row = 0; row < 4; row++)
        {
            LPC_GPIO2->FIOPIN = 1 << (10 + row);      // one row HIGH
            temp3 = LPC_GPIO1->FIOPIN & 0x07800000;   // read the columns
            if(temp3 != 0)                            // a key in this row!
            {
                if(temp3 == 1<<23) col = 0;
                else if(temp3 == 1<<24) col = 1;
                else if(temp3 == 1<<25) col = 2;
                else if(temp3 == 1<<26) col = 3;
                lcd_cmd(0xC0);                         // line 2, box 1
                lcd_char(key_ascii[row*4 + col]);      // show it
                while((LPC_GPIO1->FIOPIN & 0x07800000) != 0); // wait for release
                break;
            }
        }
    }
}`;
BUILD.push(function wQ1() {
  const ex = Exercise('w-q1', 'Q1 · solution', 'tap a key on the keypad below', {
    code: Q1_CODE, file: 'q1_keypad_lcd.c', hello: 'Program is running: LCD shows "KEY PRESSED:". <b>Tap a key</b> on the keypad → watch the scan find it.',
    world: () => ({ lcd: lcdWith('KEY PRESSED:'), row: null }),
    setup: v => { v._kp = Keypad(v, { onchange: (p, i, how) => { if (how === 'down' || how === undefined) press(i); } }); v._kv = el('div', { class: 'say' }); v.appendChild(v._kv); },
    paint: (s, v) => { v._kp.row(s.row); v._kv.innerHTML = s.row != null ? `row = ${s.row}${s.col != null ? `, col = ${s.col}` : ''}${s.t3 != null ? ` · temp3 = ${hex(s.t3)}` : ''}` : ''; }
  });
  const L = ex.L;
  function press(k) {
    const r = k >> 2, c = k & 3; const S = [];
    for (let rr = 0; rr <= r; rr++) {
      S.push({ l: [L('for(row = 0'), L('FIOPIN = 1 << (10 + row)')], t: `row = ${rr} → P2.${10 + rr} HIGH.`, f: s => set(s, { row: rr, col: null, t3: null }) });
      const t3 = rr === r ? (1 << (23 + c)) >>> 0 : 0;
      S.push({ l: [L('temp3 = LPC_GPIO1->FIOPIN'), L('if(temp3 != 0)')], t: rr === r ? `temp3 = ${hex(t3)} ≠ 0 → <b>a key in this row!</b>` : 'temp3 = 0 → nothing here, next row.', f: s => set(s, { t3 }) });
    }
    S.push({ l: [L(`temp3 == 1<<${23 + c}`)], t: `temp3 == 1&lt;&lt;${23 + c} → <b>col = ${c}</b>. keycode = ${r}×4 + ${c} = ${k}.`, f: s => set(s, { col: c }) });
    S.push({ l: L('lcd_cmd(0xC0)'), t: 'Command 0xC0 → cursor to line 2, box 1.', f: s => { s.lcd.cmd(0xC0); } });
    S.push({ l: L('lcd_char(key_ascii'), t: `key_ascii[${k}] = '${KEYLAB[k]}' (${hx(KEYLAB[k].charCodeAt(0))}) sent as data → it appears!`, f: s => { s.lcd.data(KEYLAB[k].charCodeAt(0)); } });
    S.push({ l: L('wait for release'), t: 'Stay here until the key is released → one press = one character.' });
    S.push({ l: L('break;'), t: 'break → while(1) → scanning restarts from row 0.', f: s => set(s, { row: null, col: null, t3: null }) });
    ex.fire(S);
  }
});

/* ---------- Q2: BCD counter ---------- */
const Q2_CODE = `#include <LPC17xx.h>
/* + the LCD driver from above */
void delay_ms(unsigned int ms);
unsigned char d[4] = {0,0,0,0};      // thousands, hundreds, tens, units
int main(void)
{
    int k;
    SystemInit();
    SystemCoreClockUpdate();
    lcd_init();
    lcd_str("BCD COUNTER");
    while(1)
    {
        lcd_cmd(0xC0);                // line 2, box 1
        for(k = 0; k < 4; k++)
            lcd_char(d[k] + 0x30);    // BCD digit -> ASCII
        delay_ms(500);
        k = 3;                        // add 1 to the units digit
        d[k]++;
        while(k > 0 && d[k] > 9)      // ripple carry
        {
            d[k] = 0;
            k--;
            d[k]++;
        }
        if(d[0] > 9) d[0] = 0;        // 9999 -> 0000
    }
}
void delay_ms(unsigned int ms)        // Timer0, 1 ms per TC step
{
    LPC_TIM0->TCR = 0x02;
    LPC_TIM0->EMR = 0x20;
    LPC_TIM0->PR  = 2999;
    LPC_TIM0->MR0 = ms;
    LPC_TIM0->MCR = 0x04;
    LPC_TIM0->TCR = 0x01;
    while(!(LPC_TIM0->EMR & 0x01));
}`;
BUILD.push(function wQ2() {
  const ds = d => d.join('');
  const ex = Exercise('w-q2', 'Q2 · solution', 'step one count, or let it run', {
    code: Q2_CODE, file: 'q2_bcd_counter.c', hello: 'Press <b>count +1 (step)</b> to see one loop pass, including the carries. Try the presets 0099 / 0999 / 9999.',
    world: () => ({ lcd: lcdWith('BCD COUNTER', '0000'), d: [0, 0, 0, 0] }),
    setup: v => { v._dg = el('div', { class: 'bcd' }); v.appendChild(v._dg); },
    paint: (s, v) => { v._dg.innerHTML = s.d.map((x, i) => `<span class="${s.k === i ? 'on' : ''}"><b>${x}</b><small>d[${i}]</small></span>`).join(''); }
  });
  const L = ex.L;
  function stepOne() {
    const d0 = ex.st.last().d.slice(); const S = [];
    S.push({ l: [L('lcd_cmd(0xC0)')], t: 'Cursor → line 2, box 1.', f: s => { s.lcd.cmd(0xC0); s.k = null; } });
    S.push({ l: [L('for(k = 0'), L('lcd_char(d[k] + 0x30)')], t: `Print each digit + 0x30: ${d0.map(x => `${x}→'${x}'`).join(' ')}`, f: s => { s.lcd.print(ds(s.d)); } });
    S.push({ l: L('delay_ms(500);'), t: 'Wait 0.5 s (Timer0).' });
    const d = d0.slice(); let k = 3; d[k]++;
    S.push({ l: [L('k = 3;'), L('d[k]++;')], t: `units + 1 → d[3] = ${d[3]}`, f: s => { s.d = d.slice(); s.k = 3; } });
    while (k > 0 && d[k] > 9) { d[k] = 0; k--; d[k]++; const snap = d.slice(), kk = k; S.push({ l: [L('while(k > 0'), L('d[k] = 0;'), L('k--;'), L('d[k]++;', 2)], t: `d[${kk + 1}] became 10 → set it to 0 and <b>carry</b> into d[${kk}] → ${snap.join('')}`, f: s => { s.d = snap.slice(); s.k = kk; } }); }
    if (d[0] > 9) { d[0] = 0; S.push({ l: L('if(d[0] > 9)'), t: '9999 + 1 → wrap to <b>0000</b>.', f: s => { s.d = [0, 0, 0, 0]; s.k = 0; } }); }
    S.push({ l: [L('lcd_cmd(0xC0)'), L('lcd_char(d[k] + 0x30)')], t: `Next pass prints <b>${d.join('')}</b>.`, f: s => { s.lcd.cmd(0xC0); s.lcd.print(ds(s.d)); s.k = null; } });
    ex.fire(S);
  }
  const b1 = el('button', { class: 'btn p', type: 'button' }, 'count +1 (step)'); b1.onclick = stepOne; ex.ctl.appendChild(b1);
  [['0099', [0, 0, 9, 9]], ['0999', [0, 9, 9, 9]], ['9999', [9, 9, 9, 9]], ['0000', [0, 0, 0, 0]]].forEach(([t, d]) => { const b = el('button', { class: 'chip', type: 'button' }, t); b.onclick = () => { ex.st.setSteps([{ l: [], t: `Preset: d[] = {${d.join(',')}}`, f: s => { s.d = d.slice(); s.lcd.cmd(0xC0); s.lcd.print(d.join('')); } }]); ex.commitNow(); }; ex.ctl.appendChild(b); });
  let run = null; const br = el('button', { class: 'btn sm y', type: 'button' }, '▶ run fast'); ex.ctl.appendChild(br);
  br.onclick = () => { if (run) { clearInterval(run); run = null; br.textContent = '▶ run fast'; return; } br.textContent = '❚❚ stop'; run = setInterval(() => { const s = ex.st.last(); const d = s.d.slice(); let k = 3; d[k]++; while (k > 0 && d[k] > 9) { d[k] = 0; k--; d[k]++; } if (d[0] > 9) d[0] = 0; ex.st.setSteps([{ l: [ex.L('lcd_char(d[k] + 0x30)')], t: `running… ${d.join('')}`, f: x => { x.d = d; x.lcd.cmd(0xC0); x.lcd.print(d.join('')); } }]); ex.commitNow(); }, 120); };
});

/* ---------- Q3: digital clock ---------- */
const Q3_CODE = `#include <LPC17xx.h>
/* + the LCD driver and delay_ms() from above */
unsigned char hh = 23, mm = 59, ss = 50;   // starting time
void show2(unsigned char v)                // 2-digit number
{
    lcd_char(v / 10 + '0');                // tens
    lcd_char(v % 10 + '0');                // units
}
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    lcd_init();
    lcd_str("DIGITAL CLOCK");
    while(1)
    {
        lcd_cmd(0xC0);                     // line 2, box 1
        show2(hh); lcd_char(':');
        show2(mm); lcd_char(':');
        show2(ss);
        delay_ms(1000);                    // 1 second
        ss++;
        if(ss == 60) { ss = 0; mm++; }
        if(mm == 60) { mm = 0; hh++; }
        if(hh == 24) { hh = 0; }
    }
}`;
BUILD.push(function wQ3() {
  const p2 = n => String(n).padStart(2, '0'); const tstr = s => `${p2(s.hh)}:${p2(s.mm)}:${p2(s.ss)}`;
  const ex = Exercise('w-q3', 'Q3 · solution', 'live clock · step one second to see the roll-overs', {
    code: Q3_CODE, file: 'q3_clock.c', hello: 'Clock starts at 23:59:50. Step a second, or run it fast and watch midnight.',
    world: () => ({ lcd: lcdWith('DIGITAL CLOCK', '23:59:50'), hh: 23, mm: 59, ss: 50 })
  });
  const L = ex.L;
  function tick(play = true) {
    const s0 = ex.st.last(); let { hh, mm, ss } = s0; const S = [];
    S.push({ l: [L('lcd_cmd(0xC0)'), L('show2(hh)'), L('show2(mm)'), L('show2(ss);')], t: `Print ${tstr(s0)}: each number → tens = v/10, units = v%10, each + '0'.`, f: s => { s.lcd.cmd(0xC0); s.lcd.print(tstr(s)); } });
    S.push({ l: L('delay_ms(1000)'), t: 'Wait exactly 1 s with Timer0.' });
    ss++; S.push({ l: L('ss++;'), t: `ss = ${ss}`, f: s => { s.ss++; } });
    if (ss === 60) { ss = 0; mm++; S.push({ l: L('if(ss == 60)'), t: `ss hit 60 → ss = 0, mm + 1 = ${mm}`, f: s => { s.ss = 0; s.mm++; } }); }
    if (mm === 60) { mm = 0; hh++; S.push({ l: L('if(mm == 60)'), t: `mm hit 60 → mm = 0, hh + 1 = ${hh}`, f: s => { s.mm = 0; s.hh++; } }); }
    if (hh === 24) { hh = 0; S.push({ l: L('if(hh == 24)'), t: 'hh hit 24 → <b>midnight</b>, hh = 0', f: s => { s.hh = 0; } }); }
    S.push({ l: [L('lcd_cmd(0xC0)'), L('show2(ss);')], t: `Next print: <b>${p2(hh)}:${p2(mm)}:${p2(ss)}</b>`, f: s => { s.lcd.cmd(0xC0); s.lcd.print(tstr(s)); } });
    if (play) ex.fire(S); else { ex.st.setSteps(S, S.length - 1); ex.commitNow(); }
  }
  const b1 = el('button', { class: 'btn p', type: 'button' }, '+1 second (step)'); b1.onclick = () => tick(true); ex.ctl.appendChild(b1);
  let run = null; const br = el('button', { class: 'btn sm y', type: 'button' }, '▶ run (×10)'); ex.ctl.appendChild(br);
  br.onclick = () => { if (run) { clearInterval(run); run = null; br.textContent = '▶ run (×10)'; return; } br.textContent = '❚❚ stop'; run = setInterval(() => tick(false), 100); };
  [['12:59:58', [12, 59, 58]], ['23:59:55', [23, 59, 55]]].forEach(([t, [h, m, s]]) => { const b = el('button', { class: 'chip', type: 'button' }, 'set ' + t); b.onclick = () => { ex.st.setSteps([{ l: [], t: 'Time set to ' + t, f: x => { x.hh = h; x.mm = m; x.ss = s; x.lcd.cmd(0xC0); x.lcd.print(t); } }]); ex.commitNow(); }; ex.ctl.appendChild(b); });
});

/* ---------- Q4: die tossing ---------- */
const Q4_CODE = `#include <LPC17xx.h>
/* + the LCD driver from above */
int main(void)
{
    unsigned char dice = 1;
    SystemInit();
    SystemCoreClockUpdate();
    lcd_init();
    lcd_str("DIE TOSS: P2.12");
    LPC_PINCON->PINSEL4 &= ~(3<<24);      // P2.12 = GPIO
    LPC_GPIO2->FIODIR &= ~(1<<12);        // P2.12 = input (the key)
    while(1)
    {
        dice++;                           // spins 1..6 very fast
        if(dice > 6) dice = 1;
        if(!(LPC_GPIO2->FIOPIN & (1<<12)))  // key pressed -> logic 0
        {
            lcd_cmd(0xC0);                // line 2, box 1
            lcd_str("YOU GOT: ");
            lcd_char(dice + '0');         // number -> ASCII
            while(!(LPC_GPIO2->FIOPIN & (1<<12)));  // wait for release
        }
    }
}`;
BUILD.push(function wQ4() {
  let spin = 1, held = false;
  const ex = Exercise('w-q4', 'Q4 · solution', 'press the P2.12 key — when you press decides the number', {
    code: Q4_CODE, file: 'q4_dice.c', hello: 'The <code>dice</code> variable is spinning 1→6→1… millions of times a second (slowed down here). Press <b>P2.12</b>!',
    world: () => ({ lcd: lcdWith('DIE TOSS: P2.12'), face: 0 }),
    setup: v => {
      const r = el('div', { class: 'row' }); v.appendChild(r);
      v._spin = el('div', { class: 'spinbox' }); r.appendChild(v._spin);
      v._die = sv('svg', { class: 'die', viewBox: '0 0 100 100', width: 86, height: 86 }); r.appendChild(v._die);
      const key = el('button', { class: 'bigkey', type: 'button' }, 'P2.12<br><small>press</small>'); r.appendChild(key);
      key.addEventListener('pointerdown', e => { e.preventDefault(); if (held) return; held = true; key.classList.add('down'); toss(); });
      const up = () => { held = false; key.classList.remove('down'); }; key.addEventListener('pointerup', up); key.addEventListener('pointerleave', up);
      key.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toss(); } });
    },
    paint: (s, v) => { drawDie(v._die, s.face); }
  });
  const L = ex.L;
  function drawDie(g, n) { const P = { 1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[26, 26], [50, 50], [74, 74]], 4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]], 6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]] }; g.innerHTML = `<rect x="6" y="6" width="88" height="88" rx="18" style="fill:var(--paper);stroke:var(--ink);stroke-width:3"/>` + (P[n] || []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" style="fill:${n === 1 ? 'var(--red)' : 'var(--ink)'}"/>`).join('') + (n ? '' : '<text x="50" y="58" text-anchor="middle" style="font-family:Gaegu;font-size:22px;fill:var(--ink3)">?</text>'); }
  function toss() {
    const n = spin; const S = [
      { l: [L('dice++;'), L('if(dice > 6)')], t: `dice was spinning… caught at <b>${n}</b>.` },
      { l: L('if(!(LPC_GPIO2->FIOPIN & (1<<12)))'), t: 'Key pressed → P2.12 reads <b>0</b> → !(0) is true → enter.' },
      { l: [L('lcd_cmd(0xC0)'), L('lcd_str("YOU GOT: ")')], t: 'Cursor to line 2, print "YOU GOT: ".', f: s => { s.lcd.cmd(0xC0); s.lcd.print('YOU GOT: '); } },
      { l: L('lcd_char(dice + \'0\')'), t: `${n} + '0' = '${n}' → shown!`, f: s => { s.lcd.data(48 + n); s.face = n; } },
      { l: L('wait for release'), t: 'Wait for release, then the spinning continues.' }
    ];
    ex.fire(S);
  }
  const lp = Loop(ex.w, (dt, t) => { spin = (Math.floor(t / 70) % 6) + 1; const sb = $('.spinbox', ex.w); if (sb) sb.innerHTML = `<small>dice =</small><b>${spin}</b>`; });
  lp.start();
});

/* ---------- Q5: calculator ---------- */
const Q5_CODE = `#include <LPC17xx.h>
#include <stdio.h>
/* + the LCD driver from above */
unsigned char get_key(void);
unsigned char op_sym[4] = {'+','-','*','/'};
int main(void)
{
    unsigned char key, state = 0, a = 0, b = 0, op = 0;
    int result;
    char buf[8];
    SystemInit();
    SystemCoreClockUpdate();
    lcd_init();
    LPC_GPIO2->FIODIR = 0x00003C00;            // rows out
    LPC_GPIO1->FIODIR = 0;                     // cols in
    while(1)
    {
        key = get_key();                       // 0..15
        if(key == 15) { lcd_cmd(0x01); state = 0; continue; }  // F = clear
        if(state == 0 && key <= 9)             // number a
        {
            a = key; lcd_cmd(0x01); lcd_char(a + '0'); state = 1;
        }
        else if(state == 1 && key >= 10 && key <= 13)  // operator
        {
            op = key - 10; lcd_char(op_sym[op]); state = 2;
        }
        else if(state == 2 && key <= 9)        // number b
        {
            b = key; lcd_char(b + '0'); lcd_char('=');
            if(op == 0) result = a + b;
            else if(op == 1) result = a - b;
            else if(op == 2) result = a * b;
            else if(b == 0) { lcd_str("ERR"); state = 0; continue; }
            else result = a / b;               // integer division
            sprintf(buf, "%d", result);        // number -> text
            lcd_str(buf);
            state = 0;
        }
    }
}
unsigned char get_key(void)                    // wait for a key, return 0..15
{
    unsigned char r, c; unsigned long t3;
    while(1)
        for(r = 0; r < 4; r++)
        {
            LPC_GPIO2->FIOPIN = 1 << (10 + r);
            t3 = LPC_GPIO1->FIOPIN & 0x07800000;
            if(t3 != 0)
            {
                c = (t3 == 1<<23) ? 0 : (t3 == 1<<24) ? 1 : (t3 == 1<<25) ? 2 : 3;
                while((LPC_GPIO1->FIOPIN & 0x07800000) != 0);   // wait release
                return r * 4 + c;
            }
        }
}`;
BUILD.push(function wQ5() {
  const LAB = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '−', '×', '÷', 'E', 'CLR'];
  const ex = Exercise('w-q5', 'Q5 · solution', 'type e.g. 7 × 8 on the keypad', {
    code: Q5_CODE, file: 'q5_calculator.c', hello: 'state = 0 → waiting for the first number <b>a</b>. Tap a digit.',
    world: () => ({ lcd: lcdWith(''), state: 0, a: 0, b: 0, op: 0 }),
    setup: v => { v._kp = Keypad(v, { labels: LAB, onchange: (p, i, how) => { if (how === 'down' || how === undefined) press(i); } }); v._kv = el('div', { class: 'say' }); v.appendChild(v._kv); },
    paint: (s, v) => { v._kv.innerHTML = `state = <b>${s.state}</b> (${['expect a', 'expect operator', 'expect b'][s.state]}) · a = ${s.a} · op = ${'+-*/'[s.op]} · b = ${s.b}`; }
  });
  const L = ex.L;
  function press(k) {
    const s0 = ex.st.last(); const S = [{ l: [L('key = get_key()')], t: `get_key() scans and returns <b>${k}</b> (key "${LAB[k]}").` }];
    if (k === 15) S.push({ l: L('if(key == 15)'), t: 'F → clear screen, state = 0.', f: s => { s.lcd.cmd(1); s.state = 0; } });
    else if (s0.state === 0 && k <= 9) S.push({ l: [L('if(state == 0'), L('a = key; lcd_cmd(0x01)')], t: `a = ${k}, clear LCD, print '${k}', state → 1.`, f: s => { s.a = k; s.lcd.cmd(1); s.lcd.data(48 + k); s.state = 1; } });
    else if (s0.state === 1 && k >= 10 && k <= 13) S.push({ l: [L('else if(state == 1'), L('op = key - 10')], t: `op = ${k} − 10 = ${k - 10} → print '${'+-*/'[k - 10]}', state → 2.`, f: s => { s.op = k - 10; s.lcd.data('+-*/'.charCodeAt(k - 10)); s.state = 2; } });
    else if (s0.state === 2 && k <= 9) {
      const a = s0.a, op = s0.op, b = k; let res, err = false;
      if (op === 0) res = a + b; else if (op === 1) res = a - b; else if (op === 2) res = a * b; else if (b === 0) err = true; else res = Math.trunc(a / b);
      S.push({ l: [L('else if(state == 2'), L("b = key; lcd_char(b + '0')")], t: `b = ${b}, print '${b}' and '='.`, f: s => { s.b = b; s.lcd.data(48 + b); s.lcd.data(61); } });
      if (err) S.push({ l: L('else if(b == 0)'), t: 'Division by zero → print "ERR", state → 0.', f: s => { s.lcd.print('ERR'); s.state = 0; } });
      else S.push({ l: [L(['if(op == 0)', 'else if(op == 1)', 'else if(op == 2)', 'else result = a / b'][op]), L('sprintf(buf'), L('lcd_str(buf)')], t: `result = ${a} ${'+-*/'[op]} ${b} = <b>${res}</b>${op === 3 ? ' (integer division drops the fraction)' : ''} → sprintf turns it into the text "${res}" → printed. state → 0.`, f: s => { s.lcd.print(String(res)); s.state = 0; } });
    } else S.push({ l: [L('if(state == 0'), L('else if(state == 1'), L('else if(state == 2')], t: `Key "${LAB[k]}" doesn't fit state ${s0.state} → ignored.` });
    ex.fire(S);
  }
});
