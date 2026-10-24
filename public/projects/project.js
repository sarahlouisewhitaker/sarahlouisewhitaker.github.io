// Project showcase template · small behaviours only (all optional; the page reads fine without JS).
// 1. [data-reveal] blocks fade up once when they scroll into view (adds .seen).
// 2. The hairline at the top fills as you read.
// 3. Animated figures: <figure class="viz" data-viz="…"> SVG micro-animations, plus the bar chart and
//    unit chart drawing themselves. Each plays once when scrolled into view, can be replayed with its
//    Replay button, and shows its final state, still, under prefers-reduced-motion.
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = () => !reduceMQ.matches;
  const canAnimate = typeof Element.prototype.animate === 'function';

  /* ---------- 1. reveal ---------- */
  const reveal = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveal.forEach((el) => io.observe(el));
  } else {
    reveal.forEach((el) => el.classList.add('seen'));
  }

  /* ---------- 2. reading progress ---------- */
  const bar = document.querySelector('.progress i');
  if (bar) {
    let queued = false;
    const update = () => {
      const max = root.scrollHeight - root.clientHeight;
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, root.scrollTop / max) : 0})`;
      queued = false;
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', update);
    update();
  }

  /* ---------- 3. animated figures ---------- */
  const NS = 'http://www.w3.org/2000/svg';
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const SPRING = 'cubic-bezier(.3,1.5,.5,1)';
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

  const make = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const a in attrs) n.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(n);
    return n;
  };
  // transforms on SVG shapes scale/rotate around their own centre
  const pin = (n, origin = 'center') => { n.style.transformBox = 'fill-box'; n.style.transformOrigin = origin; return n; };
  // circle / square / diamond: one shape per data source
  const shape = (kind, x, y, r, attrs, parent) => {
    const n = kind === 0 ? make('circle', { cx: x, cy: y, r }, parent)
      : kind === 1 ? make('rect', { x: x - r * 0.88, y: y - r * 0.88, width: r * 1.76, height: r * 1.76, rx: 0.6 }, parent)
        : make('path', { d: `M${x} ${y - r * 1.2}L${x + r * 1.2} ${y}L${x} ${y + r * 1.2}L${x - r * 1.2} ${y}Z` }, parent);
    for (const a in attrs) n.setAttribute(a, attrs[a]);
    return pin(n);
  };
  // seeded random numbers, so a figure looks the same on every visit
  const rng = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const palette = (node) => {
    const cs = getComputedStyle(node);
    const v = (n) => cs.getPropertyValue(n).trim();
    return { accent: v('--accent'), ink: v('--ink'), sumi: v('--sumi'), muted: v('--muted'), line: v('--line'),
      strong: v('--line-strong'), gold: v('--gold'), seal: v('--seal'), paper: v('--paper'), card: v('--card') };
  };
  const rgb = (hex) => { let h = hex.replace('#', ''); if (h.length === 3) h = [...h].map((x) => x + x).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return `rgb(${A.map((v, i) => Math.round(v * t + B[i] * (1 - t))).join(',')})`; };
  const dash = (path) => { const L = path.getTotalLength(); path.style.strokeDasharray = `${L}px ${L}px`; return L; };

  // A timeline of Web Animations, cues and counters that can be primed (start state), played, replayed or finished.
  class Timeline {
    constructor() { this.anims = []; this.counters = []; this.raf = 0; }
    add(node, frames, opts = {}) {
      const a = node.animate(frames, { duration: 600, easing: EASE, fill: 'both', ...opts });
      a.pause();
      this.anims.push(a);
      return a;
    }
    // one animation through absolute times: [{ t: ms, …props }, …]
    seq(node, frames, opts = {}) {
      const t0 = frames[0].t, span = Math.max(1, frames[frames.length - 1].t - t0);
      return this.add(node, frames.map(({ t, ...p }) => ({ easing: EASE, ...p, offset: (t - t0) / span })),
        { delay: t0, duration: span, easing: 'linear', ...opts });
    }
    count(node, to, { from = 0, delay = 0, duration = 1200, format = fmtInt, done } = {}) {
      this.counters.push({ node, from, to, delay, duration, format, done: done ?? format(to) });
    }
    prime() { this.anims.forEach((a) => { a.pause(); a.currentTime = 0; }); this.counters.forEach((c) => { c.node.textContent = c.format(c.from); }); }
    play() {
      cancelAnimationFrame(this.raf);
      this.anims.forEach((a) => { a.cancel(); a.play(); });
      if (!this.counters.length) return;
      const t0 = performance.now();
      const tick = (now) => {
        let live = false;
        this.counters.forEach((c) => {
          const t = Math.min(1, Math.max(0, (now - t0 - c.delay) / c.duration));
          if (t < 1) live = true;
          c.node.textContent = t >= 1 ? c.done : c.format(c.from + (c.to - c.from) * easeOut(t));
        });
        if (live) this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    }
    finish() { cancelAnimationFrame(this.raf); this.anims.forEach((a) => a.finish()); this.counters.forEach((c) => { c.node.textContent = c.done; }); }
    stop() { cancelAnimationFrame(this.raf); this.anims.forEach((a) => a.cancel()); }
  }

  // highlight a piece of the page text (a flow step or a method card) while its part of the figure plays
  const pulse = (tl, el, to, delay, duration) => {
    if (!el) return;
    const cs = getComputedStyle(el);
    const from = {};
    Object.keys(to).forEach((p) => { from[p] = cs[p]; });
    tl.add(el, [from, { ...to, offset: 0.2 }, { ...to, offset: 0.8 }, from], { delay, duration, fill: 'none', easing: 'ease-in-out' });
  };
  const pulseStep = (tl, el, c, delay, duration) => pulse(tl, el, { borderTopColor: c.accent, borderRightColor: c.accent, borderBottomColor: c.accent, borderLeftColor: c.accent, color: c.accent }, delay, duration);
  const pulseCard = (tl, el, c, delay, duration) => pulse(tl, el, { backgroundColor: mix(c.accent, c.card, 0.12) }, delay, duration);
  const near = (fig, sel) => [...(fig.closest('.step-body, .chapter-body') || document).querySelectorAll(sel)];

  /* ---------- the figures ----------
     dims(narrow) returns the viewBox size; it must match the aspect-ratio rules in project.css.
     "narrow" is the layout for figures under 520px wide (phones), set by a container query there. */
  const VIZ = {};

  // Research 02 · 2M+ records, to scale: 400 dots × 5,000 records each = 2,000,000, then a "+" for the rest.
  VIZ.records = {
    seed: 11,
    dims: (narrow) => (narrow ? [262, 162] : [512, 82]),
    draw({ svg, tl, c, narrow, k, rnd, fig, w, h }) {
      const cols = narrow ? 25 : 50, rows = narrow ? 16 : 8, cell = 10, pad = 6;
      const g = make('g', {}, svg);
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const x = pad + col * cell, y = pad + row * cell;
          const d = pin(make('circle', { cx: x, cy: y, r: narrow ? 2.05 : 2.2, fill: c.accent, opacity: 0.92 }, g));
          const sx = rnd() * w, sy = rnd() * h, s = 0.55 + rnd() * 0.9;
          tl.add(d, [
            { transform: `translate(${(sx - x).toFixed(1)}px,${(sy - y).toFixed(1)}px) scale(${s.toFixed(2)})`, fill: c.strong, opacity: 0.5 },
            { transform: 'translate(0px,0px) scale(1)', fill: c.accent, opacity: 0.92 },
          ], { delay: 120 + (col / cols) * 1050 + rnd() * 220, duration: 780 });
        }
      }
      const px = pad + cols * cell, py = pad + (rows - 1) * cell;
      const plus = pin(make('path', { d: `M${px - 3.4} ${py}H${px + 3.4}M${px} ${py - 3.4}V${py + 3.4}`, fill: 'none', stroke: c.gold, 'stroke-width': 1.5 * k, 'stroke-linecap': 'round' }, svg));
      tl.add(plus, [{ opacity: 0, transform: 'scale(.2) rotate(-90deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { delay: 1950, duration: 520, easing: SPRING });
      const counter = fig.querySelector('.viz-count');
      if (counter) {
        const done = counter.textContent;
        tl.count(counter, Number(counter.dataset.to), { delay: 160, duration: 1800, format: (n) => fmtInt(Math.round(n / 5000) * 5000), done });
      }
    },
  };

  // Research 02 · three public sources flow into one dataset (schematic: 8 dots per source, no real counts).
  VIZ.merge = {
    seed: 5,
    dims: (narrow) => (narrow ? [340, 250] : [600, 170]),
    draw({ svg, tl, c, narrow, k, label, fig }) {
      const names = ['TFRRS', 'Athletic.net', 'MileSplit'];
      let S, M, T, slot, frame;
      if (narrow) {
        S = [[56, 50], [170, 50], [284, 50]]; M = [170, 150]; T = [170, 174];
        slot = (i) => [135 + (i % 6) * 14, 192 + Math.floor(i / 6) * 14];
        frame = [124, 181, 92, 64];
        names.forEach((n, i) => label(S[i][0], 24, n, '', 'c'));
        label(226, 213, 'One dataset', '', 'l');
      } else {
        S = [[126, 30], [126, 85], [126, 140]]; M = [372, 85]; T = [468, 85];
        slot = (i) => [495 + (i % 6) * 14, 64 + Math.floor(i / 6) * 14];
        frame = [484, 53, 92, 64];
        names.forEach((n, i) => label(108, S[i][1], n, '', 'r'));
        label(530, 136, 'One dataset', '', 'c');
      }
      const curve = (i) => (narrow ? [S[i], [S[i][0], 112], [M[0], 108], M] : [S[i], [252, S[i][1]], [292, M[1]], M]);
      const bez = (p, t) => { const u = 1 - t; return [0, 1].map((a) => u * u * u * p[0][a] + 3 * u * u * t * p[1][a] + 3 * u * t * t * p[2][a] + t * t * t * p[3][a]); };
      const lines = make('g', { fill: 'none', 'stroke-width': k }, svg);
      [0, 1, 2].forEach((i) => {
        const p = curve(i);
        const path = make('path', { d: `M${p[0]}C${p[1]} ${p[2]} ${p[3]}`, stroke: c.strong }, lines);
        const L = dash(path);
        tl.add(path, [{ strokeDashoffset: `${L}px` }, { strokeDashoffset: '0px' }], { delay: 60 + i * 90, duration: 700 });
      });
      const trunk = make('path', { d: `M${M}L${T}`, stroke: c.sumi }, lines);
      const LT = dash(trunk);
      tl.add(trunk, [{ strokeDashoffset: `${LT}px` }, { strokeDashoffset: '0px' }], { delay: 560, duration: 320 });
      const fr = make('rect', { x: frame[0], y: frame[1], width: frame[2], height: frame[3], rx: 3, fill: 'none', stroke: c.strong, 'stroke-width': k }, svg);
      tl.add(fr, [{ opacity: 0 }, { opacity: 1 }], { delay: 700, duration: 500 });
      const cards = near(fig, '.trio > div');
      S.forEach((s, i) => {
        const m = shape(i, s[0], s[1], 5.6, { fill: c.paper, stroke: c.ink, 'stroke-width': k }, svg);
        tl.add(m, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { delay: i * 90, duration: 480, easing: SPRING });
        pulseCard(tl, cards[i], c, i * 110, 900);
      });
      for (let n = 0; n < 8; n++) {
        for (let i = 0; i < 3; i++) {
          const [fx, fy] = slot(n * 3 + i);
          const dot = shape(i, fx, fy, 3, { fill: c.accent }, svg);
          const p = curve(i), pts = [];
          for (let s = 0; s <= 14; s++) pts.push(bez(p, s / 14));
          pts.push(T, [fx, fy]);
          const seg = pts.slice(1).map((q, j) => Math.hypot(q[0] - pts[j][0], q[1] - pts[j][1]));
          const total = seg.reduce((a, b) => a + b, 0);
          let acc = 0;
          const frames = pts.map((q, j) => {
            if (j) acc += seg[j - 1];
            const off = j === pts.length - 1 ? 1 : acc / total;
            return { offset: off, transform: `translate(${(q[0] - fx).toFixed(1)}px,${(q[1] - fy).toFixed(1)}px)`, fill: off > 0.84 ? c.accent : c.sumi, opacity: j === 0 ? 0 : 1 };
          });
          tl.add(dot, frames, { delay: 560 + n * 120 + i * 45, duration: 1150, easing: 'cubic-bezier(.45,.05,.3,1)' });
        }
      }
    },
  };

  // Research 02 · cleaning (schematic): misaligned rows with odd formats, a missing value and an unusable one
  // become an aligned table; a new variable is derived; two records of the same athlete are linked.
  VIZ.clean = {
    seed: 3,
    dims: (narrow) => (narrow ? [340, 216] : [600, 178]),
    draw({ svg, tl, c, narrow, k, rnd, fig }) {
      const X = narrow ? [128, 160, 192, 224, 256] : [200, 258, 316, 374, 432];
      const XD = narrow ? 306 : 508;
      const XS = narrow ? 100 : 166;          // source shape at the start of each row
      const NODE = narrow ? 50 : 112;         // athlete node for matched rows
      const Y = narrow ? [26, 58, 90, 122, 154, 186] : [22, 48, 74, 100, 126, 152];
      const src = [0, 1, 2, 1, 0, 2];
      const missing = new Set(['1-3', '4-1', '5-4']), bad = new Set(['2-2', '0-4']);
      const P = [[0, 780], [840, 560], [1440, 640], [2120, 640]];   // standardize · clean · transform · match
      const cards = near(fig, '.trio > div');
      P.forEach(([d, dur], i) => pulseCard(tl, cards[i], c, d, dur));
      Y.forEach((y, r) => {
        const row = make('g', {}, svg);
        const dx = (rnd() * 2 - 1) * (narrow ? 20 : 34), dy = (rnd() * 2 - 1) * 5;
        tl.add(row, [{ transform: `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)` }, { transform: 'translate(0px,0px)' }], { delay: r * 45, duration: 700 });
        shape(src[r], XS, y, 3.4, { fill: 'none', stroke: c.ink, 'stroke-width': k }, row);
        X.forEach((x, f) => {
          const id = `${r}-${f}`;
          const dot = pin(make('circle', { cx: x, cy: y, r: 3.2, fill: c.sumi }, row));
          if (missing.has(id) || bad.has(id)) {
            const flaw = missing.has(id)
              ? make('circle', { cx: x, cy: y, r: 3.6, fill: 'none', stroke: c.strong, 'stroke-width': k, 'stroke-dasharray': `${2 * k} ${1.6 * k}` }, row)
              : make('path', { d: `M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}`, fill: 'none', stroke: c.seal, 'stroke-width': 1.4 * k, 'stroke-linecap': 'round' }, row);
            tl.add(flaw, [{ opacity: 1 }, { opacity: 0 }], { delay: 860 + r * 50, duration: 380 });
            tl.add(dot, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { delay: 1000 + r * 50, duration: 440, easing: SPRING });
          } else {
            const s = 0.5 + rnd() * 1.0;
            tl.add(dot, [{ transform: `scale(${s.toFixed(2)})`, fill: (f + r) % 3 ? c.sumi : c.strong }, { transform: 'scale(1)', fill: c.sumi }], { delay: 100 + r * 45, duration: 640 });
          }
        });
        const link = make('path', { d: `M${X[4] + 9} ${y}H${XD - 9}`, fill: 'none', stroke: c.strong, 'stroke-width': k }, svg);
        const L = dash(link);
        tl.add(link, [{ strokeDashoffset: `${L}px` }, { strokeDashoffset: '0px' }], { delay: 1460 + r * 70, duration: 340 });
        const nv = pin(make('rect', { x: XD - 3.6, y: y - 3.6, width: 7.2, height: 7.2, rx: 1, fill: c.accent }, svg));
        tl.add(nv, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { delay: 1680 + r * 70, duration: 440, easing: SPRING });
      });
      [[0, 2], [3, 4]].forEach(([a, b], m) => {
        const ya = Y[a], yb = Y[b], ym = (ya + yb) / 2, x0 = XS - 9;
        [ya, yb].forEach((yy) => {
          const p = make('path', { d: `M${x0} ${yy}C${NODE + 26} ${yy} ${NODE + 10} ${ym} ${NODE + 6} ${ym}`, fill: 'none', stroke: c.accent, 'stroke-width': k }, svg);
          const L = dash(p);
          tl.add(p, [{ strokeDashoffset: `${L}px` }, { strokeDashoffset: '0px' }], { delay: 2140 + m * 180, duration: 520 });
        });
        const node = pin(make('circle', { cx: NODE, cy: ym, r: 4.4, fill: c.accent }, svg));
        tl.add(node, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { delay: 2520 + m * 180, duration: 440, easing: SPRING });
      });
    },
  };

  // Research 02 · matching & validation (schematic): records from different sources link to the same athlete,
  // then each athlete's matched record set gets a check.
  VIZ.match = {
    dims: (narrow) => (narrow ? [340, 232] : [600, 192]),
    draw({ svg, tl, c, narrow, k, label, fig }) {
      const src = [0, 1, 1, 2, 0, 1, 0, 2, 2], ath = [0, 1, 0, 2, 1, 3, 2, 3, 0];
      const RX = narrow ? 70 : 160, AX = narrow ? 258 : 430, TX = narrow ? 282 : 456;
      const RY = (i) => (narrow ? 36 + i * 22 : 32 + i * 18);
      const AY = narrow ? [58, 102, 146, 190] : [50, 88, 126, 164];
      label(RX, 12, 'Records', '', 'c');
      label(AX, 12, 'Athletes', '', 'c');
      const steps = near(fig, '.flow li');
      const VAL = 1760;
      [[0, 700], [700, 1050], [VAL, 760]].forEach(([d, dur], i) => pulseStep(tl, steps[i], c, d, dur));
      const lineG = make('g', { fill: 'none', 'stroke-width': k }, svg);
      let order = 0;
      const arrive = [0, 0, 0, 0];
      [0, 1, 2, 3].forEach((a) => src.forEach((s, i) => {
        if (ath[i] !== a) return;
        const y0 = RY(i), y1 = AY[a], mx = (RX + AX) / 2;
        const p = make('path', { d: `M${RX + 8} ${y0}C${mx} ${y0} ${mx} ${y1} ${AX - 10} ${y1}`, stroke: c.strong }, lineG);
        const L = dash(p);
        const t = 720 + order * 90;
        tl.add(p, [{ strokeDashoffset: `${L}px` }, { strokeDashoffset: '0px' }], { delay: t, duration: 520 });
        tl.add(p, [{ stroke: c.strong }, { stroke: mix(c.accent, c.paper, 0.7) }], { delay: VAL + a * 170, duration: 420 });
        if (!arrive[a]) arrive[a] = t + 380;
        order++;
      }));
      src.forEach((s, i) => {
        const m = shape(s, RX, RY(i), 3.4, { fill: c.sumi }, svg);
        tl.add(m, [{ opacity: 0, transform: 'scale(.2)' }, { opacity: 1, transform: 'scale(1)' }], { delay: i * 55, duration: 440, easing: SPRING });
      });
      AY.forEach((y, a) => {
        const node = pin(make('circle', { cx: AX, cy: y, r: 6.4, fill: c.accent, stroke: c.accent, 'stroke-width': k }, svg));
        const v = VAL + a * 170;
        tl.seq(node, [
          { t: arrive[a], opacity: 0, transform: 'scale(.3)', fill: c.paper, stroke: c.ink, easing: SPRING },
          { t: arrive[a] + 380, opacity: 1, transform: 'scale(1)', fill: c.paper, stroke: c.ink },
          { t: v, opacity: 1, transform: 'scale(1)', fill: c.paper, stroke: c.ink },
          { t: v + 360, opacity: 1, transform: 'scale(1)', fill: c.accent, stroke: c.accent },
        ]);
        const tick = make('path', { d: `M${TX - 4.6} ${y + 0.4}L${TX - 1.2} ${y + 3.8}L${TX + 5.2} ${y - 4.2}`, fill: 'none', stroke: c.accent, 'stroke-width': 1.6 * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg);
        const L = dash(tick);
        tl.add(tick, [{ strokeDashoffset: `${L}px` }, { strokeDashoffset: '0px' }], { delay: v + 160, duration: 340 });
      });
    },
  };

  // Research 01 · Gower distance (illustrative example, not real films): per-feature distances
  // (numeric: |a − b| / range; categories: 0 if equal, 1 if not) are averaged; similarity = 1 − distance.
  VIZ.gower = {
    dims: (narrow) => (narrow ? [340, 292] : [600, 228]),
    draw({ svg, tl, c, narrow, k, label, fig }) {
      const D = [0.2, 0, 1, 0];
      const X = narrow ? [104, 168, 232, 296] : [168, 268, 368, 468];
      const YA = 64, YB = 102, MID = (YA + YB) / 2;
      const BASE = narrow ? 190 : 198, HM = 44;
      const RXc = 556;
      label(narrow ? 6 : 14, YA, 'Film A', 'is-row', 'l');
      label(narrow ? 6 : 14, YB, 'Film B', 'is-row', 'l');
      ['Score', 'Genre', 'Theme', 'Setting'].forEach((f, i) => label(X[i], 28, f, '', 'c'));
      const cards = near(fig, '.trio > div');
      const ink = { fill: c.ink };
      const pop = (n, t) => tl.add(n, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], { delay: t, duration: 420, easing: SPRING });
      // feature values: score on a 0–1 scale, then three categories (same, different, same)
      const sx = X[0], half = 32;
      [YA, YB].forEach((y) => make('path', { d: `M${sx - half} ${y}H${sx + half}`, stroke: c.strong, 'stroke-width': k }, svg));
      const ax = sx - half + 0.8 * 2 * half, bx = sx - half + 0.6 * 2 * half;
      pop(pin(make('circle', { cx: ax, cy: YA, r: 3.6, ...ink }, svg)), 80);
      pop(pin(make('circle', { cx: bx, cy: YB, r: 3.6, ...ink }, svg)), 140);
      pop(pin(make('rect', { x: X[1] - 4.4, y: YA - 4.4, width: 8.8, height: 8.8, rx: 0.8, ...ink }, svg)), 140);
      pop(pin(make('rect', { x: X[1] - 4.4, y: YB - 4.4, width: 8.8, height: 8.8, rx: 0.8, ...ink }, svg)), 200);
      pop(pin(make('rect', { x: X[2] - 4.4, y: YA - 4.4, width: 8.8, height: 8.8, rx: 0.8, ...ink }, svg)), 200);
      pop(pin(make('circle', { cx: X[2], cy: YB, r: 4.4, fill: 'none', stroke: c.ink, 'stroke-width': 1.2 * k }, svg)), 260);
      pop(pin(make('circle', { cx: X[3], cy: YA, r: 4.4, ...ink }, svg)), 260);
      pop(pin(make('circle', { cx: X[3], cy: YB, r: 4.4, ...ink }, svg)), 320);
      pulseCard(tl, cards[0], c, 0, 520);
      // compare column by column
      const COL = 420, STEP = 190;
      make('path', { d: `M${X[0] - 40} ${BASE}H${X[3] + 40}`, stroke: c.strong, 'stroke-width': k }, svg);
      const bars = [];
      X.forEach((x, i) => {
        const t = COL + i * STEP;
        const band = make('rect', { x: x - 42, y: 44, width: 84, height: 76, rx: 3, fill: c.accent, opacity: 0 }, svg);
        tl.add(band, [{ opacity: 0 }, { opacity: 0.09, offset: 0.35 }, { opacity: 0 }], { delay: t, duration: STEP + 120, easing: 'ease-in-out' });
        let mark;
        if (i === 0) {
          mark = make('g', {}, svg);
          make('path', { d: `M${ax} ${YA + 5}V${YB - 1}`, stroke: c.strong, 'stroke-width': k, 'stroke-dasharray': `${2 * k} ${2 * k}` }, mark);
          make('path', { d: `M${bx} ${YB}H${ax}`, stroke: c.accent, 'stroke-width': 2.2 * k, 'stroke-linecap': 'round' }, mark);
        } else if (D[i] === 0) {
          mark = make('path', { d: `M${x - 4} ${MID - 2}H${x + 4}M${x - 4} ${MID + 2}H${x + 4}`, stroke: c.accent, 'stroke-width': 1.3 * k, 'stroke-linecap': 'round' }, svg);
        } else {
          mark = make('path', { d: `M${x - 4} ${MID - 2}H${x + 4}M${x - 4} ${MID + 2}H${x + 4}M${x + 2.6} ${MID - 5.4}L${x - 2.6} ${MID + 5.4}`, stroke: c.seal, 'stroke-width': 1.3 * k, 'stroke-linecap': 'round' }, svg);
        }
        tl.add(mark, [{ opacity: 0 }, { opacity: 1 }], { delay: t + 90, duration: 260 });
        const hgt = Math.max(D[i] * HM, 1.4);
        const b = pin(make('rect', { x: x - 7, y: BASE - hgt, width: 14, height: hgt, fill: c.accent }, svg), 'center bottom');
        tl.add(b, [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { delay: t + 120, duration: 360 });
        const ghost = pin(make('rect', { x: x - 7, y: BASE - hgt, width: 14, height: hgt, fill: c.accent, opacity: 0 }, svg), 'center bottom');
        bars.push([ghost, x, t]);
        const val = label(x, BASE + 14, String(D[i]), 'is-val', 'c');
        tl.add(val, [{ opacity: 0 }, { opacity: 1 }], { delay: t + 260, duration: 260 });
      });
      // average: the four distances stack (sum 1.2), then divide by four (0.30); similarity is what's left of 1
      const MERGE = COL + 3 * STEP + 500;   // after the last bar has grown
      pulseCard(tl, cards[1], c, COL, MERGE + 600 - COL);
      const dist = 0.3, dH = dist * HM;
      let distRect, simRect, outline;
      if (!narrow) {
        outline = make('rect', { x: RXc - 7, y: BASE - HM, width: 14, height: HM, fill: 'none', stroke: c.strong, 'stroke-width': k }, svg);
        distRect = pin(make('rect', { x: RXc - 7, y: BASE - dH, width: 14, height: dH, fill: c.sumi }, svg), 'center bottom');
        simRect = pin(make('rect', { x: RXc - 7, y: BASE - HM, width: 14, height: HM - dH, fill: c.accent }, svg), 'center top');
      } else {
        const x0 = X[0], len = X[3] - X[0], y = 244;
        outline = make('rect', { x: x0, y: y - 5, width: len, height: 10, fill: 'none', stroke: c.strong, 'stroke-width': k }, svg);
        distRect = pin(make('rect', { x: x0, y: y - 5, width: dist * len, height: 10, fill: c.sumi }, svg), 'left center');
        simRect = pin(make('rect', { x: x0 + dist * len, y: y - 5, width: (1 - dist) * len, height: 10, fill: c.accent }, svg), 'left center');
        label(6, y, 'Result', 'is-row', 'l');
      }
      tl.add(outline, [{ opacity: 0 }, { opacity: 1 }], { delay: MERGE, duration: 300 });
      bars.forEach(([g, x], i) => {
        const to = narrow ? `translate(0px,${(244 - BASE).toFixed(1)}px)` : `translate(${RXc - x}px,0px)`;
        const t = MERGE + i * 40;
        tl.seq(g, [
          { t: 0, opacity: 0, transform: 'translate(0px,0px)' },
          { t: t - 1, opacity: 0, transform: 'translate(0px,0px)' },
          { t, opacity: 0.85, transform: 'translate(0px,0px)' },
          { t: t + 420, opacity: 0.3, transform: to },
          { t: t + 520, opacity: 0, transform: to },
        ]);
      });
      const S = MERGE + 380;
      tl.seq(distRect, [
        { t: S, opacity: 0, transform: narrow ? 'scaleX(4)' : 'scaleY(4)' },
        { t: S + 100, opacity: 1, transform: narrow ? 'scaleX(4)' : 'scaleY(4)' },
        { t: S + 220, opacity: 1, transform: narrow ? 'scaleX(4)' : 'scaleY(4)' },
        { t: S + 580, opacity: 1, transform: narrow ? 'scaleX(1)' : 'scaleY(1)' },
      ]);
      const div4 = narrow ? label(X[3] + 14, 230, '÷ 4', 'is-op', 'l') : label(RXc + 16, BASE - 30, '÷ 4', 'is-op', 'l');
      tl.seq(div4, [{ t: S + 140, opacity: 0 }, { t: S + 280, opacity: 1 }, { t: S + 600, opacity: 1 }, { t: S + 780, opacity: 0 }]);
      tl.add(simRect, [{ transform: narrow ? 'scaleX(0)' : 'scaleY(0)' }, { transform: narrow ? 'scaleX(1)' : 'scaleY(1)' }], { delay: S + 620, duration: 460 });
      pulseCard(tl, cards[2], c, S + 560, 760);
      const out = narrow
        ? [label(X[0], 264, 'Distance 0.30', 'is-res', 'l'), label(X[3], 282, 'Similarity 0.70', 'is-res is-accent', 'r')]
        : [label(RXc, 58, 'Distance', 'is-tiny', 'c'), label(RXc, 76, '0.30', 'is-num', 'c'), label(RXc, 100, 'Similarity', 'is-tiny is-accent', 'c'), label(RXc, 118, '0.70', 'is-num is-accent', 'c')];
      out.forEach((n, i) => tl.add(n, [{ opacity: 0 }, { opacity: 1 }], { delay: (narrow ? [S + 560, S + 900] : [S + 520, S + 580, S + 880, S + 940])[i], duration: 300 }));
    },
  };

  // Research 01 · similarity matrix → top 20 pairs (illustrative values, not the real matrix).
  VIZ.matrix = {
    seed: 23,
    dims: () => [356, 236],
    draw({ svg, tl, c, k, rnd, label, fig, narrow }) {
      const n = 12, cs = 18, ox = 8, oy = 8;
      const group = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2].sort(() => rnd() - 0.5);
      const val = {}, pairs = [];
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const v = Math.min(0.95, 0.14 + rnd() * 0.5 + (group[i] === group[j] ? 0.3 : 0));
        val[`${i}-${j}`] = v; pairs.push({ id: `${i}-${j}`, v });
      }
      pairs.sort((a, b) => b.v - a.v);
      // pairs whose titles share a first word (sequels, series) tend to score highest: drop five of the top nine
      const dropped = new Set(pairs.slice(0, 9).filter((_, i) => i % 2 === 0).map((p) => p.id));
      const top = new Set(pairs.filter((p) => !dropped.has(p.id)).slice(0, 20).map((p) => p.id));
      const steps = near(fig, '.flow li');
      const P = [[0, 980], [1000, 520], [1560, 560], [2160, 760]];
      P.forEach(([d, dur], i) => pulseStep(tl, steps[i], c, d, dur));
      const hollow = (x, y, s, t) => {
        const o = make('rect', { x: x + 0.5, y: y + 0.5, width: s - 1, height: s - 1, rx: 1.5, fill: 'none', stroke: c.strong, 'stroke-width': k, 'stroke-dasharray': `${2.2 * k} ${2 * k}` }, svg);
        tl.add(o, [{ opacity: 0 }, { opacity: 1 }], { delay: t, duration: 300 });
      };
      for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
        const x = ox + j * cs + 1, y = oy + i * cs + 1, s = cs - 2, id = `${i}-${j}`;
        const v = i === j ? 1 : val[id], op = 0.1 + 0.88 * v;
        const r = pin(make('rect', { x, y, width: s, height: s, rx: 1.5, fill: c.accent, opacity: op }, svg));
        const t0 = (j - i) * 56 + i * 16;
        const appear = [{ t: t0, opacity: 0, transform: 'scale(.4)', fill: c.accent }, { t: t0 + 300, opacity: Math.min(1, op * 1.3), transform: 'scale(1)', fill: c.accent }, { t: t0 + 520, opacity: op, transform: 'scale(1)', fill: c.accent }];
        if (i === j) {
          const t = 1040 + i * 26;
          tl.seq(r, [...appear, { t, opacity: op, transform: 'scale(1)', fill: c.accent }, { t: t + 320, opacity: 0, transform: 'scale(.6)', fill: c.accent }]);
          hollow(x, y, s, t + 180);
        } else if (dropped.has(id)) {
          const t = 1600 + [...dropped].indexOf(id) * 70;
          tl.seq(r, [...appear, { t, opacity: op, transform: 'scale(1)', fill: c.accent }, { t: t + 120, opacity: 1, transform: 'scale(1.15)', fill: c.seal }, { t: t + 300, opacity: 1, transform: 'scale(1)', fill: c.seal }, { t: t + 520, opacity: 0, transform: 'scale(.6)', fill: c.seal }]);
          hollow(x, y, s, t + 360);
        } else if (top.has(id)) {
          const t = 2200 + [...top].indexOf(id) * 28;
          tl.seq(r, [...appear, { t, opacity: op, transform: 'scale(1)', fill: c.accent }, { t: t + 200, opacity: Math.max(op, 0.5), transform: 'scale(1.18)', fill: c.accent }, { t: t + 420, opacity: Math.max(op, 0.5), transform: 'scale(1)', fill: c.accent }]);
          r.setAttribute('opacity', Math.max(op, 0.5));
          const ring = make('rect', { x: x - 1, y: y - 1, width: s + 2, height: s + 2, rx: 2.2, fill: 'none', stroke: c.ink, 'stroke-width': 1.2 * k }, svg);
          tl.add(ring, [{ opacity: 0 }, { opacity: 1 }], { delay: t + 120, duration: 300 });
        } else {
          const t = 2200 + rnd() * 240, dim = op * 0.32;
          tl.seq(r, [...appear, { t, opacity: op, transform: 'scale(1)', fill: c.accent }, { t: t + 460, opacity: dim, transform: 'scale(1)', fill: c.accent }]);
          r.setAttribute('opacity', dim);
        }
      }
      // legend
      const lx = 246;
      [0.15, 0.35, 0.55, 0.75, 0.95].forEach((v, i) => make('rect', { x: lx, y: 22 + (4 - i) * 14, width: 12, height: 12, rx: 1.5, fill: c.accent, opacity: 0.1 + 0.88 * v }, svg));
      label(lx + 20, 28, narrow ? 'More' : 'More similar', 'is-key', 'l');
      label(lx + 20, 84, narrow ? 'Less' : 'Less similar', 'is-key', 'l');
      make('rect', { x: lx - 1, y: 115, width: 14, height: 14, rx: 2.2, fill: 'none', stroke: c.ink, 'stroke-width': 1.2 * k }, svg);
      make('rect', { x: lx + 1, y: 117, width: 10, height: 10, rx: 1.5, fill: c.accent, opacity: 0.7 }, svg);
      label(lx + 20, 122, narrow ? 'Top 20' : 'Top 20 pair', 'is-key', 'l');
      make('rect', { x: lx + 0.5, y: 141.5, width: 11, height: 11, rx: 1.5, fill: 'none', stroke: c.strong, 'stroke-width': k, 'stroke-dasharray': `${2.2 * k} ${2 * k}` }, svg);
      label(lx + 20, 147, 'Removed', 'is-key', 'l');
    },
  };

  const mount = (fig) => {
    const spec = VIZ[fig.dataset.viz], stage = fig.querySelector('.viz-stage');
    if (!spec || !stage) return;
    let tl = null, played = false, lastW = 0, lastNarrow = null;
    const build = () => {
      if (tl) tl.stop();
      stage.querySelectorAll('svg, .viz-label').forEach((n) => n.remove());
      const W = stage.clientWidth || 1, narrow = fig.clientWidth < 520;
      const [w, h] = spec.dims(narrow);
      const svg = make('svg', { viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true', focusable: 'false' }, stage);
      tl = new Timeline();
      const label = (x, y, text, cls = '', anchor = 'c') => {
        const s = document.createElement('span');
        s.className = `viz-label ${cls}`.trim();
        s.dataset.anchor = anchor;
        s.textContent = text;
        s.style.left = `${(x / w) * 100}%`;
        s.style.top = `${(y / h) * 100}%`;
        stage.appendChild(s);
        return s;
      };
      spec.draw({ fig, stage, svg, tl, c: palette(fig), narrow, w, h, k: w / W, rnd: rng(spec.seed || 7), label });
      lastW = W; lastNarrow = narrow;
      if (motion() && !played) tl.prime(); else tl.finish();
    };
    build();
    if (motion()) {
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        played = true;
        setTimeout(() => tl.play(), 260);
      }, { threshold: 0.35 });
      io.observe(stage);
      const cap = fig.querySelector('figcaption');
      if (cap) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'viz-replay';
        b.setAttribute('aria-label', 'Replay this animation');
        b.innerHTML = 'Replay<span aria-hidden="true">↻</span>';
        b.addEventListener('click', () => { played = true; tl.play(); });
        cap.appendChild(b);
      }
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        const W = stage.clientWidth;
        if (!W || !lastW) return;
        if ((fig.clientWidth < 520) !== lastNarrow || Math.abs(W - lastW) / lastW > 0.12) build();
      }).observe(stage);
    }
  };

  if (canAnimate) document.querySelectorAll('.viz[data-viz]').forEach(mount);
  else root.classList.add('no-viz');

  /* the bar chart: the prior line first, then the bars grow while their values count up */
  const drawOnView = (el, run, threshold = 0.3) => {
    if (!motion() || !('IntersectionObserver' in window)) { el.classList.add('is-drawn'); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    }, { threshold });
    io.observe(el);
  };
  const replayButton = (host, run) => {
    if (!motion() || !host) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'viz-replay';
    b.setAttribute('aria-label', 'Replay this animation');
    b.innerHTML = 'Replay<span aria-hidden="true">↻</span>';
    b.addEventListener('click', run);
    host.appendChild(b);
  };
  const counting = new WeakMap();
  const countText = (el, delay, duration) => {
    const text = el.dataset.final || (el.dataset.final = el.textContent), m = text.match(/^(\D*)([\d.,]+)(\D*)$/);
    if (!m) return;
    const run = {};
    counting.set(el, run);
    const num = Number(m[2].replace(/,/g, '')), dec = (m[2].split('.')[1] || '').length;
    const t0 = performance.now();
    const step = (now) => {
      if (counting.get(el) !== run) return;
      const t = Math.min(1, Math.max(0, (now - t0 - delay) / duration));
      el.textContent = t >= 1 ? text : m[1] + (num * easeOut(t)).toFixed(dec) + m[3];
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = m[1] + (0).toFixed(dec) + m[3];
    requestAnimationFrame(step);
  };
  document.querySelectorAll('.chart').forEach((chart) => {
    const vals = [...chart.querySelectorAll('.bars .v')];
    const run = () => {
      chart.classList.remove('is-drawn');
      void chart.offsetWidth;
      chart.classList.add('is-drawn');
      vals.forEach((v, i) => countText(v, 450 + i * 150, 1400));
    };
    drawOnView(chart, run);
    replayButton(chart.querySelector('figcaption'), run);
  });
  /* the unit chart: squares fill one by one while the count climbs to its number */
  document.querySelectorAll('.units').forEach((u) => {
    const n = u.querySelector('p b');
    drawOnView(u, () => { u.classList.add('is-drawn'); if (n) countText(n, 0, 11 * 45 + 400); }, 0.6);
  });
})();

/* Research 02's running cat: gallops while hovered (a short sprint when tapped), and always
   finishes the stride it's in, so it lands back in its drawn pose instead of snapping. */
(() => {
  const runner = document.querySelector('.runner');
  if (!runner || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const art = runner.closest('.hero-art') || runner;
  let held = false, sprintUntil = 0;
  const go = () => runner.classList.add('running');
  // real mouse hover only: a tap also fires mouse-compat events that would never 'leave'
  art.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { held = true; go(); } });
  art.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') held = false; });
  art.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sprintUntil = performance.now() + 1700; go(); } });
  runner.querySelector('.run-cat').addEventListener('animationiteration', () => {
    if (!held && performance.now() >= sprintUntil) runner.classList.remove('running');
  });
})();
