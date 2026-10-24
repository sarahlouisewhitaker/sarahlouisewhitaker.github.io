// Research 02's running cat, animated with three.js.
// The Irasutoya drawing is a texture on a finely subdivided plane. A vertex shader bends that one
// mesh into a gallop: legs swing from the hip and shoulder and flex at the paw, the spine stretches
// and arches, the body bounds and pitches, the head steadies itself and the tail waves. Because it is
// one continuous mesh there are no cut-out seams. The ground shadow and speed lines (picked out of
// the same drawing by their blue-grey colour) are drawn as their own layers: the shadow shrinks as
// the cat rises, the speed lines stream backwards.
// At rest every movement is zero, so the cat matches the drawing. Hover gallops; a tap sprints for a
// moment; letting go eases back into the drawn pose. Reduced motion keeps the plain image.
import * as THREE from 'three';

const runner = document.querySelector('.runner');
if (runner && !matchMedia('(prefers-reduced-motion: reduce)').matches) init();

function init() {
  const art = runner.closest('.hero-art') || runner;
  const src = runner.querySelector('.run-body').getAttribute('src');
  const ASPECT = 720 / 666;                 // the drawing's proportions
  const PAD_X = 0.12, PAD_Y = 0.14;         // room around it for paws and bounds (matches the CSS)
  const STRIDE = 0.52;                      // seconds per gallop stride

  const canvas = document.createElement('canvas');
  canvas.className = 'run-gl';
  canvas.setAttribute('aria-hidden', 'true');
  // size and place the canvas here, not only in CSS, so a stale or missing stylesheet can't make it
  // grow (it is sized from the runner, never from itself)
  Object.assign(canvas.style, { position: 'absolute', left: -PAD_X * 100 + '%', top: -PAD_Y * 100 + '%',
    width: (1 + 2 * PAD_X) * 100 + '%', height: (1 + 2 * PAD_Y) * 100 + '%', pointerEvents: 'none', display: 'block' });
  // ask for the context ourselves first: without WebGL we quietly keep the CSS version (no console errors)
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
  if (!gl) return;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true, premultipliedAlpha: true });
  } catch { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const halfW = ASPECT / 2 + ASPECT * PAD_X, halfH = 0.5 + PAD_Y;
  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -1, 1);
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(ASPECT, 1, 180, 166);

  // The gallop is driven by channels (one value per part) that JS interpolates between six key poses
  // modelled on a classic cartoon cat run: reach, land, gather, bunch, push off, fly.
  const CH = ['uH', 'uHB', 'uN', 'uNB', 'uF', 'uFB', 'uSx', 'uSy', 'uArch', 'uPitch', 'uBound', 'uHead'];
  const vertexShader = /* glsl */`
    uniform float uRun, uPhase, uAspect, uShift;
    uniform float ${CH.join(', ')};
    uniform int uMode;                      // 0 cat, 1 shadow, 2/3 speed lines
    varying vec2 vUv;
    const float TAU = 6.2831853;
    vec2 rot(vec2 p, vec2 c, float a) {     // image space is y-down: positive a turns clockwise
      float s = sin(a), k = cos(a); p -= c;
      return c + vec2(k * p.x - s * p.y, s * p.x + k * p.y);
    }
    vec2 A(float x, float y) { return vec2(x * uAspect, y); }
    // the body: shortened/lengthened and squashed about the belly line, so parts attached to it move along
    vec2 body(vec2 p) {
      vec2 c = A(0.50, 0.62);
      return vec2(c.x + (p.x - c.x) * uSx, c.y + (p.y - c.y) * uSy);
    }
    void main() {
      vUv = uv;
      vec2 q = vec2(uv.x, 1.0 - uv.y);      // 0..1 across the drawing, y down
      vec2 P = vec2(q.x * uAspect, q.y);
      float ph = uPhase * TAU;

      if (uMode == 0) {
        // --- which part each point belongs to (soft weights) ---
        vec2 tb = A(0.27, 0.40);
        float tailM = smoothstep(0.46, 0.39, q.y) * smoothstep(0.37, 0.27, q.x);
        vec2 nk = A(0.69, 0.53);
        // the head (and the whole ear, which reaches further left) moves as one piece
        float headM = smoothstep(0.62, 0.53, q.y) * mix(smoothstep(0.55, 0.66, q.x), smoothstep(0.50, 0.575, q.x), smoothstep(0.40, 0.30, q.y));
        vec2 hip = A(0.215, 0.555);
        vec2 hd = normalize(vec2(-0.165 * uAspect, 0.11));
        float ht = dot(P - hip, hd);
        float hindM = smoothstep(-0.02, 0.06, ht) * smoothstep(0.45, 0.52, q.y) * smoothstep(0.43, 0.33, q.x);
        float hAlong = clamp(ht / 0.21, 0.0, 1.0);
        vec2 sh = A(0.792, 0.588);
        vec2 d = P - sh;
        float ang = atan(d.y, d.x), r = length(d);
        float radial = smoothstep(0.035, 0.08, r);
        float nearM = smoothstep(0.82, 1.12, ang) * smoothstep(2.38, 2.16, ang) * radial;
        float farM = smoothstep(-0.14, 0.10, ang) * (1.0 - smoothstep(0.82, 1.12, ang)) * radial * smoothstep(0.545, 0.578, q.y);
        float along = clamp(r / 0.27, 0.0, 1.0);

        // --- each part moves rigidly from its joint, then rides along with the body ---
        float tr = length(P - tb);
        vec2 tailP = rot(P, tb, uRun * (0.5 * tr) * sin(ph * 1.0 - tr * 9.0)) - tb + body(tb);
        vec2 headP = rot(P, nk, uHead) - nk + body(nk);
        vec2 hindP = rot(P, hip, uH + uHB * hAlong) - hip + body(hip);
        vec2 nearP = rot(P, sh, uN + uNB * along) - sh + body(sh);
        vec2 farP = rot(P, sh, uF + uFB * along) - sh + body(sh);
        vec2 bodyP = body(P);
        bodyP.y -= uArch * sin(3.14159 * clamp((q.x - 0.16) / 0.62, 0.0, 1.0)) * smoothstep(0.66, 0.40, q.y);

        float w = tailM + headM + hindM + nearM + farM;
        float k = w > 1.0 ? 1.0 / w : 1.0;
        P = bodyP * (1.0 - min(w, 1.0)) + k * (tailM * tailP + headM * headP + hindM * hindP + nearM * nearP + farM * farP);

        // --- the whole cat: pitch and bound ---
        P = rot(P, A(0.50, 0.55), uPitch);
        P.y -= uBound;
      } else if (uMode == 1) {
        vec2 c = A(0.41, 0.855);              // shadow shrinks while the cat is high
        P.x = c.x + (P.x - c.x) * (1.0 - 2.2 * max(uBound, 0.0));
      } else {
        P.x += uShift * uAspect;               // speed lines stream backwards
      }
      gl_Position = projectionMatrix * modelViewMatrix * vec4(P.x - uAspect * 0.5, 0.5 - P.y, 0.0, 1.0);
    }`;

  const fragmentShader = /* glsl */`
    uniform sampler2D uMap;
    uniform int uMode;
    uniform float uAlpha;
    varying vec2 vUv;
    bool inBox(vec2 q, vec4 b) { return q.x > b.x && q.x < b.z && q.y > b.y && q.y < b.w; }
    void main() {
      vec4 c = texture2D(uMap, vUv);          // premultiplied
      if (c.a < 0.004) discard;
      vec3 rgb = c.rgb / c.a;                  // judge colour on the real colour, even on soft edges
      vec2 q = vec2(vUv.x, 1.0 - vUv.y);
      bool grey = rgb.r < rgb.b + 0.06;        // shadow, speed lines and their soft rims aren't warm; the cat is
      bool sh = inBox(q, vec4(0.12, 0.79, 0.72, 0.93));
      bool up = inBox(q, vec4(0.21, 0.205, 0.57, 0.345));
      bool lo = inBox(q, vec4(0.255, 0.68, 0.555, 0.795));
      bool mine = uMode == 0 ? !((sh || up || lo) && grey)
                : uMode == 1 ? (sh && grey)
                : uMode == 2 ? (up && grey) : (lo && grey);
      if (!mine) discard;
      // convert to the output colour space before premultiplying, so soft edges don't lighten
      vec3 outRgb = linearToOutputTexel(vec4(rgb, 1.0)).rgb;
      float a = c.a * uAlpha;
      gl_FragColor = vec4(outRgb * a, a);
    }`;

  const texture = new THREE.TextureLoader().load(src, () => {
    resize(); render(); runner.classList.add('gl');
    // hide the image layers here too (the CSS does the same), so the drawing never shows twice
    runner.querySelectorAll(':scope > img, .run-cat').forEach(n => { n.style.visibility = 'hidden'; });
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.premultiplyAlpha = true;
  texture.anisotropy = 4;

  const layers = [1, 2, 3, 0].map((mode, i) => {
    const m = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true,
      uniforms: { uMap: { value: texture }, uMode: { value: mode }, uRun: { value: 0 }, uPhase: { value: 0 },
        uAspect: { value: ASPECT }, uShift: { value: 0 }, uAlpha: { value: 1 },
        ...Object.fromEntries(CH.map(c => [c, { value: c === 'uSx' || c === 'uSy' ? 1 : 0 }])) },
    });
    const mesh = new THREE.Mesh(geometry, m);
    mesh.renderOrder = i;                    // shadow, lines, then the cat on top
    scene.add(mesh);
    return m;
  });
  const [shadowM, upM, loM] = layers;
  runner.append(canvas);

  let run = 0, phase = 0, linesT = 0, last = 0, raf = 0, held = false, sprintUntil = 0;

  // Six key poses (radians; + turns clockwise). Back legs: negative swings them forward under the
  // belly. Front legs: positive sweeps them back under the chest. HB/NB/FB fold the paw end further.
  // Body: Sx length, Sy height, Arch lifts the back, Bound lifts the whole cat (drawing heights).
  //            reach   land   gather  bunch   push    fly
  const KEYS = {
    uH:     [ 0.00, -0.30, -0.95, -1.30, -0.70, -0.10],
    uHB:    [ 0.00, -0.25, -0.50, -0.40,  0.20,  0.10],
    uN:     [ 0.00,  0.22,  0.38,  0.42,  0.18,  0.00],
    uNB:    [ 0.00,  0.10,  0.22,  0.32,  0.40,  0.10],
    uF:     [ 0.00,  0.70,  1.25,  1.42,  0.80,  0.15],
    uFB:    [ 0.00,  0.15,  0.28,  0.34,  0.34,  0.10],
    uSx:    [ 1.04,  0.96,  0.86,  0.80,  0.88,  1.02],
    uSy:    [ 0.99,  1.00,  1.04,  1.07,  1.03,  0.99],
    uArch:  [ 0.000, 0.012, 0.035, 0.050, 0.020, 0.000],
    uPitch: [ 0.00,  0.05,  0.03, -0.02, -0.07, -0.03],
    uBound: [ 0.035, 0.000,-0.012,-0.028, 0.000, 0.045],
    uHead:  [ 0.00, -0.04, -0.02,  0.03,  0.06,  0.02],
  };
  const REST = { uSx: 1, uSy: 1 };
  // smooth periodic interpolation through the six keys (Catmull-Rom)
  function key(arr, ph) {
    const n = arr.length, x = ph * n, i = Math.floor(x), t = x - i;
    const p0 = arr[(i - 1 + n) % n], p1 = arr[i % n], p2 = arr[(i + 1) % n], p3 = arr[(i + 2) % n];
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  }
  function pose(ph, r, lt) {
    const vals = {};
    for (const c of CH) { const rest = REST[c] ?? 0; vals[c] = rest + r * (key(KEYS[c], ph) - rest); }
    for (const m of layers) {
      m.uniforms.uRun.value = r; m.uniforms.uPhase.value = ph;
      for (const c of CH) m.uniforms[c].value = vals[c];
    }
    shadowM.uniforms.uAlpha.value = 1 - 5 * Math.max(vals.uBound, 0);
    [[upM, 0], [loM, 0.45]].forEach(([m, off]) => {
      const f = (lt + off) % 1;
      m.uniforms.uShift.value = r * (0.06 - f * 0.17);
      m.uniforms.uAlpha.value = 1 - r + r * Math.sin(Math.PI * f);
    });
  }
  function render() { renderer.render(scene, camera); }
  function resize() {
    const w = runner.clientWidth * (1 + 2 * PAD_X), h = runner.clientHeight * (1 + 2 * PAD_Y);
    if (w && h) { renderer.setSize(w, h, false); render(); }
  }
  new ResizeObserver(resize).observe(runner);

  function frame(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const goal = held || now < sprintUntil ? 1 : 0;
    run += (goal - run) * (1 - Math.exp(-dt * (goal ? 6 : 4.5)));
    phase = (phase + dt / STRIDE) % 1;
    linesT = (linesT + dt / (STRIDE * 1.15)) % 1;
    pose(phase, run, linesT);
    render();
    if (!goal && run < 0.003) { pose(0, 0, 0); render(); raf = 0; return; }
    raf = requestAnimationFrame(frame);
  }
  function go() {
    if (raf) return;
    if (run < 0.003) phase = 0;              // start from the drawn pose
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  art.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { held = true; go(); } });
  art.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') held = false; });
  art.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { sprintUntil = performance.now() + 1800; go(); } });

  runner.__pose = (ph, r, lt = 0.3) => { pose(ph, r, lt); render(); }; // for frame-by-frame checks
}
