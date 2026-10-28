/* =========================================================
   NOTEBOOK 2 · part B — ADC, DAC, stepper
   ========================================================= */

/* ---------- ADC staircase ---------- */
BUILD.push(function wStairs() {
  const w = W('w-stairs', 'the ADC staircase', 'drag the input voltage · zoom shows the steps');
  let N = 12, V = 1.1, Vref = 3.3, zoom = false;
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  ruler(ctl, 'input voltage V_A', 0, 3300, V * 1000, 1, v => (v / 1000).toFixed(3) + ' V', v => { V = v / 1000; draw(); });
  const nc = el('div', { class: 'col' }); ctl.appendChild(nc); nc.appendChild(el('span', { class: 'gae small' }, 'bits N'));
  chipGroup(nc, [[3, '3'], [4, '4'], [8, '8'], [10, '10'], [12, '12 (LPC1768)']], N, v => { N = +v; draw(); });
  const zc = el('button', { class: 'chip', type: 'button' }, '🔍 zoom in'); zc.onclick = () => { zoom = !zoom; zc.classList.toggle('on', zoom); draw(); }; ctl.appendChild(zc);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 640 300' }); w.appendChild(s);
  const out = el('div', { class: 'row' }); w.appendChild(out);
  function draw() {
    const M = 1 << N, res = Vref / M, code = Math.min(M - 1, Math.floor(V / res));
    let v0 = 0, v1 = Vref; if (zoom) { const span = Math.max(res * 8, 0.002); v0 = Math.max(0, V - span / 2); v1 = Math.min(Vref, v0 + span); v0 = v1 - span; }
    const c0 = Math.floor(v0 / res), c1 = Math.min(M - 1, Math.ceil(v1 / res));
    const X = v => 70 + (v - v0) / (v1 - v0) * 540, Y = c => 260 - (c - c0) / Math.max(1, (c1 - c0)) * 230;
    s.innerHTML = '';
    sv('path', { d: 'M70 260 H620 M70 260 V20', class: 'ink' }, s);
    sv('text', { x: 620, y: 290, 'text-anchor': 'end', class: 'lbl', style: 'font-size:14px' }, s).textContent = 'analog input (V) →';
    sv('text', { x: 6, y: 16, class: 'lbl', style: 'font-size:14px' }, s).textContent = 'digital output';
    let d = ''; const steps = Math.min(c1 - c0 + 1, 600);
    for (let i = 0; i < steps; i++) { const c = c0 + Math.round(i * (c1 - c0) / Math.max(1, steps - 1)); const a = X(Math.max(v0, c * res)), b = X(Math.min(v1, (c + 1) * res)); d += (i ? 'V' : 'M' + a + ' ') + Y(c) + 'H' + b; }
    sv('path', { d, style: 'fill:none;stroke:var(--purple);stroke-width:2.2' }, s);
    sv('path', { d: `M${X(V)} 260 V${Y(code)} H70`, style: 'stroke:var(--pink);stroke-width:1.6;stroke-dasharray:4 4;fill:none' }, s);
    sv('circle', { cx: X(V), cy: Y(code), r: 6, style: 'fill:var(--pink);stroke:var(--ink);stroke-width:1.5' }, s);
    [v0, (v0 + v1) / 2, v1].forEach(v => sv('text', { x: X(v), y: 276, 'text-anchor': 'middle', class: 'mono', style: 'font-size:12px' }, s).textContent = v.toFixed(zoom ? 4 : 2));
    [c0, c1].forEach(c => sv('text', { x: 64, y: Y(c) + 4, 'text-anchor': 'end', class: 'mono', style: 'font-size:12px' }, s).textContent = c);
    out.innerHTML = `<span class="ro">resolution = ${Vref} / 2<sup>${N}</sup> = <b>${(res * 1000).toFixed(N > 8 ? 3 : 1)} mV</b></span><span class="ro">output = ⌊${V.toFixed(3)} / ${(res * 1000).toFixed(3)} mV⌋ = <b>${code}</b> = ${hx(code, Math.ceil(N / 4))}</span><span class="ro">back to volts: ${code} × res = ${(code * res).toFixed(4)} V</span>`;
  }
  draw();
});

/* ---------- SAR binary search ---------- */
BUILD.push(function wSar() {
  const w = W('w-sar', 'SAR = binary search', 'one bit per step, MSB first');
  let N = 12, V = 1.1, k = -1, bits = [];
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  ruler(ctl, 'input V_A', 0, 3299, V * 1000, 1, v => (v / 1000).toFixed(3) + ' V', v => { V = v / 1000; reset(); });
  const nc = el('div', { class: 'col' }); ctl.appendChild(nc); nc.appendChild(el('span', { class: 'gae small' }, 'bits'));
  chipGroup(nc, [[4, '4 (easy to follow)'], [12, '12 (real)']], N, v => { N = +v; reset(); });
  const bt = el('div', { class: 'row' }); w.appendChild(bt);
  const bN = el('button', { class: 'btn p', type: 'button' }, 'next bit ▸'), bA = el('button', { class: 'btn sm y', type: 'button' }, 'all bits ▸▸'), bR = el('button', { class: 'btn sm g', type: 'button' }, '⟲');
  bt.append(bN, bA, bR);
  const reg = el('div', { class: 'sarreg' }); w.appendChild(reg);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 640 230' }); w.appendChild(s);
  const say = el('div', { class: 'say' }); w.appendChild(say);
  const hist = [];
  function reset() { k = -1; bits = Array(N).fill(null); hist.length = 0; draw(); say.textContent = 'Start: all bits unknown. The SAR will test the MSB first.'; }
  function stepOne() {
    if (k >= N - 1) return; k++; const b = N - 1 - k;
    const base = bits.reduce((a, x, i) => a + (x ? 1 << (N - 1 - i) : 0), 0); const trial = base + (1 << b); const vt = trial * 3.3 / (1 << N);
    const keep = V >= vt; bits[k] = keep ? 1 : 0; hist.push({ vt, keep });
    say.innerHTML = `bit ${b}: try ${bin(trial, N)} → DAC makes <b>${vt.toFixed(4)} V</b>. Comparator: V<sub>A</sub> ${keep ? '≥' : '&lt;'} guess → bit ${b} = <b>${keep ? 1 : 0}</b> ${keep ? '(keep it)' : '(drop it)'}`;
    if (k === N - 1) { const code = base + (keep ? 1 << b : 0); say.innerHTML += `<br>Done in ${N} steps → <b>${code}</b> (${hx(code, Math.ceil(N / 4))}). Check: ⌊${V.toFixed(3)} / ${(3.3 / (1 << N) * 1000).toFixed(3)} mV⌋ = ${Math.min((1 << N) - 1, Math.floor(V / (3.3 / (1 << N))))} ✓`; }
    draw();
  }
  bN.onclick = stepOne; bA.onclick = () => { while (k < N - 1) stepOne(); }; bR.onclick = reset;
  function draw() {
    reg.innerHTML = bits.map((x, i) => `<span class="${x === null ? (i === k + 1 ? 'next' : '') : x ? 'one' : 'zero'}"><b>${x === null ? '?' : x}</b><small>b${N - 1 - i}</small></span>`).join('');
    s.innerHTML = ''; const X = i => 60 + i * (560 / N), Y = v => 210 - v / 3.3 * 190;
    sv('path', { d: 'M50 210 H630 M50 210 V12', class: 'ink' }, s);
    [0, 1.65, 3.3].forEach(v => sv('text', { x: 44, y: Y(v) + 4, 'text-anchor': 'end', class: 'mono', style: 'font-size:11px' }, s).textContent = v + 'V');
    sv('path', { d: `M50 ${Y(V)} H630`, style: 'stroke:var(--blue);stroke-width:2.2;stroke-dasharray:6 4' }, s);
    sv('text', { x: 628, y: Y(V) - 6, 'text-anchor': 'end', class: 'lbl', style: 'font-size:13px;fill:var(--blue)' }, s).textContent = 'V_A';
    let lo = 0, hi = 3.3;
    hist.forEach((h, i) => { const x = X(i) + 8, wd = 560 / N - 12; sv('rect', { x, y: Y(hi), width: wd, height: Y(lo) - Y(hi), rx: 3, style: 'fill:var(--hl-l);stroke:var(--ink3);stroke-width:.8' }, s); sv('path', { d: `M${x - 3} ${Y(h.vt)} H${x + wd + 3}`, style: `stroke:${h.keep ? 'var(--green)' : 'var(--red)'};stroke-width:2.6` }, s); if (h.keep) lo = h.vt; else hi = h.vt; if (N <= 4) sv('text', { x: x + wd / 2, y: Y(h.vt) - 5, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, s).textContent = h.vt.toFixed(2); });
  }
  reset();
});

/* ---------- ADCR builder ---------- */
BUILD.push(function wAdcr() {
  const w = W('w-adcr', 'ADCR builder', 'A/D Control Register');
  const selSay = x => { const ch = []; for (let i = 0; i < 8; i++) if ((x >> i) & 1) ch.push('AD0.' + i); return ch.length ? `channel(s) selected: <b>${ch.join(', ')}</b>` : '<span class="p-red">no channel selected</span>'; };
  RegBuilder(w, {
    name: 'ADCR', reg: 'LPC_ADC->ADCR', width: 28, value: (1 << 5) | (1 << 21) | (1 << 24), hexd: 8, fields: [
      { lo: 0, hi: 7, name: 'SEL', desc: 'bit n = 1 → sample AD0.n. Software mode: exactly one bit. Burst mode: 1 to 8 bits. All zeros = same as 0x01.', say: selSay },
      { lo: 8, hi: 15, name: 'CLKDIV', desc: 'ADC clock = PCLK / (CLKDIV + 1), must be ≤ 13 MHz', say: (x) => `ADC clock = 3 MHz / ${x + 1} = ${(3 / (x + 1)).toFixed(3)} MHz` },
      { bit: 16, name: 'BURST', desc: '1 = keep converting the selected channels automatically', opts: { 0: '0 · software', 1: '1 · burst' }, say: { 0: 'software-controlled mode (convert when START says)', 1: '<b>burst mode</b>: repeated conversions, START must be 000' } },
      { bit: 21, name: 'PDN', desc: '1 = ADC operational, 0 = power-down', opts: { 0: '0 · off', 1: '1 · on' }, say: { 0: '<span class="p-red">ADC in power-down</span>', 1: 'ADC <b>operational</b>' } },
      { lo: 24, hi: 26, name: 'START', desc: '000 no start · 001 start now · 010–111 start on an edge (EINT0, CAP0.1, MAT0.1, MAT0.3, MAT1.0, MAT1.1)', opts: { 0: '000', 1: '001 now', 2: '010', 3: '011', 4: '100', 5: '101', 6: '110', 7: '111' }, say: x => ['no start', '<b>start conversion now</b>', 'start on edge of P2.10/EINT0', 'start on edge of P1.27/CAP0.1', 'start on edge of MAT0.1', 'start on edge of MAT0.3', 'start on edge of MAT1.0', 'start on edge of MAT1.1'][x] },
      { bit: 27, name: 'EDGE', desc: 'for START = 010–111: 1 = falling edge, 0 = rising edge', opts: { 0: '0 rising', 1: '1 falling' }, say: (x, v) => ((v >> 24) & 7) >= 2 ? (x ? 'on the falling edge' : 'on the rising edge') : null }
    ], presets: [[(1 << 4) | (1 << 21) | (1 << 24), 'A1: AD0.4 start'], [(1 << 5) | (1 << 21) | (1 << 24), 'A1/A3: AD0.5 start'], [(1 << 4) | (1 << 5) | (1 << 16) | (1 << 21), 'A2: burst 4+5']]
  });
  w.appendChild(el('p', { class: 'small p-soft' }, 'Bits 20:17, 23:22 and 31:28 are reserved — write 0. START = 000 is also the value to use when clearing PDN to 0. For 100–111 the MAT signal does not need to be pinned out (MAT0.3 can\'t even be).'));
});

/* ---------- ADGDR decoder ---------- */
BUILD.push(function wAdgdr() {
  const w = W('w-adgdr', 'decode a data register', 'type or pick a raw 32-bit value');
  const row = el('div', { class: 'row' }); w.appendChild(row);
  const inp = el('input', { class: 'inp', value: '0x85005550', style: 'width:12em', 'aria-label': 'raw value' }); row.append(el('span', { class: 'gae' }, 'ADGDR ='), inp);
  const ch = el('div', { class: 'chips' }); row.appendChild(ch);
  [['0x85005550', 'done, ch 5'], ['0x04008880', 'not done'], ['0xC4003FF0', 'done + overrun']].forEach(([v, t]) => { const b = el('button', { class: 'chip', type: 'button' }, t); b.onclick = () => { inp.value = v; upd(); }; ch.appendChild(b); });
  const strip = RegStrip(w, { bits: 32, name: 'LPC_ADC->ADGDR' });
  const out = el('div', { class: 'col' }); w.appendChild(out);
  function upd() {
    let v; try { v = safeEval(inp.value); } catch (e) { return; }
    strip.set(v, [{ lo: 4, hi: 15, color: 'var(--purple)' }, { lo: 24, hi: 26, color: 'var(--blue)' }, { lo: 30, hi: 30, color: 'var(--orange)' }, { lo: 31, hi: 31, color: 'var(--green)' }]);
    const r = (v >>> 4) & 0xFFF, c = (v >>> 24) & 7, done = v >>> 31, ov = (v >>> 30) & 1;
    out.innerHTML = `<div class="kv"><span class="p-green">DONE (31)</span><span>${done} ${done ? '→ conversion complete, result valid' : '→ still converting: keep waiting'}</span><span class="p-orange">OVERRUN (30)</span><span>${ov} ${ov ? '→ an older result was overwritten (burst mode)' : ''}</span><span class="p-blue">CHN (26:24)</span><span>${c} → result is from AD0.${c}</span><span class="p-purple">RESULT (15:4)</span><span>(v &gt;&gt; 4) &amp; 0xFFF = <b>${r}</b> = ${hx(r, 3)} → ${(r * 3.3 / 4096).toFixed(3)} V</span></div>`;
  }
  inp.addEventListener('input', upd); upd();
});

/* ---------- software vs burst timeline ---------- */
BUILD.push(function wModes() {
  const w = W('w-modes', 'software vs burst', 'what the CPU and the ADC are doing');
  const s = sv('svg', { class: 'dg', viewBox: '0 0 640 220' }); w.appendChild(s);
  const lanes = [['software: CPU', 30], ['software: ADC', 70], ['burst: CPU', 140], ['burst: ADC', 180]];
  lanes.forEach(([t, y]) => sv('text', { x: 2, y: y + 5, class: 'lbl', style: 'font-size:13px' }, s).textContent = t);
  const g = sv('g', {}, s);
  const blk = (x, wd, y, fill, txt) => { sv('rect', { x, y: y - 13, width: wd, height: 26, rx: 5, style: `fill:${fill};stroke:var(--ink3);stroke-width:.8` }, g); if (txt) sv('text', { x: x + wd / 2, y: y + 5, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, g).textContent = txt; };
  let x = 120; [4, 5, 4, 5].forEach(c => { blk(x, 26, 30, 'var(--hl-y)', 'START'); blk(x + 26, 52, 30, 'var(--faint)', 'wait'); blk(x + 26, 52, 70, 'var(--hl-l)', 'ch' + c); blk(x + 78, 22, 30, 'var(--hl-g)', 'read'); x += 124; });
  x = 120; for (let i = 0; i < 9; i++) { blk(x, 52, 180, 'var(--hl-l)', 'ch' + (i % 2 ? 5 : 4)); x += 56; }
  blk(120, 500, 140, 'var(--hl-g)', 'free for other work … the ISR reads results when DONE interrupts');
  x = 120; for (let i = 0; i < 9; i++) { sv('text', { x: x + 52, y: 162, 'text-anchor': 'middle', style: 'font-size:13px' }, g).textContent = '⚡'; x += 56; }
  const t = el('div', { class: 'split mt' }); w.appendChild(t);
  t.innerHTML = '<ul class="b"><li><b>Software</b>: one START → one conversion; the CPU waits for DONE.</li></ul><ul class="b"><li><b>Burst</b>: the ADC loops through the SEL channels by itself; the CPU is free and collects results in the ADC interrupt.</li></ul>';
});

/* ---------- A1 software ---------- */
const A1_CODE = `#include<LPC17xx.h>
#include<stdio.h>
int main(void)
{
    unsigned long temp4, temp5;
    unsigned int i;
    SystemInit();
    SystemCoreClockUpdate();
    LPC_PINCON->PINSEL3 = (3<<28) | (3<<30);   //P1.30 as AD0.4 and P1.31 as AD0.5
    LPC_ADC->ADINTEN = 0;
    while(1)
    {
        LPC_ADC->ADCR = (1<<4)|(1<<21)|(1<<24);  //ADC0.4, start conversion and operational
        while(((temp4=LPC_ADC->ADDR4) & (1<<31)) == 0); //wait till 'done' bit is 1
        temp4 = LPC_ADC->ADDR4;
        temp4 >>= 4;
        temp4 &= 0x00000FFF;                       //12 bit ADC
        LPC_ADC->ADCR = (1<<5)|(1<<21)|(1<<24);  //ADC0.5, start conversion and operational
        for(i=0;i<2000;i++);                       //delay for conversion
        while(((temp5=LPC_ADC->ADDR5) & (1<<31)) == 0); //wait till 'done' bit is 1
        temp5 = LPC_ADC->ADDR5;
        temp5 >>= 4;
        temp5 &= 0x00000FFF;                       //12 bit ADC
        //Now you can use temp4 and temp5 for further processing
    }
}`;
function knobRow(host, labs, vals, on) { const r = el('div', { class: 'row' }); host.appendChild(r); labs.forEach((l, i) => ruler(r, l, 0, 3300, vals[i] * 1000, 1, v => (v / 1000).toFixed(2) + ' V', v => { vals[i] = v / 1000; on && on(); })); return r; }
BUILD.push(function wA1() {
  const w = W('w-a1', 'A1 · step through', 'set the two input voltages first');
  const vals = [1.1, 2.5]; const host = el('div');
  const L = t => lineOf(A1_CODE, t);
  const cd = v => Math.min(4095, Math.floor(v / 3.3 * 4096));
  function build() {
    const c4 = cd(vals[0]), c5 = cd(vals[1]); const raw4 = (0x84000000 | (c4 << 4)) >>> 0, raw5 = (0x85000000 | (c5 << 4)) >>> 0;
    return [
      { l: L('PINSEL3 = (3<<28)'), t: 'P1.30 → AD0.4, P1.31 → AD0.5 (function 11).' },
      { l: L('ADINTEN = 0'), t: 'No ADC interrupts — we poll the DONE bit.' },
      { l: L('ADCR = (1<<4)'), t: 'ADCR: SEL bit 4 (AD0.4) + PDN bit 21 (on) + START bit 24 = 001 → <b>convert AD0.4 now</b>.', f: s => set(s, { busy: 4 }) },
      { l: L("while(((temp4"), t: 'Spin until ADDR4 bit 31 (DONE) = 1 … (65 ADC clocks).', f: s => set(s, { busy: 0, raw4 }) },
      { l: L('temp4 = LPC_ADC->ADDR4'), t: `ADDR4 = <b>${hex(raw4)}</b> (DONE = 1, result in bits 15:4).` , f: s => set(s, { t4: raw4 }) },
      { l: L('temp4 >>= 4'), t: `Shift right 4 → ${hex(raw4 >>> 4)}`, f: s => set(s, { t4: raw4 >>> 4 }) },
      { l: L('temp4 &= 0x00000FFF'), t: `Keep 12 bits → temp4 = <b>${c4}</b> (${hx(c4, 3)}) ≈ ${(c4 * 3.3 / 4096).toFixed(3)} V.`, f: s => set(s, { t4: c4 }) },
      { l: [L('ADCR = (1<<5)'), L('for(i=0;i<2000')], t: 'Same for AD0.5: select bit 5 and START. (The for-loop delay is extra — the DONE wait is enough.)', f: s => set(s, { busy: 5 }) },
      { l: [L("while(((temp5"), L('temp5 = LPC_ADC->ADDR5'), L('temp5 >>= 4'), L('temp5 &= 0x00000FFF')], t: `ADDR5 = ${hex(raw5)} → temp5 = <b>${c5}</b> (${hx(c5, 3)}) ≈ ${(c5 * 3.3 / 4096).toFixed(3)} V.`, f: s => set(s, { busy: 0, t5: c5 }) },
      { l: L('Now you can use'), t: 'Both values ready → loop and measure again. Only one channel converts at a time in software mode.' }
    ];
  }
  const view = (s, v, k, first) => {
    if (first) { v.innerHTML = ''; v._m = el('div', { class: 'row' }); v.appendChild(v._m); }
    v._m.innerHTML = [4, 5].map(c => `<div class="meter${s.busy === c ? ' busy' : ''}"><div class="gae">AD0.${c}</div><div class="mono">input ${vals[c - 4].toFixed(2)} V</div><div class="mbig">${s['t' + c] != null ? s['t' + c] : '—'}</div><div class="small">temp${c}</div></div>`).join('');
  };
  knobRow(w, ['P1.30 (AD0.4)', 'P1.31 (AD0.5)'], vals, () => st.setSteps(build(), st.k));
  w.appendChild(host);
  const st = Stepper(host, { code: A1_CODE, title: 'adc_software.c', steps: build(), init: () => ({}), view });
});

/* ---------- A2 burst ---------- */
const A2_CODE = `#include<LPC17xx.h>
#include<stdio.h>
unsigned long temp4, temp5;          //~ make these global
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    LPC_PINCON->PINSEL3 =(3<<28)|(3<<30);   //P1.30 as AD0.4 and P1.31 as AD0.5
    LPC_ADC->ADCR = (1<<4)|(1<<5)|(1<<16)|(1<<21); //Enable CH 4 and 5 for BURST mode with ADC power ON
    LPC_ADC->ADINTEN =(1<<4)|(1<<5); // Enable DONE for INTR
    NVIC_EnableIRQ(ADC_IRQn);
    while(1);
}
void ADC_IRQHandler(void)
{
    int channel,temp,result;
    channel=(LPC_ADC->ADGDR >>24) & 0x07;
    result= ( LPC_ADC->ADGDR >>4) & 0xFFF;
    if(channel == 4)
    {
        temp4 = ( LPC_ADC->ADDR4 >>4) & 0xFFF ; //Read to Clear Done flag
    }
    else if(channel == 5)
    {
        temp5 = ( LPC_ADC->ADDR5 >>4) & 0xFFF ; //Read to Clear Done flag
    }
    //Now you can use temp4 and temp5 for further processing
}`;
BUILD.push(function wA2() {
  const w = W('w-a2', 'A2 · burst mode, live', 'the ADC alternates 4, 5, 4, 5… and interrupts each time');
  const vals = [0.8, 2.7]; knobRow(w, ['P1.30 (AD0.4)', 'P1.31 (AD0.5)'], vals);
  const sp = el('div', { class: 'stp' }); w.appendChild(sp);
  const code = codeBlock(A2_CODE, 'adc_burst.c'); sp.appendChild(code);
  const lines = $$('.cl', code), L = t => lineOf(A2_CODE, t);
  const hi = arr => { lines.forEach(x => x.classList.remove('on')); arr.forEach(n => lines[n - 1] && lines[n - 1].classList.add('on')); };
  const side = el('div', { class: 'stp-side' }); sp.appendChild(side);
  const m = el('div', { class: 'row' }); side.appendChild(m);
  const say = el('div', { class: 'note blue stp-note' }); side.appendChild(say);
  const ctl = el('div', { class: 'row' }); side.appendChild(ctl); let spd = 1;
  ruler(ctl, 'slow-motion', 1, 10, 3, 1, v => '×' + v, v => spd = v);
  let T = 0, ph = 0, ch = 4, t4 = null, t5 = null, n = 0;
  const cd = v => Math.min(4095, Math.floor(v / 3.3 * 4096));
  const lp = Loop(side, dt => {
    ph += dt / spd * 2;
    if (ph < 1) { hi([L('ADCR = (1<<4)|(1<<5)'), L('while(1);')]); say.innerHTML = `ADC converting <b>AD0.${ch}</b> by itself (burst). CPU is idle in <code>while(1);</code>.`; }
    else if (ph < 1.6) { hi([L('channel=(LPC_ADC->ADGDR'), L('result= ( LPC_ADC->ADGDR')]); say.innerHTML = `DONE for AD0.${ch} → ADINTEN bit ${ch} → <b>ADC interrupt</b>. ISR reads ADGDR: CHN = ${ch}, result = ${cd(vals[ch - 4])}.`; }
    else if (ph < 2.2) { hi(ch === 4 ? [L('if(channel == 4)'), L('temp4 = ( LPC_ADC->ADDR4')] : [L('else if(channel == 5)'), L('temp5 = ( LPC_ADC->ADDR5')]); if (ch === 4) t4 = cd(vals[0]); else t5 = cd(vals[1]); say.innerHTML = `channel == ${ch} → read ADDR${ch} (this also clears its DONE flag) → temp${ch} = <b>${ch === 4 ? t4 : t5}</b>.`; }
    else { ph = 0; ch = ch === 4 ? 5 : 4; n++; }
    m.innerHTML = [4, 5].map(c => `<div class="meter${ch === c && ph < 1 ? ' busy' : ''}"><div class="gae">AD0.${c}</div><div class="mono">${vals[c - 4].toFixed(2)} V</div><div class="mbig">${(c === 4 ? t4 : t5) ?? '—'}</div><div class="small">temp${c}</div></div>`).join('') + `<div class="say small">interrupts: ${n}</div>`;
  });
  lp.start();
});

/* ---------- A3 LCD voltmeter ---------- */
const A3_CODE = `#include<LPC17xx.h>
#include<stdio.h>
#define Ref_Vtg    3.300
#define Full_Scale 0xFFF          //12 bit ADC
int main(void)
{
    unsigned long adc_temp;
    unsigned int i;
    float in_vtg;
    unsigned char vtg[7], dval[7];
    unsigned char Msg3[] = {"ANALOG IP:"};
    unsigned char Msg4[] = {"ADC OUTPUT:"};
    SystemInit();
    SystemCoreClockUpdate();
    lcd_init();                       //Initialize LCD
    LPC_PINCON->PINSEL3 |= 3<<30;     //P1.31 as AD0.5
    LPC_SC->PCONP |= (1<<12);         //enable the peripheral ADC
    flag1=0;                          //Command
    temp1 = 0x80;                     //Cursor at beginning of first line
    lcd_write();
    flag1=1;                          //Data
    i =0;
    while (Msg3[i++] != '\\0')
    {
        temp1 = Msg3[i];
        lcd_write();                  //Send data bytes
    }
    flag1=0;                          //Command
    temp1 = 0xC0;                     //Cursor at beginning of second line
    lcd_write();
    flag1=1;
    i =0;
    while (Msg4[i++] != '\\0')
    {
        temp1 = Msg4[i];
        lcd_write();                  //Send data bytes
    }
    while(1)
    {
        LPC_ADC->ADCR = (1<<5)|(1<<21)|(1<<24);  //ADC0.5, start conversion and operational
        while(((adc_temp=LPC_ADC->ADGDR) & (1<<31)) == 0);
        adc_temp = LPC_ADC->ADGDR;
        adc_temp >>= 4;
        adc_temp &= 0x00000FFF;       //12 bit ADC
        in_vtg = (((float)adc_temp * (float)Ref_Vtg))/((float)Full_Scale); //calculating input analog voltage
        sprintf(vtg,"%3.2fV",in_vtg); //convert the readings into string to display on LCD
        sprintf(dval,"%x",adc_temp);
        flag1=0;
        temp1 = 0x8A;
        lcd_write();
        flag1=1;
        i =0;
        while (vtg[i++] != '\\0')
        {
            temp1 = vtg[i];
            lcd_write();              //Send data bytes
        }
        flag1=0;
        temp1 = 0xCB;
        lcd_write();
        flag1=1;
        i =0;
        while (dval[i++] != '\\0')
        {
            temp1 = dval[i];
            lcd_write();              //Send data bytes
        }
        for(i=0;i<7;i++)
            vtg[i] = dval[i] = 0;
    }
}`;
BUILD.push(function wA3() {
  let Vin = 1.1, slideBug = false;
  const w = W('w-a3', 'A3 · turn the potentiometer', 'every step = one line of the loop');
  const top = el('div', { class: 'row mb' }); w.appendChild(top);
  const pot = sv('svg', { viewBox: '0 0 120 120', width: 110, height: 110, style: 'flex:none;cursor:grab;touch-action:none;overflow:visible' }); top.appendChild(pot);
  sv('circle', { cx: 60, cy: 60, r: 46, style: 'fill:#3c4a63;stroke:var(--ink);stroke-width:3' }, pot); sv('circle', { cx: 60, cy: 60, r: 32, style: 'fill:#dfe4ee;stroke:var(--ink);stroke-width:2' }, pot);
  const knob = sv('path', { d: 'M60 60 L60 32', style: 'stroke:var(--pink);stroke-width:6;stroke-linecap:round' }, pot);
  const tl = el('div', { class: 'col' }); top.appendChild(tl); tl.appendChild(el('span', { class: 'cav p-soft' }, '↖ drag the knob (P1.31 wiper)'));
  const vr = el('div', { class: 'say' }); tl.appendChild(vr);
  const bugc = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-p)' }, 'show the slide\'s skip-first-letter bug'); tl.appendChild(bugc); bugc.onclick = () => { slideBug = !slideBug; bugc.classList.toggle('on', slideBug); rebuild(); };
  const host = el('div'); w.appendChild(host);
  const L = t => lineOf(A3_CODE, t);
  const strFor = v => { const c = Math.min(4095, Math.floor(v / 3.3 * 4096)); return { c, vs: (c * 3.3 / 4095).toFixed(2) + 'V', hs: c.toString(16) }; };
  const sendStr = (lcd, str) => { if (slideBug) { for (let i = 1; i <= str.length; i++) lcd.data(i < str.length ? str.charCodeAt(i) : 0); } else lcd.print(str); };
  function build() {
    const r = strFor(Vin); const S = [
      { l: [L('lcd_init();'), L('PINSEL3 |= 3<<30'), L('PCONP |= (1<<12)')], t: 'LCD init; P1.31 → AD0.5; <b>power on the ADC</b> (PCONP bit 12).', f: s => { s.lcd = new HD44780().ready(); } },
      { l: [L('temp1 = 0x80;'), L('while (Msg3[i++]'), L('temp1 = Msg3[i]')], t: 'Cursor 0x80 → write "ANALOG IP:"', f: s => { s.lcd.cmd(0x80); sendStr(s.lcd, 'ANALOG IP:'); } },
      { l: [L('temp1 = 0xC0;'), L('while (Msg4[i++]'), L('temp1 = Msg4[i]')], t: 'Cursor 0xC0 → write "ADC OUTPUT:"', f: s => { s.lcd.cmd(0xC0); sendStr(s.lcd, 'ADC OUTPUT:'); } },
      { l: [L('ADCR = (1<<5)'), L("while(((adc_temp")], t: 'Start a conversion of AD0.5, wait for DONE in ADGDR.' },
      { l: [L('adc_temp = LPC_ADC->ADGDR'), L('adc_temp >>= 4'), L('adc_temp &= 0x00000FFF')], t: `adc_temp = <b>${r.c}</b> (${hx(r.c, 3)}).`, f: s => set(s, { c: r.c }) },
      { l: L('in_vtg = '), t: `in_vtg = ${r.c} × 3.3 / 4095 = <b>${(r.c * 3.3 / 4095).toFixed(4)}</b> V` },
      { l: [L('sprintf(vtg'), L('sprintf(dval')], t: `sprintf turns numbers into text: vtg = "<b>${r.vs}</b>", dval = "<b>${r.hs}</b>" (hex, no 0x).` },
      { l: [L('temp1 = 0x8A'), L('while (vtg[i++]')], t: 'Cursor <b>0x8A</b> = line 1, box 11 (just after "ANALOG IP:") → print the voltage.', f: s => { s.lcd.cmd(0x8A); sendStr(s.lcd, r.vs); } },
      { l: [L('temp1 = 0xCB'), L('while (dval[i++]')], t: 'Cursor <b>0xCB</b> = line 2, box 12 (after "ADC OUTPUT:") → print the hex value.', f: s => { s.lcd.cmd(0xCB); sendStr(s.lcd, r.hs + '   '); } },
      { l: [L('vtg[i] = dval[i] = 0')], t: 'Clear the buffers, loop again → the display follows the pot continuously. Turn the knob!' }
    ];
    return S;
  }
  const ex = { lcd: null };
  const view = (s, v, k, first) => { if (first) { v.innerHTML = ''; v._lv = LCDView(v, new HD44780(), { blue: true }); } v._lv.lcd = s.lcd || new HD44780(); v._lv.draw(); };
  const st = Stepper(host, { code: A3_CODE, title: 'adc_lcd.c', steps: build(), init: () => ({ lcd: new HD44780() }), view });
  function rebuild() { st.setSteps(build(), st.k); }
  function setV(v) { Vin = clamp(v, 0, 3.3); knob.setAttribute('transform', `rotate(${-135 + Vin / 3.3 * 270} 60 60)`); vr.innerHTML = `wiper voltage = <b>${Vin.toFixed(2)} V</b>`; }
  let drag = false; const ang = e => { const r = pot.getBoundingClientRect(); let a = Math.atan2(e.clientX - r.left - r.width / 2, -(e.clientY - r.top - r.height / 2)) * 180 / Math.PI; return clamp((a + 135) / 270, 0, 1) * 3.3; };
  pot.addEventListener('pointerdown', e => { drag = true; pot.setPointerCapture(e.pointerId); setV(ang(e)); });
  pot.addEventListener('pointermove', e => { if (drag) setV(ang(e)); });
  pot.addEventListener('pointerup', () => { drag = false; rebuild(); });
  setV(1.1);
});

/* ---------- DAC: resistor string ---------- */
BUILD.push(function wDacRes() {
  const w = W('w-dacres', 'resistor-string DAC', 'pick DACVALUE → a switch taps the ladder');
  let val = 388, VP = 3.3, VN = 0;
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  const r1 = ruler(ctl, 'DACVALUE', 0, 1023, val, 1, v => v + ' = ' + hx(v, 3), v => { val = v; draw(); });
  ruler(ctl, 'V_REFP', 1000, 3300, VP * 1000, 10, v => (v / 1000).toFixed(2) + ' V', v => { VP = v / 1000; draw(); });
  const s = sv('svg', { class: 'dg', viewBox: '0 0 640 300' }); w.appendChild(s);
  const out = el('div', { class: 'say' }); w.appendChild(out);
  function draw() {
    s.innerHTML = ''; const n = 16, top = 30, bot = 270, step = (bot - top) / n;
    sv('text', { x: 60, y: 22, 'text-anchor': 'middle', class: 'lbl' }, s).textContent = 'V_REFP';
    sv('text', { x: 60, y: 292, 'text-anchor': 'middle', class: 'lbl' }, s).textContent = 'V_REFN';
    const tap = val / 1024 * n; const ty = bot - tap * step;
    for (let i = 0; i < n; i++) { const y = top + i * step; sv('path', { d: `M60 ${y} l0 3 l-8 3 l16 4 l-16 4 l16 4 l-8 3 l0 ${step - 21}`, class: 'ink', style: 'stroke-width:1.5' }, s); }
    const fill = sv('rect', { x: 84, y: ty, width: 14, height: bot - ty, rx: 4, style: 'fill:var(--hl-o);stroke:var(--ink3)' }, s);
    sv('path', { d: `M60 ${ty} H180`, style: 'stroke:var(--orange);stroke-width:2.6' }, s);
    sv('circle', { cx: 60, cy: ty, r: 4.5, style: 'fill:var(--orange)' }, s);
    sv('text', { x: 108, y: ty - 6, class: 'mono', style: 'font-size:11px' }, s).textContent = `tap ${val}/1024`;
    sv('path', { d: `M180 ${ty - 18} L180 ${ty + 18} L214 ${ty} Z`, class: 'ink', style: 'fill:var(--card)' }, s);
    sv('text', { x: 196, y: ty - 22, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:11px' }, s).textContent = 'buffer';
    sv('path', { d: `M214 ${ty} H260`, class: 'ink' }, s);
    sv('text', { x: 266, y: ty + 5, class: 'lbl' }, s).textContent = 'AOUT (P0.26)';
    const V = val * (VP - VN) / 1024 + VN;
    // meter
    const mx = 470, my = 160; sv('path', { d: `M${mx - 100} ${my} A100 100 0 0 1 ${mx + 100} ${my}`, class: 'ink', style: 'fill:var(--paper)' }, s);
    for (let i = 0; i <= 10; i++) { const a = Math.PI + i / 10 * Math.PI; sv('path', { d: `M${mx + Math.cos(a) * 88} ${my + Math.sin(a) * 88} L${mx + Math.cos(a) * 100} ${my + Math.sin(a) * 100}`, class: 'ink2' }, s); if (i % 2 === 0) sv('text', { x: mx + Math.cos(a) * 74, y: my + Math.sin(a) * 74 + 4, 'text-anchor': 'middle', class: 'mono', style: 'font-size:10px' }, s).textContent = (i / 10 * 3.3).toFixed(1); }
    const a = Math.PI + V / 3.3 * Math.PI; sv('path', { d: `M${mx} ${my} L${mx + Math.cos(a) * 92} ${my + Math.sin(a) * 92}`, style: 'stroke:var(--red);stroke-width:3;stroke-linecap:round' }, s);
    sv('circle', { cx: mx, cy: my, r: 6, style: 'fill:var(--ink)' }, s);
    sv('text', { x: mx, y: my + 34, 'text-anchor': 'middle', class: 'mono', style: 'font-size:22px' }, s).textContent = V.toFixed(3) + ' V';
    out.innerHTML = `V<sub>AOUT</sub> = ${val} × (${VP.toFixed(2)} − 0) / 1024 + 0 = <b>${V.toFixed(4)} V</b> · one step = ${(VP / 1024 * 1000).toFixed(2)} mV`;
  }
  const pr = el('div', { class: 'chips' }); w.appendChild(pr); pr.appendChild(el('span', { class: 'cav p-soft' }, 'try:'));
  [[0, '0'], [388, '388 (1.25 V)'], [776, '776 (2.5 V)'], [1023, '1023 (max)']].forEach(([v, t]) => { const b = el('button', { class: 'chip', type: 'button' }, t); b.onclick = () => { val = v; r1.value = v; r1.dispatchEvent(new Event('input')); }; pr.appendChild(b); });
  draw();
});

/* ---------- DACR builder ---------- */
BUILD.push(function wDacr() {
  const w = W('w-dacr', 'DACR builder', 'remember: VALUE starts at bit 6');
  RegBuilder(w, {
    name: 'DACR', reg: 'LPC_DAC->DACR', width: 17, value: 388 << 6, hexd: 5, fields: [
      { lo: 6, hi: 15, name: 'VALUE', desc: 'the 10-bit DACVALUE', say: x => `DACVALUE = ${x} → V<sub>AOUT</sub> = ${x} × 3.3 / 1024 = <b>${(x * 3.3 / 1024).toFixed(3)} V</b> · in C: <code>DACR = ${x} &lt;&lt; 6</code>` },
      { bit: 16, name: 'BIAS', desc: '0: settling 1 µs, 1 MHz, 700 µA max · 1: 2.5 µs, 400 kHz, 350 µA max', opts: { 0: '0 · fast', 1: '1 · low power' }, say: { 0: 'BIAS = 0: settles in 1 µs (update up to 1 MHz), up to 700 µA', 1: 'BIAS = 1: settles in 2.5 µs (up to 400 kHz), up to 350 µA' } }
    ], presets: [[388 << 6, '388<<6'], [776 << 6, '776<<6'], [0x3FF << 6, 'max']]
  });
  w.appendChild(el('p', { class: 'small p-soft' }, 'Bits 5:0 are reserved. That\'s why every program writes <code>(value &lt;&lt; 6)</code>.'));
});

/* ---------- double buffer ---------- */
BUILD.push(function wDbuf() {
  const w = W('w-dbuf', 'double buffering', 'CPU writes at random moments · output changes on the beat');
  let dbl = true, T = 0, cnt = 1, pre = 0, dacr = 0, hist = [[0, 0]], writes = [], beats = [], reload = 0.8, nextW = 0.3, val = 0;
  const ctl = el('div', { class: 'chips' }); w.appendChild(ctl);
  chipGroup(ctl, [[1, 'CNT_ENA = 1 + DBLBUF_ENA = 1'], [0, 'double buffering off']], 1, v => { dbl = v === '1'; });
  const boxes = el('div', { class: 'row mt' }); w.appendChild(boxes);
  boxes.innerHTML = '<div class="dbox"><div class="gae">CPU writes DACR</div><b class="cw">–</b></div><div class="arrow">➝</div><div class="dbox pre"><div class="gae">pre-buffer</div><b class="pb">–</b></div><div class="arrow">➝</div><div class="dbox"><div class="gae">DACR → AOUT</div><b class="dr">0</b></div><div class="dbox"><div class="gae">counter</div><b class="ct">–</b><small>reload = DACCNTVAL</small></div>';
  const s = sv('svg', { class: 'dg', viewBox: '0 0 640 150' }); w.appendChild(s);
  const WIN = 6, X = t => 40 + (t - (T - WIN)) / WIN * 590;
  const lp = Loop(w, dt => {
    T += dt;
    if (T >= nextW) { val = (val + 1 + Math.floor(Math.random() * 2)) % 6; writes.push(T); nextW = T + 0.25 + Math.random() * 0.7; if (dbl) pre = val; else { dacr = val; hist.push([T, dacr]); } $('.cw', boxes).textContent = val; $('.cw', boxes).parentNode.classList.remove('popin'); void boxes.offsetWidth; $('.cw', boxes).parentNode.classList.add('popin'); }
    cnt -= dt / reload;
    if (cnt <= 0) { cnt += 1; beats.push(T); if (dbl && pre !== dacr) { dacr = pre; hist.push([T, dacr]); } }
    hist = hist.filter((h, i) => i === hist.length - 1 || hist[i + 1][0] > T - WIN); writes = writes.filter(t => t > T - WIN); beats = beats.filter(t => t > T - WIN);
    $('.pb', boxes).textContent = dbl ? pre : '(bypassed)'; $('.pb', boxes).parentNode.style.opacity = dbl ? 1 : .4; $('.dr', boxes).textContent = dacr; $('.ct', boxes).textContent = dbl ? Math.ceil(cnt * 10) : '–';
    s.innerHTML = '';
    beats.forEach(t => sv('path', { d: `M${X(t)} 6 V140`, style: 'stroke:var(--green);stroke-width:1.4;stroke-dasharray:3 4;opacity:' + (dbl ? 1 : .3) }, s));
    writes.forEach(t => sv('text', { x: X(t), y: 18, 'text-anchor': 'middle', style: 'font-size:13px;fill:var(--pink)' }, s).textContent = '✎');
    sv('text', { x: 2, y: 86, class: 'lbl', style: 'font-size:12px' }, s).textContent = 'AOUT';
    const pts = hist.map(h => [Math.max(h[0], T - WIN), h[1]]); let d = ''; pts.concat([[T, dacr]]).forEach((p, i) => { const y = 130 - p[1] * 18; d += i ? `H${X(p[0])}V${y}` : `M${X(p[0])} ${y}`; });
    sv('path', { d, style: 'fill:none;stroke:var(--orange);stroke-width:2.6' }, s);
  });
  lp.start();
  w.appendChild(el('div', { class: 'small p-soft' }, '✎ = CPU writes DACR · green dashes = counter reaches 0 (output updates only here when double-buffered)'));
});

/* ---------- D1 sawtooth ---------- */
const SAW_CODE = `#include <lpc17xx.h>
void DAC_Init(void);
int main (void)
{
    unsigned int m,i;
    SystemInit();
    SystemCoreClockUpdate();
    LPC_PINCON->PINSEL1 = 2<<20;           // Analog Output P0.26 (AOUT)
    LPC_DAC->DACCNTVAL = 0x0050;           // DAC Counter for Double Buffering
    LPC_DAC->DACCTRL = (0x1<<1)|(0x1<<2);  //Double buffering
    while ( 1 )
    {
        LPC_DAC->DACR = (i << 6) ;
        i++;
        if ( i == 0x400 )                  //Maximum value is 0x3FF in 10 bit DAC
        {
            i = 0;
        }
    }
}`;
BUILD.push(function wSaw() {
  const w = W('w-saw', 'D1 · sawtooth', 'step the loop, or play the scope');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(SAW_CODE, t);
  const steps = [
    { l: L('PINSEL1 = 2<<20'), t: 'P0.26 → bits 21:20 = 10 → <b>AOUT</b> (DAC output).' },
    { l: L('DACCNTVAL = 0x0050'), t: 'Counter reload = 0x50 = 80 → the DACR updates every 80 PCLK ticks (when double buffered).' },
    { l: L('DACCTRL = (0x1<<1)'), t: 'DBLBUF_ENA (bit 1) + CNT_ENA (bit 2) → double buffering on.' },
    { l: [L('DACR = (i << 6)'), L('i++;')], t: 'i = 0 → DACR = 0 → 0 V. i++.', f: s => set(s, { i: 1 }) },
    { l: [L('DACR = (i << 6)'), L('i++;')], t: 'i = 1, 2, 3 … each loop raises the output by 3.3/1024 ≈ 3.2 mV → a ramp.', f: s => set(s, { i: 512 }) },
    { l: [L('if ( i == 0x400 )'), L('i = 0;')], t: 'i reaches 0x400 = 1024 (one past the max 0x3FF) → back to 0 → the output <b>drops</b> to 0 V. Ramp + drop = <b>sawtooth</b>, 0 → 3.3 V peak-to-peak.', f: s => set(s, { i: 1024, wrap: 1 }) }
  ];
  const view = (s, v, k, first) => {
    if (first) { v.innerHTML = ''; v._sc = el('div', { class: 'scope' }); v.appendChild(v._sc); v._svg = sv('svg', { viewBox: '0 0 400 200' }); v._sc.appendChild(v._svg); v._kv = el('div', { class: 'say' }); v.appendChild(v._kv); }
    const g = v._svg; g.innerHTML = ''; for (let i = 1; i < 10; i++) sv('path', { d: `M${i * 40} 0 V200`, class: 'sg' }, g); for (let i = 1; i < 5; i++) sv('path', { d: `M0 ${i * 40} H400`, class: 'sg' }, g);
    const n = s.i || 0; if (n) { let d = ''; const per = 1024, cyc = s.wrap ? 2.6 : n / per; const pts = 200; for (let j = 0; j <= pts; j++) { const c = j / pts * cyc; const ph = c - Math.floor(c); const y = 185 - ph * 170; d += (j ? 'L' : 'M') + (j / pts * 400 * Math.min(1, cyc / 2.6)) + ' ' + y; } sv('path', { d, class: 'trace' }, g); }
    v._kv.innerHTML = `i = ${Math.min(s.i ?? 0, 1023)} · DACR = ${hx((Math.min(s.i ?? 0, 1023)) << 6, 5)}`;
  };
  Stepper(host, { code: SAW_CODE, title: 'dac_sawtooth.c', steps, init: () => ({}), view });
  w.appendChild(el('p', { class: 'small p-soft' }, 'Slide nits: <code>i</code> isn\'t initialised (start it at 0), and <code>DAC_Init</code> / <code>m</code> are declared but never used.'));
});

/* ---------- D2 sine ---------- */
const SINE_CODE = `#include <lpc17xx.h>
void DAC_Init(void);
unsigned int sinetable[]= { 388, 582,723, 776, 723,582, 388,194,52,0,52,194};
int main (void)
{
    unsigned int m,i;
    SystemInit();
    SystemCoreClockUpdate();
    LPC_PINCON->PINSEL1 = 2<<20;   // Analog Output P0.26
    while ( 1 )
    {
        for(i=0; i < 12; i++)  // Assuming samples separated by 30 degrees
        {
            LPC_DAC->DACR = (sinetable[i % 12]<< 6) ;
            delay(); // Call timer delay based on period. If period is 10 ms. Delay is (10ms/12)
        }
    }
}`;
BUILD.push(function wSine() {
  const w = W('w-sine', 'D2 · build the sine table', 'tap a sample to see its maths · change N for a smoother wave');
  let N = 12, sel = 2, amp = 1.25, off = 1.25;
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  const nc = el('div', { class: 'col' }); ctl.appendChild(nc); nc.appendChild(el('span', { class: 'gae small' }, 'samples per period'));
  chipGroup(nc, [[6, '6'], [12, '12 (slide)'], [24, '24'], [48, '48']], N, v => { N = +v; sel = Math.min(sel, N - 1); draw(); });
  const sp = el('div', { class: 'split mt' }); w.appendChild(sp);
  const L = el('div'), R = el('div', { class: 'col' }); sp.append(L, R);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 420 240' }); L.appendChild(s);
  const math = el('div', { class: 'icard', style: 'margin:0' }); R.appendChild(math);
  const tbl = el('div', { class: 'stable' }); R.appendChild(tbl);
  const rnd = v => Math.round(v * 1024 / 3.3);
  function draw() {
    const vals = Array.from({ length: N }, (_, k) => { const th = k * 360 / N, V = off + amp * Math.sin(th * Math.PI / 180); return { th, V, d: Math.max(0, Math.min(1023, Math.round(V * 1024 / 3.3))) }; });
    s.innerHTML = ''; const X = th => 40 + th / 360 * 360, Y = V => 210 - V / 2.5 * 180;
    sv('path', { d: 'M40 210 H405 M40 210 V20', class: 'ink' }, s);
    [0, 1.25, 2.5].forEach(v => { sv('path', { d: `M40 ${Y(v)} H400`, style: 'stroke:var(--faint);stroke-dasharray:3 4' }, s); sv('text', { x: 34, y: Y(v) + 4, 'text-anchor': 'end', class: 'mono', style: 'font-size:11px' }, s).textContent = v + 'V'; });
    let d = ''; for (let t = 0; t <= 360; t += 3) d += (t ? 'L' : 'M') + X(t) + ' ' + Y(off + amp * Math.sin(t * Math.PI / 180)); sv('path', { d, style: 'fill:none;stroke:var(--ink3);stroke-width:1.4;stroke-dasharray:4 4' }, s);
    let st = ''; vals.forEach((v, k) => { const x1 = X(v.th), x2 = X(v.th + 360 / N), y = Y(v.d * 3.3 / 1024); st += (k ? `V${y}` : `M${x1} ${y}`) + `H${x2}`; }); sv('path', { d: st, style: 'fill:none;stroke:var(--orange);stroke-width:2.6' }, s);
    vals.forEach((v, k) => { const c = sv('circle', { cx: X(v.th), cy: Y(v.V), r: k === sel ? 7 : 4.5, style: `fill:${k === sel ? 'var(--pink)' : 'var(--paper)'};stroke:var(--ink);stroke-width:1.5;cursor:pointer` }, s); c.addEventListener('click', () => { sel = k; draw(); }); });
    [0, 90, 180, 270, 360].forEach(t => sv('text', { x: X(t), y: 228, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, s).textContent = t + '°');
    const v = vals[sel];
    math.innerHTML = `<div class="ih">sample ${sel}: θ = ${+v.th.toFixed(1)}°</div><div style="padding:8px 4px;font-size:17px">V = 1.25 + 1.25 × sin ${+v.th.toFixed(1)}° = <b>${v.V.toFixed(3)} V</b><br>digital = 1024 × V / 3.3 = 1024 × ${v.V.toFixed(3)} / 3.3 = ${(v.V * 1024 / 3.3).toFixed(2)} ≈ <b>${v.d}</b></div>`;
    tbl.innerHTML = `<div class="gae small">sinetable[${N}] =</div><div class="mono">{ ${vals.map((x, k) => `<span class="${k === sel ? 'hl' : ''}">${x.d}</span>`).join(', ')} }</div><div class="small p-soft">delay between samples for a 10 ms period = 10 ms / ${N} = ${(10 / N).toFixed(3)} ms (f = 100 Hz) = ${+(30000 / N).toFixed(1)} PCLK ticks at 3 MHz → e.g. Timer0 PR = 0, MR0 = ${Math.round(30000 / N)} (stop on match)</div>`;
  }
  draw();
  const host = el('div', { class: 'mt' }); w.appendChild(host);
  host.appendChild(codeBlock(SINE_CODE, 'dac_sine.c'));
  w.appendChild(el('p', { class: 'small p-soft' }, 'With N = 12 this gives the slide table, except 60° and 120°: the slide rounded V to 2.33 V first and got 723 instead of 724 — both are fine. <code>delay()</code> = any timer delay from notebook ① set to period / 12.'));
});

/* ---------- stepper motor ---------- */
const SEQ_CW = [0x3, 0x9, 0xC, 0x6];
function motorSvg(host) {
  const s = sv('svg', { class: 'dg motor', viewBox: '0 0 260 260' }); host.appendChild(s);
  const C = { A: [130, 34, 0], B: [226, 130, 90], C: [130, 226, 180], D: [34, 130, 270] };
  const coils = {};
  Object.entries(C).forEach(([k, [x, y, r]]) => {
    const g = sv('g', { transform: `translate(${x} ${y}) rotate(${r})` }, s);
    sv('rect', { x: -26, y: -16, width: 52, height: 32, rx: 6, class: 'coil' }, g);
    for (let i = -18; i <= 18; i += 9) sv('path', { d: `M${i} -16 q5 16 0 32`, class: 'ink2' }, g);
    const lab = sv('text', { x, y: y + (k === 'A' ? -24 : k === 'C' ? 34 : 5), 'text-anchor': 'middle', class: 'lbl', style: 'font-size:16px' }, s); if (k === 'B') { lab.setAttribute('x', x + 26); } if (k === 'D') lab.setAttribute('x', x - 26); lab.textContent = k;
    coils[k] = g;
  });
  ['I', 'II', 'III', 'IV'].forEach((t, i) => { const a = [-45, -135, 135, 45][i] * Math.PI / 180; sv('text', { x: 130 + Math.cos(a) * 96, y: 130 + Math.sin(a) * 96 + 5, 'text-anchor': 'middle', style: 'font-size:13px;fill:var(--red);font-family:Gaegu;font-weight:700' }, s).textContent = t; });
  const rot = sv('g', { class: 'rotor' }, s);
  sv('circle', { cx: 130, cy: 130, r: 58, style: 'fill:none;stroke:var(--faint);stroke-dasharray:3 5' }, rot);
  sv('rect', { x: 92, y: 118, width: 38, height: 24, rx: 4, style: 'fill:#e04f63;stroke:var(--ink);stroke-width:1.8' }, rot);
  sv('rect', { x: 130, y: 118, width: 38, height: 24, rx: 4, style: 'fill:#4f7fe0;stroke:var(--ink);stroke-width:1.8' }, rot);
  sv('text', { x: 111, y: 135, 'text-anchor': 'middle', style: 'fill:#fff;font-family:Gaegu;font-weight:700;font-size:15px' }, rot).textContent = 'N';
  sv('text', { x: 149, y: 135, 'text-anchor': 'middle', style: 'fill:#fff;font-family:Gaegu;font-weight:700;font-size:15px' }, rot).textContent = 'S';
  sv('circle', { cx: 130, cy: 130, r: 4, style: 'fill:var(--ink)' }, rot);
  let ang = 0;
  return {
    s, set(code, animate = true) {
      const on = { C: (code >> 3) & 1, D: (code >> 2) & 1, A: (code >> 1) & 1, B: code & 1 };
      Object.entries(on).forEach(([k, v]) => coils[k].classList.toggle('on', !!v));
      const dirs = { A: -90, B: 0, C: 90, D: 180 }; const act = Object.keys(on).filter(k => on[k]);
      if (!act.length) return; let x = 0, y = 0; act.forEach(k => { x += Math.cos(dirs[k] * Math.PI / 180); y += Math.sin(dirs[k] * Math.PI / 180); });
      let target = Math.atan2(y, x) * 180 / Math.PI + 180; // N end points to active pair
      let diff = ((target - ang) % 360 + 540) % 360 - 180; ang += diff;
      rot.style.transition = animate ? 'transform .35s cubic-bezier(.3,1.4,.5,1)' : 'none'; rot.style.transform = `rotate(${ang}deg)`; rot.style.transformOrigin = '130px 130px';
    }, get ang() { return ang; }
  };
}
BUILD.push(function wMotor() {
  const w = W('w-motor', 'stepper playground', 'click coils, or run the sequence');
  const sp = el('div', { class: 'split' }); w.appendChild(sp);
  const L = el('div', { style: 'max-width:300px' }), R = el('div', { class: 'col' }); sp.append(L, R);
  const m = motorSvg(L);
  let code = 0x3, k = 0, dir = 1, run = null, spd = 600, steps = 0;
  const bits = miniBits(R, ['C · P0.3', 'D · P0.2', 'A · P0.1', 'B · P0.0'], 'FIOPIN bits 3…0');
  const ro = el('div', { class: 'row' }); R.appendChild(ro); const hv = el('span', { class: 'ro big' }); ro.append(el('span', { class: 'gae' }, 'value ='), hv);
  const seq = el('div', { class: 'seqrow' }); R.appendChild(seq);
  const ctl = el('div', { class: 'row' }); R.appendChild(ctl);
  const dg = chipGroup(ctl, [[1, '↻ clockwise 3,9,C,6'], [-1, '↺ anticlockwise 3,6,C,9']], 1, v => { dir = +v; paintSeq(); });
  const bt = el('div', { class: 'row' }); R.appendChild(bt);
  const bS = el('button', { class: 'btn sm p', type: 'button' }, 'one step ▸'), bR = el('button', { class: 'btn sm y', type: 'button' }, '▶ run');
  bt.append(bS, bR); ruler(bt, 'delay per step', 80, 1000, spd, 10, v => v + ' ms', v => { spd = v; if (run) { clearInterval(run); run = setInterval(stepOne, spd); } });
  const cnt = el('div', { class: 'say' }); R.appendChild(cnt);
  m.s.querySelectorAll('g').forEach(() => { });
  function paintSeq() { const order = dir > 0 ? SEQ_CW : [0x3, 0x6, 0xC, 0x9]; seq.innerHTML = order.map((c, i) => `<span class="${c === code ? 'on' : ''}"><b>${hx(c, 1).slice(2)}</b><small>${bin(c, 4)}</small></span>`).join('<i>→</i>'); }
  function show(anim = true) { m.set(code, anim); bits.set([3, 2, 1, 0].map(b => (code >> b) & 1)); hv.textContent = hx(code, 1) + ' = ' + bin(code, 4); paintSeq(); const reg = { 3: 'I (between A & B)', 9: 'IV (between B & C)', 0xC: 'III (between C & D)', 6: 'II (between D & A)' }[code]; cnt.innerHTML = `steps taken: ${steps} · N pole points to ${reg || 'a single coil / mixed'}`; }
  function stepOne() { const order = dir > 0 ? SEQ_CW : [0x3, 0x6, 0xC, 0x9]; let i = order.indexOf(code); if (i < 0) i = 0; code = order[(i + 1) % 4]; steps++; show(); }
  bS.onclick = stepOne; bR.onclick = () => { if (run) { clearInterval(run); run = null; bR.textContent = '▶ run'; } else { run = setInterval(stepOne, spd); bR.textContent = '❚❚ stop'; } };
  // click coils to toggle
  const map = { A: 1, B: 0, C: 3, D: 2 };
  [...m.s.querySelectorAll('g')].slice(0, 4).forEach((g, i) => { g.style.cursor = 'pointer'; g.addEventListener('click', () => { const k = 'ABCD'[i]; code ^= 1 << map[k]; show(); }); });
  show(false);
});

/* ---------- driver circuit ---------- */
BUILD.push(function wDrv() {
  const w = W('w-drv', 'one channel of the driver', 'flip the pin, watch current flow');
  let on = false, diode = true, spike = 0;
  const s = sv('svg', { class: 'dg drv', viewBox: '0 0 640 260' }); w.appendChild(s);
  sv('rect', { x: 10, y: 80, width: 90, height: 100, rx: 8, style: 'fill:#20c997;stroke:var(--ink);stroke-width:2' }, s);
  sv('text', { x: 55, y: 135, 'text-anchor': 'middle', class: 'lbl' }, s).textContent = 'LPC1768';
  sv('text', { x: 104, y: 124, class: 'mono', style: 'font-size:12px' }, s).textContent = 'P0.0';
  const w1 = sv('path', { d: 'M100 130 H170', class: 'wr2' }, s);
  sv('path', { d: 'M170 130 l6 -8 l8 16 l8 -16 l8 16 l8 -16 l6 8', class: 'ink' }, s);
  sv('text', { x: 196, y: 116, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, s).textContent = '10k';
  const w2 = sv('path', { d: 'M214 130 H260', class: 'wr2' }, s);
  sv('circle', { cx: 290, cy: 130, r: 32, class: 'ink', style: 'fill:var(--card)' }, s);
  sv('path', { d: 'M266 112 V148 M266 130 H260 M266 120 L300 100 M266 140 L300 160', class: 'ink' }, s);
  sv('text', { x: 290, y: 186, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:13px' }, s).textContent = 'Q1 (switch)';
  const w3 = sv('path', { d: 'M300 100 V60 H420', class: 'wr2' }, s);
  const w4 = sv('path', { d: 'M300 160 V230', class: 'wr2' }, s);
  sv('path', { d: 'M282 230 h36 M289 236 h22 M296 242 h8', class: 'ink' }, s);
  const coil = sv('g', {}, s); sv('rect', { x: 420, y: 40, width: 90, height: 40, rx: 8, class: 'coil' }, coil); for (let i = 0; i < 5; i++) sv('path', { d: `M${432 + i * 16} 40 q8 20 0 40`, class: 'ink2' }, coil);
  sv('text', { x: 465, y: 100, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:13px' }, s).textContent = 'coil B';
  const w5 = sv('path', { d: 'M510 60 H580 V20', class: 'wr2' }, s);
  sv('text', { x: 590, y: 22, class: 'lbl' }, s).textContent = '+12 V';
  const dg = sv('g', {}, s); sv('path', { d: 'M465 150 L445 120 H485 Z', class: 'ink', style: 'fill:var(--card)' }, dg); sv('path', { d: 'M445 120 H485', class: 'ink' }, dg);
  const dw = sv('path', { d: 'M465 150 V170 H380 V60 M465 120 V100 H540 V60', class: 'wr2' }, s);
  sv('text', { x: 500, y: 150, class: 'lbl', style: 'font-size:13px' }, s).textContent = 'diode';
  const bolt = sv('text', { x: 300, y: 60, style: 'font-size:28px', 'text-anchor': 'middle' }, s); bolt.textContent = '⚡';
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  const b = el('button', { class: 'btn p', type: 'button' }, 'P0.0 = 0 → set 1'); ctl.appendChild(b);
  const dc = el('button', { class: 'chip on', type: 'button', style: '--cc:var(--n-g)' }, '✓ flyback diode'); ctl.appendChild(dc);
  const say = el('div', { class: 'say' }); w.appendChild(say);
  b.onclick = () => { on = !on; b.textContent = on ? 'P0.0 = 1 → set 0' : 'P0.0 = 0 → set 1'; if (!on) spike = 1; paint(); };
  dc.onclick = () => { diode = !diode; dc.classList.toggle('on', diode); dc.textContent = diode ? '✓ flyback diode' : '✗ no diode'; dg.style.opacity = diode ? 1 : .15; paint(); };
  function paint() {
    [w1, w2].forEach(p => p.classList.toggle('flow', on)); [w3, w4, w5].forEach(p => p.classList.toggle('flow', on)); coil.classList.toggle('on', on);
    dw.classList.toggle('flow', spike > 0 && diode); bolt.style.display = spike > 0 && !diode ? '' : 'none';
    say.innerHTML = on ? 'Pin HIGH → tiny base current → transistor ON → <b>big 12 V current</b> flows through the coil → it becomes a magnet.' : spike > 0 ? (diode ? 'Pin LOW → transistor OFF. The coil\'s stored energy circulates through the <b>diode</b> and fades away safely.' : '<span class="p-red">No diode: the collapsing field makes a huge voltage spike across the transistor ⚡ → it can be destroyed.</span>') : 'Pin LOW → transistor OFF → no coil current.';
  }
  const lp = Loop(w, dt => { if (spike > 0) { spike -= dt * .8; if (spike <= 0) { spike = 0; paint(); } } }); lp.start(); paint();
});

/* ---------- S1 ---------- */
const S1_CODE = `#include <lpc17xx.h>
unsigned int step_pos[]= { 3,9,0xC,6};
int main (void)
{
    unsigned int m,i;
    SystemInit();
    SystemCoreClockUpdate();
    LPC_GPIO0->FIODIR = 0x0F;      // Output
    while ( 1 )
    {
        for(i=0; i < 150; i++)
        {
            LPC_GPIO0->FIOPIN = step_pos[i % 4];
            delay();               //Use Timer delay for 16.67 ms
        }
    }
}`;
BUILD.push(function wS1() {
  const w = W('w-s1', 'S1 · calculator + simulation', 'change the numbers, then run');
  let ang = 6, rpm = 60, rev = 2.5;
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  ruler(ctl, 'step angle', 1, 30, ang, 0.5, v => v + '°', v => { ang = v; calc(); });
  ruler(ctl, 'speed', 10, 120, rpm, 5, v => v + ' rpm', v => { rpm = v; calc(); });
  ruler(ctl, 'revolutions', 0.5, 5, rev, 0.5, v => v, v => { rev = v; calc(); });
  const calcBox = el('div', { class: 'icard' }); w.appendChild(calcBox);
  const sp = el('div', { class: 'split' }); w.appendChild(sp);
  const L = el('div'); const R = el('div', { class: 'col' }); sp.append(L, R);
  L.appendChild(codeBlock(S1_CODE, 'stepper.c'));
  const mh = el('div', { style: 'max-width:240px' }); R.appendChild(mh); const m = motorSvg(mh);
  const ro = el('div', { class: 'say' }); R.appendChild(ro);
  const b = el('button', { class: 'btn p', type: 'button' }, '▶ run the for loop'); R.appendChild(b);
  let N = 150, ms = 16.67, run = null;
  function calc() {
    const spr = 360 / ang, tRev = 60 / rpm; ms = tRev / spr * 1000; N = Math.round(rev * spr);
    calcBox.innerHTML = `<div class="ih">working (exam style)</div><div style="padding:8px 4px;font-size:17.5px;line-height:1.7">time for 1 revolution at ${rpm} rpm = 60/${rpm} = <b>${tRev.toFixed(3)} s</b><br>steps per revolution = 360 / ${ang} = <b>${+spr.toFixed(2)}</b><br>time per step = ${tRev.toFixed(3)} s / ${+spr.toFixed(2)} = <b>${ms.toFixed(2)} ms</b> ← the timer delay<br>steps needed = ${rev} × ${+spr.toFixed(2)} = <b>${N}</b> ← the for-loop limit<br><span class="small">delay() with Timer0: ${ms.toFixed(2)} ms × 3 MHz ≈ <b>${Math.round(ms * 3000)}</b> PCLK ticks → PR = 0, MR0 = ${Math.round(ms * 3000)}, MCR = 4 (stop), wait for EM0 — as in notebook ①</span></div>`;
  }
  b.onclick = () => {
    if (run) { clearInterval(run); run = null; b.textContent = '▶ run the for loop'; return; }
    let i = 0, total = 0; m.set(3, false); const sim = Math.max(30, Math.min(ms, 120));
    b.textContent = '❚❚ stop';
    run = setInterval(() => { if (i >= N) { clearInterval(run); run = null; b.textContent = '▶ run again'; return; } const c = SEQ_CW[i % 4]; m.set(c); i++; total += ang; ro.innerHTML = `i = ${i} / ${N} · FIOPIN = step_pos[${(i - 1) % 4}] = ${hx(c, 1)} · real angle turned = <b>${(total).toFixed(1)}°</b> = ${(total / 360).toFixed(2)} rev`; }, sim);
  };
  calc(); m.set(3, false);
  w.appendChild(el('p', { class: 'small p-soft' }, 'Slide nits: <code>step_pos[]= { 3,9,C,6};</code> — a bare <code>C</code> is not a number in C, write <code>0xC</code>; and <code>delay()</code> is not given — write it with Timer0 as above.'));
});
