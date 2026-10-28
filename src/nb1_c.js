/* =========================================================
   NOTEBOOK 1 · part C — the six timer programs
   ========================================================= */

/* shared view: LED + timer box + registers + waveform */
function tView(v, o) {
  v.innerHTML = '';
  const top = el('div', { class: 'row' }); v.appendChild(top);
  const ledW = el('div', { class: 'col center' }); top.appendChild(ledW);
  v._led = el('span', { class: 'led', style: 'width:34px;height:34px' }); ledW.append(v._led, el('span', { class: 'pinlbl' }, o.pin || 'P0.2'));
  const tb = el('div', { class: 'tbox grow' }); top.appendChild(tb);
  tb.innerHTML = `<div class="row spread small"><span class="gae">${o.tname || 'Timer0'}</span><span class="tst pill"></span></div><div class="tbar"><i></i><b></b></div><div class="row spread small"><span class="mono tcv"></span><span class="emv"></span></div>`;
  v._tb = tb;
  v._kv = el('div', { class: 'rgs' }); v.appendChild(v._kv);
  v._wv = sv('svg', { class: 'dg', viewBox: `0 0 520 ${o.h || 92}` }); v.appendChild(v._wv);
}
function tPaint(v, s, o) {
  v._led.classList.toggle('on', !!s.led);
  const st = v._tb.querySelector('.tst'); st.textContent = s.tcr || 'not set'; st.className = 'tst pill ' + (s.tcr === 'counting' ? 'g' : s.tcr === 'reset' ? 'p' : s.tcr === 'stopped' ? 'y' : '');
  const bar = v._tb.querySelector('.tbar i'); const max = s.mr0 || 1; bar.style.width = Math.min(100, (s.tc || 0) / max * 100) + '%';
  v._tb.querySelector('.tbar b').style.left = '100%';
  v._tb.querySelector('.tcv').textContent = `TC = ${s.tc ?? 0}${s.mr0 != null ? ' / MR0 = ' + s.mr0 : ''}`;
  v._tb.querySelector('.emv').innerHTML = s.em0 != null ? `EM0 = <b class="${s.em0 ? 'p-green' : ''}">${s.em0}</b>` : '';
  const R = o.regs || ['tcr', 'emr', 'pr', 'mr0', 'mcr'];
  const nm = { tcr: 'TCR', emr: 'EMR', pr: 'PR', mr0: 'MR0', mcr: 'MCR', ctcr: 'CTCR', ccr: 'CCR' };
  v._kv.innerHTML = R.map(k => `<span class="rgc${s['r_' + k] != null ? ' set' : ''}"><i>${nm[k]}</i><b>${s['r_' + k] != null ? s['r_' + k] : '–'}</b></span>`).join('');
  // waveform
  const g = v._wv, T = o.T || 4, X = t => 44 + t / T * 466;
  g.innerHTML = '';
  for (let t = 0; t <= T; t += .5) { sv('path', { d: `M${X(t)} 14 V70`, style: 'stroke:var(--faint);stroke-width:1' }, g); if (t % 1 === 0) sv('text', { x: X(t), y: 88, 'text-anchor': 'middle', class: 'mono', style: 'font-size:14px' }, g).textContent = t + 's'; }
  sv('text', { x: 2, y: 48, class: 'lbl', style: 'font-size:16px' }, g).textContent = o.pin || 'P0.2';
  if (s.wave && s.wave.length) { const pts = s.wave.concat([[s.t, s.wave[s.wave.length - 1][1]]]); sv('path', { d: digi(pts, X, 22, 64), style: 'fill:none;stroke:var(--red);stroke-width:2.6;stroke-linejoin:round' }, g); }
  sv('path', { d: `M${X(s.t || 0)} 8 V74`, style: 'stroke:var(--pink);stroke-width:1.6;stroke-dasharray:3 3' }, g);
}

/* ---------- P1: blink every second ---------- */
const P1_CODE = `#include<stdio.h>
#include<LPC17xx.h>
void delay(void)
{
    LPC_TIM0->TCR = 0x00000002;   // Timer0 Reset
    LPC_TIM0->EMR = 0X20;         //Set match bit upon match
    LPC_TIM0->PR = 1000;
    LPC_TIM0->MR0 = 3000;         //for 1 second
    LPC_TIM0->MCR = 0x00000004;   // stop PC and TC on MR0
    LPC_TIM0->TCR = 0x00000001;   // Timer0 Enable
    while ( !(LPC_TIM0->EMR & 0x01)); // wait until match
    return;
}
int main(void)
{
    LPC_GPIO0->FIODIR=0x00000004;
    while(1)
    {
        LPC_GPIO0->FIOSET=0x4;
        delay();
        LPC_GPIO0->FIOCLR=0x4;
        delay();
    }
}`;
function delaySteps(L, mr, pr, extra = {}) {
  return [
    { l: [L('TCR = 0x00000002')], t: 'Inside <code>delay()</code>: <b>TCR = 2</b> → TC &amp; PC held at 0.', f: s => set(s, { tcr: 'reset', tc: 0, r_tcr: '0x02' }) },
    { l: [L('EMR = 0X20')], t: '<b>EMR = 0x20</b> → EMC0 = 10 = "set EM0 on a match". Bit 0 (EM0) is written <b>0</b> → the flag is cleared.', f: s => set(s, { em0: 0, r_emr: '0x20' }) },
    ...(pr != null ? [{ l: [L('PR = ' + pr)], t: `<b>PR = ${pr}</b> → TC + 1 every ${pr + 1} PCLK ticks = ${((pr + 1) / 3000).toFixed(4)} ms.`, f: s => set(s, { r_pr: pr }) }] : []),
    ...(mr != null ? [{ l: [L('MR0 = ' + mr)], t: `<b>MR0 = ${mr}</b> → ${mr} × ${((pr + 1) / 3000).toFixed(4)} ms ≈ <b>${(mr * (pr + 1) / 3e6).toFixed(3)} s</b>.`, f: s => set(s, { mr0: mr, r_mr0: mr }) }] : []),
    { l: [L('MCR = 0x00000004')], t: '<b>MCR = 4</b> = bit 2 (MR0S) → <b>stop</b> TC &amp; PC when TC = MR0.', f: s => set(s, { r_mcr: '0x04' }) },
    { l: [L('TCR = 0x00000001')], t: '<b>TCR = 1</b> → start counting.', f: s => set(s, { tcr: 'counting', r_tcr: '0x01' }) },
    { l: [L('while ( !(LPC_TIM0->EMR & 0x01))')], t: 'Wait here… TC climbs to MR0. On the match: <b>EM0 → 1</b> and the timer stops → the loop exits.', f: s => set(s, Object.assign({ tc: s.mr0, em0: 1, tcr: 'stopped', r_tcr: '0x00' }, extra)) }
  ];
}
BUILD.push(function wP1() {
  const w = W('w-p1', 'P1 · step through', 'LED on P0.2, Timer0 polling');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(P1_CODE, t);
  const steps = [
    { l: L('FIODIR=0x00000004'), t: '<b>FIODIR = 0x4</b> → bit 2 = 1 → P0.2 is an output.', f: s => set(s, { led: 0 }) },
    { l: [L('while(1)'), L('FIOSET=0x4')], t: '<b>FIOSET = 0x4</b> → P0.2 HIGH → LED <b>ON</b> at t = 0 s.', f: s => set(s, { led: 1, wave: [[0, 1]], t: 0 }) },
    { l: L('delay();'), t: 'Call <code>delay()</code> — this is where the 1 second goes.' },
    ...delaySteps(L, 3000, 1000, { t: 1 }),
    { l: L('return;'), t: 'Return to main, t ≈ 1 s.' },
    { l: L('FIOCLR=0x4'), t: '<b>FIOCLR = 0x4</b> → P0.2 LOW → LED <b>OFF</b>.', f: s => { s.led = 0; s.wave = s.wave.concat([[1, 0]]); } },
    { l: L('delay();', 2), t: 'delay() again: EMR = 0x20 clears EM0 first, so the wait works again → another 1 s.', f: s => set(s, { t: 2, tc: 3000, em0: 1, tcr: 'stopped' }) },
    { l: L('FIOSET=0x4'), t: 'while(1) loops → LED ON at t = 2 s. ON 1 s + OFF 1 s = <b>period 2 s</b> (0.5 Hz square wave).', f: s => { s.led = 1; s.wave = s.wave.concat([[2, 1]]); } },
    { l: [L('delay();'), L('FIOCLR=0x4'), L('delay();', 2)], t: '…and so on, forever.', f: s => { s.wave = s.wave.concat([[3, 0], [4, 1]]); s.t = 4; s.led = 1; } }
  ];
  Stepper(host, { code: P1_CODE, title: 'blink_1s.c', steps, init: () => ({ led: 0, t: 0, wave: [] }), view: (s, v, k, f) => { if (f) tView(v, {}); tPaint(v, s, {}); } });
});

/* ---------- P2: 75 % duty ---------- */
const P2_CODE = `#include<stdio.h>
#include<LPC17xx.h>
void delay(void)
{
    //LPC_SC->PCONP |= (1<<1);   //powers the T0
    LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
    LPC_TIM0->EMR = 0X20;        //Set EM0 upon match
    LPC_TIM0->PR = 2999;
    LPC_TIM0->MCR = 0x00000004;  // stop PC and TC on MR0
    LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    while ( !(LPC_TIM0->EMR & 0x01));// Wait until EM0 is set
    return;
}
int main(void)
{
    LPC_GPIO0->FIODIR=0x00000004;
    while(1)
    {
        LPC_GPIO0->FIOPIN=0x00000004;
        LPC_TIM0->MR0 = 1500; //For 1.5 seconds
        delay();
        LPC_GPIO0->FIOPIN=0x00000000;
        LPC_TIM0->MR0 = 500;  //For 0.5 seconds
        delay();
    }
}`;
BUILD.push(function wP2() {
  const w = W('w-p2', 'P2 · step through', '1.5 s HIGH + 0.5 s LOW');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(P2_CODE, t);
  const dl = (mr, tEnd) => delaySteps(L, null, 2999, { t: tEnd }).map((x, i) => i === 2 ? Object.assign({}, x, { t: '<b>PR = 2999</b> → TC + 1 every 3000 PCLK = exactly <b>1 ms</b>. So MR0 = number of milliseconds.' }) : x);
  const steps = [
    { l: L('FIODIR=0x00000004'), t: 'P0.2 = output.' },
    { l: [L('while(1)'), L('FIOPIN=0x00000004')], t: '<b>FIOPIN = 0x4</b> → P0.2 HIGH (and every other port-0 pin 0 — fine here).', f: s => set(s, { led: 1, wave: [[0, 1]] }) },
    { l: L('MR0 = 1500'), t: '<b>MR0 = 1500</b> is set in main, <em>before</em> delay() — delay() itself never touches MR0.', f: s => set(s, { mr0: 1500, r_mr0: 1500 }) },
    { l: [L('delay();'), L('PCONP')], t: 'The PCONP line is commented out: Timer0 is already powered on after reset, so it isn\'t needed.' },
    ...dl(1500, 1.5),
    { l: L('return;'), t: 'After 1500 ms → back in main at t = 1.5 s.' },
    { l: L('FIOPIN=0x00000000'), t: 'P0.2 LOW.', f: s => { s.led = 0; s.wave = s.wave.concat([[1.5, 0]]); } },
    { l: L('MR0 = 500'), t: '<b>MR0 = 500</b> → the next delay lasts 0.5 s.', f: s => set(s, { mr0: 500, r_mr0: 500, tc: 0 }) },
    { l: L('delay();', 2), t: 'delay() → 500 ms → t = 2 s.', f: s => set(s, { t: 2, tc: 500, em0: 1, tcr: 'stopped' }) },
    { l: [L('FIOPIN=0x00000004'), L('MR0 = 1500')], t: 'Loop: HIGH again at 2 s. Period = 1.5 + 0.5 = 2 s, duty = 1.5 / 2 = <b>75 %</b>.', f: s => { s.led = 1; s.wave = s.wave.concat([[2, 1], [3.5, 0], [4, 1]]); s.t = 4; s.mr0 = 1500; s.r_mr0 = 1500; } }
  ];
  Stepper(host, { code: P2_CODE, title: 'duty75.c', steps, init: () => ({ led: 0, t: 0, wave: [] }), view: (s, v, k, f) => { if (f) tView(v, {}); tPaint(v, s, {}); } });
});

/* ---------- P3: hardware toggle on MAT0.0 ---------- */
const P3_CODE = `#include<stdio.h>
#include<LPC17xx.h>
void delay(void)
{
    LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
    LPC_TIM0->CTCR = 0x00000000;
    LPC_TIM0->EMR = 0X30;        //Toggle bit upon match
    LPC_TIM0->PR = 0;
    LPC_TIM0->MR0 = 3000000;
    LPC_TIM0->MCR = 0x00000002;  // Reset TC
    LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    return;
}
int main(void)
{
    LPC_PINCON->PINSEL3 |= (3<<24); //Get EM0 on MAT0.0 (P1.28) line
    delay();
    while(1);
}`;
BUILD.push(function wP3() {
  const w = W('w-p3', 'P3 · step through', 'the CPU sets it up, then does nothing');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(P3_CODE, t);
  const steps = [
    { l: L('PINSEL3 |= (3<<24)'), t: 'P1.28 → bits 25:24 of PINSEL3 = 11 → <b>MAT0.0</b>. Now EM0 is wired to this pin.', f: s => set(s, { pin: 1 }) },
    { l: [L('delay();'), L('TCR = 0x00000002')], t: 'delay() — here it only <b>configures</b> the timer (no waiting!). TCR = 2: reset.', f: s => set(s, { tcr: 'reset', r_tcr: '0x02' }) },
    { l: L('CTCR = 0x00000000'), t: 'CTCR = 0 → <b>timer mode</b> (count PCLK).', f: s => set(s, { r_ctcr: '0x00' }) },
    { l: L('EMR = 0X30'), t: 'EMR = 0x30 → EMC0 = 11 → <b>toggle EM0</b> at every match.', f: s => set(s, { r_emr: '0x30' }) },
    { l: L('PR = 0'), t: 'PR = 0 → TC + 1 on <b>every</b> PCLK tick (1/3 µs).', f: s => set(s, { r_pr: 0 }) },
    { l: L('MR0 = 3000000'), t: 'MR0 = 3 000 000 ticks × 1/3 µs = <b>1 s</b>.', f: s => set(s, { mr0: 3000000, r_mr0: '3000000' }) },
    { l: L('MCR = 0x00000002'), t: 'MCR = 2 = bit 1 (MR0R) → <b>reset TC</b> at the match → it starts over automatically.', f: s => set(s, { r_mcr: '0x02' }) },
    { l: L('TCR = 0x00000001'), t: 'TCR = 1 → go!', f: s => set(s, { tcr: 'counting', r_tcr: '0x01' }) },
    { l: [L('return;'), L('while(1);')], t: 'CPU sits in <code>while(1);</code> doing nothing. The timer runs alone: TC 0 → 3 000 000, match → EM0 toggles, TC → 0 …', f: s => set(s, { t: 1, wave: [[0, 0], [1, 1]] }) },
    { l: L('while(1);'), t: 'After 6 s: P1.28 toggled every second → <b>square wave, period 2 s</b>, made 100 % by hardware.', f: s => set(s, { t: 6, wave: [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0], [5, 1], [6, 0]] }) }
  ];
  const view = (s, v, k, f) => {
    if (f) { tView(v, { pin: 'P1.28', h: 150 }); }
    tPaint(v, Object.assign({}, s, { led: s.wave && s.wave.length ? s.wave[s.wave.length - 1][1] : 0, tc: s.t ? 'running' : 0 }), { pin: 'P1.28', T: 6, regs: ['tcr', 'ctcr', 'emr', 'pr', 'mr0', 'mcr'] });
    v._tb.querySelector('.tcv').textContent = s.t ? 'TC: 0 → 3 000 000 → 0 → …' : 'TC = 0';
    v._tb.querySelector('.tbar i').style.width = s.t ? '100%' : '0%';
    const g = v._wv, X = t => 44 + t / 6 * 466;
    sv('text', { x: 4, y: 124, class: 'lbl', style: 'font-size:16px' }, g).textContent = 'TC';
    if (s.t) { let d = 'M' + X(0) + ' 140'; for (let t = 0; t < s.t; t++) d += `L${X(t + 1) - 2} 100 L${X(t + 1)} 140`; sv('path', { d, style: 'fill:none;stroke:var(--blue);stroke-width:2' }, g); sv('text', { x: X(.5), y: 98, class: 'mono', style: 'font-size:10px' }, g).textContent = '3M'; }
  };
  Stepper(host, { code: P3_CODE, title: 'mat00_square.c', steps, init: () => ({ led: 0, t: 0, wave: [] }), view });
});

/* ---------- P4: divide by 8 ---------- */
const P4_CODE = `#include<stdio.h>
#include<LPC17xx.h>
void init_timer1(void)
{
    LPC_PINCON->PINSEL3 |= (3<<18 | 3<<4); //  MAT 1.1(P1.25) and CAP 1.0 (P1.18)
    LPC_TIM1->TCR = 2;      //Reset Counter1
    LPC_TIM1->CTCR = 0x2;   // Counter at -ve edge of CAP1.0
    LPC_TIM1->MR1 = 0x03;   //To count 4 clock pulses
    LPC_TIM1->MCR = 0x10;   //Clear TC upon Match1
    LPC_TIM1->EMR = 0xC0;   //Toggle EM1 upon Match
    LPC_TIM1->TCR = 1;      //Start Counter1
}
int main(void)
{
    init_timer1();
    while(1);
}`;
BUILD.push(function wP4() {
  const w = W('w-p4', 'P4 · pulse by pulse', 'every step = one more falling edge on P1.18');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(P4_CODE, t);
  const steps = [
    { l: L('PINSEL3 |='), t: '<b>3&lt;&lt;18</b> → P1.25 = MAT1.1 (output). <b>3&lt;&lt;4</b> → P1.18 = CAP1.0 (count input).' },
    { l: L('TCR = 2;'), t: 'Reset counter 1.' },
    { l: L('CTCR = 0x2'), t: 'CTCR = 0x2 → bits 1:0 = 10 → <b>count falling edges</b>; bits 3:2 = 00 → of <b>CAP1.0</b>.' },
    { l: L('MR1 = 0x03'), t: 'MR1 = 3 → match when TC reaches 3.' },
    { l: L('MCR = 0x10'), t: 'MCR = 0x10 = bit 4 = <b>MR1R</b> → reset TC on MR1 match → TC goes 0,1,2,3,0,1,… = 4 counts per round.' },
    { l: L('EMR = 0xC0'), t: 'EMR = 0xC0 → bits 7:6 = 11 → <b>EMC1 = toggle</b> EM1 (= pin P1.25) on every MR1 match.' },
    { l: [L('TCR = 1;'), L('while(1);')], t: 'Start. CPU idles. Now feed pulses into P1.18 …', f: s => { s.go = 1; } }
  ];
  let tc = 0, out = 0; const ev = [];
  for (let e = 1; e <= 16; e++) {
    let txt, m = 0; const was = tc;
    if (tc === 3) { tc = 0; txt = `falling edge #${e} → TC was 3 (= MR1) → <b>reset to 0</b>`; }
    else { tc++; if (tc === 3) { m = 1; out ^= 1; txt = `falling edge #${e} → TC = 3 = MR1 → <b>match!</b> EM1 toggles → P1.25 = <b>${out}</b>`; } else txt = `falling edge #${e} → TC = ${tc}`; }
    ev.push({ e, tc, out, m, txt });
  }
  ev.forEach(x => steps.push({ l: x.m ? [L('MR1 = 0x03'), L('EMR = 0xC0')] : (x.tc === 0 ? L('MCR = 0x10') : L('CTCR = 0x2')), t: x.txt + (x.e === 8 || x.e === 16 ? `<br>→ ${x.e} input pulses = ${x.e / 8} full output period${x.e > 8 ? 's' : ''}: <b>÷ 8</b> ✓` : ''), f: s => { s.n = x.e; s.tc = x.tc; s.out = x.out; s.m = x.m; } }));
  const view = (s, v, k, f) => {
    if (f) {
      v.innerHTML = '';
      v._beads = el('div', { class: 'beads' }); v.appendChild(v._beads);
      for (let i = 0; i < 4; i++) v._beads.appendChild(el('span', {}, i));
      v._kv = el('div', { class: 'say' }); v.appendChild(v._kv);
      v._svg = sv('svg', { class: 'dg', viewBox: '0 0 520 130' }); v.appendChild(v._svg);
    }
    $$('span', v._beads).forEach((b, i) => { b.classList.toggle('on', !!s.go && i === (s.tc || 0)); b.classList.toggle('m', !!s.m && i === 3); });
    v._kv.innerHTML = s.go ? `TC = <b>${s.tc || 0}</b> · pulses in = ${s.n || 0} · P1.25 = <b>${s.out || 0}</b>` : 'counter not started yet';
    const g = v._svg; g.innerHTML = ''; const n = s.n || 0, X = e => 60 + e * 27;
    sv('text', { x: 2, y: 34, class: 'lbl', style: 'font-size:15px' }, g).textContent = 'P1.18 in'; sv('text', { x: 2, y: 104, class: 'lbl', style: 'font-size:15px' }, g).textContent = 'P1.25 out';
    let d = `M${X(0) - 13} 44 V20`, od = `M${X(0) - 13} 114`, lvl = 0;
    for (let e = 1; e <= 16; e++) {
      const x = X(e); const shown = e <= n;
      if (!shown) break;
      d += `H${x - 13}V44 H${x}`; if (e < 16) d += `V20`;
      sv('text', { x: x - 13, y: 58, 'text-anchor': 'middle', class: 'mono', style: `font-size:13px;fill:${ev[e - 1].m ? 'var(--red)' : 'var(--ink3)'}` }, g).textContent = ev[e - 1].tc;
      if (ev[e - 1].m) { od += `H${x - 13}V${ev[e - 1].out ? 84 : 114}`; sv('path', { d: `M${x - 13} 62 V78`, style: 'stroke:var(--red);stroke-width:1.5;stroke-dasharray:2 3' }, g); }
    }
    od += `H${X(n) - 13 + (n ? 13 : 0)}`;
    if (n) { sv('path', { d, style: 'fill:none;stroke:var(--blue);stroke-width:2.2' }, g); sv('path', { d: od, style: 'fill:none;stroke:var(--red);stroke-width:2.6' }, g); }
  };
  Stepper(host, { code: P4_CODE, title: 'divide_by_8.c', steps, init: () => ({}), view, speed: 1200 });
});

/* ---------- P5: frequency meter ---------- */
const P5_CODE = `#include<stdio.h>
#include<LPC17xx.h>
unsigned char seven_seg[10]={0x3F,0x06,0x5B,0x4F,0x66,0x6D,0x7D,0x07,0x7F,0x6F};
void delay(void)
{
    LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
    LPC_TIM0->EMR = 0X20;        //Set match bit upon match
    LPC_TIM0->PR = 3000;         //for 1 ms
    LPC_TIM0->MR0 = 1000;        //for 1 second
    LPC_TIM0->MCR = 0x00000004;  // stop PC and TC on MR0
    LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    while ( !(LPC_TIM0->EMR & 0x01)); // wait until match
}
void init_counter1(void)
{
    LPC_PINCON->PINSEL3 = (3<<4);  // cap 1.0 (P1.18)
    LPC_TIM1->CTCR = 0x01;         // Counter at +ve edge of CAP1.0
}
int main(void)
{
    LPC_PINCON->PINSEL0 = 0;          //P0.4 to P0.11 GPIO data lines
    LPC_GPIO0->FIODIR = 0x00000FF0;   //P0.4 to P0.11 output
    init_counter1();
    while(1)
    {
        LPC_TIM1->TCR=2;  //Reset Counter1
        LPC_TIM1->TCR=1;  //Start Counter1
        delay();          // wait for 1 second
        LPC_GPIO0->FIOPIN = seven_seg[LPC_TIM1->TC] << 4; // Counter1 on the seven segment
    }
}`;
BUILD.push(function wP5() {
  const w = W('w-p5', 'P5 · live frequency meter', 'turn the generator knob, then step or play');
  let f = 4;
  const gen = el('div', { class: 'row mb' }); w.appendChild(gen);
  gen.appendChild(el('span', { class: 'gae' }, '🎛 square-wave generator:'));
  const host = el('div'); w.appendChild(host); const L = t => lineOf(P5_CODE, t);
  function build() {
    const S = [
      { l: [L('PINSEL0 = 0'), L('FIODIR = 0x00000FF0')], t: 'P0.4–P0.11 → GPIO outputs (0xFF0 = bits 4–11) for the 7-seg.' },
      { l: [L('init_counter1();'), L('PINSEL3 = (3<<4)')], t: 'P1.18 → function 3 = <b>CAP1.0</b>.' },
      { l: L('CTCR = 0x01'), t: 'Timer1 CTCR = 0x01 → <b>counter mode</b>, +1 on each <b>rising</b> edge of CAP1.0.' }
    ];
    for (let loop = 1; loop <= 2; loop++) {
      S.push({ l: [L('TCR=2'), L('TCR=1')], t: `Loop ${loop}: reset counter 1 (TC1 = 0), then start it.`, f: s => set(s, { tc1: 0, gate: 0, loop }) });
      S.push({ l: [L('wait for 1 second'), L('while ( !(LPC_TIM0->EMR')], t: `<code>delay()</code>: Timer0 waits exactly 1 s (PR = 3000 → 1 ms ticks, MR0 = 1000). Meanwhile Timer1 counts every rising edge on P1.18 <b>by itself</b>.`, f: s => set(s, { gate: 1, tc1: f }) });
      S.push({ l: L('seven_seg[LPC_TIM1->TC]'), t: `TC1 = <b>${f}</b> edges in 1 s = <b>${f} Hz</b> → seven_seg[${f}] = ${hx(SEVEN[f], 2)} &lt;&lt; 4 → digit shows ${f}.`, f: s => set(s, { show: f, gate: 2 }) });
    }
    return S;
  }
  const view = (s, v, k, first) => {
    if (first) {
      v.innerHTML = ''; const r = el('div', { class: 'row' }); v.appendChild(r);
      const sg = el('div', { class: 'col center' }); r.appendChild(sg); v._seg = SevenSeg(sg); sg.appendChild(el('span', { class: 'gae small' }, '7-seg'));
      v._kv = el('div', { class: 'say' }); r.appendChild(v._kv);
      v._svg = sv('svg', { class: 'dg', viewBox: '0 0 520 110' }); v.appendChild(v._svg);
    }
    v._seg.set(s.show != null ? SEVEN[s.show] : 0);
    v._kv.innerHTML = `TC1 = <b>${s.gate === 1 ? '…counting' : (s.tc1 ?? '–')}</b>${s.gate === 2 ? ` → f = ${s.show} Hz` : ''}`;
    const g = v._svg; g.innerHTML = ''; const X = t => 40 + t * 460; const ph = .37 / f;
    sv('rect', { x: X(0), y: 6, width: 460, height: 70, rx: 4, style: `fill:${s.gate ? 'var(--hl-g)' : 'transparent'};stroke:var(--faint)` }, g);
    sv('text', { x: X(.5), y: 97, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:15px' }, g).textContent = s.gate ? '← 1 second gate (Timer0 delay) →' : 'the 1 s window';
    const pts = [[-0.05, 0]]; for (let k2 = 0; k2 < f + 1; k2++) { const tr = ph + k2 / f; pts.push([tr, 1], [tr + .5 / f, 0]); } pts.push([1.05, pts[pts.length - 1][1]]);
    sv('path', { d: digi(pts.filter(p => p[0] <= 1.05), x => X(Math.max(-0.05, Math.min(1.05, x))), 20, 60), style: 'fill:none;stroke:var(--blue);stroke-width:2.2' }, g);
    if (s.gate) for (let k2 = 0; k2 < f; k2++) { const x = X(ph + k2 / f); sv('text', { x, y: 17, 'text-anchor': 'middle', style: 'fill:var(--orange);font-size:15px' }, g).textContent = '★' + (k2 + 1); }
  };
  const st = Stepper(host, { code: P5_CODE, title: 'freq_meter.c', steps: build(), init: () => ({}), view });
  ruler(gen, 'frequency', 1, 9, f, 1, v => v + ' Hz', v => { f = v; st.setSteps(build(), Math.min(st.k, 99)); });
  w.appendChild(el('p', { class: 'small p-soft' }, 'Slide typos: <code>Delay();</code> must match the function name <code>delay()</code> (C is case-sensitive), and <code>PINSEL0 = 0</code> needs a semicolon.'));
});

/* ---------- P6: capture ---------- */
const P6_CODE = `#include<stdio.h>
#include<LPC17xx.h>
void delay(void)
{
    //LPC_SC->PCONP |= (1<<1);   //powers the T0
    LPC_TIM0->CCR = 9;           //capture on positive edge
    LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
    LPC_TIM0->EMR = 0X20;        //Set match bit upon match
    LPC_TIM0->PR = 3000;         //for 1 ms
    LPC_TIM0->MR0 = 1000;        //for 1 second
    LPC_TIM0->MCR = 0x00000004;  // stop PC and TC on MR0
    LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    while ( !(LPC_TIM0->EMR & 0x01)); // wait until match
    return;
}
int main(void)
{
    LPC_GPIO0->FIODIR = 0x00000004;
    LPC_PINCON->PINSEL3 |= (3<<20) | (3<<22); //select cap 0.0 and cap 0.1
    while(1)
    {
        LPC_GPIO0->FIOPIN = ~(LPC_GPIO0->FIOPIN & 0x00000004); //toggle p0.2
        delay();
    }
}`;
BUILD.push(function wP6() {
  const w = W('w-p6', 'P6 · live capture', 'program is running — fire edges at P1.26 / P1.27 any time');
  const sp = el('div', { class: 'stp' }); w.appendChild(sp);
  const code = codeBlock(P6_CODE, 'capture.c'); sp.appendChild(code);
  const side = el('div', { class: 'stp-side' }); sp.appendChild(side);
  const lines = $$('.cl', code); const L = t => lineOf(P6_CODE, t);
  const hi = (arr, cls = 'on') => { lines.forEach(x => x.classList.remove(cls)); arr.forEach(n => lines[n - 1] && lines[n - 1].classList.add(cls)); };
  const top = el('div', { class: 'row' }); side.appendChild(top);
  const led = el('span', { class: 'led', style: 'width:30px;height:30px' }); top.append(led, el('span', { class: 'pinlbl' }, 'P0.2'));
  const tcD = el('div', { class: 'odo' }); top.appendChild(tcD); top.appendChild(el('span', { class: 'cav p-soft' }, 'TC (ms into this second)'));
  const flashD = el('div', { class: 'flashfx' }); side.appendChild(flashD);
  const slots = el('div', { class: 'row' }); side.appendChild(slots);
  const mk = n => { const d = el('div', { class: 'slot' }, `<div class="gae">CR${n}</div><div class="polaroid empty">—</div><div class="pinlbl">P1.${26 + n} = CAP0.${n}</div>`); slots.appendChild(d); return d; };
  const sl = [mk(0), mk(1)];
  const bt = el('div', { class: 'row' }); side.appendChild(bt);
  const say = el('div', { class: 'note blue stp-note' }); side.appendChild(say);
  [0, 1].forEach(n => { const b = el('button', { class: 'btn sm p', type: 'button' }, `↑ rising edge on P1.${26 + n}`); b.onclick = () => cap(n); bt.appendChild(b); });
  let tc = 0, lv = 0, last = 0;
  say.innerHTML = 'Main toggles P0.2, then <code>delay()</code> counts TC 0 → 1000 ms and stops. TC keeps restarting every second.';
  function cap(n) {
    const ms = Math.floor(tc); const p = sl[n].querySelector('.polaroid'); p.classList.remove('empty'); p.textContent = ms; p.classList.remove('popin'); void p.offsetWidth; p.classList.add('popin');
    flashD.classList.remove('go'); void flashD.offsetWidth; flashD.classList.add('go');
    hi([L('CCR = 9')], 'on2');
    say.innerHTML = `Rising edge on CAP0.${n} → CCR bit ${n * 3} (CAP${n}RE) is 1 → hardware copies TC into <b>CR${n} = ${ms}</b>. TC itself keeps counting. → the edge came ${ms} ms after the last LED toggle.`;
  }
  const lp = Loop(side, dt => {
    tc += dt * 1000;
    if (tc >= 1000) { tc = 0; lv ^= 1; led.classList.toggle('on', !!lv); hi([L('toggle p0.2')]); setTimeout(() => hi([L('wait until match')]), 300); }
    tcD.textContent = String(Math.floor(tc)).padStart(4, '0');
  });
  lp.start(); hi([L('wait until match')]);
});
