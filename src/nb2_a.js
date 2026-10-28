/* =========================================================
   NOTEBOOK 2 · part A — interrupts (NVIC, timer, EINT, GPIO)
   ========================================================= */

/* draw an SVG at its real pixel width (text stays readable on phones) */
function pxW(svg, H, min = 260) { const Wd = Math.max(min, Math.round(svg.clientWidth || (svg.parentNode && svg.parentNode.clientWidth) || 600)); svg.setAttribute('viewBox', `0 0 ${Wd} ${H}`); svg.setAttribute('height', H); return Wd; }

/* ---------- polling vs interrupt race ---------- */
BUILD.push(function wPoll() {
  const w = W('w-poll', 'polling vs interrupt', 'same random parcels arrive in both lanes');
  let P = 1.2; const H = 0.45, CHK = 0.18, WIN = 12;
  const mkLane = (name) => ({ name, segs: [], st: 'work', t0: 0, pend: [], lat: [], checks: 0, wasted: 0, work: 0, next: 0, bells: [] });
  const A = mkLane('polling'), B = mkLane('interrupt');
  const row = el('div', { class: 'col' }); w.appendChild(row);
  const mk = (lane, color) => {
    const box = el('div', { class: 'lane' }); row.appendChild(box);
    box.innerHTML = `<div class="row spread"><span class="gae" style="color:${color}">${lane.name}</span><span class="lst cav"></span></div>`;
    const s = sv('svg', { class: 'dg', viewBox: '0 0 640 58' }); box.appendChild(s); lane.svg = s; lane.lst = box.querySelector('.lst');
    const stats = el('div', { class: 'small lstat' }); box.appendChild(stats); lane.stats = stats;
  };
  mk(A, 'var(--orange)'); mk(B, 'var(--pink)');
  const leg = el('div', { class: 'row small' }); w.appendChild(leg);
  leg.innerHTML = '<span class="pill g">doing homework (main)</span><span class="pill">checking the door</span><span class="pill p">handling the parcel (ISR)</span><span>🔔 = parcel arrives</span>';
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  ruler(ctl, 'polling interval', 2, 30, 12, 1, v => (v / 10).toFixed(1) + ' s', v => { P = v / 10; });
  let T = 0, nextEv = 1.2;
  const step = (L, dt, poll) => {
    const t = T;
    if (L.st === 'work') { L.work += dt; if (poll && t - L.t0 >= P) { L.segs.push([L.t0, t, 'w']); L.st = 'chk'; L.t0 = t; L.checks++; } if (!poll && L.pend.length) { L.segs.push([L.t0, t, 'w']); L.st = 'isr'; L.t0 = t; L.lat.push(t - L.pend.shift()); } }
    else if (L.st === 'chk') { if (t - L.t0 >= CHK) { L.segs.push([L.t0, t, 'c']); if (L.pend.length) { L.st = 'isr'; L.lat.push(t - L.pend.shift()); } else { L.st = 'work'; L.wasted++; } L.t0 = t; } }
    else if (L.st === 'isr') { if (t - L.t0 >= H) { L.segs.push([L.t0, t, 'h']); L.st = 'work'; L.t0 = t; } }
    L.segs = L.segs.filter(s => s[1] > T - WIN); L.bells = L.bells.filter(b => b > T - WIN);
  };
  const draw = L => {
    const Wd = pxW(L.svg, 58), X = t => 10 + (t - (T - WIN)) / WIN * (Wd - 20); const g = L.svg; g.innerHTML = '';
    const col = { w: 'var(--hl-g)', c: 'var(--faint)', h: 'var(--hl-p)' };
    L.segs.concat([[L.t0, T, { work: 'w', chk: 'c', isr: 'h' }[L.st]]]).forEach(([a, b, k]) => { if (b < T - WIN) return; const x1 = X(Math.max(a, T - WIN)), x2 = X(b); sv('rect', { x: x1, y: 22, width: Math.max(0, x2 - x1), height: 26, rx: 4, style: `fill:${col[k]};stroke:var(--ink3);stroke-width:.6` }, g); });
    L.bells.forEach(b => sv('text', { x: X(b), y: 16, 'text-anchor': 'middle', style: 'font-size:14px' }, g).textContent = '🔔');
    L.lst.textContent = { work: '📖 studying…', chk: '🚪 checking the door…', isr: '📦 handling the parcel!' }[L.st];
    const avg = L.lat.length ? L.lat.reduce((a, b) => a + b, 0) / L.lat.length : 0;
    L.stats.innerHTML = `homework time: <b>${Math.round(L.work / Math.max(T, .01) * 100)}%</b> · waited per parcel: <b>${avg.toFixed(2)} s</b>${L === A ? ` · checks: ${L.checks} (wasted: <b>${L.wasted}</b>)` : ' · checks: 0 — the bell tells it'}`;
  };
  const tick = dt => { T += dt; if (T >= nextEv) { [A, B].forEach(L => { L.pend.push(T); L.bells.push(T); }); nextEv = T + 1.4 + Math.random() * 2.6; } step(A, dt, true); step(B, dt, false); };
  for (let i = 0; i < 600; i++) tick(1 / 60); // start with a few seconds already on the chart
  const lp = Loop(w, dt => { tick(dt); draw(A); draw(B); });
  lp.start();
});

/* ---------- IVT / interrupt sequence ---------- */
const IVT_CODE = `int main(void)
{
    ...setup...
    NVIC_EnableIRQ(TIMER0_IRQn);  // NVIC: allowed
    while(1)
    {
        do_main_work();           // main program runs here
    }
}
/* EVENT: TC == MR0 -> IR bit 0 = 1 -> request to NVIC */
/* NVIC: enabled? yes -> accept */
/* CPU: save return address (push on stack) */
/* CPU: vector = memory[IVT base + 4*N] */
/* CPU: PC = vector -> jump into the ISR */
void TIMER0_IRQHandler(void)
{
    LPC_TIM0->IR = 1;             // clear the flag
    /* ...do the job... */
}                                 // return: pop -> PC
`;
BUILD.push(function wIvt() {
  const w = W('w-ivt', 'an interrupt, in slow motion', 'choose N, then step');
  let N = 17; const BASE = 0x00000000;
  const top = el('div', { class: 'row mb' }); w.appendChild(top);
  const nr = ruler(top, 'interrupt type N', 0, 50, N, 1, v => 'N = ' + v + ' → offset ' + hx(4 * v, 2), v => { N = v; st.refresh(); });
  top.appendChild(el('span', { class: 'small p-soft', style: 'max-width:380px' }, 'The 16 Cortex system exceptions come first (N = 0–15), then the 35 peripheral interrupts: N = 16 + IRQ number.'));
  const qc = el('div', { class: 'chips mb' }); w.appendChild(qc); qc.appendChild(el('span', { class: 'cav p-soft' }, 'ISRs in these notes:'));
  [['TIMER0', 1], ['UART0', 5], ['PWM1', 9], ['EINT2', 20], ['EINT3', 21], ['ADC', 22]].forEach(([n, q]) => { const c = el('button', { class: 'chip', type: 'button' }, `${n} · IRQ ${q} → N ${16 + q}`); c.onclick = () => { nr.value = 16 + q; nr.dispatchEvent(new Event('input')); }; qc.appendChild(c); });
  const host = el('div'); w.appendChild(host); const L = t => lineOf(IVT_CODE, t);
  const steps = [
    { l: [L('do_main_work')], t: 'The main program is running. PC points into <code>main()</code>.', f: s => set(s, { pc: 'main + 0x10', where: 'main' }) },
    { l: L('EVENT'), t: 'Timer0 match: the timer sets <b>IR bit 0</b> and sends an interrupt request to the NVIC.', f: s => set(s, { req: 1 }) },
    { l: [L('NVIC: enabled'), L('NVIC_EnableIRQ')], t: 'The NVIC checks: is TIMER0 enabled? Yes (<code>NVIC_EnableIRQ</code> was called) → accept.', f: s => set(s, { acc: 1 }) },
    { l: L('save return address'), t: 'Save the <b>return address</b> (where main was) on the stack, so we can come back.', f: s => { s.stack = ['main + 0x10']; } },
    { l: L('vector = memory'), t: '', f: s => set(s, { look: 1 }) },
    { l: L('PC = vector'), t: 'Load the vector into the <b>PC</b> → the CPU is now inside the ISR.', f: s => set(s, { pc: 'TIMER0_IRQHandler', where: 'isr' }) },
    { l: L('LPC_TIM0->IR = 1'), t: 'ISR: clear the flag (write 1). Otherwise the interrupt would fire again immediately.', f: s => set(s, { req: 0 }) },
    { l: [L('...do the job')], t: 'Do the actual work (toggle a pin, count ticks…). Keep it short!' },
    { l: L('return: pop'), t: 'End of ISR: pop the saved address back into PC → <b>main continues exactly where it stopped</b>.', f: s => { s.stack = []; s.pc = 'main + 0x10'; s.where = 'main'; s.look = 0; s.acc = 0; } }
  ];
  const view = (s, v, k, first) => {
    if (first) { v.innerHTML = ''; v._g = el('div', { class: 'ivtv' }); v.appendChild(v._g); }
    const rows = [0, 1, 2, '…', N - 1, N, N + 1].filter((x, i, a) => x === '…' || (x >= 0 && a.indexOf(x) === i));
    v._g.innerHTML = `<div class="ivt"><div class="gae small">IVT (in memory)</div>${rows.map(r => r === '…' ? '<div class="ivr dots">⋮</div>' : `<div class="ivr${r === N && s.look ? ' hit' : ''}"><span class="mono">${hex(BASE + 4 * r)}</span><b>type ${r} vector</b></div>`).join('')}</div>
      <div class="cpu"><div class="gae small">CPU</div><div class="reg1"><i>PC</i><b>${s.pc || '–'}</b></div><div class="reg1"><i>stack</i><b>${(s.stack || []).join(', ') || 'empty'}</b></div><div class="reg1"><i>running</i><b class="${s.where === 'isr' ? 'p-pink' : 'p-green'}">${s.where === 'isr' ? 'ISR ⚡' : 'main'}</b></div><div class="reg1"><i>request</i><b>${s.req ? 'pending 🔔' : '–'}</b></div></div>`;
  };
  const st = Stepper(host, { code: IVT_CODE, title: 'what the hardware does', steps, init: () => ({}), view });
  const fix = () => { steps[4].t = `Read the vector of type ${N} at <b>base + 4 × ${N} = ${hex(4 * N)}</b>. That word is the ISR's address.`; };
  fix(); st.refresh(); const _r = st.refresh; st.refresh = () => { fix(); _r(); };
});

/* ---------- IR: write-1-to-clear ---------- */
BUILD.push(function wIr() {
  const w = W('w-ir', 'IR · write 1 to clear', 'make events, then write to IR');
  const names = ['MR0', 'MR1', 'MR2', 'MR3', 'CR0', 'CR1']; let ir = 0;
  const cells = el('div', { class: 'irrow' }); w.appendChild(cells);
  const cs = names.map((n, i) => { const c = el('div', { class: 'irc' }, `<small>bit ${i}</small><b>0</b><em>${n}</em>`); cells.appendChild(c); return c; });
  const ev = el('div', { class: 'row mt' }); w.appendChild(ev); ev.appendChild(el('span', { class: 'gae' }, 'events:'));
  names.forEach((n, i) => { const b = el('button', { class: 'btn sm y', type: 'button' }, (i < 4 ? n + ' match' : n + ' capture')); b.onclick = () => { ir |= 1 << i; paint(); say.textContent = `${n} event → IR bit ${i} = 1 (an interrupt request).`; }; ev.appendChild(b); });
  const wr = el('div', { class: 'row mt' }); w.appendChild(wr); wr.appendChild(el('span', { class: 'gae' }, 'LPC_TIM0->IR ='));
  [[1, '1'], [2, '0x02'], [0x3F, '0x3F'], [0, '0']].forEach(([v, t]) => { const b = el('button', { class: 'btn sm p', type: 'button' }, t); b.onclick = () => { const before = ir; ir &= ~v; paint(v); say.innerHTML = v ? `wrote ${hx(v)}: bits with a <b>1</b> got cleared${before & v ? '' : ' (they were already 0)'}; all others untouched.` : 'wrote 0 → <b>nothing changes</b>. Writing 0 has no effect on IR.'; }; wr.appendChild(b); });
  const say = el('div', { class: 'say' }); w.appendChild(say);
  const why = el('div', { class: 'small p-soft' }, 'Why "write 1": with several flags set, you can clear exactly one without reading first — the zeros you write leave the others alone.'); w.appendChild(why);
  // forgot-to-clear demo
  const fg = el('div', { class: 'forgot mt' }); w.appendChild(fg);
  fg.innerHTML = '<div class="gae">what if the ISR forgets <code>IR = 1</code>?</div>';
  const fr = el('div', { class: 'row' }); fg.appendChild(fr);
  let clears = true; const ch = el('button', { class: 'chip on', type: 'button', style: '--cc:var(--n-g)' }, '✓ ISR clears the flag'); fr.appendChild(ch);
  ch.onclick = () => { clears = !clears; ch.classList.toggle('on', clears); ch.textContent = clears ? '✓ ISR clears the flag' : '✗ ISR forgets'; mainP = 0; isrN = 0; };
  const bar = el('div', { class: 'tbar', style: 'width:260px' }, '<i></i>'); const fs = el('span', { class: 'mono small' }); fr.append(el('span', { class: 'gae small' }, 'main progress'), bar, fs);
  let mainP = 0, isrN = 0, ph = 0;
  const lp = Loop(fg, dt => { ph += dt; if (clears) { mainP = (mainP + dt * 18) % 100; if (ph > 1) { ph = 0; isrN++; } } else { isrN += Math.round(dt * 400); } bar.firstChild.style.transition = 'none'; bar.firstChild.style.width = mainP + '%'; fs.innerHTML = clears ? `ISR ran ${isrN}× (once per event) — main keeps going` : `ISR ran <b class="p-red">${isrN}×</b> — it re-enters forever, main is <b class="p-red">stuck</b>`; });
  lp.start();
  function paint(flash) { cs.forEach((c, i) => { const on = (ir >> i) & 1; c.querySelector('b').textContent = on; c.classList.toggle('one', !!on); c.classList.toggle('hit', !!flash && !!((flash >> i) & 1)); }); }
  paint();
});

/* ---------- T1 ---------- */
const T1_CODE = `#include<stdio.h>
#include<LPC17xx.h>
unsigned int ticks=0,x;
void TIMER0_IRQHandler(void)
{
    LPC_TIM0->IR = 1;
    ticks++;
    if(ticks==1000)
    {
        ticks=0;
        LPC_GPIO0->FIOPIN=~(LPC_GPIO0->FIOPIN & 0x00000004);
    }
}
void init_timer0(void)
{
    LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
    LPC_TIM0->CTCR =0x00;        //Timer
    LPC_TIM0->MR0 = 2999;        // For 1ms
    LPC_TIM0->EMR = 0X00;        //Do nothing for EM0
    LPC_TIM0->PR = 0;
    LPC_TIM0->MCR = 0x00000003;  //Reset TC upon Match-0 and generate INTR
    LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    return;
}
int main(void)
{
    LPC_GPIO0->FIODIR=0x00000004;
    LPC_GPIO2->FIODIR=0x00000001;
    init_timer0();
    NVIC_EnableIRQ(TIMER0_IRQn);//timer 0 intr enabled in NVIC
    while(1)
    {
        LPC_GPIO2->FIOPIN=(LPC_GPIO1->FIOPIN & 0x01) ;
    }
}`;
function liveBoard(v, o) { // small real-time board with LEDs + optional switch
  const b = el('div', { class: 'board' }); v.appendChild(b);
  const items = {};
  (o.leds || []).forEach(([k, lab, cls]) => { const d = el('div', { class: 'col center' }); const l = el('span', { class: 'led ' + (cls || ''), style: 'width:30px;height:30px' }); d.append(l, el('span', { class: 'pinlbl' }, lab)); b.appendChild(d); items[k] = l; });
  if (o.sw) { const d = el('div', { class: 'col center' }); const s = el('button', { class: 'tsw', type: 'button', 'aria-label': 'switch' }, '<i></i>'); d.append(s, el('span', { class: 'pinlbl' }, o.sw)); b.appendChild(d); items.sw = s; s.onclick = () => { s.classList.toggle('on'); o.onsw && o.onsw(s.classList.contains('on')); }; }
  if (o.counter) { items.cnt = el('div', { class: 'say small' }); b.appendChild(items.cnt); }
  return items;
}
BUILD.push(function wT1() {
  const w = W('w-t1', 'T1 · step through + live board', 'the board runs for real; the steps show why');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(T1_CODE, t);
  const steps = [
    { l: L('FIODIR=0x00000004'), t: 'P0.2 = output (the blinking LED).' },
    { l: L('LPC_GPIO2->FIODIR=0x00000001'), t: 'P2.0 = output (the LED that copies the switch). P1.0 stays input (the switch).' },
    { l: [L('init_timer0();'), L('TCR = 0x00000002'), L('CTCR =0x00')], t: 'init_timer0(): reset Timer0; CTCR = 0 → timer mode.' },
    { l: [L('MR0 = 2999'), L('PR = 0;')], t: 'PR = 0 and MR0 = 2999 → match every 3000 PCLK ticks = <b>1 ms</b>.' },
    { l: L('EMR = 0X00'), t: 'EMR = 0 → don\'t touch any MAT pin.' },
    { l: L('MCR = 0x00000003'), t: 'MCR = 3 = bit 0 (<b>interrupt</b> on MR0) + bit 1 (<b>reset</b> on MR0) → an interrupt every 1 ms, forever.' },
    { l: L('TCR = 0x00000001'), t: 'Start Timer0.' },
    { l: L('NVIC_EnableIRQ'), t: 'Enable TIMER0 in the NVIC — the second switch. Now its ISR can run.' },
    { l: [L('while(1)'), L('LPC_GPIO2->FIOPIN=(LPC_GPIO1')], t: 'main loops: P2.0 = (P1.0 &amp; 1). Flip the switch on the board — P2.0 follows instantly.', f: s => set(s, { cpu: 'main' }) },
    { l: [L('void TIMER0_IRQHandler'), L('LPC_TIM0->IR = 1;')], t: '1 ms later: TC = MR0 → interrupt! main is paused, the ISR starts. First: clear the MR0 flag.', f: s => set(s, { cpu: 'isr', ticks: 0 }) },
    { l: [L('ticks++;'), L('if(ticks==1000)')], t: 'ticks = 1. Not 1000 yet → return to main.', f: s => set(s, { ticks: 1 }) },
    { l: L('LPC_GPIO2->FIOPIN=(LPC_GPIO1'), t: 'Back in main exactly where it was — copying the switch again.', f: s => set(s, { cpu: 'main' }) },
    { l: [L('ticks++;'), L('if(ticks==1000)')], t: '…999 more interrupts later (1 per ms): ticks = 1000.', f: s => set(s, { cpu: 'isr', ticks: 1000 }) },
    { l: [L('ticks=0;'), L('FIOPIN=~(LPC_GPIO0')], t: 'ticks = 0 and <b>toggle P0.2</b>: <code>~(FIOPIN &amp; 0x4)</code> makes bit 2 the opposite of what it was. That happens once every 1000 × 1 ms = <b>1 s</b>.', f: s => set(s, { ticks: 0 }) },
    { l: L('LPC_GPIO2->FIOPIN=(LPC_GPIO1'), t: 'Return → main continues. Two jobs share one CPU: blink by interrupt, copy by main.', f: s => set(s, { cpu: 'main' }) }
  ];
  let isrCount = 0, ms = 0, led = 0, sw = 0;
  const view = (s, v, k, first) => {
    if (first) {
      v.innerHTML = ''; v._b = liveBoard(v, { leds: [['p02', 'P0.2'], ['p20', 'P2.0', 'g']], sw: 'P1.0 switch', counter: 1, onsw: on => { sw = on ? 1 : 0; v._b.p20.classList.toggle('on', !!sw); } });
      v._kv = el('div', { class: 'say' }); v.appendChild(v._kv);
      const lp = Loop(v, dt => { ms += dt * 1000; while (ms >= 1) { ms -= 1; isrCount++; if (isrCount % 1000 === 0) { led ^= 1; v._b.p02.classList.toggle('on', !!led); } } v._b.cnt.innerHTML = `ISR calls so far: <b>${isrCount}</b><br>ticks = ${isrCount % 1000}`; });
      lp.start();
    }
    v._kv.innerHTML = s.cpu ? `CPU is running: <b class="${s.cpu === 'isr' ? 'p-pink' : 'p-green'}">${s.cpu === 'isr' ? 'the ISR ⚡' : 'main()'}</b>${s.ticks != null ? ` · ticks = ${s.ticks}` : ''}` : 'setting up…';
  };
  Stepper(host, { code: T1_CODE, title: 'timer_int_blink.c', steps, init: () => ({}), view });
});

/* ---------- T2 ---------- */
const T2_CODE = `#include<stdio.h>
#include<LPC17xx.h>
void TIMER0_IRQHandler(void)
{
    LPC_TIM0->IR = 1; //Clear the interrupt
    LPC_GPIO0->FIOPIN=~(LPC_GPIO0->FIOPIN & 0x00000004);
}
void init_timer0(void)
{
    LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
    LPC_TIM0->CTCR =0x05;        // Counter at +ve edge of CAP0.1
    LPC_TIM0->MR0 = 3;
    LPC_TIM0->EMR = 0X00;
    LPC_TIM0->PR = 0;
    LPC_TIM0->MCR = 0x00000003;
    LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    return;
}
int main(void)
{
    LPC_GPIO0->FIODIR=0x00000004;
    LPC_PINCON->PINSEL3 |=((3<<22)|(3<<24));
    init_timer0();
    NVIC_EnableIRQ(TIMER0_IRQn);
    while(1);
}`;
BUILD.push(function wT2() {
  const w = W('w-t2', 'T2 · edge by edge', 'each step = one rising edge on P1.27');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(T2_CODE, t);
  const steps = [
    { l: L('FIODIR=0x00000004'), t: 'P0.2 = output.' },
    { l: L('PINSEL3 |='), t: '<b>3&lt;&lt;22</b> → P1.27 = CAP0.1 (count input). 3&lt;&lt;24 → P1.28 = MAT0.0 (unused here, EMR = 0).' },
    { l: [L('CTCR =0x05')], t: 'CTCR = 0x05 = 0101: bits 1:0 = 01 → counter, <b>rising</b> edges; bits 3:2 = 01 → input <b>CAP0.1</b>.' },
    { l: [L('MR0 = 3;'), L('MCR = 0x00000003')], t: 'MR0 = 3, MCR = 3 → when TC reaches 3: <b>interrupt + reset</b>.' },
    { l: [L('TCR = 0x00000001'), L('NVIC_EnableIRQ'), L('while(1);')], t: 'Start, enable in the NVIC, then main does nothing. Now feed edges…', f: s => set(s, { go: 1, tc: 0, led: 0, n: 0 }) }
  ];
  let tc = 0, led = 0;
  for (let e = 1; e <= 12; e++) {
    let m = 0; if (tc === 3) tc = 0; else { tc++; if (tc === 3) { m = 1; led ^= 1; } }
    const T = tc, Ld = led, M = m;
    steps.push({ l: M ? [L('void TIMER0_IRQHandler'), L('IR = 1;'), L('FIOPIN=~')] : L('CTCR =0x05'), t: M ? `edge #${e} → TC = 3 = MR0 → <b>interrupt</b>: ISR clears IR and toggles P0.2 → LED ${Ld ? 'ON' : 'OFF'}` : `edge #${e} → TC = ${T}${T === 0 ? ' (reset after the match)' : ''}`, f: s => set(s, { tc: T, led: Ld, n: e, m: M }) });
  }
  const view = (s, v, k, first) => {
    if (first) { v.innerHTML = ''; const r = el('div', { class: 'row' }); v.appendChild(r); v._led = el('span', { class: 'led', style: 'width:32px;height:32px' }); r.append(v._led, el('span', { class: 'pinlbl' }, 'P0.2')); v._beads = el('div', { class: 'beads' }); r.appendChild(v._beads); for (let i = 0; i < 4; i++) v._beads.appendChild(el('span', {}, i)); v._kv = el('div', { class: 'say' }); v.appendChild(v._kv); }
    v._led.classList.toggle('on', !!s.led);
    $$('span', v._beads).forEach((b, i) => { b.classList.toggle('on', !!s.go && i === s.tc); b.classList.toggle('m', !!s.m && i === 3); });
    v._kv.innerHTML = s.go ? `edges so far: ${s.n} · TC = ${s.tc} · interrupts: ${Math.floor((s.n + 1) / 4)}` : '';
  };
  Stepper(host, { code: T2_CODE, title: 'counter_int.c', steps, init: () => ({}), view, speed: 1200 });
});

/* ---------- T3 ---------- */
const T3_CODE = `include<stdio.h>
#include<LPC17xx.h>
unsigned char flag=1;
void TIMER0_IRQHandler(void)
{
    LPC_TIM0->IR = 1;
    if(flag)
    {
        flag=0;
        LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
        LPC_GPIO0->FIOCLR=0x00000004;
        LPC_TIM0->MR0 = 500;
        LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    }
    else
    {
        flag=1;
        LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
        LPC_GPIO0->FIOSET=0x00000004;
        LPC_TIM0->MR0 = 1500;
        LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    }
}
void init_timer0(void)
{
    LPC_TIM0->TCR = 0x00000002;  // Timer0 Reset
    LPC_TIM0->CTCR =0x00;
    LPC_TIM0->MR0 = 1500;
    LPC_TIM0->EMR = 0X00;
    LPC_TIM0->PR = 3000;
    LPC_TIM0->MCR = 0x00000005;
    LPC_TIM0->TCR = 0x00000001;  // Timer0 Enable
    LPC_GPIO0->FIOSET=0x00000004;
    return;
}
int main(void)
{
    LPC_GPIO0->FIODIR=0x00000004;
    init_timer0();
    NVIC_EnableIRQ(TIMER0_IRQn);
    while(1);
}`;
BUILD.push(function wT3() {
  const w = W('w-t3', 'T3 · step through time', 'the ISR swaps between 1.5 s and 0.5 s');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(T3_CODE, t);
  const steps = [
    { l: L('FIODIR=0x00000004'), t: 'P0.2 = output.' },
    { l: [L('init_timer0();'), L('MR0 = 1500;', 2), L('PR = 3000')], t: 'init: MR0 = 1500 and PR = 3000 (≈ 1 ms per TC step) → first match after ≈ 1.5 s.', f: s => set(s, { mr0: 1500 }) },
    { l: L('MCR = 0x00000005'), t: 'MCR = 5 = bit 0 + bit 2 → on MR0: <b>interrupt</b> and <b>stop</b> the timer.' },
    { l: [L('TCR = 0x00000001;  // Timer0 Enable', 3), L('FIOSET=0x00000004', 2)], t: 'Start the timer and set P0.2 HIGH at t = 0. (flag starts as 1 = "we are in the HIGH part").', f: s => set(s, { wave: [[0, 1]], t: 0, flag: 1 }) },
    { l: [L('NVIC_EnableIRQ'), L('while(1);')], t: 'Enable the interrupt; main idles.' },
    { l: [L('void TIMER0_IRQHandler'), L('IR = 1;'), L('if(flag)')], t: 't = 1.5 s: match → timer stops → <b>ISR</b>. Clear IR. flag = 1 → take the first branch.', f: s => set(s, { t: 1.5, cpu: 'isr' }) },
    { l: [L('flag=0;'), L('FIOCLR=0x00000004'), L('MR0 = 500;')], t: 'flag = 0, reset timer, P0.2 <b>LOW</b>, MR0 = 500, start → next match in 0.5 s.', f: s => { s.flag = 0; s.mr0 = 500; s.wave = s.wave.concat([[1.5, 0]]); s.cpu = 'main'; } },
    { l: [L('else'), L('flag=1;'), L('FIOSET=0x00000004;'), L('MR0 = 1500;')], t: 't = 2 s: ISR again, flag = 0 → else-branch: flag = 1, P0.2 <b>HIGH</b>, MR0 = 1500.', f: s => { s.t = 2; s.flag = 1; s.mr0 = 1500; s.wave = s.wave.concat([[2, 1]]); } },
    { l: [L('if(flag)'), L('else')], t: '…and it keeps alternating: 1.5 s HIGH, 0.5 s LOW → period 2 s, 75 % duty — without main doing anything.', f: s => { s.t = 4; s.wave = s.wave.concat([[3.5, 0], [4, 1]]); } }
  ];
  const view = (s, v, k, first) => {
    if (first) { v.innerHTML = ''; v._kv = el('div', { class: 'say' }); v.appendChild(v._kv); v._svg = sv('svg', { class: 'dg', viewBox: '0 0 520 100' }); v.appendChild(v._svg); }
    v._kv.innerHTML = `flag = ${s.flag ?? '–'} · MR0 = ${s.mr0 ?? '–'} · ${s.cpu === 'isr' ? '<b class="p-pink">in the ISR</b>' : 'main idling'}`;
    const g = v._svg; g.innerHTML = ''; const X = t => 44 + t / 4 * 466;
    for (let t = 0; t <= 4; t += .5) { sv('path', { d: `M${X(t)} 12 V70`, style: 'stroke:var(--faint)' }, g); if (t % 1 === 0) sv('text', { x: X(t), y: 88, 'text-anchor': 'middle', class: 'mono', style: 'font-size:14px' }, g).textContent = t + 's'; }
    sv('text', { x: 2, y: 46, class: 'lbl', style: 'font-size:15px' }, g).textContent = 'P0.2';
    if (s.wave) sv('path', { d: digi(s.wave.concat([[s.t, s.wave[s.wave.length - 1][1]]]), X, 20, 64), style: 'fill:none;stroke:var(--red);stroke-width:2.6' }, g);
  };
  Stepper(host, { code: T3_CODE, title: 'rect_wave_int.c', steps, init: () => ({}), view });
  w.appendChild(el('p', { class: 'small p-soft' }, 'The first line of the slide reads <code>include&lt;stdio.h&gt;</code> — the # is missing.'));
});

/* ---------- trigger lab ---------- */
BUILD.push(function wTrig() {
  const w = W('w-trig', 'trigger lab', 'hold the button to pull the pin LOW · pick a mode');
  let mode = 2; // EXTMODE<<1 | EXTPOLAR
  const MODES = [['0', '0', 'Level 0', 'again and again while pin = 0'], ['0', '1', 'Level 1', 'again and again while pin = 1'], ['1', '0', 'Falling edge ↘', 'once each time the pin goes 1→0'], ['1', '1', 'Rising edge ↗', 'once each time the pin goes 0→1']];
  const tb = el('table', { class: 'tbl trigtbl' }); w.appendChild(el('div', { class: 'tblwrap' })).appendChild(tb);
  tb.innerHTML = '<tr><th>EXTMODE</th><th>EXTPOLAR</th><th>EINTx triggers on <span class="small p-soft">(tap a row)</span></th></tr>' + MODES.map((m, i) => `<tr data-i="${i}" style="cursor:pointer"><td class="m">${m[0]}</td><td class="m">${m[1]}</td><td><b>${m[2]}</b> <span class="small p-soft">— ${m[3]}</span></td></tr>`).join('');
  $$('tr[data-i]', tb).forEach(r => r.onclick = () => { mode = +r.dataset.i; marks = []; paint(); });
  const ctl = el('div', { class: 'row mt' }); w.appendChild(ctl);
  const btn = el('button', { class: 'bigkey', type: 'button', style: 'width:76px;height:76px' }, 'P2.12<br><small>hold</small>'); ctl.appendChild(btn);
  const cnt = el('div', { class: 'say' }); ctl.appendChild(cnt);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 640 120' }); w.appendChild(s);
  let lvl = 1, T = 8, hist = [[0, 1]], marks = [], last = -9, n = 0;
  const setL = v => { if (v === lvl) return; lvl = v; hist.push([T, v]); const m = mode; if ((m === 2 && v === 0) || (m === 3 && v === 1)) { marks.push(T); n++; } };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.classList.add('down'); setL(0); });
  const up = () => { btn.classList.remove('down'); setL(1); }; btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up);
  function paint() { $$('tr[data-i]', tb).forEach(r => r.classList.toggle('hit', +r.dataset.i === mode)); }
  const WIN = 8; let X = t => t;
  const lp = Loop(w, dt => {
    T += dt; const m = mode;
    if ((m === 0 && lvl === 0) || (m === 1 && lvl === 1)) { if (T - last > 0.12) { last = T; marks.push(T); n++; } }
    hist = hist.filter((h, i) => i === hist.length - 1 || hist[i + 1][0] > T - WIN); marks = marks.filter(t => t > T - WIN);
    s.innerHTML = ''; const Wd = pxW(s, 120); X = t => 70 + (t - (T - WIN)) / WIN * (Wd - 80);
    sv('text', { x: 2, y: 44, class: 'lbl', style: 'font-size:14px' }, s).textContent = 'P2.12';
    sv('text', { x: 2, y: 104, class: 'lbl', style: 'font-size:14px' }, s).textContent = 'ISR runs';
    sv('path', { d: `M70 112 H${Wd - 10}`, style: 'stroke:var(--faint)' }, s);
    sv('path', { d: digi(hist.map(h => [Math.max(h[0], T - WIN), h[1]]).concat([[T, lvl]]), X, 22, 58), style: 'fill:none;stroke:var(--blue);stroke-width:2.6' }, s);
    marks.forEach(t => { sv('path', { d: `M${X(t)} 112 V86`, style: 'stroke:var(--red);stroke-width:2.6;stroke-linecap:round' }, s); });
    cnt.innerHTML = `mode: <b>${MODES[mode][2]}</b> · ISR ran <b>${n}</b>×<br><span class="small p-soft">${MODES[mode][3]}</span>`;
  });
  lp.start(); paint();
});

/* ---------- EINT config generator ---------- */
BUILD.push(function wEintGen() {
  const w = W('w-eintgen', 'EINT setup generator', 'tick the interrupts you want');
  const cfg = [0, 1, 2, 3].map(x => ({ on: x === 2, mode: 1, pol: 0 }));
  const tb = el('table', { class: 'tbl' }); w.appendChild(el('div', { class: 'tblwrap' })).appendChild(tb);
  w.appendChild(el('div', { class: 'code' }));
  function paint() {
    tb.innerHTML = '<tr><th>use</th><th>pin</th><th>trigger (EXTMODE)</th><th>polarity (EXTPOLAR)</th></tr>';
    cfg.forEach((c, x) => {
      const tr = el('tr'); tb.appendChild(tr);
      const td = (h) => { const d = el('td', {}, h); tr.appendChild(d); return d; };
      const u = el('button', { class: 'chip' + (c.on ? ' on' : ''), type: 'button' }, 'EINT' + x); u.onclick = () => { c.on = !c.on; paint(); }; td('').appendChild(u);
      td(`<span class="mono">P2.${10 + x}</span>`);
      const m = td(''); chipGroup(m, [[0, 'level'], [1, 'edge']], c.mode, v => { c.mode = +v; paint(); });
      const p = td(''); chipGroup(p, [[0, c.mode ? 'falling' : 'active low'], [1, c.mode ? 'rising' : 'active high']], c.pol, v => { c.pol = +v; paint(); });
    });
    const on = cfg.map((c, x) => c.on ? x : -1).filter(x => x >= 0);
    const pin = on.map(x => `(1<<${20 + 2 * x})`).join(' | ') || '0';
    const em = on.reduce((a, x) => a | (cfg[x].mode << x), 0), ep = on.reduce((a, x) => a | (cfg[x].pol << x), 0);
    const src = `LPC_PINCON->PINSEL4 |= ${pin};   // ${on.map(x => `P2.${10 + x} -> EINT${x}`).join(', ') || 'none'}
LPC_SC->EXTMODE  = ${hx(em)};   // 1 = edge, 0 = level
LPC_SC->EXTPOLAR = ${hx(ep)};   // 1 = rising/high, 0 = falling/low
${on.map(x => `NVIC_EnableIRQ(EINT${x}_IRQn);`).join('\n') || '// nothing enabled'}
/* first line of each EINTx_IRQHandler: */
${on.map(x => `LPC_SC->EXTINT = ${hx(1 << x)};   // clear EINT${x} (write 1)`).join('\n') || '//'}`;
    const nc = codeBlock(src, 'generated'); w.querySelector('.code').replaceWith(nc);
  }
  paint();
});

/* ---------- E1 ---------- */
const E1_CODE = `include<LPC17xx.h>
void EINT2_IRQHandler(void);
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    LPC_PINCON->PINSEL4 |= (1<<24);   //P2.12 as EINT2 i.e FUNCTION-01
    LPC_GPIO1->FIODIR = 0x00800000;   //P1.23 is assigned output
    LPC_SC->EXTMODE = 0x00000004;     //EINT2 is initiated as edge sensitive, 0 for level
    LPC_SC->EXTPOLAR = 0x00000000;    //EINT2 is falling edge sensitive, 1 for rising edge
    NVIC_EnableIRQ(EINT2_IRQn);
    while(1) ;
}
void EINT2_IRQHandler(void)
{
    LPC_SC->EXTINT = 0x00000004;  //clears the interrupt
    LPC_GPIO1->FIOPIN = ~ LPC_GPIO1->FIOPIN ;
}`;
BUILD.push(function wE1() {
  const L = t => lineOf(E1_CODE, t);
  const boot = [
    { l: L('PINSEL4 |= (1<<24)'), t: 'P2.12 → bits 25:24 of PINSEL4 = 01 → <b>EINT2</b>.' },
    { l: L('FIODIR = 0x00800000'), t: '0x00800000 = bit 23 → P1.23 output (LED).' },
    { l: L('EXTMODE = 0x00000004'), t: 'EXTMODE bit 2 = 1 → EINT2 is <b>edge</b> triggered.' },
    { l: L('EXTPOLAR = 0x00000000'), t: 'EXTPOLAR bit 2 = 0 → <b>falling</b> edge.' },
    { l: [L('NVIC_EnableIRQ'), L('while(1) ;')], t: 'Enable EINT2 in the NVIC; main idles. Now <b>press</b> the switch (1→0 = falling edge) or release it.' }
  ];
  let held = false;
  const ex = Exercise('w-e1', 'E1 · press the switch', 'pressed = 0 (pull-up to +V)', {
    code: E1_CODE, file: 'eint2_toggle.c', noLcd: true, boot, noteClass: 'blue',
    world: () => ({ led: 0, pin: 1, n: 0 }),
    setup: v => { const r = el('div', { class: 'row' }); v.appendChild(r); v._led = el('span', { class: 'led', style: 'width:36px;height:36px' }); r.append(v._led, el('span', { class: 'pinlbl' }, 'P1.23 LED')); const k = el('button', { class: 'bigkey', type: 'button' }, 'P2.12<br><small>switch</small>'); r.appendChild(k); v._kv = el('div', { class: 'say' }); v.appendChild(v._kv);
      k.addEventListener('pointerdown', e => { e.preventDefault(); if (held) return; held = true; k.classList.add('down'); edge(0); });
      const up = () => { if (!held) return; held = false; k.classList.remove('down'); edge(1); }; k.addEventListener('pointerup', up); k.addEventListener('pointerleave', up); },
    paint: (s, v) => { v._led.classList.toggle('on', !!s.led); v._kv.innerHTML = `pin P2.12 = ${s.pin} · ISR ran ${s.n}× · EXTINT bit 2 = ${s.flag ? 1 : 0}`; }
  });
  function edge(lv) {
    if (lv === 1) { ex.fire([{ l: [ex.L('EXTPOLAR')], t: 'Released: 0 → 1 is a <b>rising</b> edge. We asked for falling edges only → <b>no interrupt</b>.', f: s => set(s, { pin: 1 }) }]); return; }
    ex.fire([
      { l: ex.L('EXTPOLAR'), t: 'Pressed: P2.12 goes 1 → 0 = <b>falling edge</b> → EXTINT bit 2 = 1 → request to NVIC.', f: s => set(s, { pin: 0, flag: 1 }) },
      { l: [ex.L('void EINT2_IRQHandler(void)', 2), ex.L('EXTINT = 0x00000004')], t: 'NVIC runs <code>EINT2_IRQHandler</code>. First: write 1 to bit 2 of EXTINT → flag cleared.', f: s => set(s, { flag: 0, n: s.n + 1 }) },
      { l: ex.L('FIOPIN = ~ LPC_GPIO1->FIOPIN'), t: 'Invert all port-1 pins → P1.23 <b>toggles</b> (only P1.23 is an output, so nothing else changes).', f: s => set(s, { led: s.led ^ 1 }) },
      { l: ex.L('while(1) ;'), t: 'Return to main (idling). Holding the switch does nothing more — edge = once.' }
    ]);
  }
});

/* ---------- E2 ---------- */
const E2_CODE = `#include<LPC17xx.h>
void EINT2_IRQHandler(void);
unsigned int i;                   //~ not declared in the slide
int main(void)
{
    LPC_PINCON->PINSEL4 |= (1<<24);   //P2.12 as EINT2 i.e FUNCTION-01
    LPC_GPIO1->FIODIR = 0x00800000;   //P1.23 is assigned output
    LPC_SC->EXTMODE = 0x00000000;     //EINT2 as level-0 sensitive
    LPC_SC->EXTPOLAR = 0x00000000;
    NVIC_EnableIRQ(EINT2_IRQn);
    while(1) ;
}
void EINT2_IRQHandler(void)
{
    LPC_SC->EXTINT = 0x00000004;  //clear the interrupt
    LPC_GPIO1->FIOSET = 1<<23;    //LED ON
    for (i=0;i<255;i++);
    LPC_GPIO1->FIOCLR = 1<<23;    //LED OFF
}`;
BUILD.push(function wE2() {
  const w = W('w-e2', 'E2 · hold the switch', 'level-0: the ISR runs again and again while held');
  const sp = el('div', { class: 'stp' }); w.appendChild(sp);
  const code = codeBlock(E2_CODE, 'eint2_level0.c'); sp.appendChild(code);
  const lines = $$('.cl', code), L = t => lineOf(E2_CODE, t);
  const hi = arr => { lines.forEach(x => x.classList.remove('on')); arr.forEach(n => lines[n - 1] && lines[n - 1].classList.add('on')); };
  const side = el('div', { class: 'stp-side' }); sp.appendChild(side);
  const r = el('div', { class: 'row' }); side.appendChild(r);
  const led = el('span', { class: 'led', style: 'width:40px;height:40px' }); r.append(led, el('span', { class: 'pinlbl' }, 'P1.23'));
  const k = el('button', { class: 'bigkey', type: 'button' }, 'P2.12<br><small>hold</small>'); r.appendChild(k);
  const say = el('div', { class: 'note blue stp-note' }); side.appendChild(say);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 520 110' }); side.appendChild(s);
  let held = false, T = 4, ph = 0, n = 0, lv = 0, hist = [[0, 0]], pin = [[0, 1]];
  k.addEventListener('pointerdown', e => { e.preventDefault(); held = true; k.classList.add('down'); pin.push([T, 0]); });
  const up = () => { if (!held) return; held = false; k.classList.remove('down'); pin.push([T, 1]); }; k.addEventListener('pointerup', up); k.addEventListener('pointerleave', up);
  say.innerHTML = 'Press and <b>hold</b> P2.12. Watch the ISR loop and the LED trace.';
  const setLv = v => { if (v !== lv) { lv = v; hist.push([T, v]); led.classList.toggle('on', !!v); } };
  const WIN = 4; let X = t => t;
  const lp = Loop(side, dt => {
    T += dt;
    if (held) { ph += dt; const P = 0.16; const q = ph % P; if (q < 0.02) { hi([L('EXTINT = 0x00000004')]); setLv(0); } else if (q < 0.13) { hi([L('FIOSET = 1<<23'), L('for (i=0')]); setLv(1); } else { hi([L('FIOCLR = 1<<23')]); setLv(0); } if (ph - dt < Math.floor(ph / P) * P || ph < dt) n++; say.innerHTML = `Pin is 0 → flag comes right back → <b>ISR #${n}</b>. LED: ON → short delay → OFF → the ISR starts again immediately. Looks ON (a bit dimmer).`; }
    else { ph = 0; setLv(0); hi([L('while(1) ;')]); if (n) say.innerHTML = `Released → pin = 1 → no more interrupts → LED stays OFF. (ISR ran ${n}× while you held it.)`; }
    hist = hist.filter((h, i) => i === hist.length - 1 || hist[i + 1][0] > T - WIN); pin = pin.filter((h, i) => i === pin.length - 1 || pin[i + 1][0] > T - WIN);
    s.innerHTML = ''; const Wd = pxW(s, 110); X = t => 52 + (t - (T - WIN)) / WIN * (Wd - 60);
    sv('text', { x: 2, y: 36, class: 'lbl', style: 'font-size:13px' }, s).textContent = 'P2.12'; sv('text', { x: 2, y: 92, class: 'lbl', style: 'font-size:13px' }, s).textContent = 'LED';
    sv('path', { d: digi(pin.map(h => [Math.max(h[0], T - WIN), h[1]]).concat([[T, held ? 0 : 1]]), X, 18, 46), style: 'fill:none;stroke:var(--blue);stroke-width:2.4' }, s);
    sv('path', { d: digi(hist.map(h => [Math.max(h[0], T - WIN), h[1]]).concat([[T, lv]]), X, 72, 100), style: 'fill:none;stroke:var(--red);stroke-width:2.4' }, s);
  });
  lp.start();
});

/* ---------- GPIO interrupt switchboard ---------- */
BUILD.push(function wGpioInt() {
  const w = W('w-gpioint', 'GPIO interrupt switchboard', 'enable edges, flip pins, then clear');
  const PINS = [[0, 0], [0, 1], [0, 2], [0, 15], [2, 10], [2, 11], [2, 12], [2, 13]];
  const st = PINS.map(() => ({ lv: 0, R: 0, F: 0, sR: 0, sF: 0 }));
  const tb = el('table', { class: 'tbl gpiotbl' }); w.appendChild(el('div', { class: 'tblwrap' })).appendChild(tb);
  const regs = el('div', { class: 'col mt' }); w.appendChild(regs);
  const bellRow = el('div', { class: 'row' }); w.appendChild(bellRow);
  const bell = sv('svg', { width: 44, height: 44, viewBox: '0 0 100 100' }); sv('use', { href: '#st-bell', width: 100, height: 100 }, bell); bellRow.appendChild(bell);
  const bsay = el('div', { class: 'say' }); bellRow.appendChild(bsay);
  const cl = el('div', { class: 'row' }); w.appendChild(cl);
  [0, 2].forEach(p => { const b = el('button', { class: 'btn sm g', type: 'button' }, `IO${p}IntClr = all ones`); b.onclick = () => { PINS.forEach((q, i) => { if (q[0] === p) { st[i].sR = 0; st[i].sF = 0; } }); paint(); }; cl.appendChild(b); });
  function paint() {
    tb.innerHTML = '<tr><th>pin</th><th>level (click)</th><th>EnR</th><th>EnF</th><th>StatR</th><th>StatF</th></tr>';
    PINS.forEach(([p, n], i) => {
      const s = st[i]; const tr = el('tr'); tb.appendChild(tr);
      tr.appendChild(el('td', { class: 'm' }, `P${p}.${n}`));
      const lt = el('td'); const sw = el('button', { class: 'tsw' + (s.lv ? ' on' : ''), type: 'button', 'aria-label': 'pin level' }, '<i></i>'); sw.onclick = () => { const nl = s.lv ^ 1; s.lv = nl; if (nl && s.R) s.sR = 1; if (!nl && s.F) s.sF = 1; paint(); }; lt.appendChild(sw); tr.appendChild(lt);
      ['R', 'F'].forEach(k => { const td = el('td'); const c = el('button', { class: 'chip' + (s[k] ? ' on' : ''), type: 'button', style: '--cc:var(--n-g)' }, s[k] ? '1' : '0'); c.onclick = () => { s[k] ^= 1; paint(); }; td.appendChild(c); tr.appendChild(td); });
      ['sR', 'sF'].forEach(k => tr.appendChild(el('td', { class: 'm' }, s[k] ? '<b class="p-red">1</b>' : '0')));
    });
    const val = (p, k) => PINS.reduce((a, [pp, n], i) => pp === p && st[i][k] ? (a | (1 << n)) >>> 0 : a, 0);
    const p0 = val(0, 'sR') | val(0, 'sF'), p2 = val(2, 'sR') | val(2, 'sF');
    regs.innerHTML = `<div class="rgs">${[['IO0IntEnR', val(0, 'R')], ['IO0IntEnF', val(0, 'F')], ['IO0IntStatR', val(0, 'sR')], ['IO0IntStatF', val(0, 'sF')], ['IO2IntEnR', val(2, 'R')], ['IO2IntEnF', val(2, 'F')], ['IO2IntStatR', val(2, 'sR')], ['IO2IntStatF', val(2, 'sF')], ['IOIntStatus', (p0 ? 1 : 0) | (p2 ? 4 : 0)]].map(([n, v]) => `<span class="rgc${v ? ' set' : ''}"><i>${n}</i><b>${hex(v)}</b></span>`).join('')}</div>`;
    const any = p0 || p2; bell.classList.toggle('ringing', !!any);
    bsay.innerHTML = any ? `<b>EINT3_IRQHandler</b> runs! IOIntStatus = ${hx((p0 ? 1 : 0) | (p2 ? 4 : 0))} → ${[p0 ? 'port 0' : '', p2 ? 'port 2' : ''].filter(Boolean).join(' &amp; ')} → read the StatR/StatF registers to find the pin, then clear it.` : 'nothing pending — enable an edge, then flip that pin.';
  }
  st[0].R = 1; st[4].R = 1; paint();
});

/* ---------- G1 ---------- */
const G1_CODE = `#include<LPC17xx.h>
void EINT3_IRQHandler(void);
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    LPC_GPIO1->FIODIR = 1<<23;               //P1.23 is assigned output
    LPC_GPIO1->FIOCLR = 1<<23;               //Initially LED is kept OFF  //~ slide forgot "="
    LPC_GPIOINT->IO0IntEnR=0x00000003;       //P0.0 and P0.1 - Enable Rising Edge
    NVIC_EnableIRQ(EINT3_IRQn);              //Enable EINT3
    while(1) ;
}
void EINT3_IRQHandler(void)
{
    unsigned int x=LPC_GPIOINT->IO0IntStatR; // Get the status of Rising Edge Interrupts
    LPC_GPIOINT->IO0IntClr |=x;              //Clear the Interrupt
    if (x==0x00000001)                       //If Rising Edge at P0.0
        LPC_GPIO1->FIOSET = 0x00800000;
    else                                     //If Rising edge at P0.1
        LPC_GPIO1->FIOCLR = 0x00800000;
}`;
BUILD.push(function wG1() {
  const L = t => lineOf(G1_CODE, t);
  const boot = [
    { l: [L('FIODIR = 1<<23'), L('FIOCLR = 1<<23;')], t: 'P1.23 = output, LED off.' },
    { l: L('IO0IntEnR=0x00000003'), t: 'IO0IntEnR bits 0 and 1 → <b>rising edge</b> interrupts on P0.0 and P0.1.' },
    { l: [L('NVIC_EnableIRQ(EINT3_IRQn)'), L('while(1) ;')], t: 'GPIO interrupts use the <b>EINT3</b> channel → enable EINT3. Now send an edge.' }
  ];
  const ex = Exercise('w-g1', 'G1 · send edges', 'one ISR, two pins', {
    code: G1_CODE, file: 'gpio_int_led.c', noLcd: true, boot, noteClass: 'green',
    world: () => ({ led: 0, x: null }),
    setup: v => { const r = el('div', { class: 'row' }); v.appendChild(r); v._led = el('span', { class: 'led', style: 'width:36px;height:36px' }); r.append(v._led, el('span', { class: 'pinlbl' }, 'P1.23')); [0, 1].forEach(n => { const b = el('button', { class: 'btn p', type: 'button' }, `↑ edge on P0.${n}`); b.onclick = () => go(n); r.appendChild(b); }); v._kv = el('div', { class: 'say' }); v.appendChild(v._kv); },
    paint: (s, v) => { v._led.classList.toggle('on', !!s.led); v._kv.innerHTML = s.x != null ? `x = IO0IntStatR = ${hex(s.x)}` : ''; }
  });
  function go(n) {
    const x = 1 << n;
    ex.fire([
      { l: L('IO0IntEnR'), t: `Rising edge on P0.${n} → IO0IntStatR bit ${n} = 1 → EINT3 interrupt.`, f: s => set(s, { x: null }) },
      { l: L('unsigned int x='), t: `ISR: x = IO0IntStatR = <b>${hex(x)}</b> → tells us which pin.`, f: s => set(s, { x }) },
      { l: L('IO0IntClr |=x'), t: `Write x to IO0IntClr → bit ${n} of StatR cleared.` },
      n === 0 ? { l: [L('if (x==0x00000001)'), L('FIOSET = 0x00800000')], t: 'x == 1 → it was P0.0 → <b>LED ON</b>.', f: s => set(s, { led: 1 }) } : { l: [L('else'), L('FIOCLR = 0x00800000')], t: 'x ≠ 1 → it was P0.1 → <b>LED OFF</b>.', f: s => set(s, { led: 0 }) }
    ]);
  }
});

/* ---------- G2 ---------- */
const G2_CODE = `#include <lpc17xx.h>
void EINT3_IRQHandler (void);
unsigned int row, col, temp;      //~ temp added
int main(void)
{
    LPC_GPIO0->FIODIR =0x03;      //p0.0 and p0.1 output
    LPC_GPIO1->FIODIR =0x03;      // p1.0 to p1.1 output
    LPC_GPIO1->FIOSET =0x03;      // Facilitate any key press detection
    LPC_GPIOINT->IO2IntEnR= 1<<10 | 1<<11; //Rising edge- P2.10,P2.11
    NVIC_EnableIRQ(EINT3_IRQn);   //Enable GPIO INTR
    while(1);
}
void EINT3_IRQHandler (void)
{
    unsigned int temp3;
    temp3 = LPC_GPIOINT->IO2IntStatR;
    if (temp3 == 1<<10)
        col = 0;
    else if (temp3 == 1<<11)
        col = 1;
    LPC_GPIOINT->IO2IntClr=1<<10 | 1<<11;//Clear Interrupt
    for (row=0;row <2;row++)
    {
        if (row==0)
            temp=0x01;
        else if (row==1)
            temp=0x02;
        LPC_GPIO1->FIOPIN=temp;
        if ((LPC_GPIO2->FIOPIN & ((1<<10)|(1<<11))) != 0) //~ brackets fixed
        {
            LPC_GPIO0->FIOPIN=row *2+col; //Display the keycode
            LPC_GPIO1->FIOSET=0x03; // Facilitate any keypress detection
            break;
        }
    }
}`;
BUILD.push(function wG2() {
  const L = t => lineOf(G2_CODE, t);
  const boot = [
    { l: L('LPC_GPIO0->FIODIR =0x03'), t: 'P0.0, P0.1 = outputs (the 2 keycode LEDs).' },
    { l: [L('LPC_GPIO1->FIODIR =0x03'), L('FIOSET =0x03;')], t: 'Rows P1.0, P1.1 = outputs, both driven <b>HIGH</b> → any key press will pull its column HIGH.', f: s => set(s, { rows: 3 }) },
    { l: L('IO2IntEnR'), t: 'Rising-edge interrupt on both columns P2.10, P2.11.' },
    { l: [L('NVIC_EnableIRQ'), L('while(1);')], t: 'Enable EINT3 (GPIO interrupts) and wait. <b>Press a key.</b>' }
  ];
  const ex = Exercise('w-g2', 'G2 · press a key', '2×2 keypad, no scanning while idle', {
    code: G2_CODE, file: 'gpio_int_keypad.c', noLcd: true, boot, noteClass: 'green',
    world: () => ({ rows: 3, code: 0, row: null, col: null }),
    setup: v => { const r = el('div', { class: 'row' }); v.appendChild(r); v._kp = Keypad(r, { rows: 2, cols: 2, labels: ['0', '1', '2', '3'], onchange: (p, i, how) => { if (how === 'down' || how === undefined) press(i); } }); v._kp.el.style.maxWidth = '150px'; const lc = el('div', { class: 'col' }); r.appendChild(lc); v._l1 = el('span', { class: 'led y' }); v._l0 = el('span', { class: 'led y' }); lc.append(el('span', { class: 'gae small' }, 'P0.1 P0.0'), el('div', { class: 'row' })); lc.lastChild.append(v._l1, v._l0); v._kv = el('div', { class: 'say' }); lc.appendChild(v._kv); },
    paint: (s, v) => { v._l1.classList.toggle('on', !!(s.code & 2)); v._l0.classList.toggle('on', !!(s.code & 1)); v._kv.innerHTML = `rows P1.1/P1.0 = ${bin(s.rows, 2)}${s.col != null ? ` · col = ${s.col}` : ''}${s.row != null ? ` · row = ${s.row}` : ''} · keycode = ${s.code}`; v._kp.row(s.scan ?? null); }
  });
  function press(k) {
    const r = k >> 1, c = k & 1; const S = [
      { l: L('IO2IntEnR'), t: `Key (${r},${c}) joins row ${r} to column ${c}: column P2.${10 + c} goes 0 → 1 → <b>rising-edge interrupt</b>.`, f: s => set(s, { row: null, col: null }) },
      { l: [L('temp3 = LPC_GPIOINT->IO2IntStatR'), c ? L('else if (temp3 == 1<<11)') : L('if (temp3 == 1<<10)')], t: `temp3 = IO2IntStatR = ${hex(1 << (10 + c))} → <b>col = ${c}</b>.`, f: s => set(s, { col: c }) },
      { l: L('IO2IntClr'), t: 'Clear both column flags.' }
    ];
    for (let rr = 0; rr <= r; rr++) {
      S.push({ l: [L('for (row=0'), rr ? L('temp=0x02') : L('temp=0x01'), L('LPC_GPIO1->FIOPIN=temp')], t: `row = ${rr}: drive only P1.${rr} HIGH (FIOPIN = ${hx(1 << rr)}).`, f: s => set(s, { rows: 1 << rr, row: rr, scan: rr }) });
      S.push({ l: L('if ((LPC_GPIO2->FIOPIN'), t: rr === r ? `Column ${c} is HIGH → the key is in <b>row ${rr}</b>!` : 'Both columns read 0 → not this row.' });
    }
    S.push({ l: [L('FIOPIN=row *2+col'), L('FIOSET=0x03; // Facilitate')], t: `keycode = ${r}×2 + ${c} = <b>${k}</b> → LEDs show ${bin(k, 2)}. Both rows HIGH again → ready for the next key.`, f: s => set(s, { code: k, rows: 3, scan: null }) });
    ex.fire(S);
  }
});
