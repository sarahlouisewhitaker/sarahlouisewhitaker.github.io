// "Messy data in. Clear answers out." — the little data factory on the homepage.
// A worker cat winds a key, the gears turn, a jumble of raw data points tumbles into a funnel,
// straightens out, leaves the machine as one tidy stream and builds a clean report that gets the
// SW stamp; then the report is filed and a fresh one starts. Art is Irasutoya (art/craft/); the
// funnel, points, belt and report are diagram strokes in the theme's colors, so every theme
// restyles it. Desktop runs left to right; phones top to bottom.
(() => {
  const host = document.querySelector('.craft-flow');
  if (!host) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NS = 'http://www.w3.org/2000/svg';
  const CAT_ASPECT = 251 / 360, PAW = [0.87, 0.554]; // mirrored cat: where its raised paw is
  // raw data comes in all shapes; clean data comes out as one kind of dot
  const SHAPES = [
    r => `M${r},0A${r},${r} 0 1 1 ${-r},0A${r},${r} 0 1 1 ${r},0Z`,
    r => `M${-r * .85},${-r * .85}h${r * 1.7}v${r * 1.7}h${-r * 1.7}Z`,
    r => `M0,${-r * 1.15}L${r},${r * .75}L${-r},${r * .75}Z`,
    r => `M${-r},0H${r}M0,${-r}V${r}`,
  ];

  const LAYOUTS = {
    wide: {
      w: 960, h: 450, dots: 130,
      spawn: [172, 438, 8, 62],
      funnel: { cx: 300, mouthY: 118, half: 130, neckY: 246, neckHalf: 12 },
      gears: [{ id: 'black', x: 300, y: 322, s: 124, d: 9 }, { id: 'gold', x: 392, y: 296, s: 80, d: -5.8 }, { id: 'red', x: 448, y: 330, s: 52, d: 3.8 }],
      key: { x: 238, y: 322, s: 90 }, cat: { pawX: 205, pawY: 322, h: 200 },
      belt: { x0: 440, x1: 676, y: 398 }, path: [[452, 384], [684, 384]],
      report: { x: 690, y: 118, w: 240, h: 290 },
      count: { x: 160, y: 96, anchor: 'end' },
      labels: [{ t: 'clean · match · check', x: 330, y: 442 }, { t: 'one clear report', x: 810, y: 442 }],
    },
    tall: {
      w: 360, h: 800, dots: 90,
      spawn: [74, 286, 76, 128],
      funnel: { cx: 180, mouthY: 172, half: 120, neckY: 290, neckHalf: 11 },
      gears: [{ id: 'black', x: 180, y: 366, s: 116, d: 9 }, { id: 'gold', x: 266, y: 338, s: 76, d: -5.8 }, { id: 'red', x: 318, y: 372, s: 50, d: 3.8 }],
      key: { x: 122, y: 366, s: 88 }, cat: { pawX: 94, pawY: 366, h: 150 },
      chute: { x: 318, y0: 404, y1: 498 }, path: [[318, 404], [318, 506]],
      report: { x: 40, y: 506, w: 280, h: 262 },
      count: { x: 180, y: 34, anchor: 'middle' },
      labels: [{ t: 'clean · match · check', x: 180, y: 470 }, { t: 'one clear report', x: 180, y: 792 }],
    },
  };

  let L, svg, gDots, report, stamp, countEl, dots = [], cleans = [], items = [];
  let absorbed = 0, arrived = 0, filing = false, built = 0, running = false, raf = 0, last = 0, counted = false;

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.append(n);
    return n;
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  function funnelHalf(y) {
    const f = L.funnel, t = Math.min(1, Math.max(0, (y - f.mouthY) / (f.neckY - f.mouthY)));
    return f.neckHalf + (f.half - f.neckHalf) * Math.pow(1 - t, 1.7);
  }

  function dress(p) {
    const s = Math.floor(Math.random() * 4);
    p.n.setAttribute('d', SHAPES[s](p.r));
    p.n.setAttribute('class', `p c${Math.floor(Math.random() * 4)}${s === 3 ? ' x' : ''}`);
    p.a = rand(0, 360); p.va = rand(-3, 3);
  }

  function build() {
    L = innerWidth < 700 ? LAYOUTS.tall : LAYOUTS.wide;
    built++;
    host.innerHTML = '';
    dots = []; cleans = []; items = []; absorbed = arrived = 0; filing = false;
    svg = el('svg', { viewBox: `0 0 ${L.w} ${L.h}`, class: 'flow-svg', 'aria-hidden': 'true', focusable: 'false' }, host);
    const f = L.funnel, ym = f.mouthY + (f.neckY - f.mouthY) * 0.55;

    // the data count, counted up the first time the section is seen
    countEl = el('text', { x: L.count.x, y: L.count.y, 'text-anchor': L.count.anchor, class: 'count-num' }, svg);
    countEl.textContent = reduceMotion || counted ? '2,000,000+' : '0';
    el('text', { x: L.count.x, y: L.count.y + 20, 'text-anchor': L.count.anchor, class: 'flow-label' }, svg).textContent = 'data points';

    // funnel: a soft body behind the points, walls and rim in front of them
    const left = `M${f.cx - f.half},${f.mouthY} C${f.cx - f.half},${ym} ${f.cx - f.neckHalf},${ym - 6} ${f.cx - f.neckHalf},${f.neckY}`;
    const right = `M${f.cx + f.half},${f.mouthY} C${f.cx + f.half},${ym} ${f.cx + f.neckHalf},${ym - 6} ${f.cx + f.neckHalf},${f.neckY}`;
    el('path', { d: `${left} L${f.cx + f.neckHalf},${f.neckY} C${f.cx + f.neckHalf},${ym - 6} ${f.cx + f.half},${ym} ${f.cx + f.half},${f.mouthY} Z`, class: 'funnel-fill' }, svg);
    gDots = el('g', { class: 'dots' }, svg);
    el('path', { d: left, class: 'funnel-line' }, svg);
    el('path', { d: right, class: 'funnel-line' }, svg);
    el('line', { x1: f.cx - f.half - 10, y1: f.mouthY, x2: f.cx + f.half + 10, y2: f.mouthY, class: 'funnel-rim' }, svg);
    for (const s of [-1, 1]) el('line', { x1: f.cx + s * f.neckHalf, y1: f.neckY, x2: f.cx + s * f.neckHalf, y2: f.neckY + 14, class: 'funnel-line' }, svg);

    // the wind-up key sits behind the big gear with its wings toward the cat; then the gears
    const k = L.key, kg = el('g', { transform: `rotate(-90 ${k.x} ${k.y})` }, svg);
    el('image', { href: 'art/craft/windup-key.png', x: k.x - k.s / 2, y: k.y - k.s / 2, width: k.s, height: k.s, class: 'art key' }, kg);
    for (const g of L.gears) {
      el('image', { href: `art/craft/gear-${g.id}.png`, x: g.x - g.s / 2, y: g.y - g.s / 2, width: g.s, height: g.s, class: 'art gear', style: `--d:${Math.abs(g.d)}s;--dir:${g.d < 0 ? 'reverse' : 'normal'}` }, svg);
    }

    // the worker cat, mirrored so its raised paw turns the key
    const ch = L.cat.h, cw = ch * CAT_ASPECT, cx0 = L.cat.pawX - PAW[0] * cw, cy0 = L.cat.pawY - PAW[1] * ch;
    const cat = el('g', { class: 'worker' }, svg);
    el('image', { href: 'art/craft/worker-cat.png', x: 0, y: 0, width: cw, height: ch, class: 'art', transform: `translate(${cx0 + cw} ${cy0}) scale(-1 1)` }, cat);

    // conveyor (wide) or chute (tall)
    if (L.belt) {
      const b = L.belt, r = 9;
      el('rect', { x: b.x0 - r, y: b.y - r, width: b.x1 - b.x0 + 2 * r, height: 2 * r, rx: r, class: 'belt-body' }, svg);
      el('rect', { x: b.x0 - r, y: b.y - r, width: b.x1 - b.x0 + 2 * r, height: 2 * r, rx: r, class: 'belt-run' }, svg);
      for (const x of [b.x0, b.x1]) el('circle', { cx: x, cy: b.y, r: 4, class: 'roller' }, svg);
    } else {
      const c = L.chute;
      for (const s of [-1, 1]) el('line', { x1: c.x + s * 9, y1: c.y0, x2: c.x + s * 9, y2: c.y1, class: 'chute' }, svg);
    }

    // the report: a paper card whose lines, chart and stamp fill in as clean data arrives
    const R = L.report, pad = R.w * 0.1;
    report = el('g', { class: 'report-g' }, svg);
    el('rect', { x: R.x, y: R.y, width: R.w, height: R.h, rx: 6, class: 'report' }, report);
    const add = (cls, x, y, w, h) => items.push(el('rect', { x, y, width: w, height: h, rx: Math.min(h / 2, 3), class: `ri ${cls}` }, report));
    add('title', R.x + pad, R.y + R.h * 0.1, R.w * 0.5, R.h * 0.035);
    add('sub', R.x + pad, R.y + R.h * 0.17, R.w * 0.68, R.h * 0.02);
    const base = R.y + R.h * 0.6, bw = R.w * 0.11, gap = R.w * 0.07;
    el('line', { x1: R.x + pad, y1: base, x2: R.x + R.w - pad, y2: base, class: 'axis' }, report);
    [0.14, 0.25, 0.19, 0.33].forEach((hf, i) => add(i === 3 ? 'bar accent' : 'bar', R.x + pad + R.w * 0.04 + i * (bw + gap), base - R.h * hf, bw, R.h * hf));
    [0.74, 0.6, 0.48].forEach((wf, i) => add('line', R.x + pad, R.y + R.h * (0.69 + i * 0.065), R.w * wf, R.h * 0.02));
    const sz = R.w * 0.15, sx = R.x + R.w - pad - sz * 0.6, sy = R.y + R.h - pad - sz * 0.45;
    stamp = el('g', { class: 'stamp', transform: `translate(${sx} ${sy})` }, report);
    const ink = el('g', { class: 'stamp-ink' }, stamp);
    el('rect', { x: -sz / 2, y: -sz / 2, width: sz, height: sz, rx: sz * 0.14, class: 'stamp-box' }, ink);
    el('text', { x: 0, y: sz * 0.17, 'text-anchor': 'middle', class: 'stamp-text', style: `font-size:${sz * 0.44}px` }, ink).textContent = 'SW';

    for (const lb of L.labels) el('text', { x: lb.x, y: lb.y, 'text-anchor': 'middle', class: 'flow-label' }, svg).textContent = lb.t;

    // the raw data: a messy cloud to start with, the lower part already falling in
    const [x0, x1, y0] = L.spawn;
    for (let i = 0; i < L.dots; i++) {
      const p = { x: rand(x0, x1), y: rand(y0, f.mouthY + (i % 4 === 0 ? 70 : 0)), vx: rand(-0.3, 0.3), vy: rand(0.2, 0.9), r: rand(1.6, 3.6), s: 1 };
      p.n = el('path', {}, gDots);
      dress(p);
      dots.push(p);
    }
    if (reduceMotion) { stillFrame(); return; }
    draw();
  }

  // reduced motion: one finished still frame
  function stillFrame() {
    for (const p of dots) if (p.y > L.funnel.mouthY) { const hw = funnelHalf(p.y) - p.r; p.x = Math.min(L.funnel.cx + hw, Math.max(L.funnel.cx - hw, p.x)); p.a = 0; }
    draw();
    const [[ax, ay], [bx, by]] = L.path;
    for (let i = 1; i < 6; i++) el('circle', { cx: ax + (bx - ax) * i / 6, cy: ay + (by - ay) * i / 6, r: 3.2, class: 'pc' }, gDots);
    items.forEach(n => n.classList.add('on'));
    stamp.classList.add('on');
  }

  function respawn(p) {
    const [x0, x1, y0, y1] = L.spawn;
    p.x = rand(x0, x1); p.y = rand(y0, y1); p.vx = rand(-0.25, 0.25); p.vy = rand(0.2, 0.7); p.s = 0;
    dress(p);
  }

  function emitClean() {
    const [ax, ay] = L.path[0], prev = cleans[cleans.length - 1];
    if (prev && Math.hypot(prev.x - ax, prev.y - ay) < 14) return false;
    cleans.push({ x: ax, y: ay, t: 0, n: el('circle', { cx: ax, cy: ay, r: 3.2, class: 'pc' }, gDots) });
    return true;
  }

  function step(k) {
    const f = L.funnel;
    for (const p of dots) {
      p.s = Math.min(1, p.s + 0.06 * k);
      if (p.y < f.mouthY) {
        // tumbling in: falling, drifting, spinning
        p.vy = Math.min(p.vy + 0.012 * k, 1.5);
        const tx = Math.min(f.cx + f.half * 0.8, Math.max(f.cx - f.half * 0.8, p.x));
        p.vx = (p.vx + ((tx - p.x) * 0.0018 + rand(-0.03, 0.03)) * k) * Math.pow(0.985, k);
        p.a += p.va * k;
      } else {
        // inside the funnel: squeezed to the middle, and every point straightens out
        p.vx = (p.vx + (f.cx - p.x) * 0.006 * k) * Math.pow(0.9, k);
        p.vy = Math.min(p.vy + 0.025 * k, 2.4);
        p.a = ((p.a % 360) + 540) % 360 - 180;
        p.a *= Math.pow(0.9, k);
        const hw = Math.max(0.5, funnelHalf(p.y) - p.r - 1);
        p.x = Math.min(f.cx + hw, Math.max(f.cx - hw, p.x));
      }
      p.x += p.vx * k; p.y += p.vy * k;
      if (p.y > f.neckY + 8) { absorbed++; respawn(p); }
    }
    // every four raw points that go in, one clean point comes out
    while (absorbed >= 4 && emitClean()) absorbed -= 4;
    absorbed = Math.min(absorbed, 12);
    const [[ax, ay], [bx, by]] = L.path, len = Math.hypot(bx - ax, by - ay);
    for (let i = cleans.length - 1; i >= 0; i--) {
      const c = cleans[i];
      c.t += (1.15 * k) / len;
      if (c.t >= 1) { c.n.remove(); cleans.splice(i, 1); arrive(); continue; }
      c.x = ax + (bx - ax) * c.t; c.y = ay + (by - ay) * c.t;
    }
  }

  function arrive() {
    if (filing) return;
    arrived++;
    const i = Math.floor(arrived / 2) - 1;
    if (i >= 0 && i < items.length) items[i].classList.add('on');
    if (arrived === items.length * 2 + 3) { stamp.classList.add('on'); fileLater(built); }
  }

  // the finished report is filed after a moment, and a fresh one starts
  function fileLater(id) {
    filing = true;
    setTimeout(() => {
      if (id !== built) return;
      report.classList.add('filed');
      setTimeout(() => {
        if (id !== built) return;
        report.classList.add('reset');
        items.forEach(n => n.classList.remove('on'));
        stamp.classList.remove('on');
        void report.getBoundingClientRect();
        report.classList.remove('reset', 'filed');
        arrived = 0; filing = false;
      }, 650);
    }, 3600);
  }

  function draw() {
    for (const p of dots) p.n.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.a.toFixed(0)}) scale(${p.s.toFixed(2)})`);
    for (const c of cleans) { c.n.setAttribute('cx', c.x.toFixed(1)); c.n.setAttribute('cy', c.y.toFixed(1)); }
  }

  function frame(now) {
    const k = last ? Math.min(2.5, (now - last) / 16.7) : 1;
    last = now;
    step(k); draw();
    raf = requestAnimationFrame(frame);
  }

  function countUp() {
    if (counted) return;
    counted = true;
    if (reduceMotion) return;
    const t0 = performance.now(), dur = 1800;
    const tick = now => {
      const e = Math.min(1, (now - t0) / dur), v = Math.round(2000000 * (1 - Math.pow(1 - e, 3)));
      countEl.textContent = v.toLocaleString('en-US') + (e >= 1 ? '+' : '');
      if (e < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function setRunning(on) {
    host.classList.toggle('paused', !on);
    if (reduceMotion || on === running) return;
    running = on;
    if (on) { last = 0; raf = requestAnimationFrame(frame); } else cancelAnimationFrame(raf);
  }

  const inView = () => { const r = host.getBoundingClientRect(); return r.bottom > -80 && r.top < innerHeight + 80; };
  build();
  new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) countUp();
    setRunning(e.isIntersecting && !document.hidden);
  }), { rootMargin: '80px 0px' }).observe(host);
  document.addEventListener('visibilitychange', () => setRunning(!document.hidden && inView()));
  let wasTall = innerWidth < 700;
  addEventListener('resize', () => {
    const tall = innerWidth < 700;
    if (tall === wasTall) return;
    wasTall = tall;
    const was = running;
    setRunning(false); build(); if (was) setRunning(true);
  });
})();
