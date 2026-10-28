/* =========================================================
   NOTEBOOK 1 · part I — M3: the six-program time machine (chapter 3)
   ========================================================= */
BUILD.push(function wM3() {
  const w = MW('w-m3', 'six-program time machine', 'pick a program · turn its knob · drag the playhead (or tap a code line)');
  const LN = 1e-6, WR = .3e-6; // real duration of one setup line / one pin write (a few CPU cycles)
  function Seq() { const q = { segs: [], t: 0 }; q.add = (k, ph, l, dur) => { q.segs.push({ t0: q.t, t1: q.t + dur, k, ph, l: [].concat(l) }); q.t += dur; return q.t - dur; }; return q; }
  const tPoll = (pr, mr) => (pr + 1) * mr / 3e6;
  /* ----- the six programs: code (with the knob value) + a timeline model ----- */
  const PROGS = [
    { id: 'P1', name: 'blink 1 s', st: 'st-bulb', file: 'blink_1s.c', knob: ['MR0 (PR = 1000)', 1000, 6000, 500, 3000, v => v], wait: 'poll',
      code: v => P1_CODE.replace('MR0 = 3000;         //for 1 second', `MR0 = ${v};${' '.repeat(Math.max(1, 9 - String(v).length))}//for ${(+(1001 * v / 3e6).toFixed(3))} second`),
      model(v) {
        const q = Seq(), half = tPoll(1000, v), pin = [[0, 0]], em = [[0, 0]], tc = [[0, 0]], marks = [];
        q.add('setup', -1, 'FIODIR=0x00000004', LN);
        for (let k = 0; k < 4; k++) {
          const t = q.add('write', -1, ['while(1)', k % 2 ? 'FIOCLR=0x4' : 'FIOSET=0x4'], WR); pin.push([t, k % 2 ? 0 : 1]);
          const nth = k % 2 + 1;
          const t0 = q.add('setup', 0, [['delay();', nth], 'TCR = 0x00000002'], LN); tc.push([t0, tc[tc.length - 1][1]], [t0, 0]);
          const t1 = q.add('setup', 1, [['delay();', nth], 'EMR = 0X20', 'PR = 1000', 'MR0 = ', 'MCR = 0x00000004'], 4 * LN); em.push([t1, 0]);
          q.add('setup', 2, [['delay();', nth], 'TCR = 0x00000001'], LN);
          const tp = q.add('poll', 3, [['delay();', nth], 'while ( !(LPC_TIM0->EMR & 0x01))'], half); tc.push([tp, 0], [tp + half, v]); em.push([tp + half, 1]); marks.push([tp + half, 'tc', '★']);
        }
        return { T: q.t, segs: q.segs, tc: { lab: 'TC', pts: tc, mr: [[0, v]], mrLab: 'MR0', top: v }, lanes: [{ lab: 'P0.2 LED', pts: pin, c: 'out' }, { lab: 'EM0', pts: em, c: 'em' }], marks };
      } },
    { id: 'P2', name: '75 % duty', st: 'st-wave', file: 'duty75.c', knob: ['duty cycle', 10, 90, 5, 75, v => v + ' %'], wait: 'poll',
      code: v => { const hi = 20 * v, lo = 2000 - hi; return P2_CODE.replace('MR0 = 1500; //For 1.5 seconds', `MR0 = ${hi}; //For ${hi / 1000} seconds`).replace('MR0 = 500;  //For 0.5 seconds', `MR0 = ${lo};  //For ${lo / 1000} seconds`); },
      model(v) {
        const q = Seq(), hi = 20 * v, lo = 2000 - hi, pin = [[0, 0]], em = [[0, 0]], tc = [[0, 0]], mr = [[0, hi]], marks = [];
        q.add('setup', -1, 'FIODIR=0x00000004', LN);
        for (let k = 0; k < 4; k++) {
          const m = k % 2 ? lo : hi, nth = k % 2 + 1;
          const t = q.add('write', -1, ['while(1)', k % 2 ? 'FIOPIN=0x00000000' : 'FIOPIN=0x00000004'], WR); pin.push([t, k % 2 ? 0 : 1]);
          const tm = q.add('write', 1, [['LPC_TIM0->MR0 = ', k % 2 + 1]], WR); mr.push([tm, m]);
          const t0 = q.add('setup', 0, [['delay();', nth], 'TCR = 0x00000002'], LN); tc.push([t0, tc[tc.length - 1][1]], [t0, 0]);
          const t1 = q.add('setup', 1, [['delay();', nth], 'EMR = 0X20', 'PR = 2999', 'MCR = 0x00000004'], 3 * LN); em.push([t1, 0]);
          q.add('setup', 2, [['delay();', nth], 'TCR = 0x00000001'], LN);
          const tp = q.add('poll', 3, [['delay();', nth], 'while ( !(LPC_TIM0->EMR & 0x01))'], tPoll(2999, m)); tc.push([tp, 0], [tp + tPoll(2999, m), m]); em.push([tp + tPoll(2999, m), 1]); marks.push([tp + tPoll(2999, m), 'tc', '★']);
        }
        return { T: q.t, segs: q.segs, tc: { lab: 'TC', pts: tc, mr, mrLab: 'MR0', top: Math.max(hi, lo) }, lanes: [{ lab: 'P0.2 LED', pts: pin, c: 'out' }, { lab: 'EM0', pts: em, c: 'em' }], marks };
      } },
    { id: 'P3', name: 'hardware square wave', st: 'st-star', file: 'mat00_square.c', knob: ['MR0 (PR = 0)', 750000, 6000000, 750000, 3000000, v => fmtN(v)], wait: 'idle',
      code: v => P3_CODE.replace('MR0 = 3000000;', `MR0 = ${v};`),
      model(v) {
        const q = Seq(), half = (v + 1) / 3e6, pin = [[0, 0]], tc = [[0, 0]], marks = [];
        q.add('setup', -1, 'PINSEL3 |= (3<<24)', LN);
        q.add('setup', 0, ['delay();', 'TCR = 0x00000002'], LN);
        q.add('setup', 1, ['delay();', 'CTCR = 0x00000000', 'EMR = 0X30', 'PR = 0', 'MR0 = ', 'MCR = 0x00000002'], 5 * LN);
        q.add('setup', 2, ['delay();', 'TCR = 0x00000001'], LN);
        const ti = q.add('idle', 3, ['while(1);'], 4 * half); let lv = 0;
        for (let k = 0; k < 4; k++) { const a = ti + k * half; tc.push([a, 0], [a + half, v], [a + half, 0]); lv ^= 1; pin.push([a + half, lv]); marks.push([a + half, 'tc', '★']); }
        return { T: q.t, segs: q.segs, tc: { lab: 'TC', pts: tc, mr: [[0, v]], mrLab: 'MR0', top: v }, lanes: [{ lab: 'P1.28 MAT0.0', pts: pin, c: 'out' }], marks };
      } },
    { id: 'P4', name: '÷ 8 counter', st: 'st-gear', file: 'divide_by_8.c', knob: ['MR1', 1, 5, 1, 3, v => `${v} → ÷ ${2 * (v + 1)}`], wait: 'idle',
      code: v => P4_CODE.replace('MR1 = 0x03;   //To count 4 clock pulses', `MR1 = 0x0${v};   //To count ${v + 1} clock pulses`),
      model(v) {
        const q = Seq(), fin = 4, T = (v + 1), inp = [[0, 1]], out = [[0, 0]], tc = [[0, 0]], marks = [];
        q.add('setup', -1, ['init_timer1();', 'PINSEL3 |='], LN);
        q.add('setup', 0, ['init_timer1();', 'TCR = 2;'], LN);
        q.add('setup', 1, ['init_timer1();', 'CTCR = 0x2', 'MR1 = 0x0', 'MCR = 0x10', 'EMR = 0xC0'], 4 * LN);
        q.add('setup', 2, ['init_timer1();', 'TCR = 1;'], LN);
        const ti = q.add('idle', 3, ['while(1);'], T - q.t); let c = 0, o = 0;
        for (let k = 0; ; k++) { const tr = (k + .5) / fin; if (tr > T) break; inp.push([tr - .5 / fin, 1], [tr, 0]); if (tr > ti) { if (c === v) c = 0; else c++; tc.push([tr, tc[tc.length - 1][1]], [tr, c]); if (c === v) { o ^= 1; out.push([tr, o]); marks.push([tr, 'tc', '★']); } } }
        return { T, segs: q.segs, tc: { lab: 'TC', pts: tc, mr: [[0, v]], mrLab: 'MR1', top: v, step: true }, lanes: [{ lab: 'P1.18 in', pts: inp, c: 'in' }, { lab: 'P1.25 out', pts: out, c: 'out' }], marks };
      } },
    { id: 'P5', name: 'frequency meter', st: 'st-meter', file: 'freq_meter.c', knob: ['generator', 1, 9, 1, 4, v => v + ' Hz'], wait: 'poll',
      code: v => P5_CODE,
      model(f) {
        const q = Seq(), inp = [[0, 0]], tc = [[0, 0]], gate = [[0, 0]], marks = [], ph = .37 / f;
        q.add('setup', -1, ['PINSEL0 = 0', 'FIODIR = 0x00000FF0'], 2 * LN);
        q.add('setup', 1, ['init_counter1();', 'PINSEL3 = (3<<4)', 'CTCR = 0x01'], 2 * LN);
        const runs = [], resets = [];
        for (let k = 0; k < 2; k++) {
          const r0 = q.add('setup', 0, ['while(1)', 'TCR=2'], WR); resets.push(r0);
          const r1 = q.add('setup', 2, ['TCR=1'], WR);
          q.add('setup', 0, ['wait for 1 second', 'LPC_TIM0->TCR = 0x00000002'], LN);
          q.add('setup', 1, ['wait for 1 second', 'LPC_TIM0->EMR = 0X20', 'PR = 3000', 'MR0 = 1000', 'MCR = 0x00000004'], 4 * LN);
          q.add('setup', 2, ['wait for 1 second', 'LPC_TIM0->TCR = 0x00000001'], LN);
          const g = tPoll(3000, 1000), tp = q.add('poll', 3, ['wait for 1 second', 'while ( !(LPC_TIM0->EMR'], g); gate.push([tp, 1], [tp + g, 0]);
          const tw = q.add('write', -1, ['seven_seg[LPC_TIM1->TC]'], WR); runs.push([r1, tw]);
        }
        const T = q.t, ev = runs.map(([a, b], i) => [resets[i], 'R']);
        for (let k = 0; ; k++) { const tr = ph + k / f; if (tr > T) break; inp.push([tr, 1], [tr + .5 / f, 0]); if (runs.some(([a, b]) => tr > a && tr < b)) ev.push([tr, 'E']); }
        ev.sort((a, b) => a[0] - b[0]); let c = 0;
        ev.forEach(([tt, k]) => { if (k === 'R') { tc.push([tt, c], [tt, 0]); c = 0; } else { tc.push([tt, c], [tt, c + 1]); c++; } });
        runs.forEach(([a, b]) => { const n = ev.filter(e => e[1] === 'E' && e[0] > a && e[0] < b).length; marks.push([b, 'seg', String(n)]); });
        return { T, segs: q.segs, tc: { lab: 'TC1', pts: tc, mr: null, top: Math.max(9, f + 1), step: true }, lanes: [{ lab: 'P1.18 in', pts: inp, c: 'in' }, { lab: 'Timer0 1 s', pts: gate, c: 'em' }], marks, seg: true };
      } },
    { id: 'P6', name: 'capture', st: 'st-cam', file: 'capture.c', knob: ['edge on P1.26 at', 50, 950, 25, 450, v => v + ' ms'], wait: 'poll',
      code: v => P6_CODE,
      model(e) {
        const q = Seq(), pin = [[0, 0]], tc = [[0, 0]], c0 = [[0, 0]], c1 = [[0, 0]], marks = [], g = tPoll(3000, 1000);
        q.add('setup', -1, ['FIODIR = 0x00000004', 'PINSEL3 |= (3<<20)'], 2 * LN);
        const polls = [];
        for (let k = 0; k < 2; k++) {
          const tw = q.add('write', -1, ['while(1)', 'toggle p0.2'], WR); pin.push([tw, k ? 0 : 1]);
          q.add('setup', 1, ['delay();', 'CCR = 9'], LN);
          const t0 = q.add('setup', 0, ['delay();', 'TCR = 0x00000002'], LN); tc.push([t0, tc[tc.length - 1][1]], [t0, 0]);
          q.add('setup', 1, ['delay();', 'EMR = 0X20', 'PR = 3000', 'MR0 = 1000', 'MCR = 0x00000004'], 4 * LN);
          q.add('setup', 2, ['delay();', 'TCR = 0x00000001'], LN);
          const tp = q.add('poll', 3, ['delay();', 'while ( !(LPC_TIM0->EMR & 0x01))'], g); tc.push([tp, 0], [tp + g, 1000]); polls.push(tp);
        }
        const a = polls[0] + e / 1000 * g, b = polls[1] + .6 * g;
        c0.push([a, 1], [a + .06, 0]); c1.push([b, 1], [b + .06, 0]);
        marks.push([a, 1, `CR0 = ${Math.floor(e)}`], [b, 2, 'CR1 = 600']);
        return { T: q.t, segs: q.segs, tc: { lab: 'TC', pts: tc, mr: [[0, 1000]], mrLab: 'MR0', top: 1000 }, lanes: [{ lab: 'P0.2 LED', pts: pin, c: 'out' }, { lab: 'P1.26 CAP0.0', pts: c0, c: 'in' }, { lab: 'P1.27 CAP0.1', pts: c1, c: 'in' }], marks };
      } }
  ];
  /* ---------- layout ---------- */
  let P = PROGS[0], kv = P.knob[4], M = null, code = '', lines = [], t = 0, xp = 0, playing = false, narrow = false, lastHL = '';
  const tabs = el('div', { class: 'm3tabs' }); w.appendChild(tabs);
  PROGS.forEach((p, i) => { const b = el('button', { class: 'm3tab', type: 'button' }, `<svg><use href="#${p.st}"/></svg><b>${p.id}</b><span>${p.name}</span>`); b.onclick = () => pick(i); tabs.appendChild(b); p.btn = b; });
  const kr = el('div', { class: 'row m3knob' }); w.appendChild(kr);
  let knobR = null;
  const rib = el('div', { class: 'm3rib' }); w.appendChild(rib);
  const main = el('div', { class: 'm3main' }); w.appendChild(main);
  const left = el('div', { class: 'm3left' }); main.appendChild(left);
  const S = sv('svg', { class: 'dg m3tl', role: 'img', 'aria-label': 'timeline of the program' }); left.appendChild(S);
  const ctl = el('div', { class: 'row m3ctl' }); left.appendChild(ctl);
  const bPlay = el('button', { class: 'btn sm y', type: 'button' }, '▶ play'), bBack = el('button', { class: 'btn sm g', type: 'button' }, '⟲ t = 0');
  const tRead = el('span', { class: 'ro' }); ctl.append(bPlay, bBack, tRead);
  let rate = 1; chipGroup(ctl, [[.5, '×½'], [1, '×1'], [2, '×2']], 1, v => rate = +v, 'm3rate');
  const now = el('div', { class: 'm3now mbox' }); left.appendChild(now);
  const right = el('div', { class: 'm3right' }); main.appendChild(right);
  const codeHost = el('div'); right.appendChild(codeHost);
  const busy = el('div', { class: 'm3busy' }); right.appendChild(busy);
  bPlay.onclick = () => { if (!playing && xp >= X(M.T) - .5) setX(X(0)); playing = !playing; bPlay.textContent = playing ? '❚❚ pause' : '▶ play'; };
  bBack.onclick = () => { playing = false; bPlay.textContent = '▶ play'; setX(X(0)); };

  /* ---------- warped time axis: short setup bits get a fixed width so you can see them ---------- */
  let X0 = 96, Wd = 520, map = []; // map: [{t0,t1,x0,x1}]
  function buildMap() {
    const segs = M.segs, short = s => s.k === 'setup' || s.k === 'write', fx = narrow ? 5 : 8;
    const nS = segs.filter(short).length, longT = segs.filter(s => !short(s)).reduce((a, s) => a + s.t1 - s.t0, 0);
    const sc = (Wd - nS * fx) / (longT || 1); let x = X0; map = [];
    segs.forEach(s => { const ww = short(s) ? fx : (s.t1 - s.t0) * sc; map.push({ t0: s.t0, t1: s.t1, x0: x, x1: x + ww, s }); x += ww; });
  }
  function X(tt) { for (const m of map) if (tt <= m.t1) return m.x0 + (m.t1 > m.t0 ? (tt - m.t0) / (m.t1 - m.t0) : 0) * (m.x1 - m.x0); return X0 + Wd; }
  function invX(x) { for (const m of map) if (x <= m.x1) return m.t0 + (m.x1 > m.x0 ? (x - m.x0) / (m.x1 - m.x0) : 0) * (m.t1 - m.t0); return M.T; }

  /* ---------- drawing ---------- */
  let LY = {}, H = 0, ph = null;
  function draw() {
    const VW = narrow ? 400 : 640; X0 = narrow ? 70 : 96; Wd = VW - X0 - 10; buildMap();
    const lanes = M.lanes, R = rng(9);
    LY = { cpu: 30, tc: 86 }; let y = 150; lanes.forEach((l, i) => { LY['l' + i] = y; y += 36; }); if (M.seg) { LY.seg = y; y += 30; } H = y + 18;
    S.setAttribute('viewBox', `0 0 ${VW} ${H}`);
    let o = '';
    // axis ticks (real seconds)
    const step = M.T > 3 ? 1 : M.T > 1.4 ? .5 : .25;
    for (let s = 0; s <= M.T + 1e-9; s += step) { const x = X(s); o += `<path d="M${x.toFixed(1)} 14 V${H - 16}" class="grid"/><text x="${x.toFixed(1)}" y="${H - 3}" text-anchor="middle" class="ax">${+s.toFixed(2)} s</text>`; }
    // CPU lane
    o += `<text x="4" y="${LY.cpu + 5}" class="lb">CPU</text>`;
    map.forEach(m => { const k = m.s.k; o += `<rect x="${m.x0.toFixed(1)}" y="${LY.cpu - 12}" width="${Math.max(.8, m.x1 - m.x0).toFixed(1)}" height="24" rx="3" class="cpu ${k} ph${m.s.ph}"/>`; if ((k === 'poll' || k === 'idle') && m.x1 - m.x0 > 70) o += `<text x="${((m.x0 + m.x1) / 2).toFixed(1)}" y="${LY.cpu + 5}" text-anchor="middle" class="cpt">${k === 'poll' ? (m.x1 - m.x0 > 130 ? 'polling EMR & 1 …' : 'polling …') : 'idle: while(1);'}</text>`; });
    // TC lane
    const tcT = M.tc.top * 1.15, TY = v => LY.tc + 40 - v / tcT * 72;
    o += `<text x="4" y="${LY.tc + 5}" class="lb">${M.tc.lab}</text>`;
    if (M.tc.mr) { let d = ''; M.tc.mr.forEach(([tt, v], i) => { const x = X(tt), yy = TY(v); d += i ? `H${x.toFixed(1)}V${yy.toFixed(1)}` : `M${X0} ${yy.toFixed(1)}`; }); d += `H${X0 + Wd}`; o += `<path d="${d}" class="mrl"/><text x="${X0 - 4}" y="${TY(M.tc.mr[0][1]) + 4}" text-anchor="end" class="mrt">${M.tc.mrLab}</text>`; }
    o += `<path d="${M.tc.pts.map(([tt, v], i) => `${i ? 'L' : 'M'}${X(tt).toFixed(1)} ${TY(v).toFixed(1)}`).join('')}" class="tcl"/>`;
    // pin lanes
    lanes.forEach((l, i) => { const yy = LY['l' + i]; o += `<text x="4" y="${yy}" class="sm">${l.lab}</text><path d="${digi(l.pts.concat([[M.T, l.pts[l.pts.length - 1][1]]]), X, yy - 12, yy + 8)}" class="ln ${l.c}"/>`; });
    if (M.seg) o += `<text x="4" y="${LY.seg + 4}" class="sm">7-seg</text>`;
    // marks
    M.marks.forEach(([tt, ln, txt]) => { const x = X(tt).toFixed(1); if (ln === 'tc') o += `<text x="${x}" y="${LY.tc - 36}" text-anchor="middle" class="star">★</text>`; else if (ln === 'seg') o += `<rect x="${(+x - 2).toFixed(1)}" y="${LY.seg - 12}" width="26" height="22" rx="4" class="segm"/><text x="${(+x + 11).toFixed(1)}" y="${LY.seg + 5}" text-anchor="middle" class="segt">${txt}</text>`; else { const yy = LY['l' + ln]; o += `<text x="${(+x + 6).toFixed(1)}" y="${yy - 14}" class="capt">${txt}</text>`; } });
    o += `<g class="phd"><path d="M0 4 V${H - 16}" class="phl"/><circle cy="8" r="8" class="phk"/></g>`;
    S.innerHTML = o; ph = $('.phd', S);
  }
  /* ---------- state at the playhead ---------- */
  const at = (pts, tt) => { let v = pts[0][1]; for (const p of pts) { if (p[0] <= tt) v = p[1]; else break; } return v; };
  const tcAt = tt => { const p = M.tc.pts; let v = 0; for (let i = 0; i < p.length; i++) { if (p[i][0] > tt) { const a = p[i - 1] || p[i]; if (p[i][0] > a[0] && p[i][1] !== a[1] && !M.tc.step) v = a[1] + (p[i][1] - a[1]) * (tt - a[0]) / (p[i][0] - a[0]); else v = a[1]; return Math.floor(v); } v = p[i][1]; } return v; };
  const segAt = tt => M.segs.find(s => tt >= s.t0 && tt < s.t1) || M.segs[M.segs.length - 1];
  const PH = ['① reset · TCR = 2', '② configure the registers', '③ start · TCR = 1', ''];
  function setX(x) {
    xp = clamp(x, X0, X0 + Wd); t = invX(xp); ph.setAttribute('transform', `translate(${xp.toFixed(1)} 0)`);
    const s = segAt(t), lnNums = s.l.map(q => Array.isArray(q) ? lineOf(code, q[0], q[1]) : lineOf(code, q)).filter(Boolean), key = lnNums.join(',');
    if (key !== lastHL) {
      lastHL = key; lines.forEach(l => l.classList.remove('on'));
      lnNums.forEach(n => lines[n - 1] && lines[n - 1].classList.add('on'));
      const ln = lines[lnNums[lnNums.length - 1] - 1], box = codeHost.firstChild; if (ln && box.scrollHeight > box.clientHeight + 4) box.scrollTo({ top: ln.offsetTop - box.clientHeight * .45, behavior: REDUCED ? 'auto' : 'smooth' });
    }
    $$('.m3ph', rib).forEach((b, i) => b.classList.toggle('on', i === s.ph));
    const tcv = tcAt(t), sec = t < 1e-3 ? (+(t * 1e6).toFixed(1)) + ' µs' : (+t.toFixed(4)) + ' s';
    tRead.textContent = `t = ${sec}`;
    const doing = { setup: 'running set-up lines (a few µs — drawn wider so you can see them)', write: 'writing a pin / register', poll: 'stuck in the polling loop, waiting for EM0', idle: 'idle in while(1); — the timer works alone' }[s.k];
    let h = `<div><span class="mlab">CPU</span> ${doing}</div><div><span class="mlab">${M.tc.lab}</span> <b>${fmtN(tcv)}</b>${M.tc.mr ? ` / ${M.tc.mrLab} = ${fmtN(at(M.tc.mr, t))}` : ''}</div>`;
    h += M.lanes.map(l => `<span class="m3pin ${at(l.pts, t) ? 'hi' : ''}"><i></i>${l.lab} = ${at(l.pts, t)}</span>`).join('');
    const seen = M.marks.filter(m => m[0] <= t && m[1] !== 'tc');
    if (M.seg) { const last = seen.filter(m => m[1] === 'seg').pop(); h += `<div class="m3seg"><span class="mlab">7-seg shows</span> <b>${last ? last[2] : '— (not written yet)'}</b>${last ? ` → f = ${last[2]} Hz` : ''}</div>`; }
    seen.filter(m => typeof m[1] === 'number').forEach(m => h += `<div class="m3cr">📸 ${m[2]} <span class="p-soft small">(TC copied at the edge)</span></div>`);
    now.innerHTML = h;
  }
  /* ---------- program / knob changes ---------- */
  function rebuild(keepT) {
    code = P.code(kv); M = P.model(kv);
    const old = codeHost.firstChild; const cb = codeBlock(code, P.file); codeHost.innerHTML = ''; codeHost.appendChild(cb); lines = $$('.cl', cb); lastHL = '';
    lines.forEach((l, i) => { l.style.cursor = 'pointer'; l.title = 'jump to when this line runs'; l.onclick = () => { const s = M.segs.find(sg => sg.l.some(q => (Array.isArray(q) ? lineOf(code, q[0], q[1]) : lineOf(code, q)) === i + 1)); if (s) { playing = false; bPlay.textContent = '▶ play'; setX(X(s.t0) + (map.find(m => m.s === s).x1 - X(s.t0)) * .5); } }; });
    const used = { P1: 'PR MR0 MCR EMR', P2: 'PR MR0 MCR EMR', P3: 'CTCR PR MR0 MCR EMR', P4: 'CTCR MR1 MCR EMR', P5: 'CTCR (T1) · PR MR0 MCR EMR (T0)', P6: 'CCR PR MR0 MCR EMR' }[P.id];
    rib.innerHTML = `<div class="m3ph" data-k="0">${PH[0]}</div><div class="m3ph" data-k="1">② configure: <b>${used}</b></div><div class="m3ph" data-k="2">${PH[2]}</div><div class="m3ph w4">${P.wait === 'poll' ? '④ CPU polls <code>EMR &amp; 1</code> until the match' : '④ CPU idles — the <b>hardware</b> makes the output'}</div>`;
    const poll = M.segs.filter(s => s.k === 'poll').reduce((a, s) => a + s.t1 - s.t0, 0), idle = M.segs.filter(s => s.k === 'idle').reduce((a, s) => a + s.t1 - s.t0, 0);
    busy.innerHTML = poll > idle ? `<b class="p-red">CPU busy-waiting ${(poll / M.T * 100).toFixed(1)} %</b> of the time — it can do nothing else.` : `<b class="p-green">CPU free ${(idle / M.T * 100).toFixed(1)} %</b> of the time — the timer hardware does the work.`;
    draw(); setX(keepT ? X(Math.min(t, M.T)) : X(0));
  }
  function pick(i) {
    P = PROGS[i]; kv = P.knob[4]; PROGS.forEach((p, j) => p.btn.classList.toggle('on', i === j));
    kr.innerHTML = ''; kr.appendChild(el('span', { class: 'gae' }, `🎛 ${P.id} knob:`));
    knobR = ruler(kr, P.knob[0], P.knob[1], P.knob[2], P.knob[4], P.knob[3], P.knob[5], v => { kv = v; rebuild(true); });
    playing = false; bPlay.textContent = '▶ play'; rebuild(false);
  }
  // scrubbing
  const toX = e => { const r = S.getBoundingClientRect(), vb = S.viewBox.baseVal; return (e.clientX - r.left) / r.width * vb.width; };
  let drag = false;
  S.addEventListener('pointerdown', e => { drag = true; S.setPointerCapture(e.pointerId); playing = false; bPlay.textContent = '▶ play'; setX(toX(e)); });
  S.addEventListener('pointermove', e => { if (drag) setX(toX(e)); });
  S.addEventListener('pointerup', () => drag = false); S.addEventListener('pointercancel', () => drag = false);
  widthWatch(w, 700, n => { narrow = n; if (M) { const tt = t; draw(); setX(X(tt)); } });
  const loop = Loop(S, dt => { if (!playing) return; const nx = xp + dt * rate * Wd / 9; setX(nx); if (nx >= X0 + Wd) { playing = false; bPlay.textContent = '▶ play'; } });
  loop.start(); pick(0);
});
