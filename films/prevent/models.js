// Wireframe models for the film, built in code (metres, y up). Nothing here is a real part, drawing or system.
import { prepModel } from './engine/holo.js';
const TAU = Math.PI * 2;

class B {
  constructor() { this.parts = []; this.o = [0, 0, 0]; this.yaw = 0; }
  at(o, yaw = 0) { this.o = o; this.yaw = yaw; return this; }
  part(id, anchor) { this.P = { id, anchor: this.w(anchor), pieces: [] }; this.parts.push(this.P); return this; }
  piece(id, explode = [0, 0, 0], o = {}) { this.C = { id, v: [], e: [], q: [], explode, ...o }; this.P.pieces.push(this.C); return this; }
  w([x, y, z]) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return [this.o[0] + x * c + z * s, this.o[1] + y, this.o[2] - x * s + z * c]; }
  p(x, y, z) { const q = this.w([x, y, z]); this.C.v.push(q[0], q[1], q[2]); return this.C.v.length / 3 - 1; }
  seg(a, b) { const i = this.p(...a), j = this.p(...b); this.C.e.push(i, j); }
  poly(pts, closed = false) {
    const ids = pts.map(q => this.p(...q));
    for (let i = 0; i < ids.length - 1; i++) this.C.e.push(ids[i], ids[i + 1]);
    if (closed) this.C.e.push(ids[ids.length - 1], ids[0]);
    return ids;
  }
  box(c, s) {
    const [hx, hy, hz] = s.map(x => x / 2), ids = [];
    for (const z of [-hz, hz]) for (const y of [-hy, hy]) for (const x of [-hx, hx]) ids.push(this.p(c[0] + x, c[1] + y, c[2] + z));
    for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) this.C.e.push(ids[a], ids[b]);
    for (const f of [[0, 1, 3, 2], [4, 5, 7, 6], [0, 1, 5, 4], [2, 3, 7, 6], [0, 2, 6, 4], [1, 3, 7, 5]]) this.C.q.push(...f.map(i => ids[i]));
  }
  // circle in the plane whose normal is axis ax (0 x, 1 y, 2 z)
  circle(c, ax, r, n = 24, a0 = 0, a1 = TAU) {
    const ids = [], closed = a1 - a0 >= TAU - 1e-6, cnt = closed ? n : n + 1;
    for (let i = 0; i < cnt; i++) {
      const a = a0 + (a1 - a0) * i / n, u = Math.cos(a) * r, w = Math.sin(a) * r;
      ids.push(ax === 0 ? this.p(c[0], c[1] + u, c[2] + w) : ax === 1 ? this.p(c[0] + u, c[1], c[2] + w) : this.p(c[0] + u, c[1] + w, c[2]));
    }
    for (let i = 0; i < ids.length - 1; i++) this.C.e.push(ids[i], ids[i + 1]);
    if (closed) this.C.e.push(ids[ids.length - 1], ids[0]);
    return ids;
  }
  cyl(c, ax, r, len, n = 24, longs = 6) {
    const d = [0, 0, 0]; d[ax] = len / 2;
    const A = this.circle([c[0] - d[0], c[1] - d[1], c[2] - d[2]], ax, r, n), Bq = this.circle([c[0] + d[0], c[1] + d[1], c[2] + d[2]], ax, r, n);
    const st = Math.max(1, Math.round(n / longs));
    for (let i = 0; i < n; i++) { if (i % st === 0) this.C.e.push(A[i], Bq[i]); this.C.q.push(A[i], A[(i + 1) % n], Bq[(i + 1) % n], Bq[i]); }
  }
  // rectangle in the x–y plane at depth z
  rect(x0, y0, x1, y1, z = 0) { return this.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], true); }
  model() { return prepModel({ parts: this.parts }); }
}

// The invented part: an angle bracket with one bore through its upright wall. HOLE is the bore's centre on the wall face.
export const HOLE = [-0.38, 0.58, 0], DIM = [-0.38, 1.1, 0];
export function partModel() {
  const b = new B();
  b.part('body', [0.1, 0.12, 0]).piece('body');
  b.box([0, 0.06, 0], [1.3, 0.12, 0.8]);
  b.box([-0.45, 0.5, 0], [0.14, 0.76, 0.8]);
  for (const z of [-0.39, 0.39]) b.poly([[-0.38, 0.12, z], [0.25, 0.12, z], [-0.38, 0.5, z]], true);   // gussets
  for (const z of [-0.22, 0.22]) b.cyl([0.3, 0.06, z], 1, 0.07, 0.12, 16, 4);                          // mounting holes
  b.part('hole', HOLE).piece('hole');
  b.cyl([-0.45, 0.58, 0], 0, 0.16, 0.14, 28, 7);
  b.circle([-0.38, 0.58, 0], 0, 0.215, 28);
  b.part('dim', DIM).piece('dim', [0, 0, 0], { box: false });
  for (const z of [-0.16, 0.16]) b.seg([-0.38, 0.58, z], [-0.38, 1.0, z]);
  b.seg([-0.38, 0.95, -0.16], [-0.38, 0.95, 0.16]);
  for (const s of [-1, 1]) { b.seg([-0.38, 0.95, s * 0.16], [-0.38, 0.975, s * 0.12]); b.seg([-0.38, 0.95, s * 0.16], [-0.38, 0.925, s * 0.12]); }
  b.seg([-0.38, 0.95, 0], [-0.38, 1.06, 0]);
  return b.model();
}

// What a change touches downstream: the drawing, the parts list, the production station.
export const LINE = [{ id: 'drawing', x: 2.3 }, { id: 'bom', x: 4.1 }, { id: 'station', x: 5.9 }];
export function lineModel() {
  const b = new B();
  // drawing sheet on a stand
  b.at([2.3, 0, 0], 0.25).part('drawing', [0, 0.72, 0]).piece('dr-frame');
  b.rect(-0.55, 0.3, 0.55, 1.1); b.rect(-0.51, 0.34, 0.51, 1.06);
  b.seg([-0.3, 0, 0], [-0.3, 0.3, 0]); b.seg([0.3, 0, 0], [0.3, 0.3, 0]); b.seg([-0.42, 0, 0], [-0.18, 0, 0]); b.seg([0.18, 0, 0], [0.42, 0, 0]);
  b.piece('dr-view', [0.07, 0.1, 0.12]);
  b.poly([[-0.4, 0.5, 0], [0.05, 0.5, 0], [0.05, 0.58, 0], [-0.32, 0.58, 0], [-0.32, 0.95, 0], [-0.4, 0.95, 0]], true);
  b.circle([-0.36, 0.8, 0], 2, 0.03, 12);
  b.seg([-0.4, 0.44, 0], [0.05, 0.44, 0]); b.seg([-0.46, 0.5, 0], [-0.46, 0.95, 0]);
  b.piece('dr-title', [-0.06, -0.09, 0.16]);
  b.rect(0.17, 0.34, 0.51, 0.52); b.seg([0.17, 0.43, 0], [0.51, 0.43, 0]); b.seg([0.34, 0.34, 0], [0.34, 0.43, 0]);
  b.circle([0.3, 0.8, 0], 2, 0.1, 20); b.seg([0.16, 0.8, 0], [0.44, 0.8, 0]); b.seg([0.3, 0.66, 0], [0.3, 0.94, 0]);
  // parts list panel
  b.at([4.1, 0, 0], 0.2).part('bom', [0, 0.75, 0]).piece('bm-frame');
  b.rect(-0.4, 0.25, 0.4, 1.2); b.seg([-0.4, 1.08, 0], [0.4, 1.08, 0]);
  b.seg([0, 0, 0], [0, 0.25, 0]); b.seg([-0.2, 0, 0], [0.2, 0, 0]);
  b.piece('bm-a', [0.12, 0.02, 0.1]);
  for (let i = 0; i < 4; i++) { const y = 0.98 - i * 0.2; b.rect(-0.34, y - 0.06, -0.2, y); b.seg([-0.14, y - 0.03, 0], [0.34, y - 0.03, 0]); }
  b.piece('bm-b', [-0.1, -0.03, 0.18]);
  for (let i = 0; i < 4; i++) { const y = 0.88 - i * 0.2; b.rect(-0.34, y - 0.06, -0.2, y); b.seg([-0.14, y - 0.03, 0], [0.22, y - 0.03, 0]); }
  // production station: table, gantry, press head, workpiece
  b.at([5.9, 0, 0], 0.35).part('station', [0, 0.7, 0]).piece('st-frame');
  b.box([0, 0.45, 0], [1.0, 0.08, 0.6]);
  for (const x of [-0.45, 0.45]) for (const z of [-0.26, 0.26]) b.seg([x, 0, z], [x, 0.41, z]);
  for (const x of [-0.42, 0.42]) { b.seg([x, 0.49, -0.26], [x, 1.25, -0.26]); b.seg([x, 0.49, 0.26], [x, 1.25, 0.26]); b.seg([x, 1.25, -0.26], [x, 1.25, 0.26]); }
  b.box([0, 1.25, 0], [0.84, 0.07, 0.12]);
  b.piece('st-head', [0.05, 0.16, 0.1]);
  b.box([0, 1.05, 0], [0.2, 0.26, 0.2]); b.cyl([0, 0.84, 0], 1, 0.05, 0.16, 12, 4);
  b.piece('st-work', [0.24, 0.05, 0.2]);
  b.box([0, 0.55, 0], [0.34, 0.12, 0.26]); b.cyl([0, 0.55, 0], 1, 0.06, 0.12, 12, 4);
  return b.model();
}

// The three outputs of the knowledge base: a warning on the design screen, a KPI dashboard, learnings back to the first stage.
export const ICONS = [{ id: 'screen', o: [-2.25, 0, 0.75], yaw: 0.55 }, { id: 'dash', o: [2.6, 0, 0.55], yaw: -0.15 }, { id: 'ept', o: [1.95, 0, -2.2], yaw: 0.2 }];
export function iconsModel() {
  const b = new B();
  let I = ICONS[0];
  b.at(I.o, I.yaw).part('screen', [0, 0.85, 0]).piece('sc-frame');
  b.rect(-0.55, 0.35, 0.55, 1.05); b.rect(-0.5, 0.4, 0.5, 1.0);
  b.seg([0, 0, 0], [0, 0.35, 0]); b.seg([-0.25, 0, 0], [0.25, 0, 0]);
  b.poly([[-0.4, 0.5, 0], [-0.05, 0.5, 0], [-0.05, 0.57, 0], [-0.33, 0.57, 0], [-0.33, 0.85, 0], [-0.4, 0.85, 0]], true);
  b.circle([-0.365, 0.72, 0], 2, 0.03, 12);
  b.piece('sc-card', [0, 0, 0.14], { hot: true });
  b.rect(0.05, 0.62, 0.44, 0.93); b.seg([0.1, 0.85, 0], [0.39, 0.85, 0]); b.seg([0.1, 0.78, 0], [0.39, 0.78, 0]); b.seg([0.1, 0.71, 0], [0.28, 0.71, 0]);
  b.seg([0.05, 0.72, 0], [-0.33, 0.72, 0]);
  I = ICONS[1];
  b.at(I.o, I.yaw).part('dash', [0, 0.85, 0]).piece('da-frame');
  b.rect(-0.55, 0.35, 0.55, 1.05);
  b.seg([0, 0, 0], [0, 0.35, 0]); b.seg([-0.25, 0, 0], [0.25, 0, 0]);
  b.seg([-0.47, 0.45, 0], [0.47, 0.45, 0]);
  [0.42, 0.34, 0.27, 0.2, 0.12].forEach((h, i) => b.rect(-0.45 + i * 0.13, 0.45, -0.36 + i * 0.13, 0.45 + h));
  b.circle([0.37, 0.8, 0], 2, 0.11, 20, -0.5, 3.6);
  b.poly([[0.2, 0.52, 0], [0.3, 0.58, 0], [0.38, 0.55, 0], [0.47, 0.64, 0]]);
  I = ICONS[2];
  b.at(I.o, I.yaw).part('ept', [-0.6, 0.55, 0]).piece('ep-gates');
  for (let i = 0; i < 4; i++) {
    const x = -0.72 + i * 0.4;
    b.poly([[x, 0.2, 0], [x + 0.24, 0.2, 0], [x + 0.36, 0.4, 0], [x + 0.24, 0.6, 0], [x, 0.6, 0], [x + 0.12, 0.4, 0]], true);
    b.seg([x + 0.12, 0, 0], [x + 0.12, 0.2, 0]);
  }
  b.seg([-0.7, 0, 0], [0.78, 0, 0]);
  b.piece('ep-back', [0, 0, 0], { hot: true });
  const arc = []; for (let i = 0; i <= 20; i++) { const a = Math.PI * i / 20; arc.push([0.06 + Math.cos(a) * 0.66, 0.66 + Math.sin(a) * 0.5, 0]); }
  b.poly(arc); b.seg([-0.6, 0.66, 0], [-0.68, 0.8, 0]); b.seg([-0.6, 0.66, 0], [-0.47, 0.76, 0]);
  return b.model();
}

// Eight plain figures in a ring, facing the centre. No faces, no one in particular.
export const RING = { n: 8, r: 1.9 };
export function ringModel() {
  const b = new B();
  for (let i = 0; i < RING.n; i++) {
    const a = i / RING.n * TAU + 0.2, o = [Math.sin(a) * RING.r, 0, Math.cos(a) * RING.r];
    b.at(o, a).part('f' + i, [0, 0.72, 0]).piece('f' + i);
    b.circle([0, 0.72, 0], 2, 0.085, 14); b.circle([0, 0.72, 0], 0, 0.085, 14);
    b.poly([[-0.15, 0.58, 0], [0.15, 0.58, 0], [0.1, 0.27, 0], [-0.1, 0.27, 0]], true);
    b.seg([-0.15, 0.58, 0], [-0.2, 0.3, 0]); b.seg([0.15, 0.58, 0], [0.2, 0.3, 0]);
    b.seg([-0.06, 0.27, 0], [-0.08, 0, 0]); b.seg([0.06, 0.27, 0], [0.08, 0, 0]);
    b.circle([0, 0, 0], 1, 0.2, 16);
  }
  return b.model();
}
