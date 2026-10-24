/* Research 01 figures, drawn from real results: data/similarity.json, exported by
   data/run_similarity.R, which reproduces Sarah's gower_dist_better.R (Gower similarity over
   26 features for 100 anime films) and checks it against her committed similarity matrix.
   Fig. 1 heatmap (canvas, hover or tap a cell) · Fig. 2 top 20 pairs · Fig. 3 Ghibli vs the rest
   · Fig. 4 the most Ghibli-like films from other studios. */
(() => {
  const root = document.getElementById('figures');
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SMALL = new Set(['of', 'the', 'a', 'an', 'and', 'in', 'on', 'to', 'with', 'through', 'is', 'from', 'at', 'for', 'no', 'wa']);
  const nice = t => t.toLowerCase().split(' ').map((w, i) => (i && SMALL.has(w)) ? w : w.replace(/^(\p{L})/u, c => c.toUpperCase())).join(' ')
    .replace(/'S\b/g, "'s").replace(/\bIi\b/g, 'II').replace(/\bIii\b/g, 'III');
  // studio names: keep acronyms and dotted names as written
  const STUDIO = { 'SIGNAL.MD': 'Signal.MD', 'PRODUCTION I.G.': 'Production I.G', '(NOT LISTED)': 'studio not listed' };
  const niceStudio = s => STUDIO[s.toUpperCase()] || s.split(' ').map(w => (w.length <= 3 || /[.\d]/.test(w)) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  fetch(root.dataset.src || 'data/similarity.json').then(r => r.json()).then(build).catch(() => {});

  function onView(node, fn) {
    if (reduce || !('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); fn(); } }), { threshold: 0.25 });
    io.observe(node);
  }

  function build(d) {
    heatmap(d);
    topPairs(d);
    groups(d);
    lookalikes(d);
  }

  /* ---------- Fig. 1: heatmap ---------- */
  function heatmap(d) {
    const fig = root.querySelector('[data-fig="heat"]');
    if (!fig) return;
    const { titles, S, ghibli } = d.heat, N = titles.length, G = ghibli.filter(Boolean).length;
    const wrap = fig.querySelector('.heat-wrap'), cv = fig.querySelector('canvas'), tip = fig.querySelector('.heat-tip');
    const css = getComputedStyle(fig);
    const hex = v => { const s = css.getPropertyValue(v).trim(); const n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const lo = hex('--paper2'), hi = hex('--accent'), seal = css.getPropertyValue('--seal').trim(), ink = css.getPropertyValue('--ink').trim();
    // stretch the colour over the range the films actually span (0.35-0.9); the diagonal (1.0) saturates
    const MIN = 0.35, MAX = 0.9;
    const col = v => { const t = Math.max(0, Math.min(1, (v - MIN) / (MAX - MIN))) ** 1.35; return `rgb(${lo.map((a, i) => Math.round(a + (hi[i] - a) * t)).join(',')})`; };
    let size = 0, band = 0, cell = 0, progress = reduce ? 1 : 0, hover = null;
    const ctx = cv.getContext('2d');

    function layout() {
      const w = wrap.clientWidth; size = w; band = Math.max(10, Math.round(w * 0.022)); cell = (w - band) / N;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = Math.round(w * dpr); cv.height = Math.round(w * dpr); cv.style.width = w + 'px'; cv.style.height = w + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, size, size);
      // group bands: Ghibli (accent) and other studios (line)
      ctx.fillStyle = `rgb(${hi.join(',')})`; ctx.fillRect(band + 0, 0, G * cell, band * 0.55); ctx.fillRect(0, band, band * 0.55, G * cell);
      ctx.fillStyle = css.getPropertyValue('--line').trim(); ctx.fillRect(band + G * cell, 0, (N - G) * cell, band * 0.55); ctx.fillRect(0, band + G * cell, band * 0.55, (N - G) * cell);
      const lim = progress * (2 * N);
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        if (i + j > lim) continue;
        ctx.fillStyle = col(S[i][j]);
        ctx.fillRect(band + j * cell, band + i * cell, Math.ceil(cell), Math.ceil(cell));
      }
      // the Ghibli block
      ctx.strokeStyle = seal; ctx.lineWidth = 1.5;
      ctx.strokeRect(band + 0.75, band + 0.75, G * cell - 1.5, G * cell - 1.5);
      if (hover) {
        const [i, j] = hover;
        ctx.fillStyle = 'rgba(29,26,23,.08)';
        ctx.fillRect(band, band + i * cell, N * cell, cell); ctx.fillRect(band + j * cell, band, cell, N * cell);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.5; ctx.strokeRect(band + j * cell, band + i * cell, cell, cell);
      }
    }
    function pick(e) {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left - band, y = e.clientY - r.top - band;
      if (x < 0 || y < 0) return null;
      const j = Math.floor(x / cell), i = Math.floor(y / cell);
      return i < N && j < N ? [i, j] : null;
    }
    function show(e) {
      const h = pick(e);
      if (!h) { hide(); return; }
      hover = h; draw();
      const [i, j] = h;
      tip.innerHTML = i === j
        ? `<b>${esc(nice(titles[i]))}</b><span>itself · 1.00</span>`
        : `<b>${esc(nice(titles[i]))}</b><b>${esc(nice(titles[j]))}</b><span>similarity ${S[i][j].toFixed(2)}</span>`;
      tip.hidden = false;
      const r = wrap.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      tip.style.left = Math.min(x + 14, r.width - tip.offsetWidth - 4) + 'px';
      tip.style.top = Math.max(4, y - tip.offsetHeight - 12) + 'px';
    }
    function hide() { hover = null; tip.hidden = true; draw(); }
    cv.addEventListener('pointermove', show);
    cv.addEventListener('pointerdown', show);
    cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    new ResizeObserver(layout).observe(wrap);
    layout();
    onView(fig, () => {
      if (reduce) { progress = 1; draw(); return; }
      const t0 = performance.now();
      const step = now => { progress = Math.min(1, (now - t0) / 1400); progress = 1 - (1 - progress) ** 3; draw(); if (progress < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    });
  }

  /* ---------- Fig. 2: top 20 pairs ---------- */
  function topPairs(d) {
    const box = root.querySelector('[data-fig="pairs"] .pairs');
    if (!box) return;
    const lo = 0.75, hiV = 0.95;
    d.top20.forEach((p, k) => {
      const both = p.ga && p.gb;
      const row = el('li', 'pair' + (both ? ' is-ghibli' : ''));
      row.style.setProperty('--w', ((p.s - lo) / (hiV - lo) * 100).toFixed(1) + '%');
      row.style.setProperty('--d', (k * 40) + 'ms');
      row.innerHTML = `<span class="pr">${k + 1}</span><span class="pn">${esc(nice(p.a))} <em>&amp;</em> ${esc(nice(p.b))}${both ? '<i title="both Studio Ghibli">✦</i>' : ''}</span><span class="pt"><i></i></span><span class="pv">${p.s.toFixed(3)}</span>`;
      box.append(row);
    });
    const fig = box.closest('figure');
    onView(fig, () => fig.classList.add('is-drawn'));
  }

  /* ---------- Fig. 3: Ghibli vs the rest ---------- */
  function groups(d) {
    const fig = root.querySelector('[data-fig="groups"]');
    if (!fig) return;
    const m = d.means, means = fig.querySelector('.means'), gen = fig.querySelector('.genres');
    [['Ghibli ↔ Ghibli', m.gg, 'g'], ['Other ↔ other', m.oo, 'o'], ['Ghibli ↔ other', m.go, 'x']].forEach(([k, v, c], i) => {
      const r = el('li', 'mrow is-' + c);
      r.style.setProperty('--w', (v * 100).toFixed(1) + '%'); r.style.setProperty('--d', (i * 120) + 'ms');
      r.innerHTML = `<span class="mk">${k}</span><span class="mt"><i></i></span><span class="mv">${v.toFixed(2)}</span>`;
      means.append(r);
    });
    d.genres.slice(0, 8).forEach((g, i) => {
      const r = el('li', 'grow');
      r.style.setProperty('--g', (g.sg * 100).toFixed(1) + '%'); r.style.setProperty('--o', (g.so * 100).toFixed(1) + '%'); r.style.setProperty('--d', (i * 60) + 'ms');
      r.innerHTML = `<span class="gk">${esc(g.genre)}</span><span class="gt"><i class="g"></i><i class="o"></i></span><span class="gv"><b>${Math.round(g.sg * 100)}%</b> ${Math.round(g.so * 100)}%</span>`;
      gen.append(r);
    });
    onView(fig, () => fig.classList.add('is-drawn'));
  }

  /* ---------- Fig. 4: most Ghibli-like outsiders ---------- */
  function lookalikes(d) {
    const box = root.querySelector('[data-fig="like"] .like');
    if (!box) return;
    const lo = 0.55, hiV = 0.62;
    d.ghibli_like.forEach((f, k) => {
      const r = el('li', 'lrow');
      r.style.setProperty('--w', ((f.s - lo) / (hiV - lo) * 100).toFixed(1) + '%'); r.style.setProperty('--d', (k * 50) + 'ms');
      r.innerHTML = `<span class="ln"><b>${esc(nice(f.title))}</b><small>${esc(niceStudio(f.studio))} · ${f.year}</small></span><span class="lt"><i></i></span><span class="lv">${f.s.toFixed(3)}</span>`;
      box.append(r);
    });
    const fig = box.closest('figure');
    onView(fig, () => fig.classList.add('is-drawn'));
  }
})();
