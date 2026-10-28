/* =========================================================
   NOTEBOOK 2 · part C — PWM + UART
   ========================================================= */

/* ---------- duty cycle & averaging ---------- */
BUILD.push(function wDuty() {
  const w = W('w-duty', 'duty cycle → brightness', 'drag the duty · then speed up the blinking');
  let duty = 30, f = 1.5, VH = 3.3;
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  ruler(ctl, 'duty cycle', 0, 100, duty, 1, v => v + ' %', v => { duty = v; });
  ruler(ctl, 'PWM frequency', 0, 100, 20, 1, v => fr(v).toFixed(fr(v) < 10 ? 1 : 0) + ' Hz', v => { f = fr(v); });
  function fr(v) { return 0.5 * Math.pow(400, v / 100); } f = fr(20);
  const sp = el('div', { class: 'split' }); w.appendChild(sp);
  const L = el('div'), R = el('div', { class: 'col center', style: 'align-items:center' }); sp.append(L, R);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 460 170' }); L.appendChild(s);
  const bulb = el('div', { class: 'bulb' }, '<svg viewBox="0 0 100 130" width="120"><defs><radialGradient id="bg1"><stop offset="0" stop-color="#fff6c0"/><stop offset="1" stop-color="#ffb02e"/></radialGradient></defs><circle class="halo" cx="50" cy="48" r="46" fill="url(#bg1)"/><path d="M50 12c-18 0-30 13-30 30 0 12 7 18 12 24 3 4 4 7 4 11h28c0-4 1-7 4-11 5-6 12-12 12-24 0-17-12-30-30-30z" class="glass"/><rect x="36" y="84" width="28" height="10" rx="3" fill="#bfc3cc" stroke="#2a2933" stroke-width="2.5"/><rect x="40" y="94" width="20" height="9" rx="4" fill="#9aa0ad" stroke="#2a2933" stroke-width="2.5"/></svg>'); R.appendChild(bulb);
  const ro = el('div', { class: 'say center' }); R.appendChild(ro);
  let T = 0, eye = 0;
  const lp = Loop(w, dt => {
    T += dt; const per = 1 / f, on = ((T % per) / per) < duty / 100;
    const avg = duty / 100; const blinkVisible = f < 25; eye += (((on ? 1 : 0)) - eye) * Math.min(1, dt * (blinkVisible ? 40 : 6));
    const b = blinkVisible ? (on ? 1 : 0) : avg;
    bulb.style.setProperty('--b', b.toFixed(3));
    s.innerHTML = ''; const X = t => 40 + t * 400, Y = v => 130 - v / VH * 100;
    sv('path', { d: 'M40 130 H445 M40 130 V20', class: 'ink' }, s);
    sv('text', { x: 34, y: Y(VH) + 4, 'text-anchor': 'end', class: 'mono', style: 'font-size:11px' }, s).textContent = 'V_H';
    const showP = Math.max(per, 0.25), cyc = Math.min(8, Math.ceil(1 / showP));
    const span = 1; let d = ''; const pp = per < 0.12 ? 0.125 : per;
    for (let c = 0; c * pp < span; c++) { const t0 = c * pp, t1 = t0 + pp * duty / 100, t2 = t0 + pp; d += `${c ? 'L' : 'M'}${X(t0)} ${Y(0)} V${Y(VH)} H${X(Math.min(span, t1))} V${Y(0)} H${X(Math.min(span, t2))}`; }
    sv('path', { d, style: 'fill:none;stroke:var(--green);stroke-width:2.4' }, s);
    sv('path', { d: `M40 ${Y(VH * avg)} H440`, style: 'stroke:var(--pink);stroke-width:2.6;stroke-dasharray:7 5' }, s);
    sv('text', { x: 444, y: Y(VH * avg) + 4, class: 'lbl', style: 'font-size:13px;fill:var(--pink)' }, s).textContent = 'V_AVG';
    sv('text', { x: 240, y: 158, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:12px;fill:var(--ink3)' }, s).textContent = per < 0.12 ? 'one period (zoomed)' : '1 second';
    ro.innerHTML = `V<sub>AVG</sub> = ${duty}% × ${VH} V = <b>${(avg * VH).toFixed(2)} V</b><br><span class="small p-soft">${blinkVisible ? 'slow → your eye sees the blinking' : 'fast → your eye only sees the average brightness'}</span>`;
  });
  lp.start();
});

/* ---------- PWM ramp: single & double edge ---------- */
BUILD.push(function wRamp() {
  const w = W('w-ramp', 'PWM timer & match registers', 'the slide example — drag MR values, flip single/double');
  const MR = [100, 41, 78, 53, 27, 65, 90]; const sel = [0, 0, 1, 0, 1, 0, 0]; // PWMSEL2 & 4 set
  const show = [2, 4, 5];
  const ctl = el('div', { class: 'col' }); w.appendChild(ctl);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 660 330' }); w.appendChild(s);
  const tb = el('div', { class: 'tblwrap' }); w.appendChild(tb);
  const chs = el('div', { class: 'chips' }); ctl.appendChild(chs); chs.appendChild(el('span', { class: 'gae small' }, 'show outputs:'));
  for (let n = 1; n <= 6; n++) { const c = el('button', { class: 'chip' + (show.includes(n) ? ' on' : ''), type: 'button' }, 'PWM' + n); c.onclick = () => { const i = show.indexOf(n); if (i >= 0) show.splice(i, 1); else show.push(n); c.classList.toggle('on'); draw(); }; chs.appendChild(c); }
  const sl = el('div', { class: 'chips' }); ctl.appendChild(sl); sl.appendChild(el('span', { class: 'gae small' }, 'double edge (PWMSELn):'));
  for (let n = 2; n <= 6; n++) { const c = el('button', { class: 'chip' + (sel[n] ? ' on' : ''), type: 'button', style: '--cc:var(--n-p)' }, 'PWMSEL' + n); c.onclick = () => { sel[n] ^= 1; c.classList.toggle('on'); draw(); }; sl.appendChild(c); }
  const mr = el('div', { class: 'row' }); ctl.appendChild(mr);
  const rr = []; for (let i = 1; i <= 6; i++) rr[i] = ruler(mr, 'MR' + i, 1, 99, MR[i], 1, v => v, v => { MR[i] = v; draw(); });
  let drag = null;
  const X = t => 70 + t / 100 * 560;
  function lv(n, t) { // level of PWMn at time t (1..100)
    if (!sel[n] || n === 1) return t < MR[n] ? 1 : 0; // set at 0 (start), reset by MRn
    const a = MR[n - 1], b = MR[n]; // set by MR(n-1), reset by MRn
    if (a < b) return t >= a && t < b ? 1 : 0; return (t >= a || t < b) ? 1 : 0;
  }
  function draw() {
    s.innerHTML = '';
    sv('text', { x: 4, y: 64, class: 'lbl', style: 'font-size:14px' }, s).textContent = 'TC';
    sv('path', { d: `M${X(0)} 100 L${X(100)} 20 L${X(100)} 100`, style: 'fill:var(--hl-b);stroke:var(--blue);stroke-width:2' }, s);
    sv('text', { x: X(100) - 6, y: 112, 'text-anchor': 'end', class: 'mono', style: 'font-size:11px' }, s).textContent = 'MR0 = 100 → TC resets';
    for (let i = 1; i <= 6; i++) {
      const x = X(MR[i]); const g = sv('g', { class: 'mrline', 'data-i': i }, s);
      sv('path', { d: `M${x} 14 V${110 + show.length * 52}`, style: `stroke:${FCOL[i % 8]};stroke-width:1.6;stroke-dasharray:4 4` }, g);
      sv('rect', { x: x - 18, y: 2, width: 36, height: 16, rx: 6, style: `fill:var(--paper);stroke:${FCOL[i % 8]};stroke-width:1.6;cursor:ew-resize` }, g);
      sv('text', { x, y: 14, 'text-anchor': 'middle', class: 'mono', style: 'font-size:10.5px;pointer-events:none' }, g).textContent = 'MR' + i;
      g.addEventListener('pointerdown', e => { drag = i; s.setPointerCapture(e.pointerId); });
    }
    show.sort((a, b) => a - b).forEach((n, k) => {
      const y = 130 + k * 52; sv('text', { x: 4, y: y + 20, class: 'lbl', style: 'font-size:14px' }, s).textContent = 'PWM' + n + (sel[n] && n > 1 ? ' (D)' : '');
      const pts = []; let prev = null; for (let t = 0; t <= 100; t += 0.5) { const l = lv(n, t); if (l !== prev) { pts.push([t, l]); prev = l; } } pts.push([100, prev]);
      sv('path', { d: digi(pts, X, y, y + 30), style: 'fill:none;stroke:var(--red);stroke-width:2.6' }, s);
    });
    [1, 27, 41, 53, 65, 78, 100].forEach(t => sv('text', { x: X(t), y: 124 + show.length * 52, 'text-anchor': 'middle', class: 'mono', style: 'font-size:10px;fill:var(--ink3)' }, s).textContent = t);
    let h = '<table class="tbl pwmff" style="max-width:640px"><tr><th>channel</th><th>single edge<br><small>set · reset by</small></th><th>double edge<br><small>set · reset by</small></th><th>HIGH</th></tr>';
    for (let n = 1; n <= 6; n++) { const d = sel[n] && n > 1; h += `<tr><td class="m">PWM${n}</td><td class="${d ? '' : 'act'}">Match 0 · Match ${n}</td><td class="${d ? 'act' : ''}">Match ${n > 1 ? n - 1 : 0} · Match ${n}${n === 1 || n === 3 || n === 5 ? ' *' : ''}</td><td class="m">${d ? `${MR[n - 1]} → ${MR[n]}` : `start → ${MR[n]}`}</td></tr>`; }
    tb.innerHTML = h + '</table><p class="small p-soft">Single = PWMSELn 0, double = PWMSELn 1; highlighted = the mode in use. * PWM1 has no PWMSEL bit (always single edge); double-edge PWM3/PWM5 would use up the match registers of PWM2/PWM4 — so PWM2, 4, 6 give the most double-edge outputs.<br>Slide example: MR0 = 100, MR1 = 41, MR2 = 78 (PWM2), MR3 = 53, MR4 = 27 (PWM4), MR5 = 65 (PWM5), PWMSEL2 &amp; PWMSEL4 set. "(D)" = double edge. If the set match is bigger than the reset match, the pulse wraps around the period end (PWM4 here).</p>';
    drawFF();
  }
  // one output, inside: MUX → S-R flip-flop → enable → pin
  const inn = el('div', { class: 'mt' }); w.appendChild(inn); let ch = 4;
  const cc = el('div', { class: 'chips' }); inn.appendChild(cc); cc.appendChild(el('span', { class: 'gae small' }, 'inside one output:'));
  chipGroup(cc, [1, 2, 3, 4, 5, 6].map(n => [n, 'PWM1.' + n]), ch, v => { ch = +v; drawFF(); });
  const ff = sv('svg', { class: 'dg', viewBox: '0 0 520 176', style: 'max-width:600px' }); inn.appendChild(ff);
  const ffs = el('div', { class: 'say' }); inn.appendChild(ffs);
  function drawFF() {
    const n = ch, d = n > 1 && !!sel[n]; ff.innerHTML = '';
    const bx = (x, y, t, on) => { sv('rect', { x, y, width: 104, height: 28, rx: 6, class: 'ink', style: `fill:${on ? 'var(--n-y)' : 'var(--paper)'}` }, ff); sv('text', { x: x + 52, y: y + 20, 'text-anchor': 'middle', style: 'font-size:17px' }, ff).textContent = t; };
    const wr = (dd, on) => sv('path', { d: dd, style: `fill:none;stroke:${on ? 'var(--pink)' : 'var(--ink3)'};stroke-width:${on ? 3 : 1.6};stroke-linejoin:round` }, ff);
    const tx = (x, y, t, st) => { sv('text', { x, y, style: st || 'font-size:12px' }, ff).textContent = t; };
    bx(6, 10, 'Match 0', !d); bx(6, 58, n > 1 ? 'Match ' + (n - 1) : 'Match 0', d); bx(6, 128, 'Match ' + n, 1);
    wr('M110 24 H160', !d); wr('M110 72 H160', d);
    sv('path', { d: 'M160 12 L196 26 L196 74 L160 88 Z', class: 'ink', style: 'fill:var(--card)' }, ff);
    tx(164, 29, '0', 'font-size:13px'); tx(164, 77, '1', 'font-size:13px'); tx(165, 55, 'MUX', 'font-size:11.5px');
    wr('M178 81 V106', 0); tx(124, 122, n > 1 ? `PWMSEL${n} = ${sel[n] ? 1 : 0}` : 'no PWMSEL1', 'font-size:14px;font-family:Courier Prime;font-weight:700');
    wr('M196 50 H264', 1); wr('M110 142 H264', 1);
    sv('rect', { x: 264, y: 34, width: 76, height: 124, rx: 6, class: 'ink', style: 'fill:var(--n-l)' }, ff);
    tx(272, 56, 'S', 'font-size:18px;font-weight:700'); tx(272, 148, 'R', 'font-size:18px;font-weight:700'); tx(318, 102, 'Q', 'font-size:18px;font-weight:700'); tx(270, 174, 'flip-flop', 'font-size:14px');
    wr('M340 96 H384', 1); wr('M366 146 V116 H384', 1); tx(346, 164, `PWMENA${n} = 1`, 'font-size:13px;font-family:Courier Prime;font-weight:700');
    sv('path', { d: 'M384 82 h18 a23 23 0 0 1 0 46 h-18 z', class: 'ink', style: 'fill:var(--paper)' }, ff);
    wr('M425 105 H452', 1); tx(456, 101, 'PWM1.' + n, 'font-size:15px;font-weight:700'); tx(456, 119, 'pin', 'font-size:14px');
    ffs.innerHTML = `PWM1.${n}: <b>set</b> (S → output 1) by Match ${d ? n - 1 : 0}, <b>reset</b> (R → output 0) by Match ${n} → ${d ? '<b>double</b> edge: both edges movable' : '<b>single</b> edge: the pulse always starts with the period'}. PWMENA${n} = 1 lets it out to the pin.`;
  }
  s.addEventListener('pointermove', e => { if (!drag) return; const r = s.getBoundingClientRect(); const t = clamp(Math.round(((e.clientX - r.left) / r.width * 660 - 70) / 560 * 100), 1, 99); MR[drag] = t; rr[drag].value = t; rr[drag].dispatchEvent(new Event('input')); });
  s.addEventListener('pointerup', () => drag = null);
  draw();
});

/* ---------- PWM1PCR ---------- */
BUILD.push(function wPcr() {
  const w = W('w-pcr', 'PWM1PCR builder', 'PWM Control Register: select type + enable outputs');
  const fs = [];
  for (let n = 2; n <= 6; n++) fs.push({ bit: n, name: 'PWMSEL' + n, desc: `PWM${n}: 1 = double edge, 0 = single edge`, opts: { 0: 'single', 1: 'double' }, say: x => x ? `PWM${n} = <b>double</b> edge` : null });
  for (let n = 1; n <= 6; n++) fs.push({ bit: 8 + n, name: 'PWMENA' + n, desc: `1 = PWM${n} output enabled`, opts: { 0: 'off', 1: 'on' }, say: x => x ? `PWM${n} output <b>enabled</b>` : null });
  RegBuilder(w, { name: 'PWM1PCR', reg: 'LPC_PWM1->PCR', width: 15, value: 0x1000, hexd: 8, fields: fs, presets: [[0x1000, 'W1: PWM1.4 single'], [0x0014 | (1 << 10) | (1 << 12) | (1 << 13), 'slide diagram: 2,4,5']] });
  w.appendChild(el('p', { class: 'small p-soft' }, 'Bits 1:0 unused, 8:7 reserved, 31:15 unused. PWM1 has no PWMSEL — it\'s always single edge.'));
});

/* ---------- PWM1MCR ---------- */
BUILD.push(function wPmcr() {
  const w = W('w-pmcr', 'PWM1MCR builder', '7 match registers × (interrupt, reset, stop)');
  GridBuilder(w, {
    name: 'PWM1MCR', reg: 'LPC_PWM1->MCR', rows: ['MR0', 'MR1', 'MR2', 'MR3', 'MR4', 'MR5', 'MR6'], width: 21, value: 3, hexd: 8,
    cols: [{ n: 'I', d: 'interrupt', say: (r) => `PWMTC = ${r} → <b>interrupt</b>` }, { n: 'R', d: 'reset', say: (r) => `PWMTC = ${r} → <b>reset</b> PWMTC` }, { n: 'S', d: 'stop', say: (r) => `PWMTC = ${r} → <b>stop</b> PWMTC &amp; PWMPC, PWMTCR[0] = 0` }],
    bitOf: (r, c) => r * 3 + c, presets: [[0x03, 'W1: int + reset on MR0']]
  });
});

/* ---------- shadow registers / LER ---------- */
BUILD.push(function wLer() {
  const w = W('w-ler', 'shadow registers & LER', 'write MR4 any time — see when it really changes');
  let T = 0, tc = 1, MR0 = 100, mr4 = 30, shadow4 = 30, ler = 0, pend = null, hist = [], speed = 40, run = true;
  const top = el('div', { class: 'row' }); w.appendChild(top);
  const boxes = el('div', { class: 'row' }); top.appendChild(boxes);
  boxes.innerHTML = '<div class="dbox"><div class="gae">MR4 (you write)</div><b class="m4">30</b></div><div class="arrow ga">➝</div><div class="dbox"><div class="gae">shadow 4 (used)</div><b class="s4">30</b></div><div class="dbox"><div class="gae">LER bit 4</div><b class="lb">0</b></div>';
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  const inp = el('input', { class: 'inp', type: 'number', value: 50, min: 1, max: 99, 'aria-label': 'new MR4' });
  const b1 = el('button', { class: 'btn sm p', type: 'button' }, 'MR4 = value'); const b2 = el('button', { class: 'btn sm y', type: 'button' }, 'LER = 0x10'); const b3 = el('button', { class: 'btn sm', type: 'button' }, 'both (like W1)');
  const bp = el('button', { class: 'btn sm g', type: 'button' }, '❚❚'); ctl.append(el('span', { class: 'gae' }, 'new value'), inp, b1, b2, b3, bp);
  b1.onclick = () => { mr4 = clamp(+inp.value, 1, 99); marks.push([T, 'MR4=' + mr4]); };
  b2.onclick = () => { ler = 1; marks.push([T, 'LER']); };
  b3.onclick = () => { b1.onclick(); b2.onclick(); };
  bp.onclick = () => { run = !run; bp.textContent = run ? '❚❚' : '▶'; };
  const s = sv('svg', { class: 'dg', viewBox: '0 0 660 170' }); w.appendChild(s);
  const say = el('div', { class: 'say' }); w.appendChild(say);
  let marks = []; let lvl = 1, lastLvl = 1;
  const WIN = 3.2, X = t => 50 + (t - (T - WIN)) / WIN * 600;
  hist.push([0, 1]);
  const lp = Loop(w, dt => {
    if (!run) return; T += dt; const adv = dt * speed;
    tc += adv; if (tc > MR0) { tc = 1; marks.push([T, 'Match 0']); if (ler) { shadow4 = mr4; ler = 0; marks.push([T, '→ shadow']); say.innerHTML = `Match 0 + LER bit 4 set → MR4 (${mr4}) copied into the shadow register → <b>the new duty starts with this period</b>. LER bits cleared.`; } }
    lvl = tc < shadow4 ? 1 : 0; if (lvl !== lastLvl) { hist.push([T, lvl]); lastLvl = lvl; }
    hist = hist.filter((h, i) => i === hist.length - 1 || hist[i + 1][0] > T - WIN); marks = marks.filter(m => m[0] > T - WIN);
    $('.m4', boxes).textContent = mr4; $('.s4', boxes).textContent = shadow4; $('.lb', boxes).textContent = ler; $('.lb', boxes).parentNode.classList.toggle('one', !!ler);
    if (mr4 !== shadow4 && !ler) say.innerHTML = `MR4 = ${mr4} but the shadow still holds ${shadow4} → <b>no effect</b> yet. Set the LER bit!`;
    else if (mr4 !== shadow4 && ler) say.innerHTML = 'LER bit 4 set → waiting for the next Match 0 (start of the next period)…';
    s.innerHTML = '';
    sv('text', { x: 2, y: 40, class: 'lbl', style: 'font-size:13px' }, s).textContent = 'TC';
    sv('text', { x: 2, y: 120, class: 'lbl', style: 'font-size:13px' }, s).textContent = 'PWM1.4';
    // ramp
    let d = ''; const per = MR0 / speed; for (let t = T - WIN; t <= T; t += 0.01) { const ph = ((tc - 1) / speed - (T - t)); const c = ((ph % per) + per) % per; d += (d ? 'L' : 'M') + X(t) + ' ' + (70 - c / per * 50); } sv('path', { d, style: 'fill:none;stroke:var(--blue);stroke-width:1.8' }, s);
    sv('path', { d: digi(hist.map(h => [Math.max(h[0], T - WIN), h[1]]).concat([[T, lvl]]), X, 100, 140), style: 'fill:none;stroke:var(--red);stroke-width:2.6' }, s);
    marks.forEach(([t, txt]) => { const c = txt === 'Match 0' ? 'var(--green)' : txt === 'LER' ? 'var(--orange)' : txt.startsWith('→') ? 'var(--purple)' : 'var(--pink)'; sv('path', { d: `M${X(t)} 76 V96`, style: `stroke:${c};stroke-width:2` }, s); sv('text', { x: X(t) + 3, y: txt === 'Match 0' ? 160 : 90, class: 'mono', style: `font-size:10px;fill:${c}` }, s).textContent = txt; });
  });
  lp.start();
  w.appendChild(el('p', { class: 'small p-soft' }, 'This is the slide\'s "single edge PWM1.4" picture: MR0 = 100, MR4 = 30 at first; MR4 is loaded with 50 + LER bit 4 mid-period → the next period (after Match 0) uses 50.'));
});

/* ---------- W1 breathing LED ---------- */
const W1_CODE = `#include <LPC17xx.H>
void pwm_init(void);
void PWM1_IRQHandler(void);
unsigned int a;
unsigned long int i;
unsigned char flag,flag1;
int main(void)
{
    SystemInit();
    SystemCoreClockUpdate();
    pwm_init();
    while(1);
}
void pwm_init(void)
{
    LPC_PINCON->PINSEL3 = 2<<14;   //pwm1.4 is selected (P1.23)
    LPC_PWM1->PR  = 0x00000000;    //Count frequency : Fpclk
    LPC_PWM1->PCR = 0x00001000;    //select PWM1 single edge
    LPC_PWM1->MCR = 0x00000003;    //Reset and interrupt on PWMMR0
    LPC_PWM1->MR0 = 30000;         //setup match register 0 count
    LPC_PWM1->MR4 = 50;            //setup match register MR4
    LPC_PWM1->LER = 0x0000007F;    //enable shadow copy register
    LPC_PWM1->TCR = 0x00000002;    //RESET TC and PC
    LPC_PWM1->TCR = 0x00000009;    //enable PWM and counter
    NVIC_EnableIRQ(PWM1_IRQn);
    return;
}
void PWM1_IRQHandler(void)
{
    LPC_PWM1->IR = 0x01;           //clear the interrupts
    if(flag == 0x00)
    {
        LPC_PWM1->MR4 += 50;
        LPC_PWM1->LER = 0x0000007F;
        if(LPC_PWM1->MR4 > 29900)
        {
            flag = 0xff;
            LPC_PWM1->LER = 0x000000FF;
        }
    }
    else if(flag == 0xff)
    {
        LPC_PWM1->MR4 -= 50;
        LPC_PWM1->LER = 0x0000007F;
        if(LPC_PWM1->MR4 < 100)
        {
            flag = 0x00;
            LPC_PWM1->LER = 0X000000FF;
        }
    }
}`;
BUILD.push(function wW1() {
  const w = W('w-w1', 'W1 · step through + live LED', 'steps explain · the LED below breathes for real');
  const host = el('div'); w.appendChild(host); const L = t => lineOf(W1_CODE, t);
  const steps = [
    { l: L('PINSEL3 = 2<<14'), t: 'P1.23 → PINSEL3 bits 15:14 = 10 → function 2 = <b>PWM1.4</b>.' },
    { l: L('PR  = 0x00000000'), t: 'PR = 0 → the PWM timer counts every PCLK tick (3 MHz).' },
    { l: L('PCR = 0x00001000'), t: '0x1000 = bit 12 = <b>PWMENA4</b> → PWM1.4 output on. PWMSEL4 = 0 → single edge.' },
    { l: L('MCR = 0x00000003'), t: 'MCR = 3 → on MR0: <b>interrupt</b> + <b>reset</b> → a new period starts and the ISR runs once per period.' },
    { l: L('MR0 = 30000'), t: 'MR0 = 30000 → period = 30000 / 3 MHz = <b>10 ms</b> (100 Hz).', f: s => set(s, { mr4: 50 }) },
    { l: L('MR4 = 50;'), t: 'MR4 = 50 → output HIGH from 0 to 50 → duty = 50 / 30000 ≈ <b>0.17 %</b> (almost off).' },
    { l: L('LER = 0x0000007F;'), t: 'LER = 0x7F → latch all of MR0–MR6 into their shadows at the next Match 0.' },
    { l: [L('TCR = 0x00000002'), L('TCR = 0x00000009')], t: 'TCR = 2: reset. TCR = 9 = bit 0 (counter enable) + bit 3 (<b>PWM enable</b>) → go!' },
    { l: L('NVIC_EnableIRQ(PWM1_IRQn)'), t: 'Enable the PWM1 interrupt in the NVIC.' },
    { l: [L('LPC_PWM1->IR = 0x01'), L('if(flag == 0x00)'), L('MR4 += 50'), L('LER = 0x0000007F;', 2)], t: 'Each period (every 10 ms): ISR clears IR bit 0, flag = 0 → MR4 += 50, set LER so it takes effect next period → LED slightly brighter.', f: s => set(s, { mr4: 100 }) },
    { l: [L('MR4 += 50'), L('if(LPC_PWM1->MR4 > 29900)'), L('flag = 0xff;'), L('LER = 0x000000FF')], t: 'After ~600 periods (≈ 6 s) MR4 > 29900 → almost 100 % duty → <b>flag = 0xFF</b>. (LER = 0xFF: bit 7 doesn\'t exist, so it acts like 0x7F.)', f: s => set(s, { mr4: 29950, flag: 1 }) },
    { l: [L('else if(flag == 0xff)'), L('MR4 -= 50'), L('if(LPC_PWM1->MR4 < 100)'), L('flag = 0x00;')], t: 'Now MR4 −= 50 each period → dimmer … until MR4 &lt; 100 → flag = 0 → brighten again. A smooth <b>breathing</b> LED.', f: s => set(s, { mr4: 90, flag: 0 }) }
  ];
  let live = 50, fl = 0;
  const view = (s, v, k, first) => {
    if (first) {
      v.innerHTML = ''; const r = el('div', { class: 'row' }); v.appendChild(r);
      v._bulb = el('span', { class: 'led y', style: 'width:54px;height:54px' }); r.append(v._bulb, el('span', { class: 'pinlbl' }, 'P1.23 · PWM1.4'));
      v._kv = el('div', { class: 'say' }); v.appendChild(v._kv);
      v._svg = sv('svg', { class: 'dg', viewBox: '0 0 420 90' }); v.appendChild(v._svg);
      const lp = Loop(v, dt => { const stepN = dt / 0.01; live += (fl ? -50 : 50) * stepN; if (live > 29900) { live = 29900; fl = 1; } if (live < 100) { live = 100; fl = 0; } const d = live / 30000; v._bulb.style.opacity = 0.15 + 0.85 * d; v._bulb.classList.add('on'); v._bulb.style.boxShadow = `0 0 ${4 + 26 * d}px ${2 + 8 * d}px rgba(255,210,63,${0.2 + 0.7 * d})`; v._live.textContent = `live: MR4 = ${Math.round(live)} → duty ${(d * 100).toFixed(1)} %`; });
      v._live = el('div', { class: 'small mono' }); v.appendChild(v._live); lp.start();
    }
    const m4 = s.mr4 ?? 0; v._kv.innerHTML = s.mr4 != null ? `MR4 = <b>${m4}</b> → duty = ${m4}/30000 = <b>${(m4 / 300).toFixed(2)} %</b>${s.flag != null ? ` · flag = ${s.flag ? '0xFF (dimming)' : '0x00 (brightening)'}` : ''}` : 'setting up…';
    const g = v._svg; g.innerHTML = ''; const X = t => 20 + t * 390; let d = ''; for (let c = 0; c < 3; c++) { const t0 = c / 3, t1 = t0 + m4 / 30000 / 3; d += `${c ? 'L' : 'M'}${X(t0)} 70 V20 H${X(t1)} V70 H${X(t0 + 1 / 3)}`; } if (s.mr4 != null) sv('path', { d, style: 'fill:none;stroke:var(--red);stroke-width:2.4' }, g);
    sv('text', { x: 215, y: 86, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:12px;fill:var(--ink3)' }, g).textContent = '3 periods = 30 ms';
  };
  Stepper(host, { code: W1_CODE, title: 'pwm_breathe.c', steps, init: () => ({}), view });
});

/* ---------- UART frame ---------- */
function frameBits(ch, nb, par, stop) {
  const d = []; for (let i = 0; i < nb; i++) d.push((ch >> i) & 1);
  const ones = d.reduce((a, b) => a + b, 0); const bits = [{ v: 0, k: 'start' }].concat(d.map((v, i) => ({ v, k: 'd' + i })));
  if (par === 'odd') bits.push({ v: ones % 2 ? 0 : 1, k: 'P' }); else if (par === 'even') bits.push({ v: ones % 2, k: 'P' }); else if (par === '1') bits.push({ v: 1, k: 'P' }); else if (par === '0') bits.push({ v: 0, k: 'P' });
  for (let i = 0; i < stop; i++) bits.push({ v: 1, k: 'stop' });
  return bits;
}
BUILD.push(function wFrame() {
  const w = W('w-frame', 'build & send a frame', 'type a character');
  let nb = 8, par = 'none', stop = 1, txt = 'A', baud = 9600;
  const ctl = el('div', { class: 'row' }); w.appendChild(ctl);
  const inp = el('input', { class: 'inp', value: 'A', maxlength: 1, style: 'width:3.5em;font-size:22px;text-align:center', 'aria-label': 'character' }); ctl.append(el('span', { class: 'gae' }, 'char'), inp);
  const c1 = el('div', { class: 'col' }); ctl.appendChild(c1); c1.appendChild(el('span', { class: 'gae small' }, 'data bits')); chipGroup(c1, [[5, '5'], [6, '6'], [7, '7'], [8, '8']], nb, v => { nb = +v; draw(); });
  const c2 = el('div', { class: 'col' }); ctl.appendChild(c2); c2.appendChild(el('span', { class: 'gae small' }, 'parity')); chipGroup(c2, [['none', 'none'], ['odd', 'odd'], ['even', 'even']], par, v => { par = v; draw(); });
  const c3 = el('div', { class: 'col' }); ctl.appendChild(c3); c3.appendChild(el('span', { class: 'gae small' }, 'stop bits')); chipGroup(c3, [[1, '1'], [2, '2']], stop, v => { stop = +v; draw(); });
  const info = el('div', { class: 'say' }); w.appendChild(info);
  const fr = el('div', { class: 'frame' }); w.appendChild(fr);
  const s = sv('svg', { class: 'dg', viewBox: '0 0 660 120' }); w.appendChild(s);
  const bt = el('div', { class: 'row' }); w.appendChild(bt);
  const send = el('button', { class: 'btn p', type: 'button' }, '✉ send it'); bt.appendChild(send);
  const rx = el('div', { class: 'say g' }); bt.appendChild(rx);
  let anim = -1, t0 = 0;
  inp.addEventListener('input', () => { txt = inp.value || ' '; draw(); });
  function draw() {
    const ch = txt.charCodeAt(0) & ((1 << nb) - 1); const bits = frameBits(ch, nb, par, stop);
    info.innerHTML = `'${esc(txt)}' = ${hx(txt.charCodeAt(0))} = ${bin(txt.charCodeAt(0), 8)}${nb < 8 ? ` → only the low ${nb} bits are sent: ${bin(ch, nb)}` : ''} · LSB goes <b>first</b> · frame = ${bits.length} bits · at ${baud} baud one bit lasts ${(1e6 / baud).toFixed(1)} µs → one frame ≈ ${(bits.length * 1e3 / baud).toFixed(2)} ms`;
    fr.innerHTML = bits.map((b, i) => `<span class="fb ${b.k === 'start' ? 'st' : b.k === 'stop' ? 'sp' : b.k === 'P' ? 'pa' : 'da'}${i === anim ? ' cur' : ''}"><b>${b.v}</b><small>${b.k === 'start' ? 'start' : b.k === 'stop' ? 'stop' : b.k === 'P' ? 'parity' : 'D' + b.k.slice(1)}</small></span>`).join('');
    s.innerHTML = ''; const n = bits.length + 2, X = i => 20 + i * 620 / n;
    sv('text', { x: X(0), y: 16, class: 'lbl', style: 'font-size:12px' }, s).textContent = 'idle = 1';
    const pts = [[0, 1]]; bits.forEach((b, i) => pts.push([i + 1, b.v])); pts.push([bits.length + 1, 1]); pts.push([n, 1]);
    sv('path', { d: digi(pts, X, 30, 80), style: 'fill:none;stroke:var(--blue);stroke-width:2.6' }, s);
    bits.forEach((b, i) => sv('text', { x: X(i + 1.5), y: 104, 'text-anchor': 'middle', class: 'mono', style: `font-size:11px;fill:${i === anim ? 'var(--pink)' : 'var(--ink3)'}` }, s).textContent = b.k === 'start' ? 'S' : b.k === 'stop' ? 'E' : b.k === 'P' ? 'P' : b.k.slice(1));
    if (anim >= 0) sv('rect', { x: X(anim + 1), y: 24, width: X(1) - X(0), height: 62, style: 'fill:var(--hl-p);opacity:.5' }, s);
    return bits;
  }
  send.onclick = () => {
    const bits = draw(); anim = 0; let got = [];
    rx.textContent = 'receiver: start bit seen → sample each bit in the middle…';
    const tm = setInterval(() => {
      if (anim >= bits.length) { clearInterval(tm); anim = -1; draw(); const val = got.slice(1, nb + 1).reduce((a, b, i) => a | (b << i), 0); rx.innerHTML = `receiver rebuilt ${bin(val, nb)} = ${hx(val)} → '<b>${esc(String.fromCharCode(val))}</b>' ✓`; return; }
      got.push(bits[anim].v); draw(); anim++;
    }, 380);
  };
  draw();
});

/* ---------- RS232 / MAX232 ---------- */
BUILD.push(function wRs232() {
  const w = W('w-rs232', 'TTL ↔ RS-232 through the MAX232', 'send a byte, compare the two voltage worlds');
  const s = sv('svg', { class: 'dg', viewBox: '0 0 660 210' }); w.appendChild(s);
  // DB9
  sv('path', { d: 'M20 40 L100 50 L100 170 L20 180 Z', class: 'ink', style: 'fill:var(--card)' }, s);
  sv('text', { x: 60, y: 200, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:13px' }, s).textContent = 'PC · DB-9';
  [[60, 80, '2 RxD'], [60, 120, '3 TxD'], [60, 160, '5 GND']].forEach(([x, y, t]) => { sv('circle', { cx: x, cy: y, r: 6, style: 'fill:var(--ink3)' }, s); sv('text', { x: x + 12, y: y - 8, class: 'mono', style: 'font-size:10.5px' }, s).textContent = t; });
  sv('rect', { x: 260, y: 40, width: 120, height: 140, rx: 8, style: 'fill:#cfe0b0;stroke:var(--ink);stroke-width:2' }, s);
  sv('text', { x: 320, y: 112, 'text-anchor': 'middle', class: 'lbl' }, s).textContent = 'MAX232';
  sv('text', { x: 320, y: 130, 'text-anchor': 'middle', class: 'mono', style: 'font-size:10px' }, s).textContent = 'T1/T2 · R1/R2';
  sv('rect', { x: 540, y: 40, width: 100, height: 140, rx: 8, style: 'fill:#ffb04a;stroke:var(--ink);stroke-width:2' }, s);
  sv('text', { x: 590, y: 112, 'text-anchor': 'middle', class: 'lbl' }, s).textContent = 'LPC1768';
  const a1 = sv('path', { d: 'M260 80 H66', class: 'wr2' }, s), a2 = sv('path', { d: 'M540 80 H380', class: 'wr2' }, s);
  const b1 = sv('path', { d: 'M66 120 H260', class: 'wr2' }, s), b2 = sv('path', { d: 'M380 120 H540', class: 'wr2' }, s);
  [[140, 74, 'T1 out ·14 (±10 V)'], [386, 74, 'T1 in ·11'], [120, 114, 'R1 in ·13 (±10 V)'], [386, 114, 'R1 out ·12']].forEach(([x, y, t]) => sv('text', { x, y, class: 'mono', style: 'font-size:10px' }, s).textContent = t);
  sv('text', { x: 500, y: 74, class: 'mono', style: 'font-size:10px' }, s).textContent = 'TxD'; sv('text', { x: 500, y: 114, class: 'mono', style: 'font-size:10px' }, s).textContent = 'RxD';
  const bt = el('div', { class: 'row' }); w.appendChild(bt);
  const send = el('button', { class: 'btn p', type: 'button' }, 'micro sends "U" ➝'); const recv = el('button', { class: 'btn sm', type: 'button' }, '⬅ PC sends "U"'); bt.append(send, recv);
  const sc = sv('svg', { class: 'dg', viewBox: '0 0 660 230' }); w.appendChild(sc);
  function wave(rs) {
    sc.innerHTML = ''; const bits = frameBits(0x55, 8, 'none', 1); const X = i => 110 + i * 48;
    const Yt = v => 70 - v * 46, Yr = v => 165 + (v ? 1 : -1) * 40 * 1; // rs: 1 → -10, 0 → +10
    sv('text', { x: 2, y: 50, class: 'lbl', style: 'font-size:13px' }, sc).textContent = 'TTL side'; sv('text', { x: 2, y: 66, class: 'mono', style: 'font-size:10px' }, sc).textContent = '1 = 3.3 V';
    sv('text', { x: 2, y: 160, class: 'lbl', style: 'font-size:13px' }, sc).textContent = 'RS-232 side'; sv('text', { x: 2, y: 176, class: 'mono', style: 'font-size:10px' }, sc).textContent = '1 = −10 V';
    sv('rect', { x: 86, y: 165 - 12, width: 560, height: 24, style: 'fill:url(#hatch-y)' }, sc); sv('text', { x: 650, y: 170, 'text-anchor': 'end', class: 'mono', style: 'font-size:9.5px' }, sc).textContent = '−3…+3 V undefined';
    [['+10 V', 125], ['0 V', 165], ['−10 V', 205]].forEach(([t, y]) => sv('text', { x: 84, y: y + 4, 'text-anchor': 'end', class: 'mono', style: 'font-size:10px' }, sc).textContent = t);
    const pts = [[-0.5, 1]].concat(bits.map((b, i) => [i, b.v])).concat([[bits.length, 1], [bits.length + 0.6, 1]]);
    sv('path', { d: digi(pts, X, Yt(1), Yt(0)), style: 'fill:none;stroke:var(--green);stroke-width:2.6' }, sc);
    sv('path', { d: digi(pts, X, Yr(1), Yr(0)), style: 'fill:none;stroke:var(--purple);stroke-width:2.6' }, sc);
    bits.forEach((b, i) => sv('text', { x: X(i + .5), y: 102, 'text-anchor': 'middle', class: 'mono', style: 'font-size:11px' }, sc).textContent = b.v);
    sv('text', { x: 330, y: 226, 'text-anchor': 'middle', class: 'lbl', style: 'font-size:12px;fill:var(--ink3)' }, sc).textContent = '"U" = 0x55 — same bits, but RS-232 is inverted and much bigger';
  }
  const go = (dir) => { [a1, a2, b1, b2].forEach(p => p.classList.remove('flow')); (dir ? [a2, a1] : [b1, b2]).forEach(p => p.classList.add('flow')); setTimeout(() => [a1, a2, b1, b2].forEach(p => p.classList.remove('flow')), 2600); };
  send.onclick = () => go(1); recv.onclick = () => go(0);
  wave();
});

/* ---------- DLAB address sharing ---------- */
BUILD.push(function wDlab() {
  const w = W('w-dlab', 'DLAB: one address, two registers', 'flip LCR bit 7');
  let dlab = 0;
  const box = el('div', { class: 'dlab' }); w.appendChild(box);
  const b = el('button', { class: 'tsw', type: 'button', 'aria-label': 'DLAB' }, '<i></i>');
  const r = el('div', { class: 'row' }); w.insertBefore(r, box); r.append(el('span', { class: 'gae' }, 'DLAB (LCR bit 7) ='), b); const dv = el('span', { class: 'ro big' }); r.appendChild(dv);
  b.onclick = () => { dlab ^= 1; b.classList.toggle('on', !!dlab); paint(); };
  function paint() {
    dv.textContent = dlab;
    box.innerHTML = [['0x00 (read)', 'RBR · received byte', 'DLL · divisor LSB'], ['0x00 (write)', 'THR · byte to send', 'DLL · divisor LSB'], ['0x04', 'IER · interrupt enable', 'DLM · divisor MSB']].map(([a, z, o]) => `<div class="dl"><span class="mono">offset ${a}</span><div class="doors"><span class="${dlab ? '' : 'open'}">${z}</span><span class="${dlab ? 'open' : ''}">${o}</span></div></div>`).join('') + `<div class="say">${dlab ? 'DLAB = 1 → the baud-rate divisor latches are visible. Set the baud rate now…' : 'DLAB = 0 → normal use: send with THR, receive with RBR. (That\'s why the init sets LCR = 0x83, then LCR = 0x03.)'}</div>`;
  }
  paint();
});

/* ---------- LCR ---------- */
BUILD.push(function wLcr() {
  const w = W('w-lcr', 'U0LCR builder', 'Line Control Register — the frame format');
  RegBuilder(w, {
    name: 'U0LCR', reg: 'LPC_UART0->LCR', width: 8, value: 0x83, fields: [
      { lo: 0, hi: 1, name: 'Word Length Select', opts: { 0: '00 · 5 bit', 1: '01 · 6 bit', 2: '10 · 7 bit', 3: '11 · 8 bit' }, say: x => `<b>${x + 5}-bit</b> characters` },
      { bit: 2, name: 'Stop Bit Select', opts: { 0: '0 · 1 stop', 1: '1 · 2 stop' }, say: (x, v) => x ? ((v & 3) === 0 ? '<b>1.5</b> stop bits (because 5-bit words)' : '<b>2</b> stop bits') : '<b>1</b> stop bit' },
      { bit: 3, name: 'Parity Enable', opts: { 0: '0 · off', 1: '1 · on' }, say: { 0: 'no parity', 1: 'parity generated &amp; checked' } },
      { lo: 4, hi: 5, name: 'Parity Select', desc: 'used only if parity is enabled', opts: { 0: '00 odd', 1: '01 even', 2: '10 forced 1', 3: '11 forced 0' }, say: (x, v) => (v & 8) ? ['<b>odd</b> parity: total number of 1s (data + parity) is odd', '<b>even</b> parity: total number of 1s is even', 'parity bit always <b>1</b> (stick)', 'parity bit always <b>0</b> (stick)'][x] : null },
      { bit: 6, name: 'Break Control', opts: { 0: '0 · off', 1: '1 · break' }, say: { 1: 'TXD forced to <b>0</b> (break transmission)' } },
      { bit: 7, name: 'DLAB', desc: 'Divisor Latch Access Bit', opts: { 0: '0', 1: '1' }, say: { 0: 'DLAB = 0 → THR/RBR/IER accessible', 1: 'DLAB = 1 → <b>DLL/DLM accessible</b> (set the baud rate)' } }
    ], presets: [[0x83, '8N1 + DLAB'], [0x03, '8N1']]
  });
});

/* ---------- LSR live sim ---------- */
BUILD.push(function wLsr() {
  const w = W('w-lsr', 'U0LSR · watch the status bits live', 'push characters through the UART');
  const st = { rx: [], thr: null, tsr: null, oe: 0, pe: 0, fe: 0, bi: 0, err: 0 };
  const pipe = el('div', { class: 'pipe' }); w.appendChild(pipe);
  const strip = el('div', { class: 'lsrbits mt' }); w.appendChild(strip);
  const bt = el('div', { class: 'row mt' }); w.appendChild(bt);
  const mk = (t, cls, f) => { const b = el('button', { class: 'btn sm ' + cls, type: 'button' }, t); b.onclick = () => { f(); paint(); }; bt.appendChild(b); };
  const say = el('div', { class: 'say' }); w.appendChild(say);
  let nextC = 65; const MAX = 4;
  mk('⬅ char arrives on RxD', 'p', () => { const c = String.fromCharCode(nextC++); if (nextC > 90) nextC = 65; if (st.rx.length >= MAX) { st.oe = 1; say.innerHTML = `RX FIFO full → '${c}' is <b>lost</b> → <b>OE = 1</b> (overrun).`; } else { st.rx.push(c); say.innerHTML = `'${c}' received → RX FIFO not empty → <b>RDR = 1</b>.`; } });
  mk('read RBR', 'g', () => { const c = st.rx.shift(); say.innerHTML = c ? `read '${c}' (the <b>oldest</b>). ${st.rx.length ? 'More waiting → RDR stays 1.' : 'FIFO empty → <b>RDR = 0</b>.'}` : 'nothing to read (RDR = 0).'; st.oe = 0; st.pe = st.fe = st.bi = 0; });
  mk('write THR = \'x\'', 'y', () => { if (st.tsr === null) { st.tsr = 'x'; say.innerHTML = 'THR → moved straight into the shift register (TSR), now sending… THR is empty again → <b>THRE = 1</b>, but <b>TEMT = 0</b> (TSR busy).'; } else { st.thr = 'x'; say.innerHTML = 'TSR busy → byte waits in THR → <b>THRE = 0</b>.'; } });
  mk('finish sending', '', () => { if (st.thr !== null) { st.tsr = st.thr; st.thr = null; say.innerHTML = 'TSR done → next byte moves from THR into TSR → THRE = 1, TEMT = 0.'; } else if (st.tsr !== null) { st.tsr = null; say.innerHTML = 'Last bit out → THR and TSR both empty → <b>TEMT = 1</b>.'; } else say.textContent = 'nothing to send.'; });
  mk('⚡ parity error', 'p', () => { st.rx.push('?'); st.pe = 1; say.innerHTML = 'A char arrived with the wrong parity → <b>PE = 1</b>, and <b>RXFE = 1</b>.'; });
  mk('⚡ bad stop bit', 'p', () => { st.rx.push('?'); st.fe = 1; say.innerHTML = 'Stop bit was 0 → <b>FE = 1</b> (framing error), RXFE = 1.'; });
  mk('⚡ line held at 0', 'p', () => { st.rx.push('\\0'); st.bi = 1; say.innerHTML = 'RXD held at 0 for a whole character → <b>BI = 1</b> (break), RXFE = 1.'; });
  const D = [['RXFE', 'error in RX FIFO (PE/FE/BI)'], ['TEMT', 'THR and TSR both empty'], ['THRE', 'THR empty (can write)'], ['BI', 'break interrupt'], ['FE', 'framing error (stop bit = 0)'], ['PE', 'parity error'], ['OE', 'overrun: RX FIFO was full'], ['RDR', 'receive data ready']];
  function paint() {
    const v = { RDR: st.rx.length ? 1 : 0, OE: st.oe, PE: st.pe, FE: st.fe, BI: st.bi, THRE: st.thr === null ? 1 : 0, TEMT: st.thr === null && st.tsr === null ? 1 : 0, RXFE: st.pe || st.fe || st.bi ? 1 : 0 };
    pipe.innerHTML = `<div class="prow"><span class="gae">RxD</span>➝<div class="fifo">${Array.from({ length: MAX }, (_, i) => `<i>${st.rx[i] ?? ''}</i>`).join('')}</div><span class="small">RX FIFO (RBR reads the left end · really 16 deep)</span></div><div class="prow"><span class="gae">CPU</span>➝<div class="fifo one"><i>${st.thr ?? ''}</i></div><span class="small">THR</span>➝<div class="fifo one"><i>${st.tsr ?? ''}</i></div><span class="small">TSR (shift register: sends bit by bit)</span>➝<span class="gae">TxD</span></div>`;
    strip.innerHTML = D.map(([n, d], i) => `<span class="lb ${v[n] ? 'one' : ''}"><small>bit ${7 - i}</small><b>${v[n]}</b><em>${n}</em><u>${d}</u></span>`).join('');
  }
  paint(); say.textContent = 'All quiet: RX empty (RDR = 0), THR and TSR empty (THRE = 1, TEMT = 1).';
});

/* ---------- FCR ---------- */
BUILD.push(function wFcr() {
  const w = W('w-fcr', 'U0FCR builder', 'FIFO Control Register (write-only)');
  RegBuilder(w, {
    name: 'U0FCR', reg: 'LPC_UART0->FCR', width: 8, value: 0x07, fields: [
      { bit: 0, name: 'FIFO Enable', desc: 'must be 1 for proper UART operation; toggling it clears the FIFOs', opts: { 0: '0', 1: '1' }, say: { 0: '<span class="p-red">FIFOs disabled — must not be used</span>', 1: 'RX &amp; TX FIFOs <b>enabled</b>' } },
      { bit: 1, name: 'RX FIFO Reset', desc: '1 = clear all bytes in the RX FIFO (self-clearing)', opts: { 0: '0', 1: '1' }, say: { 1: 'RX FIFO <b>cleared</b>' } },
      { bit: 2, name: 'TX FIFO Reset', desc: '1 = clear all bytes in the TX FIFO (self-clearing)', opts: { 0: '0', 1: '1' }, say: { 1: 'TX FIFO <b>cleared</b>' } },
      { bit: 3, name: 'DMA Mode Select', opts: { 0: '0', 1: '1' }, say: { 1: 'DMA mode selected' } },
      { lo: 6, hi: 7, name: 'RX Trigger Level', desc: 'how many received chars before an interrupt / DMA request', opts: { 0: '00 · 1', 1: '01 · 4', 2: '10 · 8', 3: '11 · 14' }, say: x => `RDA interrupt after <b>${[1, 4, 8, 14][x]}</b> received character${x ? 's' : ''}` }
    ], presets: [[0x07, 'U1: enable + reset both']]
  });
});

/* ---------- IER ---------- */
BUILD.push(function wIer() {
  const w = W('w-ier', 'U0IER builder', 'Interrupt Enable Register (needs DLAB = 0)');
  RegBuilder(w, {
    name: 'U0IER', reg: 'LPC_UART0->IER', width: 10, value: 0x03, hexd: 3, fields: [
      { bit: 0, name: 'RBR Interrupt Enable', desc: 'Receive Data Available (and char time-out) interrupt', opts: { 0: '0', 1: '1' }, say: { 1: 'interrupt when <b>data is received</b> (RDA / CTI)' } },
      { bit: 1, name: 'THRE Interrupt Enable', desc: 'interrupt when THR becomes empty (status in LSR[5])', opts: { 0: '0', 1: '1' }, say: { 1: 'interrupt when <b>THR is empty</b> (ready for the next byte)' } },
      { bit: 2, name: 'RX Line Status Int. Enable', desc: 'errors: status in LSR[4:1]', opts: { 0: '0', 1: '1' }, say: { 1: 'interrupt on <b>receive errors</b> (OE/PE/FE/BI)' } },
      { bit: 8, name: 'ABEOIntEn', desc: 'end of auto-baud', opts: { 0: '0', 1: '1' }, say: { 1: 'end-of-auto-baud interrupt' } },
      { bit: 9, name: 'ABTOIntEn', desc: 'auto-baud time-out', opts: { 0: '0', 1: '1' }, say: { 1: 'auto-baud time-out interrupt' } }
    ], presets: [[0x03, 'U1: receive + transmit']]
  });
});

/* ---------- IIR decoder ---------- */
BUILD.push(function wIir() {
  const w = W('w-iir', 'U0IIR · who rang?', 'pick the pending interrupt');
  const T = [['none', 0b0001, 'no interrupt pending (bit 0 = 1, active low!)'], ['RLS', 0b0110, 'priority 1 · Receive Line Status — an error (OE/PE/FE/BI)'], ['RDA', 0b0100, 'priority 2a · Receive Data Available'], ['CTI', 0b1100, 'priority 2b · Character Time-out Indicator'], ['THRE', 0b0010, 'priority 3 · THR empty']];
  const c = el('div'); w.appendChild(c);
  const strip = RegStrip(w, { bits: 10, name: 'U0IIR (FIFOs enabled → bits 7:6 = 11)' });
  const out = el('div', { class: 'col' }); w.appendChild(out);
  chipGroup(c, T.map((t, i) => [i, t[0]]), 2, v => show(+v));
  function show(i) {
    const v = (T[i][1] | 0xC0) >>> 0; strip.set(v, [{ lo: 0, hi: 0, color: 'var(--red)' }, { lo: 1, hi: 3, color: 'var(--blue)' }, { lo: 6, hi: 7, color: 'var(--green)' }]);
    const m = v & 0x06; const isTx = (m & 0x02) === 0x02, isRx = !isTx && (m & 0x04) === 0x04;
    out.innerHTML = `<div class="say">IIR = ${hx(v, 2)} → IntStatus (bit 0) = ${v & 1} ${v & 1 ? '→ nothing pending' : '→ <b>pending!</b>'} · IntId (bits 3:1) = <b>${bin((v >> 1) & 7, 3)}</b> → ${T[i][2]}</div><div class="say b">U1's ISR: Int_Stat = IIR &amp; 0x06 = ${hx(m, 2)} → ${isTx ? '<b>(Int_Stat &amp; 0x02) == 0x02 → transmit</b> → tx0_flag = 0xFF' : isRx ? '<b>(Int_Stat &amp; 0x04) == 0x04 → receive</b> → read RBR, rx0_flag = 0xFF' : 'neither branch'}${T[i][0] === 'RLS' ? ' <span class="p-red">(careful: RLS = 011 also has bit 1 set → U1 would treat it as "transmit"; fine for U1 since RLS isn\'t enabled)</span>' : ''}</div>`;
  }
  show(2);
  w.appendChild(el('p', { class: 'small p-soft' }, 'Other IntId values (000, 100, 101, 111) are reserved. Bits 5:4 reserved; bit 8 ABEOInt, bit 9 ABTOInt (auto-baud).'));
});

/* ---------- baud calculator ---------- */
BUILD.push(function wBaud() {
  const w = W('w-baud', 'baud-rate calculator', 'try the U1 values: DLM = 0, DLL = 0x13');
  const g = el('div', { class: 'kv' }); w.appendChild(g);
  const f = (lab, val) => { const i = el('input', { class: 'inp', type: 'number', value: val, 'aria-label': lab }); g.append(el('span', {}, lab), i); return i; };
  const pc = f('PCLK (Hz)', 3000000), dlm = f('U0DLM', 0), dll = f('U0DLL', 19), dav = f('DIVADDVAL', 0), mul = f('MULVAL', 1);
  const out = el('div', { class: 'icard' }); w.appendChild(out);
  const rev = el('div', { class: 'row' }); w.appendChild(rev);
  const tg = el('input', { class: 'inp', type: 'number', value: 9600, 'aria-label': 'target baud' }); const rb = el('button', { class: 'btn sm p', type: 'button' }, 'find DLL/DLM'); rev.append(el('span', { class: 'gae' }, 'target baud'), tg, rb);
  const rs = el('div', { class: 'say' }); w.appendChild(rs);
  function calc() {
    const P = +pc.value, M = +dlm.value & 255, Lv = +dll.value & 255, D = +dav.value & 15, Mu = Math.max(1, +mul.value & 15); const div = Math.max(1, 256 * M + Lv);
    const b = P / (16 * div * (1 + D / Mu));
    out.innerHTML = `<div class="ih">result</div><div style="padding:8px 4px;font-size:17.5px">baud = ${P} / (16 × (256 × ${M} + ${Lv}) × (1 + ${D}/${Mu})) = ${P} / ${(16 * div * (1 + D / Mu)).toFixed(1)} = <b>${b.toFixed(1)}</b> bps</div>`;
  }
  rb.onclick = () => { const P = +pc.value, t = +tg.value; const d = Math.max(1, Math.round(P / (16 * t))); dlm.value = d >> 8; dll.value = d & 255; dav.value = 0; mul.value = 1; calc(); const b = P / (16 * d); rs.innerHTML = `divisor = PCLK / (16 × baud) = ${P} / ${16 * t} = ${(P / 16 / t).toFixed(2)} → round to <b>${d}</b> → DLM = ${d >> 8}, DLL = ${d & 255} (${hx(d & 255)}) → actual ${b.toFixed(0)} bps, error ${((b - t) / t * 100).toFixed(2)} % ${Math.abs((b - t) / t) < 0.03 ? '✓ (under ~3 % works)' : '✗ too big — use the fractional divider'}`; };
  [pc, dlm, dll, dav, mul].forEach(i => i.addEventListener('input', calc)); calc();
});

/* ---------- U1 echo ---------- */
const U1_CODE = `#include<LPC17xx.h>
unsigned char rx0_flag=0, tx0_flag=0;
unsigned char recv_data;            //~ not declared in the slide
void UART0_Init(void);
int main(void)
{
    UART0_Init();
    while(1)
    {
        while(rx0_flag == 0x00);
        rx0_flag = 0x00;
        LPC_UART0->THR = recv_data;
        while(tx0_flag == 0x00);
        tx0_flag = 0x00;
    }
}
void UART0_Init(void)
{
    LPC_PINCON->PINSEL0 |= 0x00000050; //P0.2 TxD0 (Fn 01), P0.3 RxD0 (Fn 01)
    LPC_UART0->LCR = 0x00000083;  //enable divisor latch, parity disable, 1 stop bit, 8bit word length
    LPC_UART0->DLM = 0X00;
    LPC_UART0->DLL = 0x13;        //select baud rate 9600 bps
    LPC_UART0->LCR = 0X00000003;
    LPC_UART0->FCR = 0x07;        //FIFO enable, Reset
    LPC_UART0->IER = 0X03;        //select Transmit and receive interrupt
    NVIC_EnableIRQ(UART0_IRQn);   //Assigning channel
}
void UART0_IRQHandler(void)
{
    unsigned long Int_Stat;
    Int_Stat = LPC_UART0->IIR;     //reading the data from interrupt identification register
    Int_Stat = Int_Stat & 0x06;    //masking other than Transmit & Receive data indicator
    if((Int_Stat & 0x02)== 0x02)   //transmit interrupt
        tx0_flag = 0xff;
    else if( (Int_Stat & 0x04) == 0x04) //receive data available
    {
        recv_data = LPC_UART0->RBR;
        rx0_flag = 0xff;
    }
}`;
BUILD.push(function wU1() {
  const L = t => lineOf(U1_CODE, t);
  const boot = [
    { l: L('PINSEL0 |= 0x00000050'), t: '0x50 = 0101 0000 → bits 5:4 = 01 (P0.2 = TXD0), bits 7:6 = 01 (P0.3 = RXD0).' },
    { l: L('LCR = 0x00000083'), t: 'LCR = 0x83: 8 data bits, 1 stop, no parity, and <b>DLAB = 1</b> to reach the divisor.' },
    { l: [L('DLM = 0X00'), L('DLL = 0x13')], t: 'Divisor = 256 × 0 + 19 = 19 → 3 000 000 / (16 × 19) = <b>9868 baud ≈ 9600</b> (2.8 % off — acceptable).' },
    { l: L('LCR = 0X00000003'), t: 'LCR = 0x03: same format, <b>DLAB = 0</b> → THR/RBR/IER usable again.' },
    { l: L('FCR = 0x07'), t: 'FCR = 0x07: FIFO enable + reset RX + reset TX FIFO.' },
    { l: [L('IER = 0X03'), L('NVIC_EnableIRQ(UART0_IRQn)')], t: 'IER = 0x03: interrupts on <b>receive data</b> (bit 0) and <b>THR empty</b> (bit 1). Enable UART0 in the NVIC.' },
    { l: L('while(rx0_flag == 0x00);'), t: 'main waits for a character. <b>Type one in the PC terminal →</b>' }
  ];
  const ex = Exercise('w-u1', 'U1 · echo, live', 'type in the PC terminal', {
    code: U1_CODE, file: 'uart_echo.c', noLcd: true, boot, noteClass: 'green',
    world: () => ({ term: '', ch: null, rx: 0, tx: 0, iir: null }),
    setup: v => {
      v._term = el('div', { class: 'term' }); v.appendChild(v._term);
      const r = el('div', { class: 'row' }); v.appendChild(r);
      const inp = el('input', { class: 'inp', maxlength: 1, placeholder: 'key', 'aria-label': 'type a character', style: 'width:5em' }); r.append(el('span', { class: 'gae' }, 'PC keyboard:'), inp);
      inp.addEventListener('input', () => { const c = inp.value; inp.value = ''; if (c) typed(c); });
      v._kv = el('div', { class: 'say small' }); v.appendChild(v._kv);
    },
    paint: (s, v) => { v._term.innerHTML = `<span class="tp">PC terminal (9600 8N1)</span><pre>${esc(s.term)}<i class="cur">▌</i></pre>`; v._kv.innerHTML = `recv_data = ${s.ch != null ? `'${esc(s.ch)}'` : '–'} · rx0_flag = ${s.rx ? '0xFF' : '0'} · tx0_flag = ${s.tx ? '0xFF' : '0'}${s.iir != null ? ` · IIR &amp; 0x06 = ${hx(s.iir, 2)}` : ''}`; }
  });
  function typed(c) {
    ex.fire([
      { l: L('while(rx0_flag == 0x00);'), t: `PC sends '${esc(c)}' → frame arrives on RxD → RX FIFO → <b>RDA interrupt</b>.` },
      { l: [L('Int_Stat = LPC_UART0->IIR'), L('Int_Stat = Int_Stat & 0x06')], t: 'ISR: IIR = 0xC4 → &amp; 0x06 = <b>0x04</b>.', f: s => set(s, { iir: 4 }) },
      { l: [L('else if( (Int_Stat & 0x04)'), L('recv_data = LPC_UART0->RBR'), L('rx0_flag = 0xff')], t: `Receive branch: recv_data = RBR = '${esc(c)}', rx0_flag = 0xFF.`, f: s => set(s, { ch: c, rx: 1 }) },
      { l: [L('rx0_flag = 0x00;'), L('LPC_UART0->THR = recv_data')], t: 'Back in main: the wait ends → clear the flag → <b>write the char to THR</b> → it is sent back.', f: s => set(s, { rx: 0 }) },
      { l: [L('Int_Stat = Int_Stat & 0x06'), L('if((Int_Stat & 0x02)== 0x02)'), L('tx0_flag = 0xff')], t: 'When THR empties → <b>THRE interrupt</b>: IIR &amp; 0x06 = 0x02 → tx0_flag = 0xFF.', f: s => set(s, { iir: 2, tx: 1, term: s.term + c }) },
      { l: [L('while(tx0_flag == 0x00);'), L('tx0_flag = 0x00;'), L('while(rx0_flag == 0x00);')], t: `Echo complete: the terminal shows '${esc(c)}'. Clear tx0_flag, wait for the next character.`, f: s => set(s, { tx: 0, iir: null }) }
    ]);
  }
});
