// Lucky-cat companion for design 16.
// The cat starts in the header slot (#cat), shrinks into the bottom-right corner as you
// scroll, then follows you down the page. What it holds changes by section:
//   header + about → its gold coin · Ghibli card → TV playing anime · sports card → roasting a marshmallow
//   over a little campfire · palette → boba.
// Until the 3D cat exists (see CAT_FILE), the traveling cat is the flat Irasutoya one (same paw
// wave as the header), and each 3D prop pops in over its coin.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The 3D cat model isn't made yet. Once it exists (and CAT below is tuned to it), set this to
// 'art/3d/maneki-neko.glb'. While it's null the flat cat travels and nothing is requested.
const CAT_FILE = null;
const PROPS = {
  tv:   { file: 'art/3d/props/old-tv.glb',      height: 0.42, turn: Math.PI, spin: 0,    flatScale: 1.12, flatNudge: [0, -0.03] },
  camp: { build: buildCamp, turn: 0, spin: 0, flatScale: 1 },
  boba: { file: 'art/3d/props/boba-cup.glb',    height: 0.46, turn: 0,       spin: 0.25, flatScale: 1.45 },
};
// The campfire scene: a little fire on the cushion in front of the cat (it also hides the flat
// cat's painted coin) and a roasting stick held from the cat's right paw out over the flames.
// Positions are in companion-box pixels (the box is 260 x 290); tuned for the flat cat.
const CAMP = {
  fire: 'art/3d/props/campfire.glb', stick: 'art/3d/props/roasting-stick.glb',
  fireBase: [137, 248], fireTop: 150, fireWiden: 1.45, flameTop: 1.75, // flameTop: flame tips in the model, logs base = 0
  hand: [178, 200], tip: [114, 146], marshAt: 0.89,                     // marshAt: marshmallow centre along the stick
  raw: new THREE.Color('#fff4e2'), toasted: new THREE.Color('#e3a456'),
};
const camp = { toast: 0 };
// The TV's screen: a picture placed between the black backing and the glass (model units).
const TV_SCREEN = { image: 'art/3d/props/anime-screen.png', w: 1.56, h: 1.2, x: -0.14, y: 0.62, z: -0.036 };
// 3D cat: which mesh is the coin, and where props sit. Tuned once the model arrives.
const CAT = { coinName: /coin|koban|gold/i, propAnchor: new THREE.Vector3(0.16, 0.34, 0.26) };
// Flat cat: where its coin is, as a fraction of the companion box (see .flat in the page CSS).
const FLAT_COIN = { x: 0.524, y: 0.665 };

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const dock = document.getElementById('cat');
const hero = document.querySelector('.hero');
const holder = document.getElementById('companion');
const bubble = document.getElementById('bubble');
const SAYS = { coin: 'lucky you ✦', tv: 'anime night ✦', camp: 'campfire time ✦', boba: 'boba break ✦' };
const BOX_W = 260, BOX_H = 290;
const glow = document.createElement('style');
glow.textContent = `
#companion .flat::after{content:'';position:absolute;left:14%;right:14%;top:50%;bottom:-2%;border-radius:50%;pointer-events:none;
  background:radial-gradient(closest-side,#ffb45c70,#ffb45c00);mix-blend-mode:screen;opacity:0;transition:opacity .6s}
#companion[data-prop="camp"] .flat::after{opacity:1;animation:firelight 1.3s ease-in-out infinite alternate}
@keyframes firelight{from{opacity:.55;transform:scale(.96)}to{opacity:1;transform:scale(1.04)}}
@media (prefers-reduced-motion:reduce){#companion[data-prop="camp"] .flat::after{animation:none}}`;
document.head.append(glow);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(BOX_W, BOX_H);
renderer.outputColorSpace = THREE.SRGBColorSpace;
holder.querySelector('.stage').append(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff6e8, 0xcdbfa6, 2.1));
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(2.5, 4, 3.5);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(26, BOX_W / BOX_H, 0.05, 50);
camera.position.set(0, 0.55, 3.3);
camera.lookAt(0, 0.5, 0);

const rig = new THREE.Group();        // the 3D cat and its prop
const slot = new THREE.Group();       // where the current prop sits
scene.add(rig);
rig.add(slot);

// Scale a loaded model so its largest side is `size`, centered on the origin
// (or left where it is, for models baked around their hold point).
function fit(obj, size, standOnFloor = false, keepOrigin = false) {
  const box = new THREE.Box3().setFromObject(obj);
  const dims = box.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(size / Math.max(dims.x, dims.y, dims.z));
  box.setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  if (!keepOrigin) obj.position.sub(standOnFloor ? new THREE.Vector3(c.x, box.min.y, c.z) : c);
  const wrap = new THREE.Group();
  wrap.add(obj);
  return wrap;
}

const loader = new GLTFLoader();
const props = {};
let cat = null, coin = null;

// A point in the companion box (pixels) projected onto the plane z = `z` in the scene.
function boxToWorld(px, py, z) {
  const ray = new THREE.Raycaster(), out = new THREE.Vector3();
  ray.setFromCamera(new THREE.Vector2(px / BOX_W * 2 - 1, 1 - py / BOX_H * 2), camera);
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -z), out);
}

async function buildCamp() {
  const [fireG, stickG] = await Promise.all([loader.loadAsync(CAMP.fire), loader.loadAsync(CAMP.stick)]);
  const fire = fireG.scene, stick = stickG.scene;
  fire.traverse(o => { if (o.isMesh) o.material = o.material.clone(); });
  camp.flames = fire.getObjectByName('flames');
  camp.embers = fire.getObjectByName('embers');
  camp.embers.material.transparent = true;
  camp.embersY = camp.embers.position.y;
  camp.marsh = stick.getObjectByName('marshmallow');
  camp.marsh.material = camp.marsh.material.clone();
  camp.light = new THREE.PointLight(0xff9a3c, 1.4, 1.4, 1);
  camp.fire = fire; camp.stick = stick;
  const group = new THREE.Group();
  group.add(fire, stick, camp.light);
  return group;
}

// Lay the campfire scene out in box pixels, relative to the prop slot.
function placeCamp() {
  const zf = 0.3, zs = 0.42;
  const base = boxToWorld(CAMP.fireBase[0], CAMP.fireBase[1], zf), top = boxToWorld(CAMP.fireBase[0], CAMP.fireTop, zf);
  const s = (top.y - base.y) / CAMP.flameTop;
  camp.fire.scale.set(s * CAMP.fireWiden, s, s);
  camp.fire.position.copy(base).sub(slot.position);
  const hand = boxToWorld(CAMP.hand[0], CAMP.hand[1], zs), tip = boxToWorld(CAMP.tip[0], CAMP.tip[1], zs);
  const v = tip.clone().sub(hand);
  camp.stick.scale.setScalar(v.length() / CAMP.marshAt);
  camp.stick.position.copy(hand).sub(slot.position);
  camp.angle = Math.atan2(v.y, v.x);
  camp.stick.rotation.z = camp.angle;
  camp.light.position.copy(boxToWorld(CAMP.fireBase[0], CAMP.fireTop + 18, 0.36)).sub(slot.position);
}

async function load() {
  const screen = await new THREE.TextureLoader().loadAsync(TV_SCREEN.image);
  screen.colorSpace = THREE.SRGBColorSpace;
  await Promise.all(Object.entries(PROPS).map(async ([key, p]) => {
    if (p.build) { props[key] = await p.build(); return; }
    const g = await loader.loadAsync(p.file);
    if (key === 'tv') {
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(TV_SCREEN.w, TV_SCREEN.h), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }));
      pic.position.set(TV_SCREEN.x, TV_SCREEN.y, TV_SCREEN.z);
      pic.rotation.y = Math.PI; // the screen faces -z in this model
      g.scene.add(pic);
    }
    const m = fit(g.scene, p.height, false, p.keepOrigin);
    m.rotation.y = p.turn;
    props[key] = m;
  }));
  try {
    if (!CAT_FILE) throw new Error('no 3D cat yet');
    const g = await loader.loadAsync(CAT_FILE);
    cat = fit(g.scene, 1, true);
    cat.rotation.y = -0.35;
    rig.add(cat);
    g.scene.traverse(o => { if (!coin && o.isMesh && CAT.coinName.test(o.name)) coin = o; });
    if (coin) coin.userData.base = coin.scale.clone();
    slot.position.copy(CAT.propAnchor);
    holder.classList.add('is-3d');
  } catch {
    // No 3D cat yet: put the props over the flat cat's coin, nudged so each one fully hides it.
    for (const [key, p] of Object.entries(PROPS)) if (p.flatNudge) props[key].position.set(p.flatNudge[0], p.flatNudge[1], 0);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(FLAT_COIN.x * 2 - 1, 1 - FLAT_COIN.y * 2), camera);
    ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.35), slot.position);
  }
  placeCamp(); // with the 3D cat, CAMP's box positions will need re-tuning for its pose
}

// ---- which prop belongs to the current scroll position ----
let hoverProp = null;
document.querySelectorAll('#work .work').forEach((card, i) => {
  card.addEventListener('mouseenter', () => { hoverProp = i ? 'camp' : 'tv'; });
  card.addEventListener('mouseleave', () => { hoverProp = null; });
});
function propForScroll() {
  const mid = innerHeight * 0.55;
  const rect = el => document.querySelector(el).getBoundingClientRect();
  const atBottom = scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  if (rect('#palette').top < mid || atBottom) return 'boba';
  if (rect('#craft').top < mid) return 'camp';
  if (rect('#work').top > mid) return 'coin';
  if (hoverProp) return hoverProp;
  // phones stack the cards, so the scroll position can pick; side by side, hover picks
  const [a, b] = [...document.querySelectorAll('#work .work')].map(c => c.getBoundingClientRect());
  return b.top >= a.bottom - 4 && b.top < mid ? 'camp' : 'tv';
}

// ---- prop swap: old one spins away, new one pops in ----
let current = null, swap = null;
function show(key) {
  if (key === current) return;
  swap = { from: current, to: key, t0: performance.now() };
  if (current !== null) { hop(); say(key); }
  if (key !== 'camp') camp.toast = 0; // a fresh marshmallow next time
  current = key;
}
function propObject(key) { return props[key] || null; }
function size(key) { return cat ? 1 : PROPS[key].flatScale; }
function stepSwap(now) {
  if (!swap) return;
  const OUT = 220, IN = 420, e = now - swap.t0;
  const out = propObject(swap.from), inn = propObject(swap.to);
  const coinOut = swap.from === 'coin' && coin;
  if (e < OUT && (out || coinOut)) {
    const k = e / OUT;
    if (out) {
      out.scale.setScalar((1 - k) * size(swap.from));
      out.rotation.y = PROPS[swap.from].turn + k * Math.PI;
    }
    if (coinOut) coin.scale.copy(coin.userData.base).multiplyScalar(1 - k);
    return;
  }
  if (out) slot.remove(out);
  if (swap.from === 'coin' && coin) coin.visible = false;
  if (swap.to === 'coin' && coin) { coin.visible = true; coin.scale.copy(coin.userData.base); }
  if (inn && inn.parent !== slot) { slot.add(inn); inn.scale.setScalar(0); }
  const k = Math.min(1, (e - OUT) / IN);
  if (inn) {
    const back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // ease-out-back
    inn.scale.setScalar(Math.max(0, back) * size(swap.to));
    inn.rotation.y = PROPS[swap.to].turn + (1 - k) * -Math.PI;
  }
  if (k >= 1) swap = null;
}

// ---- speech bubble on swaps, only once the cat is down in the corner ----
let inCorner = false;
function say(key) {
  if (!inCorner || reduceMotion) return;
  bubble.textContent = SAYS[key];
  bubble.classList.remove('say');
  void bubble.offsetWidth;
  bubble.classList.add('say');
}

// ---- hop + sparkles (also on hover) ----
let hopAt = -1e9;
function hop() {
  hopAt = performance.now();
  holder.classList.remove('sparkle');
  void holder.offsetWidth;
  holder.classList.add('sparkle');
}
holder.addEventListener('mouseenter', hop);
holder.addEventListener('click', () => scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));

// ---- follow: lerp between the header slot and the corner ----
const pos = { x: 0, y: 0, s: 1, ready: false };
function targetRect() {
  const d = dock.getBoundingClientRect();
  const w = innerWidth < 760 ? 80 : 132;
  const h = w * BOX_H / BOX_W;
  // stay above the footer so its links remain clickable
  const footerTop = document.querySelector('footer').getBoundingClientRect().top;
  const corner = { x: innerWidth - w - 20, y: Math.min(innerHeight - h - 20, footerTop - h - 8), w };
  const span = Math.max(1, hero.offsetHeight * 0.5);
  let t = Math.min(1, Math.max(0, scrollY / span));
  t = t * t * (3 - 2 * t);
  // in the header, the box sits so its flat cat lines up exactly with the #cat slot
  const start = { x: d.left - d.width * 0.125, y: d.top - d.height * 0.08, w: d.width * 1.25 };
  return { x: start.x + (corner.x - start.x) * t, y: start.y + (corner.y - start.y) * t, w: start.w + (corner.w - start.w) * t, t };
}

let lastY = scrollY, sway = 0;
function frame(now) {
  const r = targetRect();
  const k = pos.ready && !reduceMotion ? 0.2 : 1;
  pos.x += (r.x - pos.x) * k; pos.y += (r.y - pos.y) * k; pos.s += (r.w / BOX_W - pos.s) * k; pos.ready = true;

  let lift = 0, tilt = 0;
  if (!reduceMotion) {
    const vel = scrollY - lastY; lastY = scrollY;
    sway += (Math.max(-0.5, Math.min(0.5, vel * 0.01)) - sway) * 0.08;
    const h = (now - hopAt) / 600;
    lift = Math.sin(now / 900) * 4 + (h < 1 ? Math.sin(h * Math.PI) * 22 : 0);
    tilt = sway * 10;
    if (cat) rig.rotation.y = sway;
    const p = propObject(current);
    if (p && !swap) p.rotation.y += PROPS[current].spin * 0.016;
    if (current === 'camp' && camp.flames) {
      // flames flicker from their base, embers drift up and fade, the firelight breathes,
      // and the marshmallow turns slowly golden while the stick bobs over the fire
      camp.flames.scale.set(1 - 0.04 * Math.sin(now / 95 + 1), 1 + 0.08 * Math.sin(now / 95) + 0.05 * Math.sin(now / 53), 1 - 0.04 * Math.sin(now / 95 + 1));
      const ph = (now / 1700) % 1;
      camp.embers.position.y = camp.embersY + ph * 0.6;
      camp.embers.material.opacity = 1 - ph;
      camp.light.intensity = 1.4 + 0.4 * Math.sin(now / 70) + 0.25 * Math.sin(now / 37);
      camp.toast = Math.min(1, camp.toast + 1 / 420);
      camp.stick.rotation.z = camp.angle + Math.sin(now / 640) * 0.05;
    }
  }
  // translate+scale place the box; the inner translate pair rotates it around its center
  holder.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${pos.s}) translate(130px, ${145 - lift}px) rotate(${tilt}deg) translate(-130px, -145px)`;
  holder.classList.toggle('docked', r.t < 0.05);
  inCorner = r.t > 0.6;
  // bubble sits up and to the left of the cat's head
  bubble.style.transform = `translate(${pos.x + 92 * pos.s}px, ${pos.y + 74 * pos.s}px) translate(-100%, -100%)`;
  // reveal only after the first placement, so it never flashes at the top-left
  if (!document.body.classList.contains('companion-on')) document.body.classList.add('companion-on');

  // in the header it always holds its coin, whatever is on screen or hovered; in the coffee-house
  // theme it holds the boba instead
  const want = r.t < 0.05 ? 'coin' : propForScroll();
  show(want === 'coin' && document.documentElement.dataset.theme === 'kissaten' ? 'boba' : want);
  holder.dataset.prop = current;
  stepSwap(now);
  if (camp.marsh) camp.marsh.material.color.copy(CAMP.raw).lerp(CAMP.toasted, reduceMotion ? 0.45 : camp.toast);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

load().then(() => requestAnimationFrame(frame)).catch(err => {
  console.error('Lucky-cat companion failed to load', err);
  holder.remove();
});
