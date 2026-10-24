/* Theme switcher for 16 · Washi 3D.
   Load this in <head> without defer/async: it puts the saved theme on <html data-theme> before the first
   paint, so a reload never flashes Washi first. Colors and fonts live in themes.css; this file only knows
   each theme's name and Google Fonts, wires up the banner, and builds the copyable CSS. */
(function () {
  // Each theme's Google Fonts and the starter components that go into its copied CSS.
  // (Colors are read live from themes.css when copying, so they can't drift from what the page shows.)
  var THEMES = {
    washi: {
      name: 'Washi', note: 'Washi paper, sumi ink and a red seal.', own: true,
      fonts: 'family=Shippori+Mincho:wght@400;600;800&family=Zen+Kaku+Gothic+New:wght@400;500',
      components: [
        'body  { background: var(--paper) radial-gradient(#00000008 1px, transparent 1px) 0 0 / 5px 5px; color: var(--ink); font-family: var(--font-body); }',
        'h1, h2, h3 { font-family: var(--font-display); font-weight: 600; }',
        '.label { font-family: var(--font-label); font-size: 11px; letter-spacing: .35em; text-transform: uppercase; color: var(--sumi); }',
        '.card  { background: var(--card); border: 1px solid var(--line); padding: 32px; }',
        '.chip  { border: 1px solid var(--ink); padding: 4px 12px; font-size: 12px; }',
        '.bar   { height: 6px; background: var(--paper2); }',
        '.bar > i { display: block; height: 100%; background: var(--ink); }',
        '.stamp { display: inline-grid; place-items: center; width: 44px; height: 44px; border: 2px solid var(--seal); border-radius: 6px; color: var(--seal); font: 800 15px var(--font-display); transform: rotate(-4deg); }'
      ]
    },
    night: {
      name: 'Night', note: 'Lavender on midnight, after the Night Shift concept.',
      fonts: 'family=Inter:wght@400;500;600&family=JetBrains+Mono',
      components: [
        'body  { background: var(--paper) radial-gradient(#ffffff0d 1px, transparent 1px) 0 0 / 24px 24px; color: var(--ink); font-family: var(--font-body); }',
        '.label { font-family: var(--font-label); font-size: 11px; letter-spacing: .25em; text-transform: uppercase; color: var(--sumi); }',
        '.card  { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; }',
        '.card:hover { border-color: var(--seal); }',
        '.chip  { border: 1px solid var(--seal); border-radius: 99px; padding: 2px 10px; font-size: 12px; color: #d9d0ff; }',
        '.bar   { height: 6px; background: var(--paper2); }',
        '.bar > i { display: block; height: 100%; background: var(--ink); }'
      ]
    },
    mochi: {
      name: 'Mochi', note: 'Monochrome Bauhaus: ink on rice paper, Space Mono labels.',
      fonts: 'family=Space+Mono&family=Zen+Kaku+Gothic+New:wght@400;700;900',
      components: [
        'body  { background: var(--paper); color: var(--ink); font-family: var(--font-body); line-height: 1.5; }',
        'h1    { font-size: clamp(54px, 8.6vw, 112px); font-weight: 400; line-height: .98; letter-spacing: -.02em; }',
        'h1 b  { font-weight: 900; }',
        '.label { font-family: var(--font-label); font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: var(--sumi); }',
        '.columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }',
        '.columns > * { padding: 24px 28px; border-left: 1px solid var(--line); }',
        '.columns > :first-child { border-left: 0; }',
        '.chip  { border: 1px solid var(--ink); border-radius: 99px; padding: 4px 14px; font-size: 13px; }',
        '.gauge { height: 12px; border: 1.5px solid var(--ink); border-radius: 9px; overflow: hidden; }',
        '.gauge > i { display: block; height: 100%; background: var(--ink); }',
        '.logo  { display: inline-grid; place-items: center; width: 38px; height: 38px; border: 1.5px solid var(--ink); border-radius: 50%; font: 12px var(--font-label); }'
      ]
    },
    kissaten: {
      name: 'Kissaten', note: 'A coffee house: milk, cream, latte, mocha and bean.',
      fonts: 'family=Kiwi+Maru:wght@400;500&family=Nunito:wght@400;600;700;800',
      components: [
        'body  { background: var(--paper); color: var(--ink); font-family: var(--font-body); }',
        'h2, h3 { font-family: var(--font-display); font-weight: 500; }',
        '.card  { background: var(--paper2); border-radius: 24px; padding: 24px; }',
        '.menu-row { display: flex; align-items: center; gap: 20px; padding: 20px 8px; border-bottom: 1px solid var(--line); border-radius: 12px; transition: padding .3s, background .3s; }',
        '.menu-row:hover { padding-left: 20px; background: var(--paper2); }',
        '.chip  { border: 1.5px solid var(--gold); border-radius: 99px; padding: 6px 12px; font-size: 12px; }',
        '.chip:hover { background: var(--seal); border-color: var(--seal); color: #fff; }',
        '.bar   { height: 12px; border-radius: 99px; background: var(--paper2); overflow: hidden; }',
        '.bar > i { display: block; height: 100%; border-radius: inherit; background: var(--gold); }',
        '.button { display: inline-block; padding: 13px 26px; border-radius: 99px; background: var(--seal); color: #fff; font-weight: 700; }'
      ]
    },
    sunprint: {
      name: 'Sunprint', note: 'A cyanotype: dusty blue, cream paper and white botanical prints.',
      fonts: 'family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,500&family=Josefin+Sans:wght@300;400;600',
      extra: [['--blue', 'the print band'], ['--blue2', 'its deeper edge'], ['--sage', 'second print panel']],
      components: [
        'body  { background: var(--paper); color: var(--ink); font-family: var(--font-body); font-weight: 300; }',
        'h1, h2, h3 { font-family: var(--font-display); font-weight: 500; }',
        '.band  { background: radial-gradient(ellipse at 78% 30%, #ffffff8c 0, transparent 46%), linear-gradient(180deg, var(--blue), var(--blue2)); }',
        '.print { filter: brightness(0) invert(1); opacity: .9; } /* any transparent PNG becomes a white cyanotype silhouette */',
        '.card  { background: var(--card); box-shadow: 0 18px 30px -24px #3b465288; }',
        '.label { font-size: 13px; letter-spacing: .3em; text-transform: uppercase; }',
        '.label::after { content: ""; display: block; width: 28px; height: 1px; margin: 10px auto 0; background: var(--ink); }',
        '.button { display: inline-block; padding: 10px 24px; border: 1px solid var(--ink); letter-spacing: .25em; text-transform: uppercase; }',
        '.button:hover { background: var(--ink); color: var(--paper); }'
      ]
    }
  };
  var ROLES = [
    ['--paper', 'page background'], ['--paper2', 'recessed fills, bar tracks'], ['--card', 'cards and panels'],
    ['--ink', 'text'], ['--sumi', 'secondary text'], ['--seal', 'accent: links, hovers, focus'],
    ['--gold', 'ornaments'], ['--line', 'hairlines and borders'],
    ['--font-display', 'headings'], ['--font-body', 'body text'], ['--font-label', 'small uppercase labels']
  ];
  var KEY = 'sw-theme';
  var root = document.documentElement;

  function load() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(id) { try { localStorage.setItem(KEY, id); } catch (e) { /* storage blocked: the choice lasts this visit */ } }
  function fontsUrl(id) { return 'https://fonts.googleapis.com/css2?' + THEMES[id].fonts + '&display=swap'; }

  // A theme's Google Fonts stylesheet, added once. Washi's fonts are linked by the page itself.
  function fontSheet(id, beforePaint) {
    if (THEMES[id].own) return null;
    var link = document.getElementById('fonts-' + id);
    if (!link) {
      link = document.createElement('link');
      link.id = 'fonts-' + id;
      link.rel = 'stylesheet';
      link.href = fontsUrl(id);
      if (beforePaint) link.setAttribute('blocking', 'render');
      link.addEventListener('load', function () { link.dataset.ready = '1'; });
      link.addEventListener('error', function () { link.dataset.ready = '1'; });
      document.head.appendChild(link);
    }
    return link;
  }
  function sheetReady(id) {
    var link = fontSheet(id);
    if (!link || link.dataset.ready) return Promise.resolve();
    return new Promise(function (done) {
      link.addEventListener('load', done);
      link.addEventListener('error', done);
      setTimeout(done, 1500);
    });
  }
  function wait(ms) { return new Promise(function (done) { setTimeout(done, ms); }); }

  // Before the first paint: the saved theme, else Washi.
  var saved = load();
  var current = THEMES.hasOwnProperty(saved) ? saved : 'washi';
  root.setAttribute('data-theme', current);
  fontSheet(current, true);

  var buttons = [], copyBtn = null, wanted = current;

  function sync() {
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.pick === current)); });
    if (copyBtn) copyBtn.setAttribute('aria-label', 'Copy CSS for the ' + THEMES[current].name + ' theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    var paper = getComputedStyle(root).getPropertyValue('--paper').trim();
    if (meta && paper) meta.setAttribute('content', paper);
  }

  function apply(id) {
    current = id;
    root.setAttribute('data-theme', id);
    save(id);
    sync();
    document.dispatchEvent(new CustomEvent('sw-themechange', { detail: { id: id } }));
  }

  function choose(id) {
    if (!THEMES.hasOwnProperty(id)) return;
    wanted = id;
    if (id === current) return;
    sheetReady(id).then(function () {
      if (wanted !== id) return; // a later click won
      var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (still) return apply(id);
      if (document.startViewTransition) {
        // cross-fade; the new state is captured once its fonts have loaded (or after 1.2s at most)
        document.startViewTransition(function () {
          apply(id);
          void root.offsetWidth;
          return Promise.race([document.fonts.ready, wait(1200)]);
        });
      } else {
        root.classList.add('theme-fading');
        apply(id);
        setTimeout(function () { root.classList.remove('theme-fading'); }, 600);
      }
    });
  }

  // The current theme as ready-to-paste CSS: the live tokens (read from themes.css, so they always match
  // the page), the Google Fonts it needs, and a few starter components in the theme's style.
  function snippet() {
    var t = THEMES[current], cs = getComputedStyle(root);
    var roles = ROLES.concat(t.extra || []);
    var width = 0;
    roles.forEach(function (r) { width = Math.max(width, r[0].length); });
    var lines = roles.map(function (r) {
      var name = r[0] + ':';
      while (name.length < width + 2) name += ' ';
      return '  ' + name + cs.getPropertyValue(r[0]).trim() + '; /* ' + r[1] + ' */';
    });
    return ['/* ' + t.name + ': a theme from Sarah Whitaker\'s homepage.',
      '   ' + t.note,
      '   Keep the @import as the first line of your stylesheet (or load the same URL with a <link>). */',
      "@import url('" + fontsUrl(current) + "');",
      '',
      ':root {'].concat(lines, ['}', '', '/* starter components */'], t.components, ['']).join('\n');
  }

  function copy(text) {
    function fallback() {
      return new Promise(function (done, fail) {
        var had = document.activeElement, area = document.createElement('textarea'), ok = false;
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
        document.body.appendChild(area);
        area.select();
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        area.remove();
        if (had && had.focus) had.focus();
        ok ? done() : fail();
      });
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    return fallback();
  }

  function toast(text) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }

  function wire() {
    var bar = document.querySelector('.theme-bar');
    if (!bar) return;
    buttons = [].slice.call(bar.querySelectorAll('.tb-theme'));
    copyBtn = bar.querySelector('.tb-copy');
    var items = buttons.concat(copyBtn ? [copyBtn] : []);

    buttons.forEach(function (b) {
      b.addEventListener('click', function () { choose(b.dataset.pick); });
      // fetch a theme's font stylesheet as soon as someone shows interest, so the switch is quick
      b.addEventListener('pointerenter', function () { fontSheet(b.dataset.pick); });
      b.addEventListener('focus', function () { fontSheet(b.dataset.pick); });
    });

    if (copyBtn) copyBtn.addEventListener('click', function () {
      var name = THEMES[current].name.toUpperCase();
      copy(snippet()).then(function () {
        toast('COPIED ' + name + ' THEME AS CSS');
        copyBtn.classList.remove('copied');
        void copyBtn.offsetWidth;
        copyBtn.classList.add('copied');
      }, function () { toast('COULD NOT COPY · TRY AGAIN'); });
    });

    // one tab stop for the whole banner; arrow keys move along it (toolbar pattern)
    function focusAt(i) {
      items.forEach(function (el, j) { el.tabIndex = j === i ? 0 : -1; });
      items[i].focus();
    }
    items.forEach(function (el, i) {
      el.tabIndex = el.dataset.pick === current ? 0 : -1;
      el.addEventListener('keydown', function (e) {
        var n = items.length, to = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i - 1 + n) % n;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = n - 1;
        if (to === null) return;
        e.preventDefault();
        focusAt(to);
      });
      el.addEventListener('focus', function () { items.forEach(function (o) { o.tabIndex = o === el ? 0 : -1; }); });
    });
    sync();
  }

  // shared with kit.js (the "use this style" strip): the current theme, its CSS, and the copy/toast helpers
  window.SWTheme = {
    current: function () { return current; },
    info: function () { var t = THEMES[current]; return { id: current, name: t.name, note: t.note, fontsUrl: fontsUrl(current) }; },
    css: snippet, copy: copy, toast: toast
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
