/* "Use this style": the small UI-kit strip under the cat-coat palette.
   It shows the current theme's real pieces (buttons, tag, stamp, type) and copies the theme two ways:
   a plain-English prompt someone can paste into ChatGPT or Claude, or the CSS for people who code.
   Everything is read live from the page (via window.SWTheme from themes.js), so it follows the theme. */
(() => {
  const kit = document.querySelector('.kit');
  if (!kit || !window.SWTheme) return;
  const T = window.SWTheme;

  // what each theme looks like, in words a designer would use
  const LOOK = {
    washi: [
      'Cream washi-paper background with a very faint dotted grain.',
      'Elegant serif headings set in capitals with wide letter-spacing; small uppercase labels for sections.',
      'Thin hairline rules and dividers, lots of empty space, nothing loud.',
      'A small red square seal stamp with the initials as the logo, tilted slightly like a real ink stamp.',
      'Cards are flat with a thin border; on hover they lift a few pixels.',
    ],
    night: [
      'Near-black background with a faint grid of tiny star-like dots.',
      'One lavender accent colour for links, buttons, tags and highlights.',
      'Clean modern sans-serif text, with small labels in a monospaced font.',
      'Cards with 12px rounded corners and thin borders that glow lavender on hover.',
      'Tags are rounded pills with a lavender outline.',
    ],
    mochi: [
      'Monochrome Bauhaus: ink black on warm rice-paper white, almost no colour.',
      'A huge, left-aligned name in a bold geometric sans; one word light, one word heavy.',
      'Small labels in a monospaced font, numbered like "01 — About".',
      'Thin rules between sections and thin vertical dividers between columns.',
      'Outlined pill-shaped chips and outlined progress bars.',
    ],
    kissaten: [
      'A cosy coffee house: milk, cream, latte, mocha and coffee-bean brown.',
      'Friendly rounded sans-serif text with soft, handwritten-feeling headings.',
      'Big rounded cards (about 24px corners) and pill-shaped buttons.',
      'Lists laid out like a café menu: icon, name, a short description and a little arrow.',
      'Section labels with café flavour, like "Today\'s research" or "House blend".',
    ],
    sunprint: [
      'A cyanotype print: a dusty-blue band at the top with white botanical silhouettes, on cream paper.',
      'A refined serif for headings, set in capitals with very wide letter-spacing.',
      'White cards with soft shadows; images sit at the top of each card.',
      'Buttons are thin outlined boxes that fill with colour on hover.',
      'Calm, airy and botanical.',
    ],
  };
  const ROLES = [
    ['--paper', 'Page background'], ['--card', 'Cards and panels'], ['--paper2', 'Soft fills (bar tracks, hover)'],
    ['--ink', 'Main text'], ['--sumi', 'Secondary text'], ['--seal', 'Accent (links, buttons, highlights)'],
    ['--gold', 'Small ornaments'], ['--line', 'Thin lines and borders'],
  ];
  const family = v => (v || '').split(',')[0].replace(/['"]/g, '').trim();

  function prompt() {
    const info = T.info(), cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
    const fonts = [['Headings', '--font-display'], ['Body text', '--font-body'], ['Small labels', '--font-label']];
    return [
      `Please help me build a web page in the "${info.name}" style from Sarah Whitaker's homepage (sarahlouisewhitaker.github.io).`,
      '',
      `The feel: ${info.note}`,
      '',
      'Colours (use these exact codes):',
      ...ROLES.map(([k, label]) => `- ${label}: ${v(k).toUpperCase()}`),
      '',
      'Fonts (free from Google Fonts):',
      ...fonts.map(([label, k]) => `- ${label}: ${family(v(k))}`),
      '',
      'Style details:',
      ...(LOOK[info.id] || []).map(s => '- ' + s),
      '- Keep any animation gentle: small fades and lifts, nothing that bounces around.',
      '- If you want cute illustrations like the ones on her site, Irasutoya (irasutoya.com) has free ones.',
      '',
      'Here is ready-made CSS with these colours, fonts and a few starter pieces (buttons, cards, tags):',
      '',
      T.css().trim(),
      '',
      'Please give me one complete HTML file I can save and open in my web browser, using this style. ' +
      'Include a simple header, a short "about me" section, a few cards and a footer, and then explain in simple steps how I change the text and colours.',
    ].join('\n');
  }

  // ---- each theme's palette, named to fit it (Washi keeps Sarah's cat coats) ----
  const PALETTES = {
    washi: { label: 'Palette · Cat coats · Click to copy', swatches: [
      ['Snow', '#F4EFE6'], ['Cream', '#E8D3B0'], ['Ginger', '#C9864E'], ['Calico', '#A8693A', 'linear-gradient(135deg,#f4efe6 0 40%,#a8693a 40% 70%,#1d1a17 70%)'],
      ['Tabby', '#9C8467'], ['Smoke', '#8A8580'], ['Tuxedo', '#4A443D', 'linear-gradient(180deg,#2b2724 0 60%,#f4efe6 60%)'], ['Black', '#1D1A17']] },
    night: { label: 'Palette · Night sky · Click to copy', swatches: [
      ['Midnight', '#050507'], ['Deep sky', '#111116'], ['Dusk', '#26262F'], ['Moon dust', '#9A9AA8'],
      ['Starlight', '#ECECF1'], ['Lilac', '#D9D0FF'], ['Lavender', '#8B6FE0'], ['Violet', '#6B4FD0']] },
    mochi: { label: 'Palette · Ink & stone · Click to copy', swatches: [
      ['Mochi', '#F6F4EE'], ['Rice paper', '#E6E1D7'], ['Stone', '#BEBBAD'], ['Pebble', '#777777'], ['Charcoal', '#333333'], ['Sumi ink', '#111111']] },
    kissaten: { label: 'Palette · Coffee flavors · Click to copy', swatches: [
      ['Milk', '#FFFAF3'], ['Cream', '#F7ECDC'], ['Latte', '#E9D6BD'], ['Hazelnut', '#C49A6C'],
      ['Caramel', '#B8805F'], ['Cinnamon', '#96593A'], ['Mocha', '#5B3A29'], ['Espresso', '#3B2418']] },
    sunprint: { label: 'Palette · Cyanotype · Click to copy', swatches: [
      ['Paper', '#F4ECE0'], ['Linen', '#E9DFD0'], ['Sage', '#C9D3C7'], ['Dusty blue', '#A9BCCB'],
      ['Blue hour', '#8EA6B8'], ['Cyanotype', '#4D6A80'], ['Slate', '#575F67'], ['Ink', '#3B4652']] },
  };
  const coats = document.querySelector('.coats2'), palLabel = document.querySelector('#palette .label');
  function renderPalette() {
    const p = PALETTES[T.current()] || PALETTES.washi;
    if (palLabel) palLabel.textContent = p.label;
    if (!coats) return;
    coats.innerHTML = p.swatches.map(([n, hex, bg]) =>
      `<button class="sw" type="button" data-hex="${hex}" data-name="${n}"><i style="background:${bg || hex}"></i>${n.toUpperCase()}<small>${hex}</small></button>`).join('');
  }
  if (coats) coats.addEventListener('click', e => {
    const s = e.target.closest('.sw'); if (!s) return;
    T.copy(s.dataset.hex).then(() => T.toast('COPIED ' + s.dataset.name.toUpperCase() + ' ' + s.dataset.hex), () => T.toast('COULD NOT COPY · TRY AGAIN'));
  });

  const btn = kit.querySelector('.kit-copy'), css = kit.querySelector('.kit-css'), pre = kit.querySelector('.kit-pre'), name = kit.querySelectorAll('.kit-name');
  function refresh() {
    const info = T.info();
    renderPalette();
    name.forEach(n => { n.textContent = info.name; });
    if (pre && kit.querySelector('details[open]')) pre.textContent = prompt();
  }
  function done(el, text) {
    T.toast(text);
    el.classList.remove('copied'); void el.offsetWidth; el.classList.add('copied');
  }
  btn.addEventListener('click', () => T.copy(prompt()).then(
    () => done(btn, 'PROMPT COPIED · PASTE IT INTO CHATGPT OR CLAUDE'), () => T.toast('COULD NOT COPY · TRY AGAIN')));
  css.addEventListener('click', () => T.copy(T.css()).then(
    () => done(css, 'COPIED ' + T.info().name.toUpperCase() + ' THEME AS CSS'), () => T.toast('COULD NOT COPY · TRY AGAIN')));
  kit.querySelector('details').addEventListener('toggle', e => { if (e.target.open) pre.textContent = prompt(); });
  document.addEventListener('sw-themechange', () => setTimeout(refresh, 60));
  refresh();
})();
