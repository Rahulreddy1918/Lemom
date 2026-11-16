// PREVENT: Before the Change. Timeline, camera and states. One continuous scene; every frame is a function of t.
import { Holo, makeCamera, drawPad, drawScanPlane } from './engine/holo.js';
import * as U from './engine/hud.js';
import { clamp, lerp, seg, ss, eio, eo, hash, mulberry, track, monotone, env, TAU } from '/core/lib.js';
import { partModel, lineModel, iconsModel, ringModel, HOLE, DIM, LINE, ICONS, RING } from './models.js';

const W = 1920, H = 1080, FPS = 24, BAR = 2.5, b = n => n * BAR;
// Every hit point sits on the 96 bpm bar grid (1 bar = 2.5 s); mix.py reads the same numbers through events.json.
export const TL = {
  fault: b(1), hits: [b(3), b(4), b(5)], erase: b(7), piles: b(10), connect: b(14), lift: b(15), title: b(17),
  warnIn: b(22), silence: b(25), lock: b(26), valLock: b(27), calm: [b(29.5), b(29.75), b(30)], warnOut: b(31),
  beams: [b(32), b(33), b(34)], join: [b(37), b(37.5)], outOut: 96.2, loop: b(39), brk: b(43), rejoin: b(44),
  pilot: b(46), locks: [b(47), b(48), b(49)], down: b(50), DUR: b(53),
};

export function makeFilm(C, dur) {
  const T = U.theme(C.hue, C.accent), hue = C.hue;
  const holo = new Holo(W, H);
  const M = { part: partModel(), line: lineModel(), icons: iconsModel(), ring: ringModel() };
  const BROKEN = 2;   // the figure whose link breaks

  // ---------- camera: [tx, ty, tz, yaw, pitch, dist, cx, cy] ----------
  const CAM = track([
    [0, [0, .5, 0, .95, .42, 3.6, 960, 560]], [2.5, [-.1, .55, 0, .75, .3, 3.0, 980, 560]], [6.5, [-.2, .6, 0, .62, .26, 2.6, 1000, 560]],
    [7.5, [-.1, .6, 0, .6, .25, 2.8, 1000, 560]], [9.8, [2.3, .6, 0, .45, .2, 3.6, 960, 540]], [12.2, [4.1, .6, 0, .38, .2, 3.6, 960, 540]],
    [14.6, [5.9, .65, 0, .3, .2, 3.5, 960, 540]], [17.3, [5.9, .65, 0, .26, .22, 3.7, 960, 540]], [19.6, [1.2, .4, 0, .25, .45, 7.2, 960, 540]],
    [21.6, [-2.9, .2, 0, .22, .6, 7.6, 960, 560]], [24.6, [-3.1, .2, 0, .18, .62, 7.4, 960, 560]], [27.2, [0, 0, .12, .02, 1.25, 6.2, 960, 540]],
    [34.6, [0, 0, .12, .16, 1.25, 5.7, 960, 540]], [40, [0, .9, 0, .5, .28, 5.2, 1160, 540]], [55, [0, .95, 0, .85, .24, 5.0, 1160, 540]],
    [58.5, [0, .95, 0, .72, .2, 4.7, 960, 600]], [62.2, [0, .9, 0, .68, .2, 4.5, 960, 600]], [65, [-.25, .62, 0, .62, .24, 2.55, 800, 560]],
    [70.5, [-.25, .62, 0, .57, .24, 2.42, 800, 560]], [73.6, [2.95, .6, 0, .35, .3, 7.8, 960, 560]], [77.5, [2.95, .6, 0, .3, .3, 7.6, 960, 560]],
    [80.5, [0, .9, 0, .3, .34, 7.0, 960, 520]], [97, [0, .9, 0, .5, .34, 6.8, 960, 520]], [100, [0, .6, 0, .8, .5, 7.6, 960, 500]],
    [114.5, [0, .6, 0, 1.5, .5, 7.4, 960, 500]], [117.5, [0, .7, 0, 1.7, .32, 6.6, 760, 560]], [125, [0, .7, 0, 1.85, .32, 6.3, 760, 560]],
    [128, [0, .35, 0, 2.0, .5, 5.7, 960, 720]], [133, [0, .35, 0, 2.1, .5, 5.45, 960, 720]],
  ]);
  const camAt = t => { const k = CAM(t); return { target: [k[0], k[1], k[2]], yaw: k[3], pitch: k[4], dist: k[5], fov: .6, cx: k[6], cy: k[7] }; };

  // ---------- the knowledge: one pool of dots, three piles, one graph ----------
  const R = mulberry(11), N0 = 240, NX = 44, N = N0 + NX;
  const PILE = [[0, 0, -0.95], [-1.3, 0, 0.6], [1.3, 0, 0.6]];
  const D = [];
  for (let i = 0; i < N; i++) {
    const p = i % 3, h = R(), d = { p, h, h2: R() };
    const r = 0.5 * Math.sqrt(R()), a = R() * TAU;
    d.pile = [PILE[p][0] + Math.cos(a) * r, 0.03 + Math.max(0, 0.34 * (1 - r / 0.5)) * R(), PILE[p][2] + Math.sin(a) * r];
    if (i < N0) {
      let g;
      for (let tr = 0; tr < 30; tr++) {
        const sa = p * TAU / 3 + 0.4, u = R() * 2 - 1, ph = R() * TAU, s = Math.sqrt(1 - u * u);
        let v = [s * Math.cos(ph) * .8 + Math.sin(sa) * .55, u * .8, s * Math.sin(ph) * .8 + Math.cos(sa) * .55];
        const l = Math.hypot(...v) || 1, rr = 0.28 + 0.57 * Math.sqrt(R()); g = v.map(x => x / l * rr);
        if (!D.some(q => q.g && Math.hypot(q.g[0] - g[0], q.g[1] - g[1], q.g[2] - g[2]) < 0.085)) break;
      }
      d.g = g; d.lift = TL.lift + 4.3 * h;
      d.start = i < 14 ? [i ? -0.5 * i - 0.25 * R() : 0, 0.04, i ? (R() - .5) * 0.24 : 0] : [d.pile[0], d.pile[1] + 1.3 + R(), d.pile[2]];
      d.tin = i < 14 ? (i ? 19.6 + i * 0.2 : 18.9) : TL.piles + h * 0.9;
    } else {
      const l = (i - N0) % 2, sg = l ? 1 : -1, u = R() * 2 - 1, ph = R() * TAU, s = Math.sqrt(1 - u * u), rr = 0.28 * Math.cbrt(R());
      d.g = [sg * 1.12 + s * Math.cos(ph) * rr, sg * 0.18 + u * rr, 0.1 + s * Math.sin(ph) * rr];
      d.lobe = l; d.sg = sg; d.tin = TL.join[l]; d.lift = 0;
    }
    D.push(d);
  }
  const E = [], seen = new Set();
  const link = (i, j) => { const k = i < j ? i * 1000 + j : j * 1000 + i; if (i !== j && !seen.has(k)) { seen.add(k); E.push({ a: i, b: j }); } };
  for (let i = 0; i < N; i++) {
    const lo = i < N0 ? 0 : N0, hi = i < N0 ? N0 : N;
    const near = []; for (let j = lo; j < hi; j++) if (j !== i && (i < N0 || D[j].lobe === D[i].lobe)) near.push([Math.hypot(D[i].g[0] - D[j].g[0], D[i].g[1] - D[j].g[1], D[i].g[2] - D[j].g[2]), j]);
    near.sort((x, y) => x[0] - y[0]);
    link(i, near[0][1]); link(i, near[1][1]); if (D[i].h2 < 0.35) link(i, near[2][1]);
  }
  for (let l = 0; l < 2; l++) {   // each new source docks onto the graph with three links
    const base = []; for (let j = 0; j < N0; j++) base.push([D[j].g[0] * (l ? -1 : 1), j]);
    base.sort((x, y) => x[0] - y[0]);
    for (let k = 0; k < 3; k++) link(N0 + l + 2 * k, base[k][1]);
  }
  {
    const main = E.filter(e => e.a < N0 && e.b < N0);
    main.forEach((e, i) => { e.key = hash(i * 3.3 + 1) + (D[e.a].p !== D[e.b].p ? 0 : 0.3); });
    main.sort((x, y) => x.key - y.key).forEach((e, i) => { e.t = i < 14 ? TL.connect + i * 0.17 : Math.max(D[e.a].lift, D[e.b].lift) + 2.0 + hash(i * 1.9) * 2.4; });
    E.forEach((e, i) => { e.h = hash(i * 7.7 + 2); if (e.t === undefined) e.t = TL.join[D[Math.max(e.a, e.b)].lobe] + 0.9 + e.h * 0.8; });
  }
  const GS = track([[37, [1.05, 1]], [55, [1.05, 1]], [58, [1.8, .5]], [77.5, [1.8, .5]], [80, [1.1, .95]], [97.5, [1.1, .95]], [100, [.95, .72]], [133, [.95, .72]]]);
  const SPIN = monotone([[40, 0], [44, .25], [55, 6.0], [58, 6.5], [80, 7.6], [97.5, 9.5], [107.5, 11.0], [107.9, 11.04], [110, 11.04], [110.5, 11.1], [125, 13.0], [133, 13.6]]);
  const dotPos = (i, t, G, out) => {
    const d = D[i], cs = Math.cos(G.spin), sn = Math.sin(G.spin);
    let gx = d.g[0], gy = d.g[1], gz = d.g[2];
    if (i >= N0) { gx += d.sg * 4 * (1 - eo(seg(t, d.tin, d.tin + 1.2))); out[0] = (gx * cs + gz * sn) * G.s; out[1] = gy * G.s + G.y; out[2] = (-gx * sn + gz * cs) * G.s; return out; }
    const kp = eio(seg(t, TL.piles + d.h * 0.9, TL.piles + 1.3 + d.h * 0.9)), k = eio(seg(t, d.lift, d.lift + 2.2));
    const px = lerp(d.start[0], d.pile[0], kp), py = lerp(d.start[1], d.pile[1], kp), pz = lerp(d.start[2], d.pile[2], kp);
    out[0] = lerp(px, (gx * cs + gz * sn) * G.s, k); out[1] = lerp(py, gy * G.s + G.y, k); out[2] = lerp(pz, (-gx * sn + gz * cs) * G.s, k);
    return out;
  };

  // ---------- small helpers ----------
  const flick = (t, s) => hash(Math.floor(t * FPS) * 1.7 + s) > 0.42;
  const flash3 = (t, t0) => t >= t0 && t < t0 + 3 / FPS;
  const appear = (t, tin, din, tout, dout, top) => {   // scan in from the floor, scan-erase from the top
    if (t < tin || t > tout + dout) return null;
    if (t < tin + din) { const y = top * (0.06 + 0.94 * ss(seg(t, tin, tin + din))); return { scan: { y }, plane: y }; }
    if (t > tout) { const y = top * (1 - ss(seg(t, tout, tout + dout))); return { scanDown: { y }, plane: y }; }
    return {};
  };
  const PULSE = monotone([[6.9, .75], [7.5, 2.3], [9.4, 2.3], [10, 4.1], [11.9, 4.1], [12.5, 5.9]]);
  const bez = (a, c, bb, u, o) => { const v = 1 - u; for (let k = 0; k < 3; k++) o[k] = v * v * a[k] + 2 * v * u * c[k] + u * u * bb[k]; return o; };
  const figPos = i => { const a = i / RING.n * TAU + 0.2; return [Math.sin(a) * RING.r, 0.72, Math.cos(a) * RING.r]; };

  let texts = [];
  const say = (id, text, x0, y0, x1, y1, pass) => texts.push(pass ? { id, text, x0, y0, x1, y1, pass: true } : { id, text, x0, y0, x1, y1 });

  function statement(ctx, t, id, text, t0, t1, o = {}) {
    const a = env(t, t0, t1, .25, .3); if (a <= 0) return;
    const x = o.x ?? 112, y = o.y ?? 178, size = o.size ?? 54;
    ctx.save(); ctx.font = `600 ${size}px ${U.FONT.ui}`; ctx.letterSpacing = '3px';
    const w = ctx.measureText(text).width;
    U.plate(ctx, T, x - 26, y - size * 0.98, w + 52, size * 1.5, a);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = o.acc ? T.acc(a) : T.hi(.96 * a); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillText(U.rollText(text, seg(t, t0, t0 + .5), Math.floor(t * FPS), 5), x, y);
    ctx.restore(); ctx.letterSpacing = '0px';
    say(id, text, x - 26, y - size * 0.98, x + w + 26, y + size * 0.52);
  }
  function label(ctx, id, text, x, y, a, o = {}) {   // a small plate centred on (x, y)
    if (a <= 0) return;
    const size = o.size ?? 28;
    ctx.save(); ctx.font = `600 ${size}px ${U.FONT.ui}`; ctx.letterSpacing = '2px';
    const w = ctx.measureText(text).width, x0 = x - w / 2 - 16, y0 = y - size * 0.8;
    U.plate(ctx, T, x0, y0, w + 32, size * 1.6, a, { op: .82 });
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = o.acc ? T.acc(a) : o.hot ? T.hi(a) : T.line(.95 * a);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, x - w / 2, y + 1);
    ctx.restore(); ctx.letterSpacing = '0px';
    say(id, text, x0, y0, x0 + w + 32, y0 + size * 1.6, o.pass);
  }

  // ---------- one frame ----------
  function render(ctx, t, o = {}) {
    texts = [];
    const GDIR = +(o.gdir ?? 1); const fr = Math.floor(t * FPS + 1e-6), cam = camAt(t), CP = makeCamera(cam, W, H), P = CP.project, q = new Float32Array(3), q2 = new Float32Array(3);
    const dimK = env(t, TL.brk + .1, TL.rejoin, .5, .12), GN = 1 - 0.72 * dimK;
    const endK = seg(t, TL.down, TL.down + 2), chromeA = 1 - seg(t, TL.down + 1, TL.down + 2.5);
    const gs = GS(t), G = { y: gs[0], s: gs[1], spin: SPIN(t) }, Gc = [0, G.y, 0];
    const fog = z => clamp(1 - (z - (cam.dist - 1.1)) / 2.2 * 0.75, .22, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    U.background(ctx, W, H, T, { cx: cam.cx, cy: cam.cy + 40, px: -cam.yaw * 220 - cam.target[0] * 46, py: cam.pitch * 130 });
    drawPad(ctx, cam, W, H, { hue, rot: t * 0.12 + G.spin * 0.3, alpha: GN });

    // ----- floor layer: conduit, small pads, time line, gauge -----
    const L = holo.L, g = L.getContext('2d');
    const begin = () => { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round'; g.setLineDash([]); };
    const ring3 = (c, r, a, w = 1.2, a0 = 0, a1 = TAU, col = T.line) => {
      if (a <= 0.01) return; g.beginPath();
      const n = Math.max(8, Math.round(64 * (a1 - a0) / TAU));
      for (let i = 0; i <= n; i++) { const th = a0 + (a1 - a0) * i / n; P(c[0] + Math.cos(th) * r, c[1], c[2] + Math.sin(th) * r, q); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      g.strokeStyle = col(a); g.lineWidth = w; g.stroke();
    };
    const line3 = (a, bb, al, w = 1.3, col = T.line) => { if (al <= 0.01) return; P(a[0], a[1], a[2], q); P(bb[0], bb[1], bb[2], q2); g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q2[0], q2[1]); g.strokeStyle = col(al); g.lineWidth = w; g.stroke(); };
    const dot3 = (p, r, al, col = T.hi) => { if (al <= 0.01) return; P(p[0], p[1], p[2], q); g.beginPath(); g.arc(q[0], q[1], Math.max(1.4, r * CP.foc / q[2]), 0, TAU); g.fillStyle = col(al); g.fill(); };
    begin();
    const condA = Math.max(env(t, 0.8, 18.7, .8, .5), env(t, 71, 78.6, .8, .6)) * 0.5;
    if (condA > 0) {
      line3([0.75, 0, 0], [5.9, 0, 0], condA, 1.4);
      LINE.forEach(o2 => ring3([o2.x, 0, 0], 0.62, condA * 0.9));
      for (let x = 1; x < 5.9; x += 0.25) line3([x, 0, -0.03], [x, 0, 0.03], condA * 0.7, 1);
      if (t >= 6.9 && t < TL.erase) {   // the fault runs down the line and stays
        const px = PULSE(t);
        if (flick(t, 3) || t < 12.6) line3([0.75, 0, 0], [px, 0, 0], 0.9, 2.2, T.hi);
        dot3([px, 0, 0], 0.035, 1);
      }
      if (t >= TL.erase && t < TL.erase + 1.1) { const px = lerp(5.9, 0.4, eio(seg(t, TL.erase, TL.erase + 1.1))); line3([px, 0, 0], [Math.min(5.9, px + 0.9), 0, 0], 0.9, 2.2, T.hi); dot3([px, 0, 0], 0.04, 1); }
      if (t >= 73.1 && t < 75.2) { const px = lerp(0.75, 5.9, seg(t, 73.1, 75)); line3([Math.max(.75, px - 0.7), 0, 0], [px, 0, 0], 0.7, 1.8, T.acc); dot3([px, 0, 0], 0.03, 1, T.acc); }
    }
    const tlA = env(t, 19.0, 25.4, .6, .5) * 0.6;   // the time line behind "now"
    if (tlA > 0) { const x1 = lerp(0.2, -7.3, eo(seg(t, 19.0, 21.4))); line3([0.2, 0, 0], [x1, 0, 0], tlA, 1.3); for (let x = 0; x > x1; x -= 0.5) line3([x, 0, -0.08], [x, 0, 0.08], tlA, 1); }
    ICONS.forEach((I, i) => { const a = env(t, TL.beams[i] - .4, TL.outOut + 1.1, .5, .5) * 0.5; ring3(I.o, 0.72, a); ring3(I.o, 0.78, a * 0.5); });
    const gaA = env(t, TL.locks[1], TL.down + .6, .5, .6);   // pass-rate gauge on the floor
    if (gaA > 0) {
      const r = 2.5, SW = 2.7, A0 = -Math.PI / 2 - cam.yaw - SW / 2 * GDIR, _ = 0, f = 0.75 * eio(seg(t, TL.locks[1] + .2, TL.locks[2])), lk = t >= TL.locks[2];
      ring3([0, 0, 0], r, gaA * 0.3, 1, A0, A0 + GDIR * SW);
      ring3([0, 0, 0], r, gaA * 0.95, 3, A0, A0 + GDIR * SW * f);
      ring3([0, 0, 0], r + 0.07, gaA * (lk ? 1 : 0.35), lk ? 5 : 1.5, A0 + GDIR * SW * 0.7, A0 + GDIR * SW * 0.8, lk ? T.acc : T.line);
      for (let k = 0; k <= 10; k++) { const th = A0 + GDIR * SW * k / 10; line3([Math.cos(th) * r, 0, Math.sin(th) * r], [Math.cos(th) * (r + (k % 5 ? .06 : .13)), 0, Math.sin(th) * (r + (k % 5 ? .06 : .13))], gaA * 0.6, 1); }
    }
    g.globalCompositeOperation = 'source-over'; holo.composite(ctx, 1, GN);

    // ----- models -----
    const planes = [];
    const drawM = (model, st, opts, c, r) => {
      if (!st) return null;
      const info = holo.draw(ctx, model, cam, { hue, gain: GN, ...st, ...opts, plane: undefined });
      if (st.plane !== undefined) planes.push([st.plane, c, r]);
      return info;
    };
    // the part, first time (fault) and second time (warning)
    const inA = t < 30, pst = inA ? appear(t, 0, 2.4, 18.4, .8, 1.3) : appear(t, TL.warnIn + .5, 2.5, TL.warnOut, 1.3, 1.3);
    const faultOn = inA && t >= TL.fault, pfl = faultOn && flick(t, 1);
    const wv = t >= TL.valLock && t < TL.valLock + 0.9 ? { y: lerp(0, 1.2, seg(t, TL.valLock, TL.valLock + 0.9)), w: 0.07 } : null;
    const pinfo = drawM(M.part, pst, { flash: { hole: pfl || flash3(t, TL.lock) ? 1 : 0, dim: pfl ? 1 : 0 }, gain: GN * (faultOn && !pfl ? 0.8 : 1), wave: wv }, [0, 0, 0], 0.95);
    // downstream: drawing, parts list, station
    const linfo = {};
    LINE.forEach((o2, i) => {
      const st = inA ? appear(t, .5 + .5 * i, 1.2, TL.erase + (2 - i) * .3, .9, 1.35) : appear(t, 71 + .6 * i, 1.0, TL.warnOut + (2 - i) * .2, 1.0, 1.35);
      if (!st) return;
      const hit = inA && t >= TL.hits[i], k = hit ? eo(seg(t, TL.hits[i], TL.hits[i] + .4)) * (0.9 + 0.1 * Math.sin(t * 7 + i)) : 0, fl = hit && flick(t, 5 + i);
      const okF = !inA && flash3(t, TL.calm[i]);
      const info = drawM(M.line, st, { only: [o2.id], explode: { [o2.id]: k }, flash: { [o2.id]: fl || okF || flash3(t, TL.hits[i]) ? 1 : 0 }, gain: GN * (hit ? (fl ? 1 : 0.55) : inA ? 0.6 : 0.85) }, [o2.x, 0, 0], 0.62);
      if (info) { linfo[o2.id] = info; }
    });
    // outputs
    const iinfo = {};
    ICONS.forEach((I, i) => {
      const st = appear(t, TL.beams[i], 1.0, TL.outOut, 1.1, 1.3); if (!st) return;
      const pop = eo(seg(t, TL.beams[i] + 1.1, TL.beams[i] + 1.6));
      iinfo[I.id] = drawM(M.icons, st, { only: [I.id], explode: { 'sc-card': pop, 'ep-back': pop }, flash: { [I.id]: flash3(t, TL.beams[i] + 1) ? 1 : 0 } }, I.o, 0.72);
    });
    // the ring of figures
    const rst = appear(t, TL.loop, 2.0, TL.down, 2.0, 0.85);
    const brk = t >= TL.brk && t < TL.rejoin;
    const rinfo = drawM(M.ring, rst, { flash: { ['f' + BROKEN]: (brk && flick(t, 9)) || flash3(t, TL.rejoin) ? 1 : 0 } }, [0, 0, 0], RING.r + .25);

    // ----- net layer: dots, edges, rays, beams, links -----
    begin();
    const netA = 1 - endK * 0.0, yCut = lerp(2.6, -0.2, endK);
    const SP = new Float32Array(N * 3), AL = new Float32Array(N), WP = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const d = D[i]; dotPos(i, t, G, q); WP[i * 3] = q[0]; WP[i * 3 + 1] = q[1]; WP[i * 3 + 2] = q[2];
      let a = seg(t, d.tin, d.tin + .35) * netA; if (endK > 0) a *= clamp((yCut - q[1]) * 6);
      P(q[0], q[1], q[2], q); SP[i * 3] = q[0]; SP[i * 3 + 1] = q[1]; SP[i * 3 + 2] = q[2]; AL[i] = a * fog(q[2]);
    }
    if (t >= TL.connect) {
      const lv = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], hot = new Path2D();
      const boost = 1 + 0.25 * seg(t, TL.join[0], TL.join[0] + 1) + 0.25 * seg(t, TL.join[1], TL.join[1] + 1);
      for (const e of E) {
        const k = seg(t, e.t, e.t + .6); if (k <= 0) continue;
        const a = Math.min(AL[e.a], AL[e.b]); if (a < 0.03) continue;
        const x0 = SP[e.a * 3], y0 = SP[e.a * 3 + 1], x1 = lerp(x0, SP[e.b * 3], k), y1 = lerp(y0, SP[e.b * 3 + 1], k);
        const tgt = k < 1 ? hot : lv[Math.min(3, Math.floor(a * 4))];
        tgt.moveTo(x0, y0); tgt.lineTo(x1, y1);
        if (e.h < 0.16 && k >= 1 && !brk) { const u = (t * 0.4 + e.h * 9) % 1; hot.rect(lerp(x0, SP[e.b * 3], u) - 1.5, lerp(y0, SP[e.b * 3 + 1], u) - 1.5, 3, 3); }
      }
      for (let i = 0; i < 4; i++) { g.strokeStyle = T.line(Math.min(1, (0.14 + i * 0.13) * boost)); g.lineWidth = 1 + i * 0.12; g.stroke(lv[i]); }
      g.strokeStyle = T.hi(.9); g.lineWidth = 1.5; g.stroke(hot); g.fillStyle = T.hi(.9); g.fill(hot);
    }
    for (let i = 0; i < N; i++) {
      if (AL[i] < 0.02) continue;
      const land = 1 - seg(t, D[i].tin + .1, D[i].tin + .6), same = i < 14 && i % 4 === 3 && t > 21 && t < 25;
      const r = Math.max(1.6, 0.017 * CP.foc / SP[i * 3 + 2] * (i < 14 && t < 25 ? (i ? 2.1 : 3) : 1));
      g.beginPath(); g.arc(SP[i * 3], SP[i * 3 + 1], r, 0, TAU);
      g.fillStyle = (land > 0 || same || (i === 0 && t < 25)) ? T.hi(AL[i]) : `hsla(${hue},100%,${68 + 14 * D[i].h2}%,${AL[i]})`; g.fill();
    }
    // the same kind of change, seen before: rings on the time line
    for (const i of [0, 3, 7, 11]) { const a = env(t, 21.2 + i * 0.07, 24.9, .3, .4); if (a > 0) { g.beginPath(); g.arc(SP[i * 3], SP[i * 3 + 1], 15 + 3 * Math.sin(t * 5 + i), 0, TAU); g.strokeStyle = T.hi(a * .9); g.lineWidth = 1.6; g.stroke(); } }
    const curve = (a, c, bb, prog, al, w = 1.4, col = T.line, u0 = 0) => {
      if (al <= 0.01 || prog <= u0) return; g.beginPath();
      for (let i = 0; i <= 28; i++) { const u = u0 + (prog - u0) * i / 28; bez(a, c, bb, u, q2); P(q2[0], q2[1], q2[2], q); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
      g.strokeStyle = col(al); g.lineWidth = w; g.stroke();
    };
    const mid = (a, bb, up) => [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 + up, (a[2] + bb[2]) / 2];
    // PREVENT speaks up: a ray from the graph down to the hole
    const rayA = env(t, TL.lock - .6, TL.warnOut - 6.8, .1, .5);
    if (rayA > 0) { const k = eo(seg(t, TL.lock - .6, TL.lock - .1)), c = mid(Gc, HOLE, 0); c[0] += 0.5; curve(Gc, c, HOLE, k, rayA * .8, 1.6, T.hi); bez(Gc, c, HOLE, (t * 0.9) % 1 * k, q2); dot3(q2, 0.014, rayA); }
    // beams to the three outputs
    const boostB = 0.55 + 0.22 * seg(t, TL.join[0], TL.join[0] + 1) + 0.23 * seg(t, TL.join[1], TL.join[1] + 1);
    ICONS.forEach((I, i) => {
      const a = env(t, TL.beams[i] - .5, TL.outOut + .6, .1, .5); if (a <= 0) return;
      const end = [I.o[0], 1.12, I.o[2]], c = mid(Gc, end, 0.95), k = eo(seg(t, TL.beams[i] - .5, TL.beams[i]));
      curve(Gc, c, end, k, a * boostB, 1.6 + boostB);
      for (let j = 0; j < 3; j++) { bez(Gc, c, end, ((t * 0.55 + j / 3 + i * .21) % 1) * k, q2); dot3(q2, 0.016, a); }
    });
    // the loop: every figure feeds the graph and is fed by it
    const loopA = env(t, TL.loop + 1.6, TL.down + .3, .6, .6);
    if (loopA > 0) for (let i = 0; i < RING.n; i++) {
      const f = figPos(i), cIn = mid(f, Gc, 0.55), cOut = mid(f, Gc, 0.1), isB = i === BROKEN;
      const gap = isB ? eo(seg(t, TL.brk, TL.brk + .4)) * (1 - eo(seg(t, TL.rejoin, TL.rejoin + .3))) : 0;
      if (gap > 0.01) {
        cIn[1] -= gap * 0.5; cOut[1] -= gap * 0.5; g.setLineDash([5, 9]);
        curve(f, cIn, Gc, 0.5 - gap * 0.22, loopA * .8, 1.4, T.hi); curve(f, cIn, Gc, 1, loopA * .8, 1.4, T.hi, 0.5 + gap * 0.22);
        g.setLineDash([]);
      } else {
        curve(f, cIn, Gc, 1, loopA * (isB && flash3(t, TL.rejoin) ? 1 : .42), 1.3); curve(Gc, cOut, f, 1, loopA * .3, 1.1);
        if (!brk) { bez(f, cIn, Gc, (t * 0.42 + i * .137) % 1, q2); dot3(q2, 0.017, loopA); bez(Gc, cOut, f, (t * 0.42 + i * .137 + .5) % 1, q2); dot3(q2, 0.014, loopA * .9, T.acc); }
      }
    }
    g.globalCompositeOperation = 'source-over'; holo.composite(ctx, 1, GN);

    for (const [y, c, r] of planes) drawScanPlane(ctx, cam, W, H, y, { hue, r, c, rot: t * 0.5 });
    U.vignette(ctx, W, H, 0.5);

    // ---------- HUD ----------
    const mode = t < TL.erase ? 'CHANGE TRACE' : t < TL.piles ? 'HISTORY' : t < TL.connect ? 'SOURCES' : t < TL.warnIn ? 'KNOWLEDGE GRAPH' : t < TL.warnOut ? 'DESIGN CHECK' : t < TL.loop ? 'OUTPUTS' : t < TL.pilot ? 'LOOP' : 'PILOT';
    const stat = t < 2.4 ? `SCANNING ${String(Math.round(seg(t, 0, 2.4) * 100)).padStart(3, '0')}%` : t < TL.fault ? 'SCAN COMPLETE' : t < TL.erase ? `CHANGE FOUND LATE · ${1 + TL.hits.filter(h => t >= h).length} AFFECTED` : t < TL.piles ? 'SAME KIND OF CHANGE · SEEN BEFORE'
      : t < TL.connect ? '3 SOURCES · 0 LINKS' : t < TL.warnIn ? `LINKS ${String(E.filter(e => t >= e.t).length).padStart(3, '0')}` : t < TL.lock ? 'DESIGN IN PROGRESS' : t < TL.valLock ? 'MATCH FOUND' : t < TL.warnOut ? 'CORRECTED · 0 AFFECTED'
      : t < TL.join[0] ? `OUTPUTS ${TL.beams.filter(h => t >= h).length}/3` : t < TL.loop ? `SOURCES ${3 + TL.join.filter(h => t >= h).length}` : brk ? 'LOOP BROKEN' : t < TL.pilot ? 'LOOP CLOSED' : t < TL.down ? 'FIRST STEP' : 'READY';
    U.chrome(ctx, W, H, T, { alpha: chromeA, px: -cam.yaw * 300, tl: `${t < TL.title ? 'ENGINEERING CHANGE' : C.title} // ${mode}`, tr: stat,
      bl: `YAW ${(cam.yaw * 57.3).toFixed(1).padStart(5, '0')}  PITCH ${(cam.pitch * 57.3).toFixed(1)}`, br: `ZOOM ${(10 / cam.dist).toFixed(2)}×  T+${t.toFixed(1).padStart(5, '0')}` });

    const proj = (p, dx = 0, dy = 0) => { P(p[0], p[1], p[2], q); return [q[0] + dx, q[1] + dy]; };
    // dimension label on the part
    if (pst && pinfo) {
      const a = inA ? env(t, 1.9, 18.6, .3, .3) : env(t, TL.warnIn + 2.6, TL.warnOut + .2, .3, .3);
      if (a > 0) {
        const [x, y] = proj(DIM, 0, -26);
        let txt = C.dim.before, st = {};
        if (inA && t > TL.fault + 0.05) { txt = U.rollText(C.dim.after, seg(t, TL.fault, TL.fault + .8), fr, 2); st = { hot: true }; }
        if (!inA && t > TL.valLock - 1 + 0.05) { txt = U.rollText(C.dim.after, seg(t, TL.valLock - 1, TL.valLock), fr, 2); st = t >= TL.valLock ? (flash3(t, TL.valLock) ? { hot: true } : { acc: true }) : {}; }
        label(ctx, 'dim', txt, x, y, a * (inA && faultOn && !pfl ? 0.75 : 1), { size: 32, ...st, pass: true });
      }
      if (inA) U.targetBox(ctx, T, pinfo.bbox.hole, seg(t, TL.fault - .22, TL.fault) * (1 - seg(t, 18.2, 18.5)), { flash: flash3(t, TL.fault), tag: C.dim.tag, pad: 20 });
      else {
        const ka = 1 - seg(t, 70.3, 70.7);
        U.targetBox(ctx, T, pinfo.bbox.hole, seg(t, TL.lock - .22, TL.lock) * ka, { flash: flash3(t, TL.lock), tag: `${C.title} · CHECK`, pad: 20 });
        const an = pinfo.anchor.hole, cx = 1310, cy = 250;
        U.leader(ctx, T, [an[0], an[1]], [an[0] + 150, cy + 40], [cx - 24, cy + 40], seg(t, TL.lock + .15, TL.lock + .65), { alpha: ka, pulse: seg(t, TL.lock + .15, TL.lock + .9) % 1 });
        const rv = seg(t, TL.lock + .4, TL.lock + .9);
        if (rv > 0 && ka > 0) {
          U.specCard(ctx, T, cx, cy, C.card, { reveal: rv, roll: seg(t, TL.valLock - 1, TL.valLock), detail: seg(t, TL.lock + 1.0, TL.lock + 1.5), frame: fr, flash: flash3(t, TL.valLock) }, { alpha: ka, index: '01', big: 124 });
          say('card', `${C.card.label} ${C.card.value} ${C.card.unit}`, cx - 22, cy - 20, cx + 482, cy + 220);
          if (t >= TL.lock + 1.0) say('card-detail', C.card.detail, cx, cy + 220, cx + 460, cy + 262);
        }
      }
    }
    // downstream tags
    LINE.forEach((o2, i) => {
      const info = linfo[o2.id]; if (!info) return;
      if (inA) U.targetBox(ctx, T, info.bbox[o2.id], seg(t, TL.hits[i] - .22, TL.hits[i]) * (1 - seg(t, TL.erase + (2 - i) * .3, TL.erase + (2 - i) * .3 + .3)), { flash: flash3(t, TL.hits[i]), tag: C.line[i], pad: 14 });
      else {
        const a = env(t, TL.calm[i], TL.warnOut + (2 - i) * .2, .15, .3), bb = info.bbox[o2.id];
        if (a > 0 && bb) { label(ctx, 'calm' + i, C.line[i], (bb[0] + bb[2]) / 2, bb[1] - 64, a, { size: 24 }); label(ctx, 'ok' + i, C.calm, (bb[0] + bb[2]) / 2, bb[1] - 26, a, { size: 24, acc: !flash3(t, TL.calm[i]), hot: flash3(t, TL.calm[i]) }); }
      }
    });
    // pile labels (plan view)
    PILE.forEach((p, i) => {
      const a = env(t, 26.6 + i * .45, 37.2, .3, .6); if (a <= 0) return;
      const [x, y] = i === 0 ? proj([p[0] + 0.62, 0, p[2]], 150, 0) : proj([p[0], 0, p[2] - 0.62], 0, -30);
      label(ctx, 'pile' + i, C.piles[i], x, y, a, { size: 30 });
    });
    // source labels
    [0, 1].forEach(l => {
      const a = env(t, TL.join[l] + .5, TL.outOut + .9, .3, .4); if (a <= 0) return;
      const sg = l ? 1 : -1, cs = Math.cos(G.spin), sn = Math.sin(G.spin), gx = sg * 1.12, gz = 0.1;
      const [x, y] = proj([(gx * cs + gz * sn) * G.s, sg * 0.18 * G.s + G.y + 0.42, (-gx * sn + gz * cs) * G.s]);
      label(ctx, 'src' + l, C.sources[l], x, y, a, { size: 26 });
    });
    // outputs: each named where it stands
    ICONS.forEach((I, i) => {
      const a = env(t, TL.beams[i] + .7, TL.outOut + .5, .35, .4), info = iinfo[I.id]; if (a <= 0 || !info || !info.bbox[I.id]) return;
      const bb = info.bbox[I.id], side = i === 1;
      const x = side ? bb[0] - 190 : (bb[0] + bb[2]) / 2, y = side ? (bb[1] + bb[3]) / 2 - 40 : bb[1] - 74;
      label(ctx, 'outA' + i, `0${i + 1} · ${C.outputs[i].label}`, x, y, a, { size: 24 });
      label(ctx, 'outB' + i, C.outputs[i].detail, x, y + 42, a, { size: 28, hot: true });
    });
    // pilot cards
    const pa = 1 - seg(t, TL.down - .4, TL.down);
    if (t >= TL.pilot && pa > 0) C.pilot.cards.forEach((c, i) => {
      const lk = TL.locks[i], rv = seg(t, lk - 1.7, lk - 1.2); if (rv <= 0) return;
      const x = 1330, y = 190 + i * 208;
      U.specCard(ctx, T, x, y, c, { reveal: rv, roll: seg(t, lk - 1, lk), detail: 0, frame: fr, flash: flash3(t, lk) }, { alpha: pa, index: '0' + (i + 1), big: 96, w: 440 });
      say('pilot' + i, `${c.label} ${c.value} ${c.unit}`, x - 22, y - 20, x + 462, y + 160);
    });

    // statements (one slot, top left)
    const S = C.statements;
    statement(ctx, t, 's1', S.s1, 3.0, 7.6); statement(ctx, t, 's2', S.s2, 19.2, 24.6); statement(ctx, t, 's3', S.s3, 25.8, 29.9); statement(ctx, t, 's4', S.s4, 30.1, 34.8);
    statement(ctx, t, 's5', S.s5, 47.5, 53.6, { x: 126, y: 760, size: 44 }); statement(ctx, t, 's6', S.s6, 73.0, 77.7, { x: 640 }); statement(ctx, t, 's7', S.s7, 88.0, 92.5); statement(ctx, t, 's8', S.s8, 92.8, 97.3);
    statement(ctx, t, 's9', S.s9, 101.5, 106.6); statement(ctx, t, 's10', S.s10, TL.brk + .2, 113.2); statement(ctx, t, 'pilot', C.pilot.head, TL.pilot + .3, TL.down - .1, { size: 44 });

    // title: rolls in like a value, part of the scene
    const ta = env(t, TL.title - 1, 54.6, .2, .5);
    if (ta > 0) {
      const x = 126, y = 520, k = seg(t, TL.title - 1, TL.title), lk = t >= TL.title;
      ctx.save(); ctx.font = `300 168px ${U.FONT.ui}`; ctx.letterSpacing = '22px'; const w = ctx.measureText(C.title).width;
      U.plate(ctx, T, x - 30, y - 196, w + 46, 346, ta);
      ctx.globalCompositeOperation = 'lighter'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.fillStyle = lk ? (flash3(t, TL.title) ? T.hi(ta) : T.acc(ta)) : T.line(.9 * ta);
      ctx.fillText(U.rollText(C.title, k, fr, 7), x, y);
      ctx.font = `20px ${U.FONT.mono}`; ctx.letterSpacing = '0px'; ctx.fillStyle = T.dim(.95 * ta); ctx.fillText('KNOWLEDGE GRAPH // ENGINEERING', x + 4, y - 156);
      const k2 = seg(t, 44.2, 44.8);
      if (k2 > 0) { ctx.font = `500 30px ${U.FONT.ui}`; ctx.letterSpacing = '2px'; ctx.fillStyle = T.hi(.92 * ta); ctx.fillText(U.rollText(C.tagline, k2, fr, 9), x + 4, y + 70); say('tagline', C.tagline, x, y + 40, x + w, y + 84); }
      ctx.fillStyle = T.line(.9 * ta); ctx.fillRect(x + 4, y + 104, (w - 26) * eo(seg(t, TL.title, TL.title + .6)), 2);
      ctx.restore(); ctx.letterSpacing = '0px';
      say('title', C.title, x - 30, y - 196, x + w + 16, y + 20);
    }
    // end: the word mark over the pad, everything else off
    const ea = seg(t, TL.down + 1.7, TL.down + 1.9);
    if (ea > 0) {
      ctx.save(); ctx.font = `300 190px ${U.FONT.ui}`; ctx.letterSpacing = '34px'; const w = ctx.measureText(C.title).width, x = (W - w + 34) / 2, y = 430;
      ctx.globalCompositeOperation = 'lighter'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      const lk = t >= TL.down + 2.5; ctx.fillStyle = lk ? (flash3(t, TL.down + 2.5) ? T.hi(1) : T.acc(1)) : T.line(.9);
      ctx.fillText(U.rollText(C.title, seg(t, TL.down + 1.8, TL.down + 2.5), fr, 7), x, y);
      ctx.restore(); ctx.letterSpacing = '0px';
      say('wordmark', C.title, x, y - 150, x + w, y + 20);
      const k2 = seg(t, TL.down + 2.6, TL.down + 3.0);
      if (k2 > 0) {
        ctx.save(); ctx.font = `500 34px ${U.FONT.ui}`; ctx.letterSpacing = '4px'; const w2 = ctx.measureText(C.endline).width, x2 = (W - w2) / 2;
        U.plate(ctx, T, x2 - 28, 492, w2 + 56, 64, k2);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = T.hi(.95 * k2); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillText(U.rollText(C.endline, k2, fr, 4), x2, 525); ctx.restore(); ctx.letterSpacing = '0px';
        say('endline', C.endline, x2 - 28, 492, x2 + w2 + 28, 556);
      }
    }

    if (!o.nosub) for (const c of subs()) if (t >= c.t0 && t < c.t1) U.subtitle(ctx, W, H, T, c.text, Math.min(seg(t, c.t0, c.t0 + .1), 1 - seg(t, c.t1 - .1, c.t1)), { t });
    if (t >= TL.brk && t < TL.brk + 3 / FPS) U.glitch(ctx, W, H, 1 - (t - TL.brk) * FPS / 4, fr);
  }

  let SUBS = null;
  function subs() {
    if (SUBS) return SUBS;
    SUBS = C.voice.map((v, i) => {
      const d = dur[v.id] || 3, nx = C.voice[i + 1];
      return { t0: v.at - 0.1, t1: Math.min(Math.max(v.at + d + 0.6, v.at + 1.8), nx ? nx.at - 0.14 : 1e9), text: v.sub };
    });
    return SUBS;
  }
  function events() {
    const ev = [], add = (t, type, x = {}) => ev.push({ t: +t.toFixed(3), type, ...x });
    add(0, 'scan', { d: 2.4 }); add(TL.fault, 'lock'); add(TL.fault, 'fault', { d: TL.erase - TL.fault });
    [6.9, 9.4, 11.9].forEach((t, i) => { add(t, 'run'); add(TL.hits[i], 'break', { i }); });
    add(TL.erase - .25, 'erase', { d: 2.0 });
    for (let i = 1; i < 14; i++) add(19.6 + i * .2, 'tick', { i });
    add(21.2, 'same'); add(TL.piles, 'fall', { d: 2.2 }); [0, 1, 2].forEach(i => add(26.6 + i * .45, 'blip', { i }));
    for (let k = 0; k < 54; k++) add(TL.connect + k * 0.3125, 'edge', { i: k });
    add(TL.title - 1, 'roll', { d: 1 }); add(TL.title, 'confirm');
    add(TL.warnIn + .5, 'scan', { d: 2.5 }); add(TL.lock - .6, 'ray'); add(TL.lock, 'lock', { big: 1 }); add(TL.lock + .15, 'leader');
    add(TL.valLock - 1, 'roll', { d: 1 }); add(TL.valLock, 'confirm', { big: 1 });
    [0, 1, 2].forEach(i => { add(71 + .6 * i, 'scan', { d: 1, small: 1 }); add(TL.calm[i], 'ok', { i }); });
    add(TL.warnOut - .2, 'erase', { d: 1.6 });
    [0, 1, 2].forEach(i => { add(TL.beams[i] - .5, 'beam', { i }); add(TL.beams[i], 'scan', { d: 1, small: 1 }); add(TL.beams[i] + .7, 'dock', { i }); });
    [0, 1].forEach(i => add(TL.join[i], 'join', { i }));
    add(TL.outOut, 'erase', { d: 1.3 }); add(TL.loop, 'scan', { d: 2 });
    add(TL.brk, 'brk'); add(TL.rejoin, 'rejoin');
    TL.locks.forEach((t, i) => { add(t - 1, 'roll', { d: 1 }); add(t, 'confirm', { i }); });
    add(TL.locks[1] + .2, 'gauge', { d: 2.3 }); add(TL.down, 'powerdown', { d: 2 }); add(TL.down + 1.8, 'roll', { d: .7 }); add(TL.down + 2.5, 'confirm', { big: 1 });
    return ev.sort((a, c) => a.t - c.t);
  }
  return { render, events, subs, texts: (ctx, t) => { render(ctx, t, { nosub: true }); return texts; }, TL };
}
