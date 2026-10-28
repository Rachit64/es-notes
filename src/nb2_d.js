/* =========================================================
   NOTEBOOK 2 · part D — master widgets: shared helpers + ch 1–3
   ========================================================= */

/* master card = a normal widget card + star sticker + stitched frame */
function MW(id, title, info) {
  const w = W(id, title, info); w.classList.add('master'); w.style.setProperty('--tilt', '0deg');
  w.insertAdjacentHTML('afterbegin', '<svg class="sticker mstar" aria-hidden="true"><use href="#st-star"/></svg>');
  return w;
}
/* tiny syntax-highlighted code pane; returns {el, set(lines), hi(idx[], cls)} */
function MCode(host, lines) {
  const box = el('div', { class: 'mcode' }); host.appendChild(box); let rows = [];
  const api = {
    el: box,
    set(L) { box.innerHTML = L.map(l => `<span class="ml">${hlC(l) || ' '}</span>`).join(''); rows = $$('.ml', box); return api; },
    hi(idx, cls = 'on') { rows.forEach(r => r.classList.remove('on', 'bad', 'bm')); [].concat(idx).forEach(i => rows[i] && rows[i].classList.add(cls)); return api; }
  };
  return api.set(lines || []);
}
/* lever toggle button */
function Tog(host, html, on, cb) {
  const b = el('button', { class: 'tog' + (on ? '' : ' off'), type: 'button', 'aria-pressed': on ? 'true' : 'false' }, `<span>${html}</span>`); host.appendChild(b);
  b.onclick = () => { on = !on; b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on); cb(on, b); };
  return { el: b, label(h) { b.firstChild.innerHTML = h; }, set(v) { on = !!v; b.classList.toggle('off', !on); b.setAttribute('aria-pressed', on); }, get on() { return on; } };
}
/* hand-drawn wires between HTML boxes inside `host` (re-routed on every resize) */
function Wires(host) {
  host.classList.add('wired');
  const back = sv('svg', { class: 'mw-back', 'aria-hidden': 'true' }), front = sv('svg', { class: 'mw-front', 'aria-hidden': 'true' });
  host.prepend(back); host.appendChild(front);
  const ws = [], cbs = []; let raf = 0;
  const rel = e => {
    let x = 0, y = 0, n = e;
    while (n && n !== host && n.offsetParent !== undefined) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    if (n !== host) { const a = e.getBoundingClientRect(), b = host.getBoundingClientRect(); return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height }; }
    return { x, y, w: e.offsetWidth, h: e.offsetHeight };
  };
  const anchor = (r, s, f) => s === 'r' ? [r.x + r.w, r.y + r.h * f] : s === 'l' ? [r.x, r.y + r.h * f] : s === 't' ? [r.x + r.w * f, r.y] : [r.x + r.w * f, r.y + r.h];
  function sides(ra, rb) {
    const hg = Math.max(rb.x - (ra.x + ra.w), ra.x - (rb.x + rb.w)), vg = Math.max(rb.y - (ra.y + ra.h), ra.y - (rb.y + rb.h));
    const dx = rb.x + rb.w / 2 - ra.x - ra.w / 2, dy = rb.y + rb.h / 2 - ra.y - ra.h / 2;
    return hg > vg ? (dx > 0 ? ['r', 'l'] : ['l', 'r']) : (dy > 0 ? ['b', 't'] : ['t', 'b']);
  }
  const V = { r: [1, 0], l: [-1, 0], t: [0, -1], b: [0, 1] }, f1 = p => p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  function curve(p1, p2, sa, sb, R) {
    const k = Math.max(16, Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * .42), j = () => (R() * 2 - 1) * 4;
    return `M${f1(p1)}C${f1([p1[0] + V[sa][0] * k + j(), p1[1] + V[sa][1] * k + j()])} ${f1([p2[0] + V[sb][0] * k + j(), p2[1] + V[sb][1] * k + j()])} ${f1(p2)}`;
  }
  function layout() {
    raf = 0; const W = host.offsetWidth, H = host.offsetHeight; if (!W) return;
    [back, front].forEach(s => { s.setAttribute('viewBox', `0 0 ${W} ${H}`); s.setAttribute('width', W); s.setAttribute('height', H); });
    ws.forEach((w, i) => {
      const ra = rel(w.a), rb = rel(w.b); const [sa, sb] = w.o.sides || sides(ra, rb);
      w.p1 = anchor(ra, sa, w.o.fa ?? .5); w.p2 = anchor(rb, sb, w.o.fb ?? .5); w.d = curve(w.p1, w.p2, sa, sb, rng(i * 31 + 7));
      w.g.innerHTML = w.o.draw ? w.o.draw(w.d, w) : `<path class="wline" d="${w.d}"/>`; w.path = w.g.querySelector('[data-track]') || w.g.querySelector('path'); w.len = w.path.getTotalLength();
    });
    cbs.forEach(f => f());
  }
  const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(layout); }); ro.observe(host);
  if (document.fonts) document.fonts.ready.then(() => layout());
  return {
    back, front,
    add(a, b, o = {}) { const w = { a, b, o, g: sv('g', { class: 'mw ' + (o.cls || '') }, back) }; ws.push(w); ro.observe(a); ro.observe(b); return w; },
    layout() { layout(); }, onLayout(f) { cbs.push(f); }, clear() { ws.length = 0; back.innerHTML = ''; },
    at(w, t) { if (!w.path) return [0, 0]; const q = w.path.getPointAtLength(clamp(t, 0, 1) * w.len); return [q.x, q.y]; }
  };
}
/* a little hand-drawn rail (double stroke) for the marble machine */
const railDraw = d => `<path class="rail-o" d="${d}"/><path class="rail-i" d="${d}" data-track="1"/><path class="rail-c" d="${d}"/>`;

/* ===================================================================
   M1 · chapter 1 in one widget — the interrupt machine (marble run)
   =================================================================== */
const IRQ_NAMES = ['WDT', 'TIMER0', 'TIMER1', 'TIMER2', 'TIMER3', 'UART0', 'UART1', 'UART2', 'UART3', 'PWM1', 'I2C0', 'I2C1', 'I2C2', 'SPI', 'SSP0', 'SSP1', 'PLL0', 'RTC', 'EINT0', 'EINT1', 'EINT2', 'EINT3', 'ADC', 'BOD', 'USB', 'CAN', 'DMA', 'I2S', 'ENET', 'RIT', 'MCPWM', 'QEI', 'PLL1', 'USBActivity', 'CANActivity'];
const M1_PER = [
  { k: 'TIMER0', irq: 1, ev: 'TC = MR0 (a match)', fl: 'IR bit 0', en: 'MCR bit 0 = 1', clr: 'LPC_TIM0->IR = 1;', job: 'ticks++;', ch: 2 },
  { k: 'EINT2', irq: 20, ev: 'falling edge on P2.12', fl: 'EXTINT bit 2', en: 'PINSEL4: P2.12 = EINT2', clr: 'LPC_SC->EXTINT = 4;', job: 'toggle_led();', ch: 3 },
  { k: 'GPIO', irq: 21, name: 'EINT3', ev: 'rising edge on P0.0', fl: 'IO0IntStatR bit 0', en: 'IO0IntEnR bit 0 = 1', clr: 'LPC_GPIOINT->IO0IntClr = 1;', job: 'led_on();', ch: 4 },
  { k: 'ADC', irq: 22, ev: 'AD0.4 conversion DONE', fl: 'ADSTAT bit 16 (ADINT)', en: 'ADINTEN bit 4 = 1', clr: 'x = LPC_ADC->ADDR4; // read clears', job: 'temp4 = (x >> 4) & 0xFFF;', ch: 5 },
  { k: 'PWM1', irq: 9, ev: 'PWM TC = MR0', fl: 'PWM1IR bit 0', en: 'PWM1MCR bit 0 = 1', clr: 'LPC_PWM1->IR = 1;', job: 'LPC_PWM1->MR4 += 50;', ch: 8 },
  { k: 'UART0', irq: 5, ev: 'a byte arrives on RxD0', fl: 'IIR = RDA (data ready)', en: 'U0IER bit 0 = 1', clr: 'c = LPC_UART0->RBR; // read clears', job: 'rx0_flag = 0xFF;', ch: 9 }
];
BUILD.push(function wM1() {
  const w = MW('w-m1', 'the interrupt machine', 'press ⚡ event · flip the ✓ switches · watch the marble');
  let per = M1_PER[0], mode = 'int', slow = 1, auto = false, nextAuto = 3;
  const G = { en: true, nvic: true, clr: true, name: true };
  const ctl = el('div', { class: 'm1-ctl' }); w.appendChild(ctl);
  const c1 = el('div', { class: 'col' }); ctl.appendChild(c1); c1.appendChild(el('span', { class: 'gae small' }, 'which peripheral rings the bell?'));
  chipGroup(c1, M1_PER.map((p, i) => [i, p.k]), 0, v => { per = M1_PER[+v]; reset(); });
  const c2 = el('div', { class: 'col' }); ctl.appendChild(c2); c2.appendChild(el('span', { class: 'gae small' }, 'how does the CPU find out?'));
  chipGroup(c2, [['int', '🔔 interrupt'], ['poll', '🚪 polling']], 'int', v => { mode = v; reset(); });
  ruler(ctl, 'slow motion', 1, 4, slow, 1, v => '×' + v, v => { slow = v; });

  const board = el('div', { class: 'm1-board' }); w.appendChild(board);
  const node = (cls, h) => { const n = el('div', { class: 'mn sk ' + cls }); n.innerHTML = `<div class="mn-h">${h}</div>`; board.appendChild(n); return n; };
  /* ① peripheral */
  const nP = node('m1-per', '<span class="step">1</span>peripheral <b class="pk"></b><a class="plink"></a>');
  const pEv = el('div', { class: 'small' }); nP.appendChild(pEv);
  const pFl = el('div', { class: 'small' }); nP.appendChild(pFl);
  const tEn = Tog(nP, '', true, v => { G.en = v; paintStatic(); });
  const pb = el('div', { class: 'row', style: 'gap:8px' }); nP.appendChild(pb);
  const bEv = el('button', { class: 'btn sm p', type: 'button' }, '⚡ event!'); pb.appendChild(bEv);
  const bAuto = el('button', { class: 'chip', type: 'button' }, 'auto'); pb.appendChild(bAuto);
  bEv.onclick = () => event(); bAuto.onclick = () => { auto = !auto; bAuto.classList.toggle('on', auto); nextAuto = 0.6; };
  /* ② NVIC */
  const nN = node('m1-nvic', '<span class="step">2</span>NVIC <span class="small p-faint">· 35 vectored IRQs</span>');
  const nPend = el('div', { class: 'small' }); nN.appendChild(nPend);
  const tNv = Tog(nN, '', true, v => { G.nvic = v; paintStatic(); });
  const nNote = el('div', { class: 'small p-soft' }); nN.appendChild(nNote);
  /* ③ CPU */
  const nC = node('m1-cpu', '<span class="step">3</span>CPU');
  nC.insertAdjacentHTML('beforeend', '<div class="reg1"><i>PC</i><b class="pcv"></b></div><div class="reg1"><i>running</i><b class="run"></b></div><div class="small gae">stack</div><div class="m1-pile"></div>');
  const pcv = $('.pcv', nC), runv = $('.run', nC), pile = $('.m1-pile', nC);
  /* ④ IVT */
  const nI = node('m1-ivt', '<span class="step">4</span>vector table (IVT)');
  const ivRows = el('div'); nI.appendChild(ivRows); const ivEq = el('div', { class: 'small' }); nI.appendChild(ivEq);
  /* ⑤ ISR */
  const nS = node('m1-isr', '<span class="step">5</span><span class="isrh">ISR</span>');
  const isrCode = MCode(nS); const sTog = el('div', { class: 'row', style: 'gap:6px' }); nS.appendChild(sTog);
  const tClr = Tog(sTog, 'ISR clears the flag', true, v => { G.clr = v; paintStatic(); });
  const tNm = Tog(sTog, '', true, v => { G.name = v; reset(); });
  /* main */
  const nM = node('m1-main', '<span class="step">0</span>main() — the normal program');
  const mainCode = MCode(nM); const mStat = el('div', { class: 'small p-soft' }); nM.appendChild(mStat);

  const log = el('div', { class: 'say m1-log' }); w.appendChild(log);
  const stats = el('div', { class: 'm1-stats' }); w.appendChild(stats);
  const bRow = el('div', { class: 'row mt' }); w.appendChild(bRow);
  const bReset = el('button', { class: 'btn sm g', type: 'button' }, '⟲ reset the board'); bRow.appendChild(bReset); bReset.onclick = () => reset();
  bRow.appendChild(el('span', { class: 'small p-faint' }, 'Hardware steps ①→⑤ are shown in slow motion — really they take about 12 clock cycles.'));

  /* rails */
  const WR = Wires(board);
  const rReq = WR.add(nP, nN, { draw: railDraw }), rAcc = WR.add(nN, nC, { draw: railDraw }), rFet = WR.add(nC, nI, { draw: railDraw }), rJmp = WR.add(nI, nS, { draw: railDraw }), rRet = WR.add(nS, nM, { draw: railDraw });
  const marble = sv('circle', { r: 8, class: 'marble', style: 'display:none' }, WR.front);

  /* program text */
  const handler = () => (per.name || per.k) + '_IRQHandler';
  const MAIN_INT = () => ['int main(void)', '{', '    setup();', `    NVIC_EnableIRQ(${per.name || per.k}_IRQn);`, '    while(1)', '    {', '        read_switches();', '        update_display();', '        count++;', '    }', '}'];
  const MAIN_POLL = () => ['int main(void)', '{', '    setup();', '    while(1)', '    {', '        read_switches();', '        update_display();', '        count++;', '        if(flag_is_set())   // "done yet?"', '            handle_it();', '    }', '}'];
  const WORK = { int: [6, 7, 8], poll: [5, 6, 7, 8] };
  const ISR_L = () => {
    if (mode === 'poll') return ['void handle_it(void)', '{', '    ' + per.clr, '    ' + per.job, '}   // back into the loop'];
    if (S.hang) return ['void Default_Handler(void)', '{', '    while(1);   // stuck here forever', '}'];
    return [`void ${G.name ? handler() : (per.k[0] + per.k.slice(1).toLowerCase()) + '_ISR'}(void)`, '{', '    ' + (G.clr ? per.clr : '/* forgot to clear the flag! */'), '    ' + per.job, '}   // return'];
  };

  let S;
  function reset() {
    S = { ph: 'idle', t: 0, ml: 0, mt: 0, loops: 0, stack: [], pend: 0, flag: 0, il: -1, runs: 0, storm: 0, hang: 0, evAt: null, lines: 0, react: null, checks: 0, wasted: 0, msg: '' };
    mainCode.set(mode === 'int' ? MAIN_INT() : MAIN_POLL()); isrCode.set(ISR_L());
    paintStatic(); say(mode === 'int' ? 'Main is busy with its own work. Press <b>⚡ event!</b> — the peripheral will ring the bell.' : 'Polling: no bell. Main must keep asking "done yet?" in its loop. Press <b>⚡ event!</b>');
  }
  function say(h) { log.innerHTML = h; }
  function paintStatic() {
    const N = 16 + per.irq, nm = per.name || per.k;
    $('.pk', nP).textContent = per.k; const a = $('.plink', nP); a.href = '#c' + per.ch; a.textContent = 'ch. ' + per.ch + ' ↗';
    pEv.innerHTML = `event: <b>${per.ev}</b>`;
    tEn.label(`peripheral may interrupt: <code>${per.en}</code>`); tEn.set(G.en);
    tNv.label(`<code>NVIC_EnableIRQ(<wbr>${nm}_IRQn)</code>`); tNv.set(G.nvic);
    tNm.label(`ISR named <code>${handler()}</code>`); tNm.set(G.name); tClr.set(G.clr);
    $('.isrh', nS).textContent = mode === 'poll' ? 'handle_it() — a normal function' : 'ISR — runs only when the bell rings';
    const rows = [N - 1, N, N + 1].map(n => { const irq = n - 16, nm2 = IRQ_NAMES[irq] || '…'; const me = n === N; const vec = me && !G.name ? 'Default_Handler ✗' : nm2 + '_IRQHandler'; return `<div class="ivtrow${me ? ' me' : ''}${me && S && ['fetch', 'jump'].includes(S.ph) ? ' hit' : ''}${me && !G.name ? ' bad' : ''}"><span class="mono">${hex(4 * n)}</span><i>N=${n}</i><b>${vec}</b></div>`; });
    ivRows.innerHTML = '<div class="ivtrow"><span class="mono">0x00000000</span><i>N=0</i><b>(start of table)</b></div><div class="small center p-faint">⋮</div>' + rows.join('');
    ivEq.innerHTML = `${nm} = IRQ ${per.irq} → N = 16 + ${per.irq} = <b>${N}</b><br>address = base + 4 × ${N} = <b>${hx(4 * N)}</b>`;
    [nN, nI].forEach(n => n.classList.toggle('off', mode === 'poll'));
    tEn.el.style.display = tNv.el.style.display = tNm.el.style.display = mode === 'poll' ? 'none' : '';
    [rReq, rAcc, rFet, rJmp].forEach(r => r.g.classList.toggle('dead', mode === 'poll'));
    isrCode.set(ISR_L());
  }
  function event() {
    if (S.hang) { say('The CPU is stuck in <code>Default_Handler</code> — press <b>⟲ reset the board</b>.'); return; }
    if (S.flag && mode === 'poll') { say('The flag is already set — main hasn\'t noticed yet!'); return; }
    S.flag = 1; S.evAt = 1; S.lines = 0;
    if (mode === 'poll') { say(`Event! <b>${per.fl}</b> = 1. Nobody tells the CPU — it will only notice when main reaches the <code>if(flag_is_set())</code> line.`); return; }
    if (!G.en) { S.flag = 0; S.evAt = null; say(`Event happened, but the peripheral was <b>not allowed to interrupt</b> (${per.en} is off) → no request reaches the NVIC. Nothing happens.`); flash(nP); return; }
    if (S.ph === 'idle' || S.ph === 'wait') { if (S.ph === 'idle') go('req'); }
  }
  function flash(n) { n.classList.add('hot'); setTimeout(() => n.classList.remove('hot'), 600); }
  const DUR = { req: .55, acc: .5, fet: .55, jmp: .55, isr: .5, ret: .5 };
  function go(ph) {
    S.ph = ph; S.t = 0; const N = 16 + per.irq, nm = per.name || per.k;
    if (ph === 'req') say(`${per.ev} → <b>${per.fl} = 1</b> → an interrupt request travels to the NVIC.`);
    if (ph === 'wait') say(`The NVIC has <b>not</b> been told to accept ${nm} (no <code>NVIC_EnableIRQ</code>) → the request waits as <b>pending</b>. Main carries on. (Flip the switch on and watch.)`);
    if (ph === 'acc') { S.pend = 0; S.stack.push(`return → line ${WORK.int[S.ml] + 1}`); say(S.storm ? `The flag is <b>still set</b> → the NVIC takes it again at once (<b>#${S.runs + 1}</b>)…` : `NVIC accepts. The CPU finishes its current instruction and <b>pushes the return address</b> (main, line ${WORK.int[S.ml] + 1}) on the stack.`); }
    if (ph === 'fet') say(`Look up the vector: memory[${hx(0)} + 4 × ${N}] = memory[<b>${hx(4 * N)}</b>] = ${G.name ? 'the address of <code>' + handler() + '</code>' : '<span class="p-red">the address of <code>Default_Handler</code> — no function called ' + handler() + ' exists!</span>'}`);
    if (ph === 'jmp') { if (!G.name) { S.hang = 1; } say(G.name ? 'Load that address into the <b>PC</b> → the CPU is now running the ISR.' : '<span class="p-red">PC = Default_Handler → <code>while(1);</code> → the program hangs. The ISR name must be spelled exactly!</span>'); isrCode.set(ISR_L()); }
    if (ph === 'isr') { S.il = 0; S.runs++; }
    if (ph === 'ret') { say(`Return: <b>pop</b> the saved address into the PC → main continues at line ${WORK.int[S.ml] + 1}, exactly where it stopped.`); }
  }
  const lineLen = () => .5 * slow;
  const lp = Loop(w, dt => {
    if (auto && !S.hang) { nextAuto -= dt; if (nextAuto <= 0) { nextAuto = (2.5 + Math.random() * 3) * slow; if (!S.flag) event(); } }
    const D = k => DUR[k] * slow * (S.storm ? Math.max(.1, Math.pow(.55, S.storm)) : 1);
    let inMain = mode === 'poll' ? !(S.ph === 'pisr') : (S.ph === 'idle' || S.ph === 'req' || S.ph === 'wait');
    if (S.hang) inMain = false;
    // main program advances while the CPU is in main
    if (inMain) {
      S.mt += dt; const W_ = WORK[mode];
      if (S.mt >= lineLen()) {
        S.mt = 0; S.ml = (S.ml + 1) % W_.length; if (S.ml === 0) S.loops++;
        if (S.evAt) S.lines++;
        if (mode === 'poll' && W_[S.ml] === 8) { S.checks++; if (S.flag) { S.ph = 'pisr'; S.t = 0; S.il = 2; S.react = S.lines; say(`Main reached the check: flag is set → <b>handle it now</b> (it waited ${S.lines} lines of main).`); } else { S.wasted++; say(`Main checks the flag… not set. A <b>wasted check</b> (#${S.wasted}).`); } }
      }
    }
    S.t += dt;
    if (mode === 'poll' && S.ph === 'pisr') { if (S.t > lineLen()) { S.t = 0; S.il++; if (S.il === 3) { S.flag = 0; } if (S.il > 4) { S.ph = 'idle'; S.il = -1; S.evAt = null; S.runs++; S.ml = (S.ml + 1) % WORK.poll.length; } } }
    if (mode === 'int') {
      if (S.ph === 'req' && S.t > D('req')) { S.pend = 1; go(G.nvic ? 'acc' : 'wait'); }
      else if (S.ph === 'wait' && G.nvic) go('acc');
      else if (S.ph === 'acc' && S.t > D('acc')) go('fet');
      else if (S.ph === 'fet' && S.t > D('fet')) go('jmp');
      else if (S.ph === 'jmp' && S.t > D('jmp')) { if (S.hang) { S.ph = 'hang'; S.il = 2; } else go('isr'); }
      else if (S.ph === 'isr') {
        if (S.t > D('isr')) { S.t = 0; S.il++; if (S.il === 3) go('ret'); }
        if (S.il === 2 && G.clr && S.flag) { S.flag = 0; S.pend = 0; if (!S.storm) say(`ISR line 1: <code>${per.clr}</code> → flag cleared. Then the job: <code>${per.job}</code>`); }
        if (S.il === 2 && !G.clr && !S.storm) say('<span class="p-red">The ISR never clears the flag…</span>');
      }
      else if (S.ph === 'ret' && S.t > D('ret')) {
        S.stack.pop();
        if (S.flag && !G.clr) { S.storm++; S.pend = 1; go('acc'); }
        else if (S.flag) { S.storm = 0; go('acc'); say('A new event arrived while the ISR was running → it was <b>pending</b>, so the CPU goes straight back in.'); }
        else { S.ph = 'idle'; S.il = -1; S.storm = 0; S.evAt = null; S.pend = 0; S.react = 0; }
      }
    }
    paint();
  });
  const inMainNow = () => !S.hang && (mode === 'poll' ? S.ph !== 'pisr' : ['idle', 'req', 'wait'].includes(S.ph));
  function paint() {
    const ph = S.ph;
    const W_ = WORK[mode];
    mainCode.hi(S.hang ? [] : [ph === 'pisr' ? 9 : W_[S.ml]], inMainNow() ? 'on' : 'bm');
    isrCode.hi(S.il >= 0 ? [S.il] : [], S.hang ? 'bad' : 'on');
    nPend.innerHTML = `<span class="lampd ${S.pend ? 'on' : ''}"></span> ${S.pend ? '<b>pending</b> — a request is waiting' : 'no request pending'}`;
    pFl.innerHTML = `<span class="lampd y ${S.flag ? 'on' : ''}"></span> flag <code>${per.fl}</code> = <b>${S.flag}</b>`;
    nNote.textContent = S.ph === 'wait' ? 'not enabled → it can only wait' : '';
    const inIsr = ['isr', 'ret'].includes(ph) || ph === 'jmp' || ph === 'hang' || ph === 'pisr';
    pcv.textContent = S.hang ? 'Default_Handler' : (ph === 'isr' || ph === 'jmp' ? handler() : ph === 'pisr' ? 'handle_it()' : 'main · line ' + (W_[S.ml] + 1));
    runv.innerHTML = S.hang ? '<span class="p-red">stuck ✗</span>' : inIsr ? '<span class="p-pink">ISR ⚡</span>' : '<span class="p-green">main</span>';
    const ph2 = S.stack.length ? S.stack.slice(-3).map(s => `<span>${s}</span>`).join('') : '<em>empty</em>'; if (pile._h !== ph2) { pile._h = ph2; pile.innerHTML = ph2; }
    // marble
    const seg = { req: rReq, acc: rAcc, fet: rFet, jmp: rJmp, ret: rRet }[ph];
    if (seg && mode === 'int') { const D = DUR[ph] * slow * (S.storm ? Math.max(.1, Math.pow(.55, S.storm)) : 1); const [x, y] = WR.at(seg, S.t / D); marble.setAttribute('cx', x); marble.setAttribute('cy', y); marble.style.display = ''; }
    else if (ph === 'wait') { const [x, y] = WR.at(rReq, 1); marble.setAttribute('cx', x); marble.setAttribute('cy', y); marble.style.display = ''; }
    else marble.style.display = 'none';
    [[rReq, 'req'], [rAcc, 'acc'], [rFet, 'fet'], [rJmp, 'jmp'], [rRet, 'ret']].forEach(([r, k]) => r.g.classList.toggle('lit', ph === k));
    $$('.ivtrow.me', nI).forEach(r => r.classList.toggle('hit', ph === 'fet' || ph === 'jmp'));
    nM.classList.toggle('hot', !inIsr && !S.hang); nS.classList.toggle('hot', inIsr);
    const starving = S.storm >= 1;
    mStat.innerHTML = `${S.hang ? '<span class="p-red">main is frozen — the CPU never comes back</span>' : starving ? '<span class="p-red">main is starved: the ISR runs again and again</span>' : `main loops done: <b>${S.loops}</b>`}`;
    stats.innerHTML = mode === 'int'
      ? `<span>ISR runs: <b>${S.runs}</b></span><span>reaction: <b>${S.react === 0 ? 'right after the current instruction' : '–'}</b></span><span>wasted checks: <b>0</b> (the bell tells the CPU)</span>`
      : `<span>checks: <b>${S.checks}</b></span><span>wasted checks: <b>${S.wasted}</b></span><span>last reaction: <b>${S.react != null ? 'waited ' + S.react + ' main lines' : '–'}</b></span>`;
  }
  reset(); lp.start();
});

/* ===================================================================
   M2 · chapter 2 in one widget — the timer-interrupt time machine
   =================================================================== */
const M2_PROG = {
  T1: { lab: 'T1 · 1 ms tick, blink every 1 s', mode: 'timer', PR: 0, MR0: 2999, MR0b: 500, I: 1, R: 1, S: 0, job: 'count', N: 1000, H: 3.2, fin: 2 },
  T2: { lab: 'T2 · interrupt every 4 edges', mode: 'counter', PR: 0, MR0: 3, MR0b: 1, I: 1, R: 1, S: 0, job: 'toggle', N: 1000, H: 8, fin: 2 },
  T3: { lab: 'T3 · 1.5 s HIGH, 0.5 s LOW', mode: 'timer', PR: 3000, MR0: 1500, MR0b: 500, I: 1, R: 0, S: 1, job: 'swap', N: 1000, H: 6, fin: 2 }
};
const M2_D = 10e-6; // one ISR ≈ 10 µs (for drawing)
function m2Sim(c) {
  const f = 3e6, tick = (c.PR + 1) / f, D = M2_D, H = c.H;
  const segs = [], steps = [[0, 0]], isr = [], edges = [], tog = [[0, c.job === 'swap' ? 1 : 0]];
  let pin = tog[0][1], ticks = 0, flag = 1, m = c.MR0, storm = null;
  const doIsr = ti => {
    if (c.job === 'count') { ticks++; if (ticks === c.N) { ticks = 0; pin ^= 1; tog.push([ti + D / 2, pin]); } }
    else if (c.job === 'toggle') { pin ^= 1; tog.push([ti + D / 2, pin]); }
    else { if (flag) { flag = 0; pin = 0; m = c.MR0b; } else { flag = 1; pin = 1; m = c.MR0; } tog.push([ti + D / 2, pin]); }
    isr.push({ t: ti, ticks, pin, flag, m });
    if (!c.clr) storm = { t: ti, ticks, pin };
  };
  if (c.mode === 'timer') {
    let t = 0, tc0 = 0;
    while (t < H && segs.length < 40000) {
      const mo = m, tm = t + (mo - tc0) * tick;
      if (mo < tc0 || tm >= H) { segs.push({ t0: t, t1: H, tc0, cap: Infinity }); break; }
      if (c.I && !storm) doIsr(tm);
      if (storm && c.job !== 'count') { segs.push({ t0: t, t1: tm + D, tc0, cap: mo }); if (c.job === 'swap') segs.push({ t0: tm + D, t1: H, tc0: 0, cap: 0 }); else segs.push({ t0: tm + D, t1: H, tc0: mo, cap: mo }); break; }
      if (c.job === 'swap' && c.I) { segs.push({ t0: t, t1: tm + D, tc0, cap: mo }); t = tm + D; tc0 = 0; continue; }
      if (c.R) { segs.push({ t0: t, t1: tm + tick, tc0, cap: mo }); t = tm + tick; tc0 = 0; }
      else if (c.S) { segs.push({ t0: t, t1: H, tc0, cap: mo, stop: 1 }); break; }
      else { segs.push({ t0: t, t1: H, tc0, cap: Infinity }); break; }
    }
  } else {
    const per = 1 / c.fin; let tc = 0, stopped = false;
    for (let j = 1; j * per - per / 2 < H; j++) {
      const te = j * per - per / 2; edges.push(te);
      if (stopped) continue;
      if (tc === m && c.R) tc = 0; else tc++;
      steps.push([te, tc]);
      if (tc === m) { if (c.I && !storm) doIsr(te); if (c.S) stopped = true; }
    }
  }
  // a storm in T1 keeps counting ticks every D → P0.2 toggles every N·D
  if (storm && c.job === 'count') { for (let k = c.N - storm.ticks; storm.t + k * D < H && tog.length < 5000; k += c.N) { pin ^= 1; tog.push([storm.t + k * D, pin]); } }
  if (storm) storm.blur = c.job !== 'count';
  return { c, tick, segs, steps, isr, edges, tog, storm, H, f };
}
function bsearch(arr, t, key = x => x) { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (key(arr[mid]) <= t) { r = mid; lo = mid + 1; } else hi = mid - 1; } return r; }
BUILD.push(function wM2() {
  const w = MW('w-m2', 'the timer-interrupt time machine', 'pick a program · drag the time cursor · zoom in on one interrupt');
  let pk = 'T1', c, sim, cur = 0, zoom = 1, play = false, rate = 1, micro = null, lastIsrSeen = -1;
  const top = el('div', { class: 'col mb' }); w.appendChild(top);
  const pg = el('div', { class: 'row' }); top.appendChild(pg); pg.appendChild(el('span', { class: 'gae' }, 'program:'));
  chipGroup(pg, Object.entries(M2_PROG).map(([k, p]) => [k, p.lab]), pk, v => { pk = v; load(); });
  const knobs = el('div', { class: 'm2-knobs' }); top.appendChild(knobs);
  const chain = el('div', { class: 'm2-chain' }); w.appendChild(chain);
  const tlWrap = el('div', { class: 'm2-tl' }); w.appendChild(tlWrap);
  const tl = sv('svg', { class: 'dg m2-svg', role: 'img', 'aria-label': 'timeline of the timer program' }); tlWrap.appendChild(tl);
  const bar = el('div', { class: 'row m2-bar' }); w.appendChild(bar);
  const bPlay = el('button', { class: 'btn sm y', type: 'button' }, '▶ play'); bar.appendChild(bPlay);
  const rc = el('div', { class: 'chips' }); bar.appendChild(rc);
  chipGroup(rc, [[1, 'real speed'], [0.1, '÷10'], [0.01, '÷100'], [0.001, '÷1000']], 1, v => { rate = +v; });
  const zc = el('div', { class: 'chips' }); bar.appendChild(zc); zc.appendChild(el('span', { class: 'gae small' }, '🔍'));
  const zg = chipGroup(zc, [[1, 'whole run'], [10, '×10'], [100, '×100'], [1000, '×1000']], 1, v => { zoom = +v; draw(); });
  const nav = el('div', { class: 'row m2-bar' }); w.appendChild(nav);
  const bPrev = el('button', { class: 'btn sm', type: 'button' }, '⏮ previous interrupt'), bNext = el('button', { class: 'btn sm p', type: 'button' }, 'next interrupt ⏭'), bIn = el('button', { class: 'btn sm l', type: 'button' }, 'step inside it ▸');
  nav.append(bPrev, bNext, bIn);
  const sp = el('div', { class: 'split mt' }); w.appendChild(sp);
  const ro = el('div', { class: 'col' }); sp.appendChild(ro);
  const kv = el('div', { class: 'm2-kv' }); ro.appendChild(kv);
  const story = el('div', { class: 'say' }); ro.appendChild(story);
  const maths = el('div', { class: 'small m2-maths' }); ro.appendChild(maths);
  const cd = el('div'); sp.appendChild(cd); const code = MCode(cd);

  function knob(lab, min, max, val, step, fmt, on) { return ruler(knobs, lab, min, max, val, step, fmt, v => { on(v); rebuild(); }); }
  function load() {
    c = Object.assign({}, M2_PROG[pk], { clr: 1 }); cur = 0; micro = null; zoom = 1; zg.set(1);
    knobs.innerHTML = '';
    if (c.mode === 'timer') knob('PR (prescale)', 0, 6000, c.PR, 1, v => v + '', v => c.PR = v);
    knob(pk === 'T3' ? 'MR0 · HIGH part' : 'MR0', pk === 'T2' ? 1 : 100, pk === 'T2' ? 9 : 6000, c.MR0, 1, v => v + '', v => c.MR0 = v);
    if (pk === 'T3') knob('MR0 · LOW part', 100, 6000, c.MR0b, 1, v => v + '', v => c.MR0b = v);
    if (pk === 'T2') knob('input edges per second', 0.5, 4, c.fin, 0.5, v => v + ' Hz', v => c.fin = v);
    const mc = el('div', { class: 'col' }); knobs.appendChild(mc); mc.appendChild(el('span', { class: 'gae small' }, 'MCR bits for MR0 (tap)'));
    const mr = el('div', { class: 'chips' }); mc.appendChild(mr);
    [['I', 'bit 0 · interrupt'], ['R', 'bit 1 · reset'], ['S', 'bit 2 · stop']].forEach(([k, t]) => { const b = el('button', { class: 'chip' + (c[k] ? ' on' : ''), type: 'button', style: '--cc:var(--n-b)' }, t); b.onclick = () => { c[k] ^= 1; b.classList.toggle('on', !!c[k]); rebuild(); }; mr.appendChild(b); });
    const cc = el('div', { class: 'col' }); knobs.appendChild(cc); cc.appendChild(el('span', { class: 'gae small' }, 'first line of the ISR'));
    chipGroup(cc, [[1, 'IR = 1; ✓'], [2, 'IR = 0;'], [0, '(forgot it)']], 1, v => { c.clr = +v === 1 ? 1 : 0; c.clrTxt = +v; rebuild(); });
    c.clrTxt = 1; rebuild();
  }
  function rebuild() { sim = m2Sim(c); cur = clamp(cur, 0, c.H); micro = null; genCode(); draw(); }
  const CODE = () => {
    const clrL = c.clrTxt === 1 ? '    LPC_TIM0->IR = 1;           // clear the MR0 flag' : c.clrTxt === 2 ? '    LPC_TIM0->IR = 0;           // writes 0: NO effect!' : '    /* (flag never cleared) */';
    const job = c.job === 'count' ? ['    ticks++;', `    if(ticks == ${c.N}) { ticks = 0; toggle P0.2; }`] : c.job === 'toggle' ? ['    toggle P0.2;', ''] : ['    if(flag) { flag=0; reset; P0.2=0; MR0=' + c.MR0b + '; start; }', '    else     { flag=1; reset; P0.2=1; MR0=' + c.MR0 + '; start; }'];
    const mcr = c.I | c.R << 1 | c.S << 2;
    return ['void TIMER0_IRQHandler(void)', '{', clrL, ...job, '}',
      'void init_timer0(void)', '{', `    LPC_TIM0->CTCR = ${c.mode === 'timer' ? '0x00;           // timer mode' : '0x05;           // count CAP0.1 rising'}`,
      `    LPC_TIM0->PR   = ${c.PR};`, `    LPC_TIM0->MR0  = ${c.MR0};`, `    LPC_TIM0->MCR  = ${hx(mcr, 2)};           // ${[c.I && 'I', c.R && 'R', c.S && 'S'].filter(Boolean).join(' + ') || 'nothing'}`, '    LPC_TIM0->TCR  = 0x01;           // go', '}',
      'int main(void)', '{', '    init_timer0();  NVIC_EnableIRQ(TIMER0_IRQn);', pk === 'T1' ? '    while(1) P2.0 = P1.0;           // copy the switch' : '    while(1);                       // main does nothing', '}'];
  };
  let codeLines = [];
  function genCode() { codeLines = CODE(); code.set(codeLines); }
  const fmtD = d => d < 1e-6 ? +(d * 1e9).toPrecision(3) + ' ns' : d < 1e-3 ? +(d * 1e6).toPrecision(3) + ' µs' : d < 1 ? +(d * 1e3).toPrecision(4) + ' ms' : +d.toPrecision(4) + ' s';
  const fmtT = (t, span, n = 1) => { const s = span ?? c.H, [u, k] = s < 0.004 ? ['µs', 1e6] : s < 0.4 ? ['ms', 1e3] : ['s', 1]; const step = s * k / n, dec = clamp(1 - Math.floor(Math.log10(step) + 1e-9), 0, 3); return (t * k).toFixed(dec) + ' ' + u; };
  function stateAt(t) {
    const S = { t };
    if (c.mode === 'timer') { const i = bsearch(sim.segs, t, s => s.t0); const s = sim.segs[Math.max(0, i)]; const n = Math.floor((t - s.t0) / sim.tick + 1e-9); S.tc = Math.min(s.cap, s.tc0 + n); S.pc = Math.floor(((t - s.t0) % sim.tick) * sim.f + 1e-6) % (c.PR + 1); S.stopped = s.stop && S.tc >= s.cap; }
    else { const i = bsearch(sim.steps, t, s => s[0]); S.tc = sim.steps[Math.max(0, i)][1]; S.edges = bsearch(sim.edges, t) + 1; }
    const k = bsearch(sim.isr, t, x => x.t); S.k = k; const e = k >= 0 ? sim.isr[k] : null;
    S.n = k + 1; S.ticks = e ? e.ticks : 0; S.flag = e ? e.flag : 1; S.mr0 = e ? e.m : c.MR0;
    S.inIsr = !!(e && t < e.t + M2_D) || !!(sim.storm && t >= sim.storm.t);
    S.ir = (e && t < e.t + M2_D * .3) || (sim.storm && t >= sim.storm.t) ? 1 : 0;
    const p = bsearch(sim.tog, t, x => x[0]); S.pin = sim.tog[Math.max(0, p)][1]; S.blur = sim.storm && sim.storm.blur && t >= sim.storm.t;
    if (sim.storm && t >= sim.storm.t) { S.n = (k + 1) + Math.floor((t - sim.storm.t) / M2_D); if (c.job === 'count') S.ticks = (sim.storm.ticks + Math.floor((t - sim.storm.t) / M2_D)) % c.N; }
    S.sw = swAt(t); S.cp = sim.storm && t > sim.storm.t ? swAt(sim.storm.t) : S.sw;
    return S;
  }
  const SW = [[0, 0], [.22, 1], [.5, 0], [.78, 1]]; const swAt = t => { let v = 0; SW.forEach(([f, l]) => { if (t >= f * c.H) v = l; }); return v; };
  function win() { const span = c.H / zoom; let a = cur - span / 2; a = clamp(a, 0, c.H - span); return [a, a + span]; }
  function draw() {
    const Wd = Math.max(280, Math.round(tlWrap.clientWidth || 600)), narrow = Wd < 520, LW = narrow ? 58 : 84, R = Wd - 10;
    const [a, b] = win(), X = t => LW + (t - a) / (b - a) * (R - LW), px = (R - LW) / (b - a);
    const tr = []; if (c.mode === 'counter') tr.push(['in', 'P1.27 in', 30]); tr.push(['tc', 'TC', 62], ['ir', 'IR bit 0', 20], ['cpu', 'CPU', 22], ['pin', 'P0.2', 30]); if (pk === 'T1') tr.push(['sw', 'P1.0', 18], ['cp', 'P2.0', 18]);
    let y = 22; const Y = {}; tr.forEach(([k, , h]) => { Y[k] = [y, h]; y += h + 12; }); const Hh = y + 14;
    tl.setAttribute('viewBox', `0 0 ${Wd} ${Hh}`); tl.setAttribute('height', Hh);
    let s = '';
    tr.forEach(([k, lab, h], i) => { const [y0] = Y[k]; s += `<rect x="${LW}" y="${y0 - 4}" width="${R - LW}" height="${h + 8}" rx="4" style="fill:${i % 2 ? 'var(--faint2)' : 'transparent'}"/><text x="4" y="${y0 + h / 2 + 5}" class="lbl" style="font-size:${narrow ? 12 : 14}px">${lab}</text>`; });
    // time axis
    const nT = narrow ? 3 : 6; for (let i = 0; i <= nT; i++) { const t = a + (b - a) * i / nT; s += `<path d="M${X(t).toFixed(1)} 16 V${Hh - 16}" style="stroke:var(--faint);stroke-dasharray:2 4"/><text x="${X(t).toFixed(1)}" y="${Hh - 2}" text-anchor="${i === 0 ? 'start' : i === nT ? 'end' : 'middle'}" class="mono" style="font-size:11px;fill:var(--ink3)">${fmtT(t, b - a, nT)}</text>`; }
    // input edges (counter)
    if (Y.in) { const [y0, h] = Y.in, per = 1 / c.fin; let d = `M${X(a)} ${y0 + h}`; sim.edges.forEach(te => { if (te + per / 2 < a || te > b) return; d += `H${X(Math.max(a, te)).toFixed(1)}V${y0}H${X(Math.min(b, te + per / 2)).toFixed(1)}V${y0 + h}`; }); d += `H${R}`; s += `<path d="${d}" style="fill:none;stroke:var(--teal);stroke-width:2.2"/>`; }
    // TC
    { const [y0, h] = Y.tc; let vmax = c.mode === 'timer' ? Math.max(c.MR0, c.job === 'swap' ? c.MR0b : 0) : Math.max(c.MR0, ...sim.steps.map(x => x[1])); const vis = sim.segs.filter(sg => sg.t1 > a && sg.t0 < b);
      vis.forEach(sg => { if (sg.cap === Infinity) vmax = Math.max(vmax, sg.tc0 + (Math.min(b, sg.t1) - sg.t0) / sim.tick); });
      const YV = v => y0 + h - Math.min(1, v / Math.max(1, vmax)) * h;
      s += `<text x="${R}" y="${y0 - 6}" text-anchor="end" class="mono" style="font-size:10.5px;fill:var(--ink3)">top = ${Math.round(vmax)}</text>`;
      if (c.mode === 'timer') {
        if (vis.length > (R - LW) / 3) { s += `<rect x="${X(Math.max(a, vis[0].t0))}" y="${YV(vmax)}" width="${X(Math.min(b, vis[vis.length - 1].t1)) - X(Math.max(a, vis[0].t0))}" height="${h}" style="fill:url(#hatch-b);stroke:var(--blue);stroke-width:1"/>`; }
        else { let d = ''; vis.forEach(sg => { const tp = sim.tick * px; const tEnd = Math.min(sg.t1, b), tStart = Math.max(sg.t0, a); const vAt = t => Math.min(sg.cap, sg.tc0 + Math.floor((t - sg.t0) / sim.tick + 1e-9));
            if (tp > 3 && (tEnd - tStart) / sim.tick < 600) { let t = tStart; d += `M${X(t).toFixed(1)} ${YV(vAt(t)).toFixed(1)}`; while (t < tEnd) { const nt = Math.min(tEnd, sg.t0 + (Math.floor((t - sg.t0) / sim.tick + 1e-9) + 1) * sim.tick); d += `H${X(nt).toFixed(1)}V${YV(vAt(Math.min(nt + 1e-12, tEnd))).toFixed(1)}`; t = nt; if (nt >= tEnd) break; } }
            else { const tc = sg.cap === Infinity ? tEnd : Math.min(tEnd, sg.t0 + (sg.cap - sg.tc0) * sim.tick); d += `M${X(tStart).toFixed(1)} ${YV(vAt(tStart)).toFixed(1)}L${X(Math.max(tStart, tc)).toFixed(1)} ${YV(vAt(Math.max(tStart, tc))).toFixed(1)}H${X(tEnd).toFixed(1)}`; } });
          s += `<path d="${d}" style="fill:none;stroke:var(--blue);stroke-width:2"/>`; }
      } else { let d = ''; const st = sim.steps; for (let i = 0; i < st.length; i++) { const t0 = Math.max(a, st[i][0]), t1 = Math.min(b, i + 1 < st.length ? st[i + 1][0] : c.H); if (t1 < a || t0 > b) continue; d += `${d ? 'L' : 'M'}${X(t0).toFixed(1)} ${YV(st[i][1]).toFixed(1)}H${X(t1).toFixed(1)}`; } s += `<path d="${d}" style="fill:none;stroke:var(--blue);stroke-width:2.2"/>`;
        st.forEach(([t, v]) => { if (t >= a && t <= b && px * (1 / c.fin) > 26) s += `<text x="${X(t) + 3}" y="${YV(v) - 3}" class="mono" style="font-size:10.5px;fill:var(--blue)">${v}</text>`; }); }
      s += `<path d="M${LW} ${YV(c.MR0)} H${R}" style="stroke:var(--pink);stroke-width:1.2;stroke-dasharray:5 4"/><text x="${R - 70}" y="${YV(c.MR0) + 12}" text-anchor="end" class="mono" style="font-size:10.5px;fill:var(--pink)">MR0 = ${c.MR0}</text>`;
    }
    // IR & CPU tracks
    const isrV = sim.isr.filter(e => e.t >= a - M2_D && e.t <= b); const dense = isrV.length > (R - LW) / 3;
    [['ir', 'var(--orange)'], ['cpu', 'var(--pink)']].forEach(([k, col]) => { const [y0, h] = Y[k];
      if (k === 'cpu') s += `<rect x="${LW}" y="${y0 + h / 2 - 3}" width="${R - LW}" height="6" rx="3" style="fill:var(--hl-g)"/>`;
      if (dense) s += `<rect x="${X(Math.max(a, isrV[0].t))}" y="${y0}" width="${Math.max(2, X(isrV[isrV.length - 1].t) - X(Math.max(a, isrV[0].t)))}" height="${h}" style="fill:url(#hatch-${k === 'ir' ? 'y' : 'p'})"/>`;
      else isrV.forEach(e => { const x = X(e.t), wd = Math.max(2.5, M2_D * (k === 'ir' ? .3 : 1) * px); s += `<rect x="${x.toFixed(1)}" y="${y0}" width="${wd.toFixed(1)}" height="${h}" rx="1" style="fill:${col}"/>`; if (k === 'cpu' && isrV.length < 40) s += `<text x="${(x + wd / 2).toFixed(1)}" y="${y0 - 1}" text-anchor="middle" style="font-size:11px">⚡</text>`; });
      if (sim.storm && sim.storm.t < b) { const x0 = X(Math.max(a, sim.storm.t)); s += `<rect x="${x0}" y="${y0}" width="${R - x0}" height="${h}" style="fill:${col};opacity:.85"/>`; if (k === 'cpu') s += `<text x="${(x0 + R) / 2}" y="${y0 + h - 5}" text-anchor="middle" class="lbl" style="font-size:12px;fill:#fff">ISR again and again — main never runs</text>`; } });
    // P0.2 + switch/copy
    const wave = (k, pts, col, blurFrom) => { const [y0, h] = Y[k]; const v = pts.filter((p, i) => (i + 1 < pts.length ? pts[i + 1][0] : 1e9) >= a && p[0] <= b).map(p => [Math.max(a, p[0]), p[1]]); if (!v.length) return; if (v.length > (R - LW) / 2) { s += `<rect x="${X(v[0][0])}" y="${y0}" width="${R - X(v[0][0])}" height="${h}" style="fill:url(#hatch-p)"/>`; return; } s += `<path d="${digi(v.concat([[b, v[v.length - 1][1]]]), X, y0, y0 + h)}" style="fill:none;stroke:${col};stroke-width:2.4"/>`; if (blurFrom != null && blurFrom < b) { const x0 = X(Math.max(a, blurFrom)); s += `<rect x="${x0}" y="${y0}" width="${R - x0}" height="${h}" style="fill:url(#hatch-p);stroke:var(--red)"/><text x="${(x0 + R) / 2}" y="${y0 + h / 2 + 5}" text-anchor="middle" class="lbl" style="font-size:12px;fill:var(--red)">toggling ~100 000× a second</text>`; } };
    wave('pin', sim.tog, 'var(--red)', sim.storm && sim.storm.blur ? sim.storm.t : null);
    if (Y.sw) { const swP = SW.map(([f, l]) => [f * c.H, l]); wave('sw', swP, 'var(--ink2)'); const cpP = sim.storm ? swP.filter(p => p[0] <= sim.storm.t).concat([[sim.storm.t, swAt(sim.storm.t)]]) : swP; wave('cp', cpP, 'var(--green)'); }
    // cursor
    const xc = X(cur); s += `<path d="M${xc} 8 V${Hh - 14}" style="stroke:var(--purple);stroke-width:2.2"/><circle cx="${xc}" cy="10" r="9" style="fill:var(--n-l);stroke:var(--ink);stroke-width:1.6"/><path d="M${xc} 10 V5 M${xc} 10 L${xc + 4} 12" style="stroke:var(--ink);stroke-width:1.5;stroke-linecap:round"/>`;
    tl.innerHTML = s;
    readout();
  }
  function chainItems(S, ph) {
    const tm = c.mode === 'timer';
    const it = tm ? [['PCLK', '3 MHz'], ['÷ (PR+1)', '÷ ' + (c.PR + 1)], ['TC', S.tc]] : [['P1.27 edges', S.edges ?? 0], ['CTCR', '0x05 count ↑'], ['TC', S.tc]];
    it.push(['TC = MR0?', 'MR0 = ' + S.mr0], ['MCR', [c.I && 'I', c.R && 'R', c.S && 'S'].filter(Boolean).join('+') || '–'], ['IR bit 0', S.ir], ['NVIC', 'TIMER0 ✓'], ['ISR', S.inIsr ? 'running ⚡' : 'idle'], ['P0.2', S.blur ? '???' : S.pin]);
    return it.map(([k, v], i) => `<span class="m2-ci${ph != null && i >= (tm ? 3 : 3) && i <= 3 + ph ? ' on' : ''}${S.inIsr && ph == null && i >= 3 ? ' on' : ''}"><i>${k}</i><b>${v}</b></span>`).join('<em>→</em>');
  }
  const MICRO = ['TC reaches MR0 → <b>match</b>.', 'MCR bit 0 = 1 → hardware sets <b>IR bit 0 = 1</b> → interrupt request.', 'NVIC: TIMER0 enabled → save return address, jump to <code>TIMER0_IRQHandler</code>.', 'ISR line 1: <code>LPC_TIM0->IR = 1;</code> → writing 1 <b>clears</b> bit 0.', 'ISR does its job.', 'Return → main continues where it was.'];
  function readout() {
    let S = stateAt(cur); const tm = c.mode === 'timer';
    if (micro != null) { S = stateAt(sim.isr[S.k]?.t ?? cur); if (micro < 4) { const prev = S.k > 0 ? sim.isr[S.k - 1] : null; S.ticks = prev ? prev.ticks : 0; S.flag = prev ? prev.flag : 1; S.pin = prev ? prev.pin : sim.tog[0][1]; S.mr0 = prev ? prev.m : c.MR0; } S.ir = micro >= 1 && (micro < 3 || !c.clr) ? 1 : 0; S.inIsr = micro >= 2 && micro < 5; }
    chain.innerHTML = chainItems(S, micro);
    const ln = (i, ok = true) => code.hi(i, ok ? 'on' : 'bad');
    if (S.inIsr) { if (micro == null || micro === 2) ln(0); else if (micro === 3) ln(2, c.clr); else ln([3, 4]); } else ln(codeLines.length - 2);
    const rows = [['time', fmtT(cur, c.H / zoom, 1000)], tm && ['PC (prescale)', `${S.pc} of 0…${c.PR}`], ['TC', `<b>${S.tc}</b>${S.stopped ? ' (stopped: MCR stop bit)' : ''}`], ['MR0', S.mr0], ['IR bit 0', S.ir ? '<b class="p-red">1 — interrupt flag set</b>' : '0'], ['CPU', S.inIsr ? '<b class="p-pink">TIMER0_IRQHandler ⚡</b>' : '<span class="p-green">main()</span>'], c.job === 'count' && ['ticks', S.ticks], c.job === 'swap' && ['flag', S.flag], !tm && ['edges counted', S.edges], ['P0.2 (LED)', S.blur ? '<span class="p-red">a blur</span>' : `<span class="led ${S.pin ? 'on' : ''}" style="width:16px;height:16px"></span> ${S.pin}`], ['interrupts so far', S.n]].filter(Boolean);
    kv.innerHTML = rows.map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
    // story
    let st;
    if (micro != null) st = `<b>inside interrupt #${S.k + 1}</b> · step ${micro + 1}/6: ${MICRO[micro]}${micro === 3 && !c.clr ? ' <span class="p-red">— but this ISR doesn\'t clear it! The flag stays 1 → the ISR will run again immediately.</span>' : ''}`;
    else if (sim.storm && cur >= sim.storm.t) st = `<span class="p-red">The ISR ${c.clrTxt === 2 ? 'writes 0 to IR (no effect)' : 'never clears IR'} → IR bit 0 stays 1 → the NVIC re-enters the ISR forever. Main is starved${pk === 'T1' ? ' — P2.0 stops following the switch' : ''}.</span>`;
    else if (!c.I) st = 'MCR bit 0 = 0: the match still happens, but <b>no interrupt</b> is requested → the ISR never runs.';
    else if (sim.isr.length === 0) st = 'No match within this run — TC never reaches MR0 (check MR0 / reset / stop).';
    else st = S.inIsr ? 'The CPU is inside the ISR right now.' : `Main is running. ${S.n ? `Last interrupt: #${S.n} at ${fmtT(sim.isr[S.k].t)}.` : 'Waiting for the first match.'}`;
    story.innerHTML = st;
    const per = c.mode === 'timer' ? (c.R ? (c.MR0 + 1) * (c.PR + 1) / 3e6 : c.MR0 * (c.PR + 1) / 3e6) : 4 / c.fin;
    maths.innerHTML = c.mode === 'timer' ? `one TC step = (PR+1) / 3 MHz = ${fmtD((c.PR + 1) / 3e6)} · ${c.job === 'swap' ? `HIGH = ${c.MR0} steps ≈ ${fmtD(c.MR0 * (c.PR + 1) / 3e6)}, LOW = ${c.MR0b} steps ≈ ${fmtD(c.MR0b * (c.PR + 1) / 3e6)}` : `${c.R ? `match every (MR0+1) = ${c.MR0 + 1} steps = <b>${fmtD(per)}</b>` : `first match after MR0 steps = ${fmtD(per)}${c.S ? ', then the timer stops' : ', then TC runs on past MR0 (no reset)'}`}${c.job === 'count' && c.R ? ` → P0.2 toggles every ${c.N} × that = <b>${fmtD(per * c.N)}</b>` : ''}`}` : `TC counts rising edges: 1, 2, ${c.MR0} (match!) then reset → one interrupt every ${c.MR0 + 1} edges = every ${(c.MR0 + 1) / c.fin} s`;
  }
  // scrubbing
  let drag = null;
  tl.addEventListener('pointerdown', e => { const r = tl.getBoundingClientRect(); drag = { x: e.clientX, cur }; play = false; bPlay.textContent = '▶ play'; micro = null; tl.setPointerCapture(e.pointerId); if (zoom === 1) setFromX(e.clientX); });
  tl.addEventListener('pointermove', e => { if (!drag) return; if (zoom === 1) setFromX(e.clientX); else { const r = tl.getBoundingClientRect(), Wd = r.width, LW = Wd < 520 ? 58 : 84; cur = clamp(drag.cur - (e.clientX - drag.x) / (Wd - LW - 10) * (c.H / zoom), 0, c.H); draw(); } });
  tl.addEventListener('pointerup', () => drag = null); tl.addEventListener('pointercancel', () => drag = null);
  function setFromX(cx) { const r = tl.getBoundingClientRect(), Wd = r.width, LW = Wd < 520 ? 58 : 84; const [a, b] = win(); cur = clamp(a + (cx - r.left - LW) / (Wd - LW - 10) * (b - a), 0, c.H); draw(); }
  bPlay.onclick = () => { play = !play; micro = null; if (play && cur >= c.H - 1e-6) cur = 0; bPlay.textContent = play ? '❚❚ pause' : '▶ play'; };
  const jump = dir => { play = false; bPlay.textContent = '▶ play'; const k = bsearch(sim.isr, cur - 1e-9, x => x.t); let j = dir > 0 ? (micro != null ? k + 1 : bsearch(sim.isr, cur + 1e-9, x => x.t) + 1) : (micro != null ? k - 1 : k); if (dir > 0 && micro == null && k >= 0 && Math.abs(sim.isr[k].t - cur) < 1e-9) j = k + 1; if (j < 0 || j >= sim.isr.length) { story.innerHTML = dir > 0 ? 'No more interrupts in this run.' : 'This is the first one.'; return; } cur = sim.isr[j].t; micro = 0; if (zoom < 100) { zoom = 100; zg.set(100); } draw(); };
  bNext.onclick = () => jump(1); bPrev.onclick = () => jump(-1);
  bIn.onclick = () => { if (micro == null) { const k = bsearch(sim.isr, cur + 1e-9, x => x.t); if (k < 0) { jump(1); return; } cur = sim.isr[k].t; micro = 0; } else micro = (micro + 1) % 6; draw(); };
  new ResizeObserver(() => draw()).observe(tlWrap);
  const lp = Loop(w, dt => { if (!play) return; cur += dt * rate; if (cur >= c.H) { cur = c.H; play = false; bPlay.textContent = '▶ play'; } draw(); });
  load(); lp.start();
});

/* ===================================================================
   M3 · chapter 3 in one widget — probe the EINT board
   =================================================================== */
BUILD.push(function wM3() {
  const w = MW('w-m3', 'probe the EINT board', 'press the inputs · set the switches inside the chip · clip probes on the test points ◉');
  const DEV = [{ k: 'push', lab: 'button' }, { k: 'toggle', lab: 'switch' }, { k: 'push', lab: 'button' }, { k: 'gen', lab: 'signal gen.' }];
  const ACT = [['toggle', 'toggle LED'], ['pulse', 'LED on · wait · off'], ['count', 'just count']];
  const ch = [0, 1, 2, 3].map(x => ({ x, sel: 0, mode: 1, pol: 0, nvic: 1, act: 'toggle', lvl: 1, prev: 1, flag: 0, runs: 0, dev: DEV[x], down: false, gen: false, pend: 0 }));
  let clr = true, led = 0, ledAvg = 0, T = 0, isr = null, probes = [{ x: 2, k: 'pin' }, { x: -1, k: 'led' }], nextProbe = 0, msg = '';
  const top = el('div', { class: 'row mb' }); w.appendChild(top); top.appendChild(el('span', { class: 'gae' }, 'load a program:'));
  const PRE = {
    E1: () => { ch.forEach(c => set(c, { sel: 0, nvic: 0 })); set(ch[2], { sel: 1, mode: 1, pol: 0, nvic: 1, act: 'toggle' }); clr = true; say('E1 loaded: EINT2 (P2.12) = <b>falling edge</b>, ISR toggles P1.23. Press and release the P2.12 button.'); },
    E2: () => { ch.forEach(c => set(c, { sel: 0, nvic: 0 })); set(ch[2], { sel: 1, mode: 0, pol: 0, nvic: 1, act: 'pulse' }); clr = true; say('E2 loaded: EINT2 = <b>level 0</b>, ISR = LED on → short delay → off. <b>Hold</b> the P2.12 button.'); },
    ALL: () => { ch.forEach((c, i) => set(c, { sel: 1, mode: i % 2 ? 1 : 0, pol: i > 1 ? 1 : 0, nvic: 1, act: ['count', 'toggle', 'pulse', 'toggle'][i] })); clr = true; say('All four EINTs on, each with a different trigger. Try them one by one.'); }
  };
  chipGroup(top, [['E1', 'E1 · toggle on falling edge'], ['E2', 'E2 · LED on while held'], ['ALL', 'all four EINTs']], 'E1', v => { PRE[v](); syncUI(); });
  const board = el('div', { class: 'm3-board' }); w.appendChild(board);
  board.appendChild(el('div', { class: 'm3-chipbody' }, '<span>LPC1768</span>'));
  const ui = ch.map((c, i) => {
    const dv = el('div', { class: 'm3-dev', style: `grid-row:${i + 1}` }); board.appendChild(dv);
    let ctl;
    if (c.dev.k === 'push') { ctl = el('button', { class: 'm3-push', type: 'button', 'aria-label': `button on P2.${10 + i}` }, '<i></i>'); const dn = e => { e.preventDefault(); c.down = true; ctl.classList.add('down'); }, up = () => { c.down = false; ctl.classList.remove('down'); }; ctl.addEventListener('pointerdown', dn); ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => ctl.addEventListener(k, up)); ctl.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); c.down = !c.down; ctl.classList.toggle('down', c.down); } }); }
    else if (c.dev.k === 'toggle') { ctl = el('button', { class: 'tsw', type: 'button', 'aria-label': 'switch on P2.11' }, '<i></i>'); ctl.onclick = () => { c.down = !c.down; ctl.classList.toggle('on', c.down); }; }
    else { ctl = el('button', { class: 'm3-gen', type: 'button' }, '∿ off'); ctl.onclick = () => { c.gen = !c.gen; ctl.textContent = c.gen ? '∿ 1 Hz' : '∿ off'; ctl.classList.toggle('on', c.gen); }; }
    dv.append(ctl, el('small', {}, c.dev.lab + (c.dev.k === 'gen' ? '' : ' → GND')));
    const row = el('div', { class: 'm3-row', style: `grid-row:${i + 1}` }); board.appendChild(row);
    const pin = el('div', { class: 'm3-pin' }, `<b>P2.${10 + i}</b><span class="lv"></span>`); row.appendChild(pin);
    const tpPin = tp(pin, i, 'pin');
    const sw = (lab, f) => { const b = el('button', { class: 'm3-sw', type: 'button' }); b.innerHTML = `<small>${lab}</small><b></b>`; b.onclick = () => { f(); syncUI(); }; row.appendChild(b); return b; };
    const bSel = sw('PINSEL4', () => { c.sel ^= 1; c.flag = 0; });
    const bMode = sw('EXTMODE', () => { c.mode ^= 1; });
    const bPol = sw('EXTPOLAR', () => { c.pol ^= 1; });
    const fl = el('div', { class: 'm3-flag' }, `<small>EXTINT bit ${i}</small><span class="lampd"></span>`); row.appendChild(fl); const tpFl = tp(fl, i, 'flag');
    const bNv = sw('NVIC', () => { c.nvic ^= 1; });
    return { dv, ctl, row, pin, bSel, bMode, bPol, fl, bNv, tpPin, tpFl };
  });
  const cpu = el('div', { class: 'm3-cpu' }); board.appendChild(cpu);
  cpu.innerHTML = '<div class="m3-cpuh">CPU · ISRs</div>';
  const isrUI = ch.map((c, i) => { const card = el('div', { class: 'm3-isr' }); cpu.appendChild(card); card.innerHTML = `<div class="m3-isrh"><code>EINT${i}_IRQHandler</code><span class="n"></span></div>`; const sel = el('select', { class: 'sel m3-act', 'aria-label': `what EINT${i}_IRQHandler does` }); ACT.forEach(([v, t]) => sel.appendChild(el('option', { value: v }, t))); sel.onchange = () => { c.act = sel.value; syncUI(); }; card.appendChild(sel); const t = tp(card.firstChild, i, 'isr'); if (i === 3) card.appendChild(el('div', { class: 'tiny', style: 'opacity:.8' }, 'shared with GPIO interrupts → ch. 4')); return { card, sel, t }; });
  const ledBox = el('div', { class: 'm3-led' }, '<span class="led"></span><b>P1.23 LED</b>'); cpu.appendChild(ledBox); tp(ledBox, -1, 'led');
  const clrRow = el('div', { class: 'row mt' }); w.appendChild(clrRow);
  const tClr = Tog(clrRow, 'each ISR clears its flag: <code>EXTINT = 1&lt;&lt;x;</code>', true, v => { clr = v; syncUI(); });
  const log = el('div', { class: 'say m3-log' }); w.appendChild(log);
  const scope = el('div', { class: 'scope m3-scope' }); w.appendChild(scope); const ssv = sv('svg', {}); scope.appendChild(ssv);
  const legend = el('div', { class: 'small m3-leg' }); w.appendChild(legend);
  const codeH = el('div', { class: 'mt' }); w.appendChild(codeH); const code = MCode(codeH);

  function tp(host, x, k) { const b = el('button', { class: 'm3tp', type: 'button', title: 'clip a probe here', 'aria-label': `probe ${k}${x >= 0 ? ' of EINT' + x : ''}` }, '◉'); b.onclick = e => { e.stopPropagation(); probes[nextProbe] = { x, k }; nextProbe ^= 1; hist = {}; paintProbes(); }; host.appendChild(b); b._p = { x, k }; return b; }
  const allTP = () => $$('.m3tp', board);
  function paintProbes() { allTP().forEach(b => { const i = probes.findIndex(p => p.x === b._p.x && p.k === b._p.k); b.classList.toggle('p1', i === 0); b.classList.toggle('p2', i === 1); b.textContent = i >= 0 ? i + 1 : '◉'; }); legend.innerHTML = probes.map((p, i) => `<span class="pl${i + 1}">CH${i + 1}</span> ${netName(p)}`).join(' &nbsp; ') + ' &nbsp;·&nbsp; tap any ◉ to move a probe'; }
  const netName = p => p.k === 'led' ? 'P1.23 (LED)' : p.k === 'pin' ? `pin P2.${10 + p.x}` : p.k === 'flag' ? `EXTINT bit ${p.x} (flag)` : `EINT${p.x}_IRQHandler running`;
  function say(h) { msg = h; log.innerHTML = h; }
  function syncUI() {
    ch.forEach((c, i) => { const u = ui[i];
      u.bSel.querySelector('b').textContent = c.sel ? `01 · EINT${i}` : '00 · GPIO'; u.bSel.classList.toggle('on', !!c.sel);
      u.bMode.querySelector('b').textContent = c.mode ? '1 · edge' : '0 · level'; u.bPol.querySelector('b').textContent = c.mode ? (c.pol ? '1 · rising ↗' : '0 · falling ↘') : (c.pol ? '1 · high' : '0 · low');
      u.bNv.querySelector('b').textContent = c.nvic ? '✓ enabled' : '✗ off'; u.bNv.classList.toggle('on', !!c.nvic);
      [u.bMode, u.bPol, u.fl, u.bNv].forEach(b => b.classList.toggle('dead', !c.sel));
      isrUI[i].sel.value = c.act; isrUI[i].card.classList.toggle('dead', !c.sel || !c.nvic);
    });
    tClr.set(clr); genCode(); paintProbes();
  }
  function genCode() {
    const on = ch.filter(c => c.sel); const em = on.reduce((a, c) => a | c.mode << c.x, 0), ep = on.reduce((a, c) => a | c.pol << c.x, 0);
    const L = [`LPC_PINCON->PINSEL4 |= ${on.map(c => `(1<<${20 + 2 * c.x})`).join(' | ') || '0'};   // ${on.map(c => `P2.${10 + c.x}→EINT${c.x}`).join(', ') || 'all pins stay GPIO'}`, `LPC_SC->EXTMODE  = ${hx(em)};   // 1 = edge, 0 = level`, `LPC_SC->EXTPOLAR = ${hx(ep)};   // 1 = rising/high, 0 = falling/low`];
    on.filter(c => c.nvic).forEach(c => L.push(`NVIC_EnableIRQ(EINT${c.x}_IRQn);`));
    on.forEach(c => L.push(`void EINT${c.x}_IRQHandler(void) { ${clr ? `LPC_SC->EXTINT = ${hx(1 << c.x)}; ` : '/* no clear! */ '}${{ toggle: 'LED ^= 1;', pulse: 'LED = 1; delay(); LED = 0;', count: 'n++;' }[c.act]} }`));
    code.set(L);
  }
  // signal history for the scope (transitions per net)
  let hist = {}; const WIN = 6;
  const net = p => p.k === 'led' ? led : p.k === 'pin' ? ch[p.x].lvl : p.k === 'flag' ? ch[p.x].flag : (isr && isr.x === p.x ? 1 : 0);
  function rec() { probes.forEach((p, i) => { const v = net(p), h = hist[i] || (hist[i] = [[T - WIN, v]]); if (h[h.length - 1][1] !== v) h.push([T, v]); while (h.length > 2 && h[1][0] < T - WIN) h.shift(); }); }
  function drawScope() {
    const Wd = Math.max(260, scope.clientWidth - 16), H = 150; ssv.setAttribute('viewBox', `0 0 ${Wd} ${H}`);
    let s = ''; for (let i = 1; i < 10; i++) s += `<path class="sg" d="M${Wd * i / 10} 0V${H}"/>`; for (let i = 1; i < 6; i++) s += `<path class="sg" d="M0 ${H * i / 6}H${Wd}"/>`;
    const X = t => (t - (T - WIN)) / WIN * Wd; const cols = ['#ffd23f', '#5fe3ff'];
    probes.forEach((p, i) => { const h = hist[i]; if (!h) return; const y1 = 16 + i * 70, y0 = y1 + 44; s += `<path d="${digi(h.map(q => [Math.max(q[0], T - WIN), q[1]]).concat([[T, h[h.length - 1][1]]]), X, y1, y0)}" style="fill:none;stroke:${cols[i]};stroke-width:2.4;filter:drop-shadow(0 0 3px ${cols[i]})"/><text x="6" y="${y1 + 12}" style="fill:${cols[i]};font:700 12px Courier Prime">CH${i + 1}</text>`; });
    s += `<text x="${Wd - 6}" y="${H - 6}" text-anchor="end" style="fill:#7dffb8;font:700 11px Courier Prime;opacity:.7">0.6 s / div</text>`;
    ssv.innerHTML = s;
  }
  const ISR_T = { toggle: .14, pulse: .18, count: .12 };
  const lp = Loop(w, dt => {
    T += dt;
    ch.forEach(c => {
      c.prev = c.lvl; c.lvl = c.dev.k === 'gen' ? (c.gen ? ((T % 1) < .5 ? 0 : 1) : 1) : (c.down ? 0 : 1);
      if (!c.sel) return;
      const active = c.mode ? (c.pol ? c.prev === 0 && c.lvl === 1 : c.prev === 1 && c.lvl === 0) : (c.lvl === c.pol);
      if (active && !c.flag) { c.flag = 1; if (!isr) say(`P2.${10 + c.x} ${c.mode ? (c.pol ? 'went 0 → 1 (rising edge)' : 'went 1 → 0 (falling edge)') : `is ${c.pol} (level-${c.pol} active)`} → <b>EXTINT bit ${c.x} = 1</b>${c.nvic ? ` → NVIC runs <code>EINT${c.x}_IRQHandler</code>.` : ' → but the NVIC is <b>off</b> for it: the flag just waits.'}`); }
    });
    if (isr) {
      isr.t += dt; const c = ch[isr.x];
      if (isr.t >= .02 && !isr.cl) { isr.cl = 1; if (clr) { c.flag = 0; const still = !c.mode && c.lvl === c.pol; if (still) c.flag = 1; } }
      if (c.act === 'pulse') led = isr.t < ISR_T.pulse * .8 ? 1 : 0;
      if (isr.t >= ISR_T[c.act]) { if (c.act === 'toggle') led ^= 1; c.runs++; const again = c.flag; isr = null;
        if (again) say(clr ? `ISR #${c.runs} done — but P2.${10 + c.x} is <b>still ${c.pol}</b> (level mode) → the flag came straight back → <b>the ISR runs again</b>.` : `<span class="p-red">ISR #${c.runs} never cleared EXTINT bit ${c.x} → the flag is still 1 → it runs again and again…</span>`);
        else if (c.mode) say(`ISR #${c.runs} done, flag cleared. An edge is a single event → <b>one</b> ISR per ${c.pol ? 'rising' : 'falling'} edge. Holding does nothing more.`);
        else say(`Pin is back to ${1 - c.pol} → level no longer active → no more interrupts. (ISR ran ${c.runs}×.)`); }
    }
    if (!isr) { const c = ch.find(c => c.sel && c.nvic && c.flag); if (c) isr = { x: c.x, t: 0, cl: 0 }; }
    ledAvg += (led - ledAvg) * Math.min(1, dt * 14);
    rec(); drawScope(); paint();
  });
  function paint() {
    ch.forEach((c, i) => { const u = ui[i]; u.pin.querySelector('.lv').textContent = c.lvl; u.pin.classList.toggle('low', !c.lvl); u.fl.querySelector('.lampd').classList.toggle('on', !!c.flag); u.fl.classList.toggle('hot', !!c.flag); isrUI[i].card.classList.toggle('run', !!(isr && isr.x === i)); isrUI[i].card.querySelector('.n').textContent = c.runs ? `ran ${c.runs}×` : ''; u.dv.classList.toggle('act', !c.lvl); });
    const L = ledBox.querySelector('.led'); L.classList.toggle('on', ledAvg > .05); L.style.opacity = (.35 + .65 * Math.min(1, ledAvg * 1.15)).toFixed(2);
  }
  PRE.E1(); syncUI(); lp.start();
});
