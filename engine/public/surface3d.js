/**
 * 杏坛 · 三维曲面渲染器（Canvas 自研）
 * z = f(x, y)：网格采样 + 画家算法 + 高度色图 + 光照，鼠标拖拽旋转、滚轮缩放。
 */
class Surface3D {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width; this.H = canvas.height;
    this.yaw = -0.6;          // 水平旋转
    this.pitch = 0.55;        // 俯仰
    this.zoom = 0.62;
    this.spin = false;
    this.setDomain(-3, 3, -3, 3, 40);
    this.exprFn = null;
    this.params = {};
    this._bindInput();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  setDomain(xmin, xmax, ymin, ymax, n) {
    this.dom = { xmin, xmax, ymin, ymax, n: Math.min(70, Math.max(12, n)) };
  }

  setFunction(fn, params) {
    this.exprFn = fn;
    this.params = params || {};
    this._rebuild();
  }

  setParam(k, v) { this.params[k] = v; this._rebuild(); }

  resetView() { this.yaw = -0.6; this.pitch = 0.55; this.zoom = 0.62; }

  _rebuild() {
    if (!this.exprFn) return;
    const { xmin, xmax, ymin, ymax, n } = this.dom;
    const pts = [];
    let zmin = Infinity, zmax = -Infinity;
    for (let i = 0; i <= n; i++) {
      const row = [];
      const x = xmin + (xmax - xmin) * i / n;
      for (let j = 0; j <= n; j++) {
        const y = ymin + (ymax - ymin) * j / n;
        let z = this.exprFn(x, y, this.params);
        if (typeof z !== 'number' || !isFinite(z)) z = NaN;
        if (isFinite(z)) { zmin = Math.min(zmin, z); zmax = Math.max(zmax, z); }
        row.push({ x, y, z });
      }
      pts.push(row);
    }
    this.pts = pts;
    const pad = (zmax - zmin) * 0.08 + 1e-9;
    this.zmin = zmin - pad; this.zmax = zmax + pad;
  }

  // 世界坐标 → 屏幕坐标（yaw 绕 z 轴，pitch 绕 x 轴）
  _proj(p) {
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const { xmin, xmax, ymin, ymax } = this.dom;
    const cx = (xmin + xmax) / 2, cyy = (ymin + ymax) / 2, cz = (this.zmin + this.zmax) / 2;
    const x = p.x - cx, y = p.y - cyy;
    const zn = ((p.z - cz) / (this.zmax - this.zmin || 1)) * 1.35; // z 归一化并提升比例
    const x1 = x * cy + y * sy;
    const y1 = -x * sy + y * cy;
    const y2 = y1 * cp - zn * sp;
    const z2 = y1 * sp + zn * cp;
    const s = this.zoom * (this.W / 7);
    return { sx: this.W / 2 + x1 * s, sy: this.H / 2 - y2 * s * 0.92, depth: z2 };
  }

  _bindInput() {
    let dragging = false, lx = 0, ly = 0;
    this.cv.addEventListener('mousedown', e => { dragging = true; lx = e.offsetX; ly = e.offsetY; });
    window.addEventListener('mouseup', () => dragging = false);
    this.cv.addEventListener('mousemove', e => {
      if (!dragging) return;
      this.yaw += (e.offsetX - lx) * 0.008;
      this.pitch = Math.max(-0.15, Math.min(1.45, this.pitch + (e.offsetY - ly) * 0.006));
      lx = e.offsetX; ly = e.offsetY;
    });
    this.cv.addEventListener('wheel', e => {
      e.preventDefault();
      this.zoom = Math.max(0.4, Math.min(3, this.zoom * (e.deltaY > 0 ? 0.92 : 1.08)));
    }, { passive: false });
  }

  _color(t) {
    // 蓝 → 青 → 黄 → 红 高度色图
    const stops = [
      [42, 120, 200], [80, 190, 200], [250, 235, 120], [215, 60, 55]
    ];
    const u = Math.max(0, Math.min(0.999, t)) * (stops.length - 1);
    const i = Math.floor(u), f = u - i;
    const a = stops[i], b = stops[i + 1] || a;
    return [0, 1, 2].map(k => Math.round(a[k] + (b[k] - a[k]) * f));
  }

  _loop() {
    if (this.spin) this.yaw += 0.006;
    if (this.pts) this._draw();
    requestAnimationFrame(this._loop);
  }

  _draw() {
    const ctx = this.ctx, { W, H } = this;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);

    const zr = this.zmax - this.zmin || 1;
    // 收集四边形
    const quads = [];
    const n = this.dom.n;
    const P = (i, j) => this._proj(this.pts[i][j]);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
        if ([a, b, c, d].some(p => !isFinite(p.sx) || !isFinite(p.sy))) continue;
        const cells = [
          { pts: [a, b, c, d], zv: (this.pts[i][j].z + this.pts[i + 1][j].z + this.pts[i + 1][j + 1].z + this.pts[i][j + 1].z) / 4 }
        ];
        for (const q of cells) {
          if (!isFinite(q.zv)) continue;
          q.depth = (a.depth + b.depth + c.depth + d.depth) / 4;
          quads.push(q);
        }
      }
    }
    quads.sort((u, v) => u.depth - v.depth); // 远的先画（depth 小 = 远）

    // 光照方向（屏幕空间）
    const L = { x: -0.4, y: -0.7, z: -0.6 };
    for (const q of quads) {
      const t = (q.zv - this.zmin) / zr;
      let [r, g, b] = this._color(t);
      // 面法线近似：屏幕四点叉积
      const [p1, p2, p3] = q.pts;
      const ux = p2.sx - p1.sx, uy = p2.sy - p1.sy;
      const vx = p3.sx - p1.sx, vy = p3.sy - p1.sy;
      const nz = ux * vy - uy * vx;
      const shade = 0.72 + 0.28 * Math.min(1, Math.abs(nz) / (Math.hypot(ux, uy) * Math.hypot(vx, vy) || 1));
      ctx.fillStyle = `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
      ctx.beginPath();
      ctx.moveTo(q.pts[0].sx, q.pts[0].sy);
      for (let k = 1; k < 4; k++) ctx.lineTo(q.pts[k].sx, q.pts[k].sy);
      ctx.closePath();
      ctx.fill();
    }

    // 坐标轴
    this._axes(ctx);

    // 标题与色条
    ctx.fillStyle = '#5b6575'; ctx.font = '12px sans-serif';
    ctx.fillText('三维视图 · z = f(x, y)　（拖拽旋转 / 滚轮缩放）', 14, 20);
    const barH = 130, bx = W - 30;
    for (let k = 0; k < barH; k++) {
      const [r, g, b] = this._color(1 - k / barH);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(bx, 40 + k, 12, 1);
    }
    ctx.fillStyle = '#5b6575';
    ctx.fillText(this.zmax.toFixed(1), bx - 26, 44);
    ctx.fillText(this.zmin.toFixed(1), bx - 26, 40 + barH);
    ctx.fillText('z', bx + 2, 34);
  }

  _axes(ctx) {
    const { xmin, xmax, ymin, ymax } = this.dom;
    const O = this._proj({ x: 0, y: 0, z: this.zmin });
    const X = this._proj({ x: xmax, y: 0, z: this.zmin });
    const X0 = this._proj({ x: xmin, y: 0, z: this.zmin });
    const Y = this._proj({ x: 0, y: ymax, z: this.zmin });
    const Y0 = this._proj({ x: 0, y: ymin, z: this.zmin });
    const Z = this._proj({ x: 0, y: 0, z: this.zmax });
    ctx.strokeStyle = '#9aa5b5'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(X0.sx, X0.sy); ctx.lineTo(X.sx, X.sy);
    ctx.moveTo(Y0.sx, Y0.sy); ctx.lineTo(Y.sx, Y.sy);
    ctx.moveTo(O.sx, O.sy); ctx.lineTo(Z.sx, Z.sy);
    ctx.stroke();
    ctx.fillStyle = '#5b6575'; ctx.font = '13px italic serif';
    ctx.fillText('x', X.sx + 4, X.sy);
    ctx.fillText('y', Y.sx + 4, Y.sy);
    ctx.fillText('z', Z.sx + 4, Z.sy - 2);
  }
}
