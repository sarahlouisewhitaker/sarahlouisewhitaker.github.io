
// Interactive overlay for the knight-and-horse background.
// Draws on a transparent canvas laid exactly over the background video (same 1672x941 art space,
// same object-fit: cover), so everything here lines up pixel-for-pixel with the painting.
//
//   - hover a card      -> the horse raises its head and looks up
//   - leave the card    -> it shakes its head, tossing the mane, then settles back to the distance
//   - every ~8s         -> an ear twitch, and separately a tail swish
//   - always            -> woodsmoke drifting up from the campfire, behind the horse and knight

const W = 1672;
const H = 941;
const STEP = 1 / 12; // the painting's loop runs at 12fps; step the rig at the same cadence

// Rig atlas layout (public/art/rig/horse-rig.png). x/y = where the piece sits in the painting.
const RIG = {
  headSprite: { sx: 0, sy: 0, w: 200, h: 260, x: 1330, y: 400 },
  headPatch: { sx: 0, sy: 260, w: 200, h: 260, x: 1330, y: 400 },
  tailSprite: { sx: 0, sy: 520, w: 116, h: 220, x: 1556, y: 550 },
  tailPatch: { sx: 0, sy: 740, w: 116, h: 220, x: 1556, y: 550 },
} as const;

// Skeleton, in painting coordinates.
const NECK_BASE = { x: 1462, y: 612 };
const POLL = { x: 1408, y: 482 };
const HEAD_PIVOT = { x: 1416, y: 500 };
const THROAT_LINE = [{ x: 1414, y: 470 }, { x: 1430, y: 550 }];
const CREST = [
  [1410, 474], [1430, 477], [1447, 485], [1461, 496], [1473, 510], [1486, 530],
];
const EARS = [
  { base: { x: 1391, y: 487 }, tip: { x: 1386, y: 468 } },
  { base: { x: 1406, y: 484 }, tip: { x: 1408, y: 469 } },
];
const TAIL_ROOT = { x: 1598, y: 566 };
const TAIL_TIP = { x: 1640, y: 745 };
const FIRE = { x: 1436, y: 742 };

const CARD_SELECTOR = [
  ".project", ".case-card", ".process div", ".stats > div", ".method-grid > div",
  ".chart", ".pipeline > div", ".validation", ".cards > div", ".finding",
].join(",");

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Rotate (x,y) around (cx,cy) by a (small-angle approximations are plenty for |a| < 0.5).
function rot(x: number, y: number, cx: number, cy: number, a: number, out: number[]) {
  const a2 = a * a;
  const c = 1 - a2 / 2 + (a2 * a2) / 24;
  const s = a - (a * a2) / 6;
  const dx = x - cx, dy = y - cy;
  out[0] = cx + c * dx - s * dy;
  out[1] = cy + s * dx + c * dy;
}

type Pose = {
  neck: number; head: number;
  maneAmp: number; manePhase: number;
  ear0: number; ear1: number;
};
const REST: Pose = { neck: 0, head: 0, maneAmp: 0, manePhase: 0, ear0: 0, ear1: 0 };
const LOOK = { neck: 0.13, head: 0.27, ears: -0.14 };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx] as const;
}

export async function startHorseRig(stage: HTMLCanvasElement) {
  const ctx = stage.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  const atlas = await loadImage("/art/rig/horse-rig.png");
  const [ac, actx] = canvas(atlas.width, atlas.height);
  actx.drawImage(atlas, 0, 0);
  const piece = (k: keyof typeof RIG) => {
    const r = RIG[k];
    const [c, cx] = canvas(r.w, r.h);
    cx.drawImage(ac, r.sx, r.sy, r.w, r.h, 0, 0, r.w, r.h);
    return { ...r, canvas: c, data: cx.getImageData(0, 0, r.w, r.h).data };
  };
  const headSprite = piece("headSprite");
  const headPatch = piece("headPatch");
  const tailSprite = piece("tailSprite");
  const tailPatch = piece("tailPatch");

  // ---------- precomputed weight maps (rest coordinates) ----------
  const HB = headSprite;
  const hn = HB.w * HB.h;
  const wHead = new Float32Array(hn), wNeck = new Float32Array(hn);
  const wMane = new Float32Array(hn), sMane = new Float32Array(hn);
  const nMane = new Float32Array(hn * 2);
  const wEar = [new Float32Array(hn), new Float32Array(hn)];

  const [t0, t1] = THROAT_LINE;
  const tl = Math.hypot(t1.x - t0.x, t1.y - t0.y);
  const tnx = -(t1.y - t0.y) / tl, tny = (t1.x - t0.x) / tl; // normal pointing toward the muzzle
  const ux = POLL.x - NECK_BASE.x, uy = POLL.y - NECK_BASE.y, ul = Math.hypot(ux, uy);
  const crestLen: number[] = [0];
  for (let i = 1; i < CREST.length; i++) {
    crestLen.push(crestLen[i - 1] + Math.hypot(CREST[i][0] - CREST[i - 1][0], CREST[i][1] - CREST[i - 1][1]));
  }
  const crestTotal = crestLen[crestLen.length - 1];

  for (let j = 0; j < HB.h; j++) {
    for (let i = 0; i < HB.w; i++) {
      const k = j * HB.w + i, x = HB.x + i + 0.5, y = HB.y + j + 0.5;
      const sd = (x - t0.x) * tnx + (y - t0.y) * tny;
      const s = ((x - NECK_BASE.x) * ux + (y - NECK_BASE.y) * uy) / (ul * ul);
      wHead[k] = smooth(-12, 22, sd) * smooth(0.3, 0.52, s);
      wNeck[k] = smooth(0.05, 0.78, s);

      // mane: signed distance to the crest (positive = into the neck)
      let best = 1e9, bs = 0, bnx = 0, bny = 0, bsd = 0;
      for (let c = 0; c < CREST.length - 1; c++) {
        const [ax, ay] = CREST[c], [bx, by] = CREST[c + 1];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = Math.min(1, Math.max(0, ((x - ax) * dx + (y - ay) * dy) / l2));
        const px = ax + dx * t, py = ay + dy * t, d = Math.hypot(x - px, y - py);
        if (d < best) {
          best = d;
          const l = Math.sqrt(l2);
          const nx = dy / l, ny = -dx / l; // outward (up/right of the crest)
          bnx = nx; bny = ny;
          bsd = -((x - px) * nx + (y - py) * ny);
          bs = (crestLen[c] + t * l) / crestTotal;
        }
      }
      const inward = bsd;
      const reach = inward >= 0 ? smooth(20, 3, inward) : smooth(-26, -8, inward);
      wMane[k] = reach * smooth(0.02, 0.18, bs) * smooth(1.02, 0.8, bs);
      sMane[k] = bs;
      nMane[k * 2] = bnx; nMane[k * 2 + 1] = bny;

      EARS.forEach((ear, e) => {
        const vy = smooth(ear.base.y + 3, ear.base.y - 7, y);
        if (vy <= 0) return;
        const t = Math.min(1, Math.max(0, (ear.base.y - y) / (ear.base.y - ear.tip.y)));
        const cx = ear.base.x + (ear.tip.x - ear.base.x) * t;
        wEar[e][k] = vy * smooth(10, 4, Math.abs(x - cx));
      });
    }
  }

  const TB = tailSprite;
  const tn = TB.w * TB.h;
  const sTail = new Float32Array(tn);
  const tdx = TAIL_TIP.x - TAIL_ROOT.x, tdy = TAIL_TIP.y - TAIL_ROOT.y, tlen2 = tdx * tdx + tdy * tdy;
  for (let j = 0; j < TB.h; j++) {
    for (let i = 0; i < TB.w; i++) {
      const x = TB.x + i + 0.5, y = TB.y + j + 0.5;
      sTail[j * TB.w + i] = Math.min(1.1, Math.max(0, ((x - TAIL_ROOT.x) * tdx + (y - TAIL_ROOT.y) * tdy) / tlen2));
    }
  }

  // ---------- warps ----------
  const [headOut, headOutCtx] = canvas(HB.w, HB.h);
  const headImg = headOutCtx.createImageData(HB.w, HB.h);
  const [tailOut, tailOutCtx] = canvas(TB.w, TB.h);
  const tailImg = tailOutCtx.createImageData(TB.w, TB.h);
  const tmp = [0, 0];

  // forward map: rest position -> posed position
  function headForward(x: number, y: number, pose: Pose, out: number[]) {
    const i = Math.round(x - HB.x - 0.5), j = Math.round(y - HB.y - 0.5);
    if (i < 0 || j < 0 || i >= HB.w || j >= HB.h) { out[0] = x; out[1] = y; return; }
    const k = j * HB.w + i;
    let px = x, py = y;
    for (let e = 0; e < 2; e++) {
      const w = wEar[e][k], a = e === 0 ? pose.ear0 : pose.ear1;
      if (w > 0 && a !== 0) { rot(px, py, EARS[e].base.x, EARS[e].base.y, a * w, tmp); px = tmp[0]; py = tmp[1]; }
    }
    const mw = wMane[k];
    if (mw > 0 && pose.maneAmp !== 0) {
      const s = sMane[k];
      const m = pose.maneAmp * mw * Math.sin(pose.manePhase - s * 2.8) * (0.55 + 0.45 * s);
      px += nMane[k * 2] * m - m * 0.35;
      py += nMane[k * 2 + 1] * m;
    }
    const ah = pose.head * wHead[k];
    if (ah !== 0) { rot(px, py, HEAD_PIVOT.x, HEAD_PIVOT.y, ah, tmp); px = tmp[0]; py = tmp[1]; }
    const an = pose.neck * wNeck[k];
    if (an !== 0) { rot(px, py, NECK_BASE.x, NECK_BASE.y, an, tmp); px = tmp[0]; py = tmp[1]; }
    out[0] = px; out[1] = py;
  }

  function renderHead(pose: Pose) {
    const src = HB.data, dst = headImg.data;
    for (let j = 0; j < HB.h; j++) {
      for (let i = 0; i < HB.w; i++) {
        const qx = HB.x + i + 0.5, qy = HB.y + j + 0.5;
        // invert the forward map by fixed-point iteration
        let px = qx, py = qy;
        for (let it = 0; it < 4; it++) {
          headForward(px, py, pose, tmp);
          px = qx - (tmp[0] - px);
          py = qy - (tmp[1] - py);
        }
        const si = Math.round(px - HB.x - 0.5), sj = Math.round(py - HB.y - 0.5);
        const o = (j * HB.w + i) * 4;
        if (si >= 0 && sj >= 0 && si < HB.w && sj < HB.h) {
          const s = (sj * HB.w + si) * 4;
          dst[o] = src[s]; dst[o + 1] = src[s + 1]; dst[o + 2] = src[s + 2]; dst[o + 3] = src[s + 3];
        } else dst[o + 3] = 0;
      }
    }
    headOutCtx.putImageData(headImg, 0, 0);
  }

  function tailForward(x: number, y: number, amp: number, phase: number, out: number[]) {
    const i = Math.round(x - TB.x - 0.5), j = Math.round(y - TB.y - 0.5);
    if (i < 0 || j < 0 || i >= TB.w || j >= TB.h) { out[0] = x; out[1] = y; return; }
    const s = sTail[j * TB.w + i];
    const a = amp * Math.pow(s, 1.5) * Math.sin(phase - s * 2.4);
    rot(x, y, TAIL_ROOT.x, TAIL_ROOT.y, a, out);
  }

  function renderTail(amp: number, phase: number) {
    const src = TB.data, dst = tailImg.data;
    for (let j = 0; j < TB.h; j++) {
      for (let i = 0; i < TB.w; i++) {
        const qx = TB.x + i + 0.5, qy = TB.y + j + 0.5;
        let px = qx, py = qy;
        for (let it = 0; it < 4; it++) {
          tailForward(px, py, amp, phase, tmp);
          px = qx - (tmp[0] - px);
          py = qy - (tmp[1] - py);
        }
        const si = Math.round(px - TB.x - 0.5), sj = Math.round(py - TB.y - 0.5);
        const o = (j * TB.w + i) * 4;
        if (si >= 0 && sj >= 0 && si < TB.w && sj < TB.h) {
          const s = (sj * TB.w + si) * 4;
          dst[o] = src[s]; dst[o + 1] = src[s + 1]; dst[o + 2] = src[s + 2]; dst[o + 3] = src[s + 3];
        } else dst[o + 3] = 0;
      }
    }
    tailOutCtx.putImageData(tailImg, 0, 0);
  }

  // ---------- behaviour ----------
  const pose: Pose = { ...REST };
  const spring = { neck: 0, head: 0, ears: 0, vNeck: 0, vHead: 0, vEars: 0 };
  let hovering = false;
  let leaveTimer = 0;
  let shakeT = -1; // seconds into a head shake, -1 when not shaking
  let earT = -1, earWhich = 0, earDouble = false, nextEar = rand(4, 9);
  let tailT = -1, tailDir = 1, nextTail = rand(6, 11);
  const TAIL_DUR = 1.5;

  function setHover(on: boolean) {
    if (on) {
      window.clearTimeout(leaveTimer);
      hovering = true;
      shakeT = -1;
      return;
    }
    window.clearTimeout(leaveTimer);
    leaveTimer = window.setTimeout(() => {
      if (!hovering) return;
      hovering = false;
      if (spring.head > LOOK.head * 0.35) shakeT = 0;
    }, 140);
  }
  const isCard = (el: EventTarget | null) => el instanceof Element && !!el.closest(CARD_SELECTOR);
  document.addEventListener("pointerover", (e) => { if (e.pointerType !== "touch" && isCard(e.target)) setHover(true); });
  document.addEventListener("pointerout", (e) => {
    if (e.pointerType === "touch" || !isCard(e.target)) return;
    const to = e.relatedTarget;
    const from = (e.target as Element).closest(CARD_SELECTOR);
    if (to instanceof Node && from?.contains(to)) return;
    setHover(false);
  });
  document.addEventListener("focusin", (e) => { if (isCard(e.target)) setHover(true); });
  document.addEventListener("focusout", (e) => { if (isCard(e.target) && !isCard(e.relatedTarget)) setHover(false); });

  function earCurve(t: number) {
    // flick back fast, hold, ease forward
    if (t < 0.07) return t / 0.07;
    if (t < 0.2) return 1;
    if (t < 0.42) return 1 - smooth(0.2, 0.42, t);
    return 0;
  }

  function update(dt: number, time: number) {
    // base pose springs toward look / rest
    const target = hovering ? 1 : 0;
    const k = 55, damp = 2 * Math.sqrt(k) * 0.72;
    for (const [key, v, goal] of [
      ["neck", "vNeck", LOOK.neck * target],
      ["head", "vHead", LOOK.head * target],
      ["ears", "vEars", LOOK.ears * target],
    ] as const) {
      const acc = k * (goal - spring[key]) - damp * spring[v];
      spring[v] += acc * dt;
      spring[key] += spring[v] * dt;
    }
    pose.neck = spring.neck;
    pose.head = spring.head + (hovering ? 0.012 * Math.sin(time * 1.3) : 0);
    pose.ear0 = spring.ears;
    pose.ear1 = spring.ears;
    pose.maneAmp = 0;

    if (shakeT >= 0) {
      shakeT += dt;
      const env = Math.exp(-shakeT / 0.42) * smooth(0, 0.06, shakeT);
      const w = Math.PI * 2 * 4.2 * shakeT;
      pose.head += 0.17 * env * Math.sin(w);
      pose.neck += 0.05 * env * Math.sin(w + 0.9);
      pose.maneAmp = 9 * Math.exp(-shakeT / 0.6) * smooth(0, 0.08, shakeT);
      pose.manePhase = w - 1.3;
      const flat = 0.42 * Math.exp(-shakeT / 0.5);
      pose.ear0 += flat; pose.ear1 += flat;
      if (shakeT > 1.6) shakeT = -1;
    }

    // ear twitches
    nextEar -= dt;
    if (earT < 0 && nextEar <= 0 && shakeT < 0) {
      earT = 0; earWhich = Math.random() < 0.55 ? 1 : 0; earDouble = Math.random() < 0.35;
      nextEar = rand(6, 11);
    }
    if (earT >= 0) {
      earT += dt;
      let e = earCurve(earT);
      if (earDouble) e = Math.max(e, earCurve(earT - 0.46));
      const a = 0.5 * e;
      if (earWhich === 0) pose.ear0 += a; else pose.ear1 += a;
      if (earT > (earDouble ? 0.9 : 0.45)) earT = -1;
    }

    // tail swish
    nextTail -= dt;
    if (tailT < 0 && nextTail <= 0) { tailT = 0; tailDir = Math.random() < 0.75 ? -1 : 0.7; nextTail = rand(6.5, 11); }
    if (tailT >= 0) { tailT += dt; if (tailT > TAIL_DUR) tailT = -1; }

  }

  const posed = () =>
    Math.abs(pose.neck) + Math.abs(pose.head) + Math.abs(pose.ear0) + Math.abs(pose.ear1) + Math.abs(pose.maneAmp) > 0.003;

  let lastKey = "";
  function draw() {
    ctx!.clearRect(0, 0, W, H);

    if (tailT >= 0) {
      const t = tailT;
      const fade = smooth(0, 0.12, t) * smooth(TAIL_DUR, TAIL_DUR - 0.14, t);
      const amp = tailDir * 0.2 * Math.sin(Math.PI * Math.min(1, t / (TAIL_DUR - 0.1)));
      renderTail(amp, Math.PI * 2 * 1.25 * t);
      ctx!.globalAlpha = fade;
      ctx!.drawImage(tailPatch.canvas, TB.x, TB.y);
      ctx!.drawImage(tailOut, TB.x, TB.y);
      ctx!.globalAlpha = 1;
    }

    const moving = posed();
    if (moving) ctx!.drawImage(headPatch.canvas, HB.x, HB.y);

    const key = moving
      ? [pose.neck, pose.head, pose.ear0, pose.ear1, pose.maneAmp, pose.manePhase].map((v) => v.toFixed(3)).join()
      : "rest";
    if (key !== lastKey) {
      if (moving) renderHead(pose);
      else headOutCtx.drawImage(headSprite.canvas, 0, 0);
      lastKey = key;
    }
    ctx!.drawImage(headOut, HB.x, HB.y);
  }

  // ---------- loop ----------
  let running = false, raf = 0, last = 0, acc = 0, clock = 0;
  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += dt;
    if (acc >= STEP) {
      while (acc >= STEP) { update(STEP, clock); clock += STEP; acc -= STEP; }
      draw();
    }
    raf = requestAnimationFrame(frame);
  }
  const controller = {
    start() {
      if (running) return;
      running = true; last = performance.now(); acc = STEP;
      stage.classList.add("is-ready");
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    // test hooks
    hover: setHover,
    forceTail() { nextTail = 0; },
    forceEar() { nextEar = 0; },
  };
  return controller;
}
