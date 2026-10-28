/* =========================================================
   CORE: pens, decorations, theme, nav + reusable widgets
   ========================================================= */
const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const hex = (v, d = 8) => '0x' + ((v >>> 0).toString(16).toUpperCase().padStart(d, '0'));
const hx = (v, d = 2) => '0x' + ((v >>> 0).toString(16).toUpperCase().padStart(d, '0'));
const bin = (v, d = 8) => (v >>> 0).toString(2).padStart(d, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function el(tag, attrs = {}, html) { const e = document.createElement(tag); for (const k in attrs) { if (k === 'class') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); } if (html != null) e.innerHTML = html; return e; }
function sv(tag, attrs = {}, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function onVisible(node, cb, opts) { const io = new IntersectionObserver(es => es.forEach(e => cb(e.isIntersecting)), opts || { rootMargin: '80px' }); io.observe(node); return io; }
function strHash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- PEN: hand-drawn path generators ---------- */
const Pen = {
  line(x1, y1, x2, y2, R = Math.random, r = 1) {
    const j = () => (R() * 2 - 1) * r, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(len * .018, 2.4) * (R() * 2 - 1), nx = -dy / len, ny = dx / len;
    const mx = (x1 + x2) / 2 + nx * bend, my = (y1 + y2) / 2 + ny * bend;
    return `M${(x1 + j()).toFixed(1)} ${(y1 + j()).toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${(x2 + j()).toFixed(1)} ${(y2 + j()).toFixed(1)}`;
  },
  rect(x, y, w, h, R = Math.random, r = 1.2) {
    const o = () => 1 + R() * 3;
    return this.line(x - o(), y, x + w + o(), y, R, r) + this.line(x + w, y - o(), x + w, y + h + o(), R, r) +
      this.line(x + w + o(), y + h, x - o(), y + h, R, r) + this.line(x, y + h + o(), x, y - o(), R, r);
  },
  catmull(p) {
    let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  },
  ellipse(cx, cy, rx, ry, R = Math.random) {
    const pts = [], st = R() * Math.PI * 2, n = 26, turns = 1.1 + R() * .06;
    for (let i = 0; i <= n; i++) { const t = st + i / n * Math.PI * 2 * turns, k = 1 + (R() * 2 - 1) * .035 + i / n * .05; pts.push([cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k]); }
    return this.catmull(pts);
  },
  under(w, y, R = Math.random) {
    const pts = []; const n = 6;
    for (let i = 0; i <= n; i++) pts.push([-2 + (w + 6) * i / n, y + (R() * 2 - 1) * 1.6 + (i === n ? -2 : 0)]);
    return this.catmull(pts);
  },
  arrow(x1, y1, x2, y2, R = Math.random) {
    const mx = (x1 + x2) / 2 + (R() - .5) * 18, my = (y1 + y2) / 2 - 14 - R() * 10;
    const a = Math.atan2(y2 - my, x2 - mx), L = 9;
    return `M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}M${x2 - L * Math.cos(a - .45)} ${y2 - L * Math.sin(a - .45)}L${x2} ${y2}L${x2 - L * Math.cos(a + .45)} ${y2 - L * Math.sin(a + .45)}`;
  }
};

/* ---------- DECORATIONS ---------- */
function sketchBoxes(root = document) {
  $$('.sk', root).forEach((box, i) => {
    if (box._sk) return; box._sk = 1;
    const svg = sv('svg', { class: 'skb', 'aria-hidden': 'true' });
    box.prepend(svg);
    const seed = strHash(box.id || box.className + i) + i;
    const draw = () => {
      const w = box.offsetWidth, h = box.offsetHeight; if (!w) return;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const R = rng(seed);
      let d = Pen.rect(2, 2, w - 4, h - 4, R, 1.3);
      if (box.classList.contains('dbl')) d += Pen.rect(4, 3, w - 7, h - 6, R, 1.6);
      svg.innerHTML = `<path d="${d}"/>`;
    };
    draw(); new ResizeObserver(draw).observe(box);
  });
}
function penMarks(root = document) {
  $$('.ul', root).forEach((u, i) => {
    if (u._pm) return; u._pm = 1;
    const svg = sv('svg', { class: 'pen drawn', 'aria-hidden': 'true' }); u.appendChild(svg);
    const draw = () => {
      const w = u.offsetWidth, h = u.offsetHeight; const R = rng(i * 31 + w);
      Object.assign(svg.style, { left: '0', top: '0', width: w + 'px', height: (h + 8) + 'px' });
      svg.setAttribute('viewBox', `0 0 ${w} ${h + 8}`);
      svg.innerHTML = `<path d="${Pen.under(w, h - 1, R)}" style="stroke:var(--ulc,var(--pink));stroke-width:2.4;--len:${w * 1.3 + 20}"/>`;
    };
    draw(); new ResizeObserver(draw).observe(u);
  });
  $$('.circ', root).forEach((c, i) => {
    if (c._pm) return; c._pm = 1;
    const svg = sv('svg', { class: 'pen drawn', 'aria-hidden': 'true' }); c.appendChild(svg);
    const draw = () => {
      const w = c.offsetWidth + 16, h = c.offsetHeight + 10; const R = rng(i * 17 + 5);
      Object.assign(svg.style, { left: '-8px', top: '-5px', width: w + 'px', height: h + 'px' });
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      svg.innerHTML = `<path d="${Pen.ellipse(w / 2, h / 2, w / 2 - 3, h / 2 - 3, R)}" style="stroke:var(--cc,var(--red));stroke-width:2;--len:${(w + h) * 3.6}"/>`;
    };
    draw(); new ResizeObserver(draw).observe(c);
  });
}
function jitterText(root = document) {
  $$('.jit', root).forEach((h, k) => {
    if (h._jt) return; h._jt = 1;
    const R = rng(k * 97 + 11); let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(w => {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
            const ws = document.createElement('span'); ws.className = 'jw';
            [...w].forEach(ch => { const s = document.createElement('span'); s.className = 'jl'; s.textContent = ch; s.style.cssText = `--i:${i++};transform:translateY(${((R() * 2 - 1) * 1.6).toFixed(1)}px) rotate(${((R() * 2 - 1) * 3.2).toFixed(1)}deg)`; ws.appendChild(s); });
            frag.appendChild(ws);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('num')) walk(n);
      });
    };
    walk(h);
  });
}
function reveal(root = document) {
  const targets = $$('.chapter > *:not(script):not(.mnote), .rv, .cover > *', root).filter(e => !e._rv);
  if (REDUCED || !('IntersectionObserver' in window)) { targets.forEach(e => e.classList.add('in')); document.body.classList.add('noanim'); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .06 });
  targets.forEach((e, i) => { e._rv = 1; e.classList.add('rv'); e.style.setProperty('--rvr', ((i % 3) - 1) * .5 + 'deg'); io.observe(e); });
}

/* ---------- THEME (pull-cord lamp) ---------- */
function themeSetup() {
  const root = document.documentElement;
  try { const t = localStorage.getItem('es-nb-theme'); if (t) root.dataset.theme = t; } catch (e) { }
  const lamp = $('.lamp'); if (!lamp) return;
  const eff = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const paint = () => { const d = eff() === 'dark'; lamp.querySelector('.bead').innerHTML = `<svg width="26" height="26"><use href="#${d ? 'st-moon' : 'st-sun'}"/></svg>`; lamp.querySelector('.lt').textContent = d ? 'night page · gel pens' : 'day page · ink'; lamp.setAttribute('aria-label', d ? 'Switch to light mode' : 'Switch to dark mode'); };
  paint();
  lamp.addEventListener('click', () => {
    lamp.classList.add('pull'); setTimeout(() => lamp.classList.remove('pull'), 260);
    const r = lamp.querySelector('.bead').getBoundingClientRect();
    root.style.setProperty('--vx', (r.left + r.width / 2) + 'px'); root.style.setProperty('--vy', (r.top + r.height / 2) + 'px');
    const next = eff() === 'dark' ? 'light' : 'dark';
    const apply = () => { root.dataset.theme = next; try { localStorage.setItem('es-nb-theme', next); } catch (e) { } paint(); dispatchEvent(new Event('themechange')); };
    setTimeout(() => { if (document.startViewTransition && !REDUCED) document.startViewTransition(apply); else apply(); }, 180);
  });
}
function navSetup() {
  const tabs = $('.tabs'), fab = $('.fab');
  if (fab && tabs) { fab.addEventListener('click', () => tabs.classList.toggle('open')); tabs.addEventListener('click', e => { if (e.target.closest('a')) tabs.classList.remove('open'); }); }
  if (tabs) {
    const links = $$('a[href^="#"]', tabs); const map = new Map();
    links.forEach(a => { const t = $(a.getAttribute('href')); if (t) map.set(t, a); });
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { links.forEach(l => l.classList.remove('act')); map.get(e.target)?.classList.add('act'); } }), { rootMargin: '-35% 0px -60% 0px' });
    map.forEach((a, t) => io.observe(t));
  }
  const prog = $('.prog');
  if (prog) { const upd = () => { const m = document.documentElement.scrollHeight - innerHeight; prog.style.width = (m > 0 ? scrollY / m * 100 : 0) + '%'; }; addEventListener('scroll', upd, { passive: true }); upd(); }
}

/* ---------- CODE RENDERER ---------- */
const C_RE = /(\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#\s*\w+)|(\bLPC_\w+(?:->\w+)?)|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|\b(int|void|unsigned|char|long|float|while|for|if|else|return|break|do|switch|case|default)\b/g;
function hlC(line) {
  let out = '', last = 0, m; C_RE.lastIndex = 0;
  while ((m = C_RE.exec(line))) { out += esc(line.slice(last, m.index)); const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'pp' : m[4] ? 'r' : m[5] ? 'n' : 'k'; out += `<span class="${cls}">${esc(m[0])}</span>`; last = C_RE.lastIndex; }
  return out + esc(line.slice(last));
}
function codeBlock(src, title) {
  const lines = src.replace(/^\n+|\s+$/g, '').split('\n');
  const ind = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length));
  const box = el('div', { class: 'code' });
  if (title) box.appendChild(el('div', { class: 'ctitle' }, esc(title)));
  const sc = el('div', { class: 'scroller' }); box.appendChild(sc);
  lines.forEach((l, i) => {
    l = l.slice(ind).replace(/\t/g, '    ');
    let ann = ''; const k = l.indexOf('//~');
    if (k >= 0) { ann = l.slice(k + 3).trim(); l = l.slice(0, k).replace(/\s+$/, ''); }
    const d = el('span', { class: 'cl', 'data-n': i + 1 }, hlC(l) + (ann ? `<span class="an">${esc(ann)}</span>` : ''));
    sc.appendChild(d);
  });
  return box;
}
function renderCodes(root = document) {
  $$('script[type="text/plain"].csrc', root).forEach(s => { const b = codeBlock(s.textContent, s.dataset.title); if (s.id) b.id = s.id; s.replaceWith(b); });
}

/* ---------- STEPPER (code walk-through) ---------- */
function Stepper(host, cfg) {
  host.classList.add('stp');
  const codeEl = codeBlock(cfg.code, cfg.title);
  const side = el('div', { class: 'stp-side' });
  const view = el('div', { class: 'stp-view' });
  const note = el('div', { class: 'note stp-note ' + (cfg.noteClass || 'blue') });
  const prog = el('div', { class: 'stp-prog' }, '<i></i>');
  const ctl = el('div', { class: 'stp-ctl' });
  const bPrev = el('button', { class: 'btn sm', type: 'button', 'aria-label': 'previous step' }, '◀ back');
  const bNext = el('button', { class: 'btn sm p', type: 'button', 'aria-label': 'next step' }, 'next ▶');
  const bPlay = el('button', { class: 'btn sm y', type: 'button' }, '▶▶ play');
  const bReset = el('button', { class: 'btn sm g', type: 'button' }, '⟲');
  const cnt = el('span', { class: 'cnt' });
  ctl.append(bPrev, bNext, bPlay, bReset, cnt);
  if (cfg.extra) ctl.appendChild(cfg.extra);
  side.append(view, note, prog, ctl);
  host.append(codeEl, side);
  const lines = $$('.cl', codeEl);
  let steps = cfg.steps, k = 0, timer = null, first = true;
  function stateAt(n) { const st = cfg.init(); for (let i = 0; i <= n; i++) steps[i] && steps[i].f && steps[i].f(st, i); return st; }
  function go(n, anim = true) {
    k = clamp(n, 0, steps.length - 1);
    const s = steps[k]; const L = s.l == null ? [] : [].concat(s.l);
    lines.forEach(x => x.classList.remove('on', 'on2'));
    L.forEach(n => lines[n - 1] && lines[n - 1].classList.add('on'));
    if (L.length && lines[L[0] - 1]) { const ln = lines[L[0] - 1]; const top = ln.offsetTop - codeEl.clientHeight * .3; if (codeEl.scrollHeight > codeEl.clientHeight + 4) codeEl.scrollTo({ top, behavior: anim && !REDUCED ? 'smooth' : 'auto' }); }
    note.innerHTML = `<div class="sn">step ${k + 1} / ${steps.length}${L.length ? ' · line ' + L.join(', ') : ''}</div>${s.t}`;
    cnt.textContent = `${k + 1}/${steps.length}`;
    prog.firstChild.style.width = ((k + 1) / steps.length * 100) + '%';
    bPrev.disabled = k === 0; bNext.disabled = k === steps.length - 1;
    cfg.view(stateAt(k), view, k, first); first = false;
  }
  function stop() { clearInterval(timer); timer = null; bPlay.textContent = '▶▶ play'; }
  bPrev.onclick = () => { stop(); go(k - 1); };
  bNext.onclick = () => { stop(); go(k + 1); };
  bReset.onclick = () => { stop(); go(0); };
  bPlay.onclick = () => { if (timer) return stop(); if (k >= steps.length - 1) go(0); bPlay.textContent = '❚❚ pause'; timer = setInterval(() => { if (k >= steps.length - 1) return stop(); go(k + 1); }, cfg.speed || 1900); };
  go(0, false);
  return { go, get k() { return k; }, get n() { return steps.length; }, setSteps(s, n = 0) { stop(); steps = s; go(Math.min(n, s.length - 1)); }, view, note, codeEl, refresh() { go(k, false); }, play() { stop(); bPlay.onclick(); }, stateAt, last() { return stateAt(steps.length - 1); } };
}

/* ---------- REGISTER STRIP ---------- */
function RegStrip(host, o) {
  const n = o.bits || 32, wrap = el('div', { class: 'reg regx' });
  if (o.name) wrap.appendChild(el('div', { class: 'rname' }, o.name));
  const row = el('div', { class: 'bits' }); wrap.appendChild(row); host.appendChild(wrap);
  const cells = [];
  for (let b = n - 1; b >= 0; b--) {
    const c = el('div', { class: 'bit' + ((b % 4 === 3 && b !== n - 1) ? ' nib' : '') + (o.click ? ' click' : ''), title: 'bit ' + b }, '0');
    if (o.numbers !== false && (b % 4 === 0 || b === n - 1 || (o.mark && o.mark.includes(b)))) c.appendChild(el('span', { class: 'bn' }, b));
    if (o.click) c.addEventListener('click', () => o.click(b));
    row.appendChild(c); cells[b] = c;
  }
  const api = {
    el: wrap, cells,
    set(v, fields = o.fields) {
      v = v >>> 0;
      for (let b = 0; b < n; b++) { const on = (v >>> b) & 1; const c = cells[b]; c.firstChild.nodeValue = on; c.classList.toggle('one', !!on); c.classList.remove('fld', 'dim'); c.style.removeProperty('--fc'); }
      (fields || []).forEach(f => { for (let b = f.lo; b <= f.hi; b++) if (cells[b]) { cells[b].classList.add('fld'); cells[b].style.setProperty('--fc', f.color || 'var(--pink)'); } });
      if (o.dimOutside && fields && fields.length) for (let b = 0; b < n; b++) if (!fields.some(f => b >= f.lo && b <= f.hi)) cells[b].classList.add('dim');
    }
  };
  api.set(o.value || 0); return api;
}

/* ---------- REGISTER BUILDER ---------- */
const FCOL = ['var(--pink)', 'var(--blue)', 'var(--green)', 'var(--orange)', 'var(--purple)', 'var(--teal)', 'var(--red)', 'var(--brown)'];
function RegBuilder(host, o) {
  const w = o.width || 32; let v = o.value >>> 0 || 0;
  const box = el('div', { class: 'rb' }); host.appendChild(box);
  const top = el('div', { class: 'row' }); box.appendChild(top);
  const strip = RegStrip(top, { bits: w, name: o.name, click: b => { v = (v ^ (1 << b)) >>> 0; upd(); } });
  const fields = o.fields.map((f, i) => ({ ...f, hi: f.hi ?? f.bit, lo: f.lo ?? f.bit, color: f.color || FCOL[i % FCOL.length] }));
  const fWrap = el('div', { class: 'rb-fields' }); box.appendChild(fWrap);
  const fget = f => (v >>> f.lo) & ((1 << (f.hi - f.lo + 1)) - 1);
  const fset = (f, x) => { const m = ((1 << (f.hi - f.lo + 1)) - 1) << f.lo; v = ((v & ~m) | ((x << f.lo) & m)) >>> 0; };
  const uis = fields.map(f => {
    const c = el('div', { class: 'rb-f', style: `--fc:${f.color}` });
    c.innerHTML = `<div class="fn"><span>${f.name}</span><small>bit${f.hi === f.lo ? ' ' + f.lo : 's ' + f.hi + ':' + f.lo}</small></div>${f.desc ? `<div class="fd">${f.desc}</div>` : ''}`;
    const chips = el('div', { class: 'chips' }); c.appendChild(chips);
    let inp = null;
    if (f.opts) {
      Object.entries(f.opts).forEach(([val, lab]) => { const ch = el('button', { class: 'chip', type: 'button', 'data-v': val }, lab); ch.onclick = () => { fset(f, +val); upd(); }; chips.appendChild(ch); });
    } else {
      inp = el('input', { class: 'inp', type: 'number', min: 0, max: (1 << (f.hi - f.lo + 1)) - 1, value: 0, 'aria-label': f.name }); inp.oninput = () => { fset(f, clamp(+inp.value || 0, 0, (1 << (f.hi - f.lo + 1)) - 1)); upd(true); }; chips.appendChild(inp);
    }
    fWrap.appendChild(c); return { f, chips, inp };
  });
  const out = el('div', { class: 'rb-out' }); box.appendChild(out);
  const roHex = el('span', { class: 'ro big' }), roC = el('span', { class: 'ro' });
  out.append(el('span', { class: 'gae' }, 'value ='), roHex, roC);
  if (o.presets) { const pr = el('div', { class: 'chips' }); pr.appendChild(el('span', { class: 'cav p-soft' }, 'from the slides:')); o.presets.forEach(([pv, lab]) => { const b = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-o)' }, `${hx(pv, o.hexd || 2)} · ${lab}`); b.onclick = () => { v = pv >>> 0; upd(); }; pr.appendChild(b); }); box.appendChild(pr); }
  const say = el('ul', { class: 'b arrow rb-say' }); box.appendChild(say);
  function upd(fromInput) {
    strip.set(v, fields);
    uis.forEach(u => { const x = fget(u.f); if (u.inp) { if (!fromInput) u.inp.value = x; } else $$('.chip', u.chips).forEach(ch => ch.classList.toggle('on', +ch.dataset.v === x)); });
    roHex.textContent = hx(v, o.hexd || Math.max(2, Math.ceil(w / 4)));
    roC.textContent = `${o.reg || o.name} = ${hx(v, o.hexd || 2)};`;
    const lines = fields.map(f => { const x = fget(f); const s = f.say ? (typeof f.say === 'function' ? f.say(x, v) : f.say[x]) : null; return s ? `<li>${s}</li>` : ''; }).join('');
    say.innerHTML = lines || '<li class="p-faint">all actions off</li>';
    o.onchange && o.onchange(v);
  }
  upd();
  return { get v() { return v; }, set(x) { v = x >>> 0; upd(); } };
}


/* ---------- GRID BUILDER (e.g. MCR: rows = match regs, cols = I/R/S) ---------- */
function GridBuilder(host, o) {
  let v = o.value >>> 0 || 0; const R = o.rows.length, C = o.cols.length, w = o.width || R * C;
  const box = el('div', { class: 'rb' }); host.appendChild(box);
  const strip = RegStrip(box, { bits: w, name: o.name, click: b => { v = (v ^ (1 << b)) >>> 0; upd(); } });
  const tbl = el('table', { class: 'gb' }); box.appendChild(tbl);
  let hd = '<tr><th></th>' + o.cols.map(c => `<th title="${esc(c.d || '')}">${c.n}<small>${c.d || ''}</small></th>`).join('') + '</tr>';
  tbl.innerHTML = hd;
  const cells = [];
  o.rows.forEach((rn, r) => {
    const tr = el('tr'); tr.appendChild(el('th', {}, rn));
    o.cols.forEach((cn, c) => {
      const b = o.bitOf(r, c); const td = el('td');
      const btn = el('button', { class: 'gcell', type: 'button', 'aria-label': `${rn} ${cn.n}` }, `<span>${cn.n}</span><small>bit ${b}</small>`);
      btn.onclick = () => { v = (v ^ (1 << b)) >>> 0; upd(); };
      td.appendChild(btn); tr.appendChild(td); cells.push([btn, b]);
    });
    tbl.appendChild(tr);
  });
  const out = el('div', { class: 'rb-out' }); box.appendChild(out);
  const roHex = el('span', { class: 'ro big' }), roC = el('span', { class: 'ro' });
  out.append(el('span', { class: 'gae' }, 'value ='), roHex, roC);
  if (o.presets) { const pr = el('div', { class: 'chips' }); pr.appendChild(el('span', { class: 'cav p-soft' }, 'from the slides:')); o.presets.forEach(([pv, lab]) => { const b = el('button', { class: 'chip', type: 'button', style: '--cc:var(--n-o)' }, `${hx(pv, o.hexd || 2)} · ${lab}`); b.onclick = () => { v = pv >>> 0; upd(); }; pr.appendChild(b); }); box.appendChild(pr); }
  const say = el('ul', { class: 'b arrow rb-say' }); box.appendChild(say);
  function upd() {
    strip.set(v, o.rows.map((rn, r) => ({ lo: o.bitOf(r, 0), hi: o.bitOf(r, C - 1), color: FCOL[r % FCOL.length] })));
    cells.forEach(([b, bit]) => b.classList.toggle('on', !!((v >>> bit) & 1)));
    roHex.textContent = hx(v, o.hexd || Math.max(2, Math.ceil(w / 4))); roC.textContent = `${o.reg} = ${hx(v, o.hexd || 2)};`;
    const L = []; o.rows.forEach((rn, r) => o.cols.forEach((cn, c) => { if ((v >>> o.bitOf(r, c)) & 1) L.push(`<li>${cn.say(rn, r)}</li>`); }));
    say.innerHTML = L.join('') || '<li class="p-faint">no actions — matches are ignored</li>';
    o.onchange && o.onchange(v);
  }
  upd(); return { get v() { return v; }, set(x) { v = x >>> 0; upd(); } };
}

/* ---------- 7-SEGMENT ---------- */
const SEG_POLY = {
  a: '15,6 51,6 55,10 51,14 15,14 11,10', b: '55,12 59,16 59,46 55,50 51,46 51,16', c: '55,54 59,58 59,88 55,92 51,88 51,58',
  d: '15,90 51,90 55,94 51,98 15,98 11,94', e: '11,54 15,58 15,88 11,92 7,88 7,58', f: '11,12 15,16 15,46 11,50 7,46 7,16', g: '15,48 51,48 55,52 51,56 15,56 11,52'
};
function SevenSeg(host, o = {}) {
  const s = sv('svg', { class: 'seg7', viewBox: '-4 -2 78 108' });
  sv('rect', { class: 'case', x: -4, y: -2, width: 78, height: 108, rx: 6 }, s);
  const g = sv('g', { transform: 'skewX(-6) translate(8 0)' }, s);
  const segs = {};
  'abcdefg'.split('').forEach(k => { segs[k] = sv('polygon', { class: 's', points: SEG_POLY[k] }, g); });
  segs.dp = sv('circle', { class: 's', cx: 64, cy: 95, r: 4 }, g);
  if (o.labels) 'abcdefg'.split('').forEach(k => { const p = SEG_POLY[k].split(' ')[0].split(','); });
  host.appendChild(s);
  const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'];
  return { el: s, segs, set(code) { order.forEach((k, i) => segs[k].classList.toggle('on', !!((code >> i) & 1))); } };
}
const SEVEN = [0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F, 0x77, 0x7C, 0x58, 0x5E, 0x79, 0x71];

/* ---------- KEYPAD ---------- */
function Keypad(host, o = {}) {
  const R = o.rows || 4, C = o.cols || 4, labels = o.labels || '0123456789AbcdEF'.split('');
  const g = el('div', { class: 'kpad', style: `grid-template-columns:repeat(${C},1fr)` });
  const keys = []; const pressed = new Set();
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const i = r * C + c; const k = el('button', { class: 'kkey', type: 'button', 'data-k': i, 'aria-label': 'key ' + labels[i] }, `<b>${labels[i]}</b><small>r${r} c${c}</small>`);
    const down = e => { e.preventDefault(); if (o.latch && o.latch()) { pressed.has(i) ? pressed.delete(i) : pressed.add(i); } else pressed.add(i); paint(); o.onchange && o.onchange(pressed, i, 'down'); };
    const up = () => { if (o.latch && o.latch()) return; if (pressed.delete(i)) { paint(); o.onchange && o.onchange(pressed, i, 'up'); } };
    k.addEventListener('pointerdown', down); k.addEventListener('pointerup', up); k.addEventListener('pointerleave', up); k.addEventListener('pointercancel', up);
    k.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); pressed.has(i) ? pressed.delete(i) : pressed.add(i); paint(); o.onchange && o.onchange(pressed, i); } });
    g.appendChild(k); keys.push(k);
  }
  function paint() { keys.forEach((k, i) => k.classList.toggle('down', pressed.has(i))); }
  host.appendChild(g);
  return { el: g, keys, pressed, paint, clear() { pressed.clear(); paint(); }, row(r) { keys.forEach((k, i) => k.classList.toggle('rowon', r != null && Math.floor(i / C) === r)); } };
}

/* ---------- HD44780 LCD (emulator + dot-matrix view) ---------- */
const FONT5x7 = [0x00,0x00,0x00,0x00,0x00, 0x00,0x00,0x5F,0x00,0x00, 0x00,0x07,0x00,0x07,0x00, 0x14,0x7F,0x14,0x7F,0x14, 0x24,0x2A,0x7F,0x2A,0x12, 0x23,0x13,0x08,0x64,0x62, 0x36,0x49,0x55,0x22,0x50, 0x00,0x05,0x03,0x00,0x00, 0x00,0x1C,0x22,0x41,0x00, 0x00,0x41,0x22,0x1C,0x00, 0x08,0x2A,0x1C,0x2A,0x08, 0x08,0x08,0x3E,0x08,0x08, 0x00,0x50,0x30,0x00,0x00, 0x08,0x08,0x08,0x08,0x08, 0x00,0x60,0x60,0x00,0x00, 0x20,0x10,0x08,0x04,0x02,
  0x3E,0x51,0x49,0x45,0x3E, 0x00,0x42,0x7F,0x40,0x00, 0x42,0x61,0x51,0x49,0x46, 0x21,0x41,0x45,0x4B,0x31, 0x18,0x14,0x12,0x7F,0x10, 0x27,0x45,0x45,0x45,0x39, 0x3C,0x4A,0x49,0x49,0x30, 0x01,0x71,0x09,0x05,0x03, 0x36,0x49,0x49,0x49,0x36, 0x06,0x49,0x49,0x29,0x1E, 0x00,0x36,0x36,0x00,0x00, 0x00,0x56,0x36,0x00,0x00, 0x00,0x08,0x14,0x22,0x41, 0x14,0x14,0x14,0x14,0x14, 0x41,0x22,0x14,0x08,0x00, 0x02,0x01,0x51,0x09,0x06,
  0x32,0x49,0x79,0x41,0x3E, 0x7E,0x11,0x11,0x11,0x7E, 0x7F,0x49,0x49,0x49,0x36, 0x3E,0x41,0x41,0x41,0x22, 0x7F,0x41,0x41,0x22,0x1C, 0x7F,0x49,0x49,0x49,0x41, 0x7F,0x09,0x09,0x01,0x01, 0x3E,0x41,0x41,0x51,0x32, 0x7F,0x08,0x08,0x08,0x7F, 0x00,0x41,0x7F,0x41,0x00, 0x20,0x40,0x41,0x3F,0x01, 0x7F,0x08,0x14,0x22,0x41, 0x7F,0x40,0x40,0x40,0x40, 0x7F,0x02,0x04,0x02,0x7F, 0x7F,0x04,0x08,0x10,0x7F, 0x3E,0x41,0x41,0x41,0x3E,
  0x7F,0x09,0x09,0x09,0x06, 0x3E,0x41,0x51,0x21,0x5E, 0x7F,0x09,0x19,0x29,0x46, 0x46,0x49,0x49,0x49,0x31, 0x01,0x01,0x7F,0x01,0x01, 0x3F,0x40,0x40,0x40,0x3F, 0x1F,0x20,0x40,0x20,0x1F, 0x7F,0x20,0x18,0x20,0x7F, 0x63,0x14,0x08,0x14,0x63, 0x03,0x04,0x78,0x04,0x03, 0x61,0x51,0x49,0x45,0x43, 0x00,0x00,0x7F,0x41,0x41, 0x02,0x04,0x08,0x10,0x20, 0x41,0x41,0x7F,0x00,0x00, 0x04,0x02,0x01,0x02,0x04, 0x40,0x40,0x40,0x40,0x40,
  0x00,0x01,0x02,0x04,0x00, 0x20,0x54,0x54,0x54,0x78, 0x7F,0x48,0x44,0x44,0x38, 0x38,0x44,0x44,0x44,0x20, 0x38,0x44,0x44,0x48,0x7F, 0x38,0x54,0x54,0x54,0x18, 0x08,0x7E,0x09,0x01,0x02, 0x08,0x14,0x54,0x54,0x3C, 0x7F,0x08,0x04,0x04,0x78, 0x00,0x44,0x7D,0x40,0x00, 0x20,0x40,0x44,0x3D,0x00, 0x00,0x7F,0x10,0x28,0x44, 0x00,0x41,0x7F,0x40,0x00, 0x7C,0x04,0x18,0x04,0x78, 0x7C,0x08,0x04,0x04,0x78, 0x38,0x44,0x44,0x44,0x38,
  0x7C,0x14,0x14,0x14,0x08, 0x08,0x14,0x14,0x18,0x7C, 0x7C,0x08,0x04,0x04,0x08, 0x48,0x54,0x54,0x54,0x20, 0x04,0x3F,0x44,0x40,0x20, 0x3C,0x40,0x40,0x20,0x7C, 0x1C,0x20,0x40,0x20,0x1C, 0x3C,0x40,0x30,0x40,0x3C, 0x44,0x28,0x10,0x28,0x44, 0x0C,0x50,0x50,0x50,0x3C, 0x44,0x64,0x54,0x4C,0x44, 0x00,0x08,0x36,0x41,0x00, 0x00,0x00,0x7F,0x00,0x00, 0x00,0x41,0x36,0x08,0x00, 0x08,0x08,0x2A,0x1C,0x08];
class HD44780 {
  constructor() { this.powerOn(); }
  clone() { const c = new HD44780(); Object.assign(c, this); c.dd = this.dd.slice(); return c; }
  powerOn() { this.dd = new Uint8Array(128).fill(0x20); this.ac = 0; this.id = 1; this.S = 0; this.D = 0; this.C = 0; this.B = 0; this.sh = 0; this.DL = 1; this.N = 0; this.F = 0; this.bus8 = true; this.half = null; }
  ready() { this.powerOn(); this.DL = 0; this.bus8 = false; this.N = 1; this.D = 1; return this; }
  inc(d) { let a = this.ac; if (this.N) { if (d > 0) { a++; if (a === 0x28) a = 0x40; else if (a === 0x68) a = 0; } else { a--; if (a < 0) a = 0x67; else if (a === 0x3F) a = 0x27; } } else a = (a + d + 80) % 80; this.ac = a; }
  cmd(c) {
    c &= 0xFF;
    if (c & 0x80) { this.ac = c & 0x7F; return `move cursor → DDRAM address ${hx(c & 0x7F)} (line ${(c & 0x40) ? 2 : 1}, box ${(c & 0x3F) + 1})`; }
    if (c & 0x40) return 'set CGRAM address (custom characters) – not used here';
    if (c & 0x20) { this.DL = (c >> 4) & 1; this.N = (c >> 3) & 1; this.F = (c >> 2) & 1; this.bus8 = !!this.DL; this.half = null; return `function set: ${this.DL ? '8-bit' : '4-bit'} bus, ${this.N ? '2 lines' : '1 line'}, ${this.F ? '5×10' : '5×7'} dots`; }
    if (c & 0x10) { const sc = (c >> 3) & 1, rl = (c >> 2) & 1; if (sc) this.sh = (this.sh + (rl ? -1 : 1) + 40) % 40; else this.inc(rl ? 1 : -1); return sc ? `shift whole display ${rl ? 'right' : 'left'}` : `move cursor ${rl ? 'right' : 'left'}`; }
    if (c & 0x08) { this.D = (c >> 2) & 1; this.C = (c >> 1) & 1; this.B = c & 1; return `display ${this.D ? 'ON' : 'OFF'}, cursor ${this.C ? 'ON' : 'OFF'}, blink ${this.B ? 'ON' : 'OFF'}`; }
    if (c & 0x04) { this.id = (c >> 1) & 1; this.S = c & 1; return `entry mode: cursor ${this.id ? 'increments (→)' : 'decrements (←)'}${this.S ? ', display shifts with each char' : ''}`; }
    if (c & 0x02) { this.ac = 0; this.sh = 0; return 'return home (cursor to box 1, undo shifts)'; }
    if (c & 0x01) { this.dd.fill(0x20); this.ac = 0; this.sh = 0; this.id = 1; return 'clear display, cursor home'; }
    return 'no operation';
  }
  data(ch) { this.dd[this.ac] = ch & 0xFF; this.inc(this.id ? 1 : -1); if (this.S) this.sh = (this.sh + (this.id ? 1 : -1) + 40) % 40; }
  bus(rs, nib) { if (this.bus8) { const b = (nib & 15) << 4; rs ? this.data(b) : this.cmd(b); return { byte: b, w: 8 }; } if (this.half === null) { this.half = nib & 15; return { half: this.half }; } const b = (this.half << 4) | (nib & 15); this.half = null; rs ? this.data(b) : this.cmd(b); return { byte: b, w: 4 }; }
  print(s) { for (const ch of s) this.data(ch.charCodeAt(0)); }
  cell(line, col) { if (!this.N) return line ? -1 : (col + this.sh) % 80; return (line ? 0x40 : 0) + ((col + this.sh) % 40); }
}
const LCDS = new Set();
function LCDView(host, lcd, o = {}) {
  const box = el('div', { class: 'lcdbox' + (o.blue ? ' blue' : '') }); const cv = el('canvas'); box.appendChild(cv); host.appendChild(box);
  const P = 5, pad = 9, CW = 6 * P, RH = 9 * P; const W = pad * 2 + 16 * CW - P, H = pad * 2 + 2 * RH - P;
  const dpr = Math.min(2, devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  let blinkOn = true, vis = true;
  const view = { lcd, box, cv, highlight: null,
    draw() {
      const L = this.lcd; const cs = getComputedStyle(document.documentElement);
      const bg = o.blue ? '#2f6fd6' : cs.getPropertyValue('--lcd-bg').trim() || '#a5d63c', on = o.blue ? '#f2f8ff' : '#1d3a10', off = o.blue ? 'rgba(255,255,255,.10)' : 'rgba(40,80,10,.13)';
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      for (let line = 0; line < 2; line++) for (let col = 0; col < 16; col++) {
        const x0 = pad + col * CW, y0 = pad + line * RH; const a = L.cell(line, col);
        let code = a >= 0 && L.D ? L.dd[a] : 0x20; let cols = (code >= 0x20 && code <= 0x7E) ? FONT5x7.slice((code - 0x20) * 5, (code - 0x20) * 5 + 5) : (code >= 0x80 ? [0x7F, 0x41, 0x41, 0x41, 0x7F] : code < 8 ? [0x55, 0x2A, 0x55, 0x2A, 0x55] : [0, 0, 0, 0, 0]);
        const isCur = L.D && a === L.ac; const blk = isCur && L.B && blinkOn; const und = isCur && L.C;
        if (this.highlight && this.highlight(line, col, a)) { ctx.fillStyle = 'rgba(255,90,140,.28)'; ctx.fillRect(x0 - 2, y0 - 2, CW - P + 4, RH - P + 4); }
        for (let cx = 0; cx < 5; cx++) for (let cy = 0; cy < 8; cy++) {
          let lit = cy < 7 ? (cols[cx] >> cy) & 1 : 0; if (blk) lit = 1; if (und && cy === 7) lit = 1;
          ctx.fillStyle = lit ? on : off; ctx.fillRect(x0 + cx * P, y0 + cy * P, P - 1, P - 1);
        }
      }
    }
  };
  LCDS.add(view); onVisible(box, v => { vis = v; view.vis = v; }); view.vis = true;
  view.draw(); view.tick = () => { blinkOn = !blinkOn; if (view.vis && view.lcd.B && view.lcd.D) view.draw(); };
  return view;
}
setInterval(() => LCDS.forEach(v => v.tick()), 420);
addEventListener('themechange', () => LCDS.forEach(v => v.draw()));

/* ---------- small helpers for waveform SVGs ---------- */
function digi(points, X, yH, yL) { // points: [[t,level],...] sorted
  if (!points.length) return '';
  let d = `M${X(points[0][0]).toFixed(1)} ${(points[0][1] ? yH : yL)}`;
  for (let i = 1; i < points.length; i++) { const x = X(points[i][0]).toFixed(1); d += `H${x}V${points[i][1] ? yH : yL}`; }
  return d;
}
/* a loop that only runs while visible */
function Loop(node, step) {
  let raf = 0, run = false, vis = true, last = 0;
  const f = t => { raf = 0; if (!run) return; const dt = last ? Math.min(.1, (t - last) / 1000) : 0; last = t; step(dt, t); if (vis) raf = requestAnimationFrame(f); };
  onVisible(node, v => { vis = v; if (v && run && !raf) { last = 0; raf = requestAnimationFrame(f); } });
  return { start() { if (run) return; run = true; last = 0; if (!raf) raf = requestAnimationFrame(f); }, stop() { run = false; }, get on() { return run; } };
}

/* ---------- BIT PLAYGROUND ---------- */
function safeEval(expr) {
  if (!/^[\s0-9a-fA-FxX<>|&~^()+\-*]+$/.test(expr)) throw new Error('only numbers and << >> | & ~ ( ) allowed');
  const v = Function('"use strict";return (' + expr + ')')();
  if (typeof v !== 'number' || !isFinite(v)) throw new Error('not a number');
  return v >>> 0;
}


/* ---------- page widget registry ---------- */
const BUILD = [];
function PAGE() { BUILD.forEach(f => { try { f(); } catch (e) { console.error('widget failed:', f.name, e); } }); }
const TAPES = ['', 'w2', 'w3', 'w4', 'w5'];
function W(id, title, info) {
  const w = document.getElementById(id); if (!w) { console.warn('no widget host', id); return el('div'); }
  w.insertAdjacentHTML('afterbegin', `<span class="washi tl ${TAPES[strHash(id) % 5]}"></span><div class="wg-h"><span class="wt">${title}</span>${info ? `<span class="wi">${info}</span>` : ''}</div>`);
  return w;
}
function chipGroup(host, items, cur, onpick, cls = '') { // items: [[value,label],...]
  const g = el('div', { class: 'chips ' + cls }); host.appendChild(g);
  const set = v => { $$('.chip', g).forEach(c => c.classList.toggle('on', c.dataset.v === String(v))); };
  items.forEach(([v, lab, col]) => { const c = el('button', { class: 'chip', type: 'button', 'data-v': v, style: col ? `--cc:${col}` : '' }, lab); c.onclick = () => { set(v); onpick(v); }; g.appendChild(c); });
  set(cur); return { el: g, set };
}
function ruler(host, label, min, max, val, step, fmt, oninput) {
  const id = 'r' + Math.random().toString(36).slice(2, 8);
  const w = el('div', { class: 'rl' }); w.innerHTML = `<label for="${id}"><span>${label}</span><output></output></label>`;
  const r = el('input', { type: 'range', class: 'ruler', id, min, max, step: step || 1, value: val }); w.appendChild(r); host.appendChild(w);
  const o = w.querySelector('output'); const f = () => { o.textContent = fmt ? fmt(+r.value) : r.value; oninput && oninput(+r.value); };
  r.addEventListener('input', f); o.textContent = fmt ? fmt(+r.value) : r.value; return r;
}
function miniBits(host, labels, title) { // small labelled bit cells, labels left→right
  const w = el('div', { class: 'mbits' }); if (title) w.appendChild(el('div', { class: 'mbt' }, title));
  const row = el('div', { class: 'mbr' }); w.appendChild(row); host.appendChild(w);
  const cells = labels.map(l => { const c = el('div', { class: 'mb' }, `<i>0</i><small>${l}</small>`); row.appendChild(c); return c; });
  return { el: w, set(arr) { arr.forEach((b, i) => { const c = cells[i]; if (!c) return; c.firstChild.textContent = b === null ? '?' : b; c.classList.toggle('one', b === 1); c.classList.toggle('unk', b === null); }); } };
}

/* find the line number (1-based) of the n-th line containing txt */
function lineOf(code, txt, n = 1) { const L = code.replace(/^\n+|\s+$/g, '').split('\n'); let c = 0; for (let i = 0; i < L.length; i++) if (L[i].includes(txt) && ++c === n) return i + 1; console.warn('lineOf miss', txt); return 0; }
/* ---------- boot ---------- */
function bootCore() {
  renderCodes(); if (typeof PAGE === 'function') PAGE();
  jitterText(); sketchBoxes(); penMarks(); themeSetup(); navSetup();
  requestAnimationFrame(() => reveal());
}
