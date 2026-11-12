// CLosed LOOp - realistic outpost scene (Canvas 2D, no libraries).
// Public API:  Scene.init(canvas)   Scene.set({...state})   Scene.snapshot()
// State fields (all optional): sunlit, storm, shelter, dig, clean, repairRecycler, repairLeak, tend,
//   shieldCm, maxShieldCm, dust, dustCleaned (0..1), broken, leak, mat (0..1), dying, light (0..1),
//   tempC, powered, battery (0..1), labels, shieldLabel, dustLabel, ghLabel
(function (root) {
  'use strict';
  const W = 1000, H = 440, S = 2, HY = 208;
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const lerp = (a, b, t) => a + (b - a) * t;

  function mulberry(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const NP = (function () { const r = mulberry(1234), p = new Float32Array(65536); for (let i = 0; i < p.length; i++) p[i] = r(); return p; })();
  function vn(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const g = (a, b) => NP[((b & 255) << 8) | (a & 255)];
    return lerp(lerp(g(xi, yi), g(xi + 1, yi), u), lerp(g(xi, yi + 1), g(xi + 1, yi + 1), u), v);
  }
  function fbm(x, y, o) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); f *= 2; a *= 0.5; } return s; }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ------------------------------------------------------------------ static background
  const bgCache = {};
  function buildEarth(R) {
    const px = Math.round(R * 2 * S), c = mk(px, px), g = c.getContext('2d'), img = g.createImageData(px, px), d = img.data;
    const L = (function () { const v = [-0.8, -0.3, 0.52], m = Math.hypot(v[0], v[1], v[2]); return v.map((q) => q / m); })();
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
      const nx = (x + 0.5) / px * 2 - 1, ny = (y + 0.5) / px * 2 - 1, rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      const land = fbm(nx * 2.3 + 5, ny * 2.3 + 3, 5);
      let r, gg, b;
      if (land > 0.58) { const k = (land - 0.58) * 3; r = 70 + 90 * k; gg = 110 + 40 * k; b = 55 + 20 * k; }
      else { const k = nz; r = 14 + 20 * k; gg = 55 + 60 * k; b = 130 + 90 * k; }
      const cl = fbm(nx * 4.5 + 20, ny * 3.2 + 7, 5);
      if (cl > 0.5) { const a = clamp((cl - 0.5) * 3.4, 0, 0.9); r = lerp(r, 245, a); gg = lerp(gg, 247, a); b = lerp(b, 252, a); }
      const diff = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      const sh = 0.05 + 0.95 * Math.pow(diff, 0.85);
      const rim = Math.pow(1 - nz, 3);
      r = r * sh + rim * 90 * (0.3 + sh); gg = gg * sh + rim * 150 * (0.3 + sh); b = b * sh + rim * 255 * (0.3 + sh);
      const i = (y * px + x) * 4; d[i] = clamp(r, 0, 255); d[i + 1] = clamp(gg, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  function buildBg(day) {
    const c = mk(W * S, H * S), g = c.getContext('2d'); g.scale(S, S);
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    // stars
    const r = mulberry(day ? 99 : 7), tints = ['255,255,255', '190,210,255', '255,232,205'];
    const nS = day ? 55 : 480;
    for (let i = 0; i < nS; i++) {
      const x = r() * W, y = r() * (HY - 4), m = r(), sz = m > 0.985 ? 1.7 : m > 0.93 ? 1.2 : 0.7;
      const a = (day ? 0.18 + r() * 0.25 : 0.3 + r() * 0.7) * (1 - (y / HY) * 0.35);
      g.fillStyle = 'rgba(' + tints[(r() * 3) | 0] + ',' + a.toFixed(2) + ')'; g.beginPath(); g.arc(x, y, sz * 0.7, 0, TAU); g.fill();
    }
    if (!day) { // milky way
      for (let i = 0; i < 2600; i++) {
        const u = r(), cx = u * W, cy = lerp(HY * 0.95, 10, u) + Math.sin(u * 5) * 18, off = (r() + r() + r() - 1.5) * 34;
        const a = 0.025 + r() * 0.05 * (1 - Math.abs(off) / 52);
        g.fillStyle = 'rgba(190,205,255,' + clamp(a, 0, 0.09).toFixed(3) + ')'; g.beginPath(); g.arc(cx + off * 0.5, cy + off, 0.7 + r() * 1.5, 0, TAU); g.fill();
      }
    }
    // Earth
    const ER = 34, ex = 800, ey = 84;
    const glow = g.createRadialGradient(ex, ey, ER * 0.9, ex, ey, ER * 2.6);
    glow.addColorStop(0, 'rgba(90,150,255,.28)'); glow.addColorStop(1, 'rgba(60,110,255,0)');
    g.fillStyle = glow; g.fillRect(ex - ER * 3, ey - ER * 3, ER * 6, ER * 6);
    g.drawImage(buildEarth(ER), ex - ER, ey - ER, ER * 2, ER * 2);
    // sun (day)
    if (day) {
      const sx = 118, sy = 118;
      let gl = g.createRadialGradient(sx, sy, 0, sx, sy, 230);
      gl.addColorStop(0, 'rgba(255,244,214,.75)'); gl.addColorStop(0.12, 'rgba(255,230,170,.3)'); gl.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gl; g.fillRect(0, 0, 420, HY + 6);
      g.fillStyle = '#fffdf2'; g.beginPath(); g.arc(sx, sy, 14, 0, TAU); g.fill();
      g.globalCompositeOperation = 'lighter';
      [[0.35, 20, 'rgba(255,200,120,.10)'], [0.55, 34, 'rgba(150,200,255,.08)'], [0.8, 14, 'rgba(255,255,255,.10)'], [1.1, 46, 'rgba(255,160,100,.06)']].forEach((f) => {
        const fx = lerp(sx, 560, f[0]), fy = lerp(sy, 230, f[0]); g.fillStyle = f[2]; g.beginPath(); g.arc(fx, fy, f[1], 0, TAU); g.fill();
      });
      g.globalCompositeOperation = 'source-over';
    }
    // mountains (two ridges, shaded per column by slope so lit faces point to the sun on the left)
    function ridge(base, amp, freq, seed, col, k) {
      const ys = []; for (let x = -2; x <= W + 2; x++) ys.push(base - amp * Math.pow(fbm(x * freq + seed, seed * 0.37, 5), 1.35) * 2.1);
      for (let x = 0; x < W; x++) {
        const y0 = ys[x + 2], s = ys[x + 3] - ys[x + 1];
        const b = clamp(0.42 - s * 0.22, 0.08, 1) * (day ? 1 : 0.14) * k;
        const gr = g.createLinearGradient(0, y0, 0, HY + 8);
        gr.addColorStop(0, 'rgb(' + (col[0] * b | 0) + ',' + (col[1] * b | 0) + ',' + (col[2] * (day ? b : b * 1.5) | 0) + ')');
        gr.addColorStop(1, 'rgb(' + (col[0] * b * 0.6 | 0) + ',' + (col[1] * b * 0.6 | 0) + ',' + (col[2] * (day ? b * 0.6 : b * 1.0) | 0) + ')');
        g.fillStyle = gr; g.fillRect(x, y0, 1.02, HY + 12 - y0);
      }
    }
    ridge(HY + 6, 42, 0.0065, 11, [255, 250, 240], 1.0);
    ridge(HY + 10, 24, 0.014, 47, [235, 230, 222], 0.9);
    // ground (height field -> shaded, with craters)
    const GW = W, GH = H - HY, img = new ImageData(GW, GH), hm = new Float32Array(GW * GH);
    const rc = mulberry(5), craters = [];
    for (let i = 0; i < 52; i++) craters.push({ x: (rc() - 0.5) * 80, z: 1.2 + Math.pow(rc(), 1.5) * 24, r: 0.15 + rc() * rc() * 1.7 });
    for (let y = 0; y < GH; y++) {
      const t = y / GH, z = 1 / (t * 0.93 + 0.043);
      for (let x = 0; x < GW; x++) {
        const X = (x - GW / 2) / 420 * z;
        let h = 0.55 * fbm(X * 2.4 + 10, z * 2.1, 5) + 0.1 * fbm(X * 10, z * 9, 3);
        for (let k = 0; k < craters.length; k++) {
          const c = craters[k], dx = X - c.x, dz = z - c.z; if (Math.abs(dx) > c.r * 1.7 || Math.abs(dz) > c.r * 1.7) continue;
          const d = Math.sqrt(dx * dx + dz * dz) / c.r;
          if (d < 1) h -= 0.42 * c.r * (1 - d * d); h += 0.2 * c.r * Math.exp(-Math.pow((d - 1.07) / 0.2, 2));
        }
        hm[y * GW + x] = h;
      }
    }
    for (let y = 1; y < GH - 1; y++) {
      const t = y / GH, z = 1 / (t * 0.93 + 0.043), gain = 2.2 + 16 * t;
      for (let x = 1; x < GW - 1; x++) {
        const dx = hm[y * GW + x + 1] - hm[y * GW + x - 1], dy = hm[(y + 1) * GW + x] - hm[(y - 1) * GW + x];
        const X = (x - GW / 2) / 420 * z;
        let sh = 0.5 + dx * gain * 1.5 - dy * gain * 0.6;
        const alb = 0.78 + 0.45 * fbm(X * 0.9 + 50, z * 0.8, 4) + (vn(x * 0.9, y * 0.9) - 0.5) * 0.16;
        let v = clamp(sh, 0.06, 1.25) * alb;
        let R, G, B;
        if (day) { v *= 1.12 - 0.42 * (x / GW); R = v * 178; G = v * 172; B = v * 163; }
        else { v *= 0.17; R = v * 150; G = v * 190; B = v * 290; }
        const i = (y * GW + x) * 4; img.data[i] = clamp(R, 0, 255); img.data[i + 1] = clamp(G, 0, 255); img.data[i + 2] = clamp(B, 0, 255); img.data[i + 3] = 255;
      }
    }
    const gc = mk(GW, GH); gc.getContext('2d').putImageData(img, 0, 0);
    g.imageSmoothingQuality = 'high'; g.drawImage(gc, 0, HY, GW, GH);
    // rocks
    const rr = mulberry(31);
    const rocks = []; for (let i = 0; i < 90; i++) rocks.push({ x: rr() * W, t: Math.pow(rr(), 0.8), s: rr() });
    rocks.sort((a, b) => a.t - b.t).forEach((k) => {
      const y = HY + 14 + k.t * (GH - 22), sc = 0.35 + k.t * 1.7, w = (2 + k.s * 5.5) * sc, h = w * (0.5 + k.s * 0.2);
      if (day) { g.fillStyle = 'rgba(0,0,0,.38)'; g.beginPath(); g.moveTo(k.x - w * 0.5, y); g.lineTo(k.x + w * 0.5, y); g.lineTo(k.x + w * 0.5 + w * 1.8, y + h * 0.3); g.lineTo(k.x - w * 0.3 + w * 1.5, y + h * 0.3); g.fill(); }
      const gr = g.createLinearGradient(k.x - w * 0.6, y - h, k.x + w * 0.6, y);
      gr.addColorStop(0, day ? '#d8d3ca' : '#3a4560'); gr.addColorStop(1, day ? '#6f6a64' : '#10141f');
      g.fillStyle = gr; g.beginPath(); g.ellipse(k.x, y - h * 0.4, w * 0.55, h * 0.6, 0, 0, TAU); g.fill();
    });
    // film grain
    const gr2 = mk(200, 200), gg = gr2.getContext('2d'), gi = gg.createImageData(200, 200);
    for (let i = 0; i < gi.data.length; i += 4) { const v = Math.random() * 255; gi.data[i] = gi.data[i + 1] = gi.data[i + 2] = v; gi.data[i + 3] = 11; }
    gg.putImageData(gi, 0, 0); g.fillStyle = g.createPattern(gr2, 'repeat'); g.fillRect(0, 0, W, H);
    return c;
  }
  function getBg(day) { const k = day ? 'd' : 'n'; if (!bgCache[k]) bgCache[k] = buildBg(day); return bgCache[k]; }

  // regolith texture used on the shielding bank
  let regTex = null;
  function getRegTex() {
    if (regTex) return regTex;
    const c = mk(128, 128), g = c.getContext('2d'), im = g.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const v = 90 + 130 * fbm(x * 0.09, y * 0.09, 4) + (Math.random() - 0.5) * 50, i = (y * 128 + x) * 4; im.data[i] = v; im.data[i + 1] = v * 0.97; im.data[i + 2] = v * 0.92; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); regTex = c; return c;
  }

  // ------------------------------------------------------------------ runtime state
  let cv, ctx, raf = 0, last = 0, started = false;
  const tgt = { sunlit: true, storm: false, shelter: false, dig: false, clean: false, repairRecycler: false, repairLeak: false, tend: false, shieldCm: 0, maxShieldCm: 300, dust: false, dustCleaned: 0, broken: false, leak: false, mat: 0.4, dying: false, light: 1, tempC: 21, powered: true, battery: 1, labels: true, shieldLabel: '', dustLabel: '', ghLabel: '' };
  const cur = { shield: 0, dust: 0, mat: 0.4, light: 1, crew: [0, 0, 0, 0], shelterAmt: 0, storm: 0, tend: 0, night: 0 };
  let parts = [], streaks = [], spawnAcc = {}, LT = 1, TR = 1, TG = 1, TB = 1, DAY = true;
  const CREW_COL = ['#ff5a4d', '#4da3ff', '#ffd24d', '#5be38b'];

  const lit = (r, g, b, k) => { const f = LT * (k === undefined ? 1 : k); return 'rgb(' + Math.round(clamp(r * f * TR, 0, 255)) + ',' + Math.round(clamp(g * f * TG, 0, 255)) + ',' + Math.round(clamp(b * f * TB, 0, 255)) + ')'; };
  function capsule(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
  function glow(g, x, y, r, c0, k) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.globalAlpha = k === undefined ? 1 : k; g.fillRect(x - r, y - r, r * 2, r * 2); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  function shadowQuad(g, x0, x1, y, len, depth, a) { if (!DAY) return; g.fillStyle = 'rgba(0,0,0,' + (a || 0.38) + ')'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.lineTo(x1 + len, y + depth); g.lineTo(x0 + len, y + depth); g.closePath(); g.fill(); }

  // ------------------------------------------------------------------ objects
  const MOD = { x: [262, 378, 494], w: 112, y: 252, h: 66, base: 318 };
  function drawHabitat(g, t) {
    const s = tgt;
    shadowQuad(g, MOD.x[0], MOD.x[2] + MOD.w, MOD.base, 70, 14, 0.4);
    // connection tubes
    for (let i = 0; i < 2; i++) { const x = MOD.x[i] + MOD.w - 6; g.fillStyle = lit(150, 158, 175); g.fillRect(x, MOD.y + 24, 18, 22); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, MOD.y + 40, 18, 6); }
    // tube to greenhouse
    const gy = MOD.y + 30; const gr0 = g.createLinearGradient(0, gy, 0, gy + 18); gr0.addColorStop(0, lit(220, 226, 238)); gr0.addColorStop(1, lit(100, 108, 126)); g.fillStyle = gr0; g.fillRect(196, gy, 70, 18);
    for (let i = 0; i < 3; i++) {
      const x = MOD.x[i], w = MOD.w, y = MOD.y, h = MOD.h;
      capsule(g, x, y, w, h, h * 0.4);
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, lit(248, 250, 253)); gr.addColorStop(0.3, lit(218, 224, 236)); gr.addColorStop(0.72, lit(150, 160, 182)); gr.addColorStop(1, lit(78, 86, 104));
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      const gx = g.createLinearGradient(x, 0, x + w, 0);
      if (DAY) { gx.addColorStop(0, 'rgba(255,238,205,.32)'); gx.addColorStop(0.45, 'rgba(255,255,255,0)'); gx.addColorStop(1, 'rgba(0,0,14,.36)'); } else { gx.addColorStop(0, 'rgba(120,160,255,.10)'); gx.addColorStop(1, 'rgba(0,0,0,.2)'); }
      g.fillStyle = gx; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1;
      for (let k = 1; k < 6; k++) { const xx = x + k * w / 6; g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(xx + 1, y); g.lineTo(xx + 1, y + h); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.2)'; }
      g.fillStyle = lit(40, 90, 190); g.fillRect(x, y + h * 0.62, w, 5); g.fillStyle = lit(220, 60, 40); g.fillRect(x, y + h * 0.62 + 5, w, 1.5);
      // windows
      [0.2, 0.62].forEach((f) => {
        const wx = x + w * f, wy = y + 14, ww = 18, wh = 13, on = s.powered;
        capsule(g, wx, wy, ww, wh, 4); g.fillStyle = on ? '#ffe9b0' : '#10151f'; g.fill();
        if (on) { const wg = g.createLinearGradient(0, wy, 0, wy + wh); wg.addColorStop(0, 'rgba(255,255,255,.7)'); wg.addColorStop(1, 'rgba(255,170,70,.35)'); g.fillStyle = wg; g.fill(); }
        g.strokeStyle = lit(90, 98, 118); g.lineWidth = 1.2; g.stroke();
      });
      if (s.tempC < 15) { g.fillStyle = 'rgba(200,232,255,' + (s.tempC < 5 ? 0.38 : 0.2) + ')'; g.fillRect(x, y, w, h); }
      g.restore();
      capsule(g, x, y, w, h, h * 0.4); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    }
    // mission lettering
    g.save(); g.font = '700 9px system-ui,sans-serif'; g.fillStyle = lit(30, 50, 110); g.fillText('CLosed LOOp', MOD.x[1] + 22, MOD.y + 57); g.restore();
    // antenna and beacon
    const ax = MOD.x[2] + 80;
    g.strokeStyle = lit(190, 196, 208); g.lineWidth = 2; g.beginPath(); g.moveTo(ax, MOD.y + 4); g.lineTo(ax, MOD.y - 34); g.stroke();
    g.fillStyle = lit(230, 234, 242); g.beginPath(); g.ellipse(ax + 2, MOD.y - 30, 16, 7, -0.5, 0, TAU); g.fill();
    g.strokeStyle = lit(120, 128, 146); g.lineWidth = 1; g.stroke();
    const blink = (Math.sin(t * 3) > 0.3);
    const bcol = !s.powered ? 'rgba(255,60,40,' + (blink ? 1 : 0.2) + ')' : 'rgba(255,60,40,' + (blink ? 0.9 : 0.15) + ')';
    g.fillStyle = bcol; g.beginPath(); g.arc(ax, MOD.y - 36, 2.2, 0, TAU); g.fill(); if (blink) glow(g, ax, MOD.y - 36, 14, 'rgba(255,60,40,.6)');
    if (cur.storm > 0.1) { g.fillStyle = 'rgba(255,255,255,.0)'; }
  }

  function drawBerm(g, t) {
    const k = clamp(cur.shield / tgt.maxShieldCm, 0, 1); if (cur.shield < 0.5) return;
    const x0 = MOD.x[0] - 26 - k * 20, x1 = MOD.x[2] + MOD.w + 26 + k * 24, base = MOD.base + 4;
    const hB = (4 + k * 82);
    const top = base - hB;
    g.save();
    g.beginPath(); g.moveTo(x0 - 30 - k * 20, base + 6);
    const steps = 46;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, x = lerp(x0 - 30 - k * 20, x1 + 36 + k * 26, u);
      const prof = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.96)), 0.55);
      const y = base + 6 - (hB + 6) * prof + (fbm(x * 0.06, 3, 3) - 0.4) * 6 * (0.3 + k);
      g.lineTo(x, y);
    }
    g.lineTo(x1 + 36 + k * 26, base + 6); g.closePath();
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    if (DAY) { gr.addColorStop(0, '#d9d2c4'); gr.addColorStop(0.5, '#b8b1a4'); gr.addColorStop(1, '#716b62'); } else { gr.addColorStop(0, '#2a3248'); gr.addColorStop(1, '#0d111b'); }
    g.fillStyle = gr; g.fill(); g.clip();
    g.globalCompositeOperation = DAY ? 'multiply' : 'overlay'; g.globalAlpha = DAY ? 0.7 : 0.35;
    g.fillStyle = g.createPattern(getRegTex(), 'repeat'); g.fillRect(x0 - 80, top - 20, x1 - x0 + 160, hB + 60);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const sh = g.createLinearGradient(0, top, 0, base + 6); sh.addColorStop(0, 'rgba(255,255,255,' + (DAY ? 0.18 : 0.03) + ')'); sh.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = sh; g.fillRect(x0 - 80, top - 10, x1 - x0 + 160, hB + 30);
    g.restore();
    // grains on top edge
    if (DAY) { g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 40; i++) { const x = lerp(x0, x1, (i * 37 % 40) / 40); g.fillRect(x, top + 1 + (i % 5), 1.5, 1); } }
  }

  function drawGreenhouse(g, t) {
    const cx = 150, by = 330, R = 62, s = tgt;
    shadowQuad(g, cx - R, cx + R, by, 80, 16, 0.38);
    // base ring
    g.fillStyle = lit(170, 176, 190); g.fillRect(cx - R - 4, by - 7, R * 2 + 8, 9);
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(cx - R - 4, by - 1, R * 2 + 8, 3);
    // interior
    g.save(); g.beginPath(); g.moveTo(cx - R, by - 6); g.ellipse(cx, by - 6, R, R, 0, Math.PI, TAU); g.closePath(); g.clip();
    const ig = g.createLinearGradient(0, by - R, 0, by); const L = cur.light;
    ig.addColorStop(0, 'rgba(' + (60 + 120 * L | 0) + ',' + (20 + 20 * L | 0) + ',' + (80 + 120 * L | 0) + ',1)'); ig.addColorStop(1, 'rgba(' + (30 + 140 * L | 0) + ',' + (10 + 30 * L | 0) + ',' + (50 + 130 * L | 0) + ',1)');
    g.fillStyle = ig; g.fillRect(cx - R, by - R - 2, R * 2, R + 2);
    glow(g, cx, by - 34, R * 1.1, 'rgba(255,90,220,' + (0.7 * L).toFixed(2) + ')');
    // crops
    const m = cur.mat, n = 11, dying = tgt.dying && m > 0, leaf = dying ? [168, 132, 66] : [60, 214, 120];
    for (let i = 0; i < n; i++) {
      const x = cx - R + 12 + i * ((R * 2 - 24) / (n - 1)), hgt = (6 + m * 34) * (0.8 + 0.2 * Math.sin(i * 2.3)), sway = Math.sin(t * 1.4 + i) * 0.8;
      if (m < 0.02) continue;
      g.strokeStyle = lit(leaf[0] * 0.8, leaf[1] * 0.8, leaf[2] * 0.8, 1.3); g.lineWidth = 2; g.beginPath(); g.moveTo(x, by - 8); g.lineTo(x + sway, by - 8 - hgt); g.stroke();
      g.fillStyle = 'rgb(' + (leaf[0] * (0.7 + 0.3 * L) | 0) + ',' + (leaf[1] * (0.7 + 0.3 * L) | 0) + ',' + (leaf[2] * (0.7 + 0.3 * L) | 0) + ')';
      g.beginPath(); g.ellipse(x - 4 + sway, by - 8 - hgt * 0.7, 5, 2.4, -0.5, 0, TAU); g.fill(); g.beginPath(); g.ellipse(x + 4 + sway, by - 8 - hgt, 5.4, 2.6, 0.5, 0, TAU); g.fill();
    }
    // crew member tending
    if (cur.tend > 0.05) { const px = cx + 22 + Math.sin(t * 0.6) * 10; g.globalAlpha = cur.tend; g.fillStyle = 'rgba(20,28,60,.9)'; g.beginPath(); g.arc(px, by - 34, 4.4, 0, TAU); g.fill(); g.fillRect(px - 4.5, by - 30, 9, 20); g.globalAlpha = 1; }
    g.restore();
    // glass
    const gl = g.createRadialGradient(cx - R * 0.35, by - R * 0.8, 4, cx, by - 20, R * 1.1);
    gl.addColorStop(0, 'rgba(255,255,255,.34)'); gl.addColorStop(0.5, 'rgba(160,210,255,.1)'); gl.addColorStop(1, 'rgba(120,180,255,.22)');
    g.fillStyle = gl; g.beginPath(); g.ellipse(cx, by - 6, R, R, 0, Math.PI, TAU); g.closePath(); g.fill();
    g.strokeStyle = lit(190, 200, 220); g.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.ellipse(cx, by - 6, Math.abs(R * Math.cos(i * 0.5 + 0.01)) + 0.01, R, 0, Math.PI, TAU); g.stroke(); }
    g.beginPath(); g.ellipse(cx, by - 6, R, R * 0.0 + 0.001, 0, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, by - 6, R - 6, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
    if (DAY) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, by - 6, R, R, 0, Math.PI, TAU); g.stroke(); }
  }

  function drawPanels(g, t) {
    const xs = [740, 805, 870, 935], by = 328, dust = cur.dust;
    xs.forEach((x, i) => {
      const y = by + (i % 2) * 2;
      shadowQuad(g, x - 30, x + 30, y, 55, 10, 0.3);
      g.strokeStyle = lit(120, 126, 142); g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x, y); g.stroke();
      g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.stroke();
      const q = [[x - 34, y - 50], [x + 34, y - 56], [x + 34, y - 22], [x - 34, y - 16]];
      g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(q[k][0], q[k][1]); g.closePath();
      const gr = g.createLinearGradient(x - 34, 0, x + 34, 0);
      if (DAY) { gr.addColorStop(0, '#5a94e8'); gr.addColorStop(0.5, '#1f56b5'); gr.addColorStop(1, '#0c2c70'); } else { gr.addColorStop(0, '#16223e'); gr.addColorStop(1, '#070c1a'); }
      g.fillStyle = gr; g.fill();
      g.save(); g.clip();
      g.strokeStyle = DAY ? 'rgba(200,225,255,.35)' : 'rgba(120,150,220,.12)'; g.lineWidth = 0.8;
      for (let c = 1; c < 8; c++) { const xx = x - 34 + c * 68 / 8; g.beginPath(); g.moveTo(xx, y - 60); g.lineTo(xx, y - 10); g.stroke(); }
      for (let r = 1; r < 4; r++) { const yy = y - 56 + r * 10 + 2; g.beginPath(); g.moveTo(x - 34, yy + 6 - r * 1.5); g.lineTo(x + 34, yy - 6 + r * 0.2); g.stroke(); }
      if (DAY) { const sh = (t * 0.07 + i * 0.2) % 1.6 - 0.3; const sg = g.createLinearGradient(x - 34 + sh * 68, 0, x - 10 + sh * 68, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.22)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.fillRect(x - 40, y - 60, 80, 50); }
      if (dust > 0.01) {
        g.fillStyle = 'rgba(158,128,92,' + (0.78 * dust).toFixed(2) + ')'; g.fillRect(x - 40, y - 60, 80, 50);
        g.fillStyle = 'rgba(205,176,132,' + (0.35 * dust).toFixed(2) + ')'; for (let k = 0; k < 22; k++) g.fillRect(x - 34 + ((k * 53 + i * 17) % 68), y - 54 + ((k * 31) % 36), 6, 1.2);
      }
      g.restore();
      g.strokeStyle = lit(200, 206, 220); g.lineWidth = 1.4; g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let k = 1; k < 4; k++) g.lineTo(q[k][0], q[k][1]); g.closePath(); g.stroke();
    });
  }

  function drawRecycler(g, t) {
    const x = 660, by = 338, s = tgt;
    shadowQuad(g, x - 36, x + 36, by, 50, 9, 0.35);
    // two tanks
    [[-24, 56], [10, 46]].forEach((a) => {
      const tx = x + a[0], th = a[1], tw = 22;
      const gr = g.createLinearGradient(tx, 0, tx + tw, 0);
      gr.addColorStop(0, lit(240, 244, 250)); gr.addColorStop(0.5, lit(190, 198, 214)); gr.addColorStop(1, lit(80, 90, 110));
      g.fillStyle = gr; capsule(g, tx, by - th, tw, th, 8); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = lit(60, 110, 200); g.fillRect(tx, by - th * 0.55, tw, 4);
    });
    g.fillStyle = lit(140, 150, 168); g.fillRect(x - 28, by - 16, 70, 16); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 28, by - 4, 70, 4);
    g.strokeStyle = lit(210, 150, 60); g.lineWidth = 2; g.beginPath(); g.moveTo(x - 13, by - 52); g.lineTo(x - 13, by - 64); g.lineTo(x + 21, by - 64); g.lineTo(x + 21, by - 44); g.stroke();
    // status light
    const bl = Math.sin(t * 6) > 0;
    const c = s.broken ? (bl ? '255,60,40' : '90,20,15') : '70,230,140';
    g.fillStyle = 'rgb(' + c + ')'; g.beginPath(); g.arc(x + 30, by - 10, 3, 0, TAU); g.fill(); glow(g, x + 30, by - 10, s.broken ? 22 : 10, 'rgba(' + c + ',.7)');
  }

  function drawHatch(g, t) {
    const x = 400, by = 380, occ = cur.shelterAmt;
    shadowQuad(g, x - 28, x + 28, by, 40, 8, 0.4);
    const gr = g.createLinearGradient(0, by - 22, 0, by); gr.addColorStop(0, lit(200, 206, 218)); gr.addColorStop(1, lit(90, 98, 116));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 30, by); g.quadraticCurveTo(x - 24, by - 26, x, by - 26); g.quadraticCurveTo(x + 24, by - 26, x + 30, by); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
    g.fillStyle = lit(50, 58, 76); capsule(g, x - 9, by - 17, 18, 17, 6); g.fill();
    g.fillStyle = 'rgb(' + (occ > 0.5 ? '70,230,140' : '120,130,150') + ')'; g.beginPath(); g.arc(x, by - 21, 2.2, 0, TAU); g.fill();
    if (occ > 0.5) glow(g, x, by - 21, 14, 'rgba(70,230,140,.6)');
  }

  function drawAstro(g, x, y, sc, dir, pose, t, ph, col, alpha) {
    if (alpha < 0.03) return;
    g.save(); g.globalAlpha = alpha;
    if (DAY) { g.save(); g.translate(x, y); g.scale(sc, sc); g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(18, 2, 22, 3.6, 0, 0, TAU); g.fill(); g.restore(); }
    g.translate(x, y); g.scale(sc * dir, sc);
    const bob = pose === 'idle' ? Math.sin(t * 1.5 + ph) * 0.5 : 0;
    const wk = pose === 'walk' ? Math.sin(t * 6 + ph) : 0;
    // backpack
    g.fillStyle = lit(205, 210, 222); capsule(g, -17, -37 + bob, 11, 24, 4); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8; g.stroke();
    // legs
    [[-3, -1], [3, 1]].forEach((l, i) => {
      const a = wk * 0.5 * l[1]; g.save(); g.translate(l[0], -16 + bob); g.rotate(a);
      g.fillStyle = lit(232, 236, 244); capsule(g, -4, 0, 8, 15, 3); g.fill(); g.fillStyle = lit(70, 74, 86); capsule(g, -4.5, 12, 11, 5, 2); g.fill(); g.restore();
    });
    // torso
    const tg = g.createLinearGradient(-9, 0, 9, 0); tg.addColorStop(0, lit(252, 252, 254)); tg.addColorStop(0.6, lit(214, 220, 232)); tg.addColorStop(1, lit(130, 140, 160));
    g.fillStyle = tg; capsule(g, -9, -38 + bob, 18, 25, 6); g.fill(); g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.8; g.stroke();
    g.fillStyle = col; g.fillRect(-2, -31 + bob, 8, 3); g.fillStyle = lit(60, 66, 80); g.fillRect(-6, -24 + bob, 5, 4);
    // arms and tools
    let a1 = 0.2, a2 = 0.2, tool = null;
    if (pose === 'dig') { a1 = -0.5 + 0.95 * Math.sin(t * 3.2 + ph); a2 = a1 - 0.2; tool = 'shovel'; }
    else if (pose === 'brush') { a1 = -1.1 + 0.25 * Math.sin(t * 4 + ph); a2 = a1 - 0.15; tool = 'brush'; }
    else if (pose === 'weld') { a1 = -1.2; a2 = -1.0; tool = 'weld'; }
    else if (pose === 'walk') { a1 = wk * 0.5; a2 = -wk * 0.5; }
    const armLen = 15;
    [[a1, 0], [a2, 1]].forEach((a) => {
      g.save(); g.translate(1, -34 + bob); g.rotate(Math.PI / 2 - a[0] * 1.0 - 0.1);
      g.fillStyle = a[1] ? lit(190, 196, 210) : lit(236, 240, 248); capsule(g, -3.5, 0, 7, armLen, 3); g.fill(); g.fillStyle = lit(80, 84, 96); g.beginPath(); g.arc(0, armLen + 1, 3.4, 0, TAU); g.fill();
      if (!a[1] && tool) {
        g.translate(0, armLen + 1);
        if (tool === 'shovel') { g.strokeStyle = '#555'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, 24); g.stroke(); g.fillStyle = '#8b8f99'; g.beginPath(); g.moveTo(-5, 24); g.lineTo(5, 24); g.lineTo(3, 31); g.lineTo(-3, 31); g.fill(); }
        if (tool === 'brush') { g.strokeStyle = '#444'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, 14); g.stroke(); g.fillStyle = '#d6a24a'; g.fillRect(-6, 14, 12, 5); }
        if (tool === 'weld') { g.strokeStyle = '#444'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 12); g.stroke(); }
      }
      g.restore();
    });
    // helmet
    const hy = -45 + bob;
    g.fillStyle = lit(246, 248, 252); g.beginPath(); g.arc(2, hy, 9.4, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 0.8; g.stroke();
    const vg = g.createLinearGradient(0, hy - 8, 0, hy + 8); vg.addColorStop(0, '#f2c56a'); vg.addColorStop(0.5, '#a36a1c'); vg.addColorStop(1, '#3a2408');
    g.fillStyle = vg; g.beginPath(); g.ellipse(5.4, hy, 6.4, 7.2, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.65)'; g.beginPath(); g.ellipse(3.6, hy - 3, 2.4, 1.2, -0.5, 0, TAU); g.fill();
    g.fillStyle = col; g.fillRect(-5, hy - 9.4, 4, 2);
    g.restore();
    // headlamp at night
    if (!DAY) { g.save(); g.translate(x, y); g.scale(sc * dir, sc); const lg = g.createLinearGradient(8, -45, 70, -10); lg.addColorStop(0, 'rgba(255,245,210,.55)'); lg.addColorStop(1, 'rgba(255,245,210,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = lg; g.beginPath(); g.moveTo(9, -46); g.lineTo(80, -30); g.lineTo(80, 4); g.closePath(); g.fill(); g.restore(); }
  }

  function drawRover(g, t, x, working) {
    const y = 378, sc = 0.9;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (DAY) { g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(18, 3, 40, 4, 0, 0, TAU); g.fill(); }
    // chassis
    const bg = g.createLinearGradient(0, -22, 0, 0); bg.addColorStop(0, lit(250, 190, 60)); bg.addColorStop(1, lit(160, 100, 20));
    g.fillStyle = bg; capsule(g, -30, -22, 60, 18, 4); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke();
    g.fillStyle = lit(60, 66, 80); g.fillRect(8, -34, 16, 12); g.fillStyle = '#a9c8f0'; g.fillRect(11, -32, 10, 7);
    // bucket
    const tilt = working ? Math.sin(t * 1.6) * 0.5 : 0;
    g.save(); g.translate(-32, -12); g.rotate(tilt); g.fillStyle = lit(120, 126, 140); g.beginPath(); g.moveTo(0, -8); g.lineTo(-14, -2); g.lineTo(-14, 6); g.lineTo(0, 6); g.fill(); g.restore();
    // wheels
    [-20, 18].forEach((wx) => { g.fillStyle = lit(34, 36, 42); g.beginPath(); g.arc(wx, -5, 9, 0, TAU); g.fill(); g.fillStyle = lit(130, 134, 146); g.beginPath(); g.arc(wx, -5, 4, 0, TAU); g.fill(); });
    g.restore();
  }

  function drawPile(g) {
    const k = clamp(cur.shield / tgt.maxShieldCm, 0, 1);
    const w = 26 + (tgt.dig ? 8 : 0), x = 218, y = 386;
    g.fillStyle = DAY ? '#b9b2a5' : '#2a3248'; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 0.3, y - 22, x, y - 22); g.quadraticCurveTo(x + w * 0.5, y - 20, x + w, y); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(x + 4, y - 20); g.quadraticCurveTo(x + w * 0.5, y - 18, x + w, y); g.lineTo(x + 4, y); g.fill();
  }

  // ------------------------------------------------------------------ particles
  function emit(type, x, y, n, o) { for (let i = 0; i < n; i++) parts.push(Object.assign({ type, x, y, vx: 0, vy: 0, life: 1, max: 1, size: 2, g: 0 }, typeof o === 'function' ? o() : o)); }
  function spawn(rate, dt, key, fn) { spawnAcc[key] = (spawnAcc[key] || 0) + rate * dt; while (spawnAcc[key] >= 1) { spawnAcc[key] -= 1; fn(); } }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function stepParticles(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt / p.max; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'dust' && p.y > p.floor) { p.y = p.floor; p.vy *= -0.2; p.vx *= 0.6; }
      if (p.type === 'gas') p.size += dt * 9;
    }
  }
  function drawParticles(g) {
    parts.forEach((p) => {
      const a = clamp(p.life, 0, 1);
      if (p.type === 'dust') { g.fillStyle = (DAY ? 'rgba(205,198,185,' : 'rgba(110,125,160,') + (a * 0.8).toFixed(2) + ')'; g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill(); }
      else if (p.type === 'gas') { g.fillStyle = 'rgba(235,245,255,' + (a * 0.34).toFixed(2) + ')'; g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill(); }
      else if (p.type === 'ice') { g.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; g.fillRect(p.x, p.y, 1.6, 1.6); }
      else if (p.type === 'spark') { g.fillStyle = 'rgba(255,' + (190 + 50 * a | 0) + ',90,' + a.toFixed(2) + ')'; g.fillRect(p.x, p.y, 1.8, 1.8); }
      else if (p.type === 'steam') { g.fillStyle = 'rgba(220,230,240,' + (a * 0.25).toFixed(2) + ')'; g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill(); p.size += 0.15; }
    });
    // glow for sparks
    parts.forEach((p) => { if (p.type === 'spark' && p.life > 0.5) glow(g, p.x, p.y, 7, 'rgba(255,190,90,.5)', p.life); });
  }

  // ------------------------------------------------------------------ crew plan
  function crewPlan() {
    const s = tgt, slots = []; if (s.shelter) return slots;
    if (s.dig) { slots.push({ x: 246, y: 388, dir: 1, pose: 'dig', ph: 0 }); slots.push({ x: 276, y: 396, dir: 1, pose: 'dig', ph: 1.4 }); }
    if (s.clean) { slots.push({ x: 762, y: 366, dir: 1, pose: 'brush', ph: 0 }); slots.push({ x: 846, y: 372, dir: 1, pose: 'brush', ph: 1.9 }); }
    if (s.repairRecycler) slots.push({ x: 628, y: 366, dir: 1, pose: 'weld', ph: 0.5 });
    if (s.repairLeak) slots.push({ x: 640, y: 352, dir: -1, pose: 'weld', ph: 0.2 });
    return slots.slice(0, 4);
  }

  // ------------------------------------------------------------------ callouts
  function callout(g, text, ax, ay, lx, ly, align) {
    g.save(); g.font = '600 10px system-ui,Segoe UI,sans-serif'; if ('letterSpacing' in g) g.letterSpacing = '0.8px';
    const w = g.measureText(text).width + 14, h = 18; let bx = align === 'left' ? lx : align === 'right' ? lx - w : lx - w / 2;
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.beginPath(); g.moveTo(ax, ay); g.lineTo(lx, ly + (ly > ay ? 0 : h)); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(ax, ay, 2.4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(6,10,18,.78)'; g.strokeStyle = 'rgba(255,255,255,.35)'; capsule(g, bx, ly, w, h, 4); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.fillText(text, bx + 7, ly + 12.5); g.restore();
  }

  // ------------------------------------------------------------------ frame
  function step(dt, t) {
    const s = tgt, k = 1 - Math.exp(-dt * 3.2);
    cur.shield = lerp(cur.shield, s.shieldCm, k); cur.mat = lerp(cur.mat, s.mat, k); cur.light = lerp(cur.light, s.light, k);
    cur.dust = lerp(cur.dust, s.dust ? clamp(1 - s.dustCleaned, 0, 1) : 0, k);
    cur.shelterAmt = lerp(cur.shelterAmt, s.shelter ? 1 : 0, k * 1.3); cur.storm = lerp(cur.storm, s.storm ? 1 : 0, k);
    cur.tend = lerp(cur.tend, s.tend ? 1 : 0, k); cur.night = lerp(cur.night, s.sunlit ? 0 : 1, k);
    const plan = crewPlan();
    for (let i = 0; i < 4; i++) cur.crew[i] = lerp(cur.crew[i], i < plan.length ? 1 : 0, k * 1.5);
    // emitters
    plan.forEach((p, i) => {
      if (p.pose === 'dig') spawn(9, dt, 'dig' + i, () => emit('dust', p.x + 18 + rnd(-4, 8), p.y - 4, 1, () => ({ vx: rnd(-8, 40), vy: rnd(-60, -25), g: 70, max: rnd(1.1, 1.8), size: rnd(1, 2.2), floor: p.y + 2 })));
      if (p.pose === 'brush') spawn(10, dt, 'br' + i, () => emit('dust', p.x + 22, p.y - 26, 1, () => ({ vx: rnd(10, 45), vy: rnd(-30, 10), g: 55, max: rnd(1, 1.6), size: rnd(1, 2), floor: p.y + 2 })));
      if (p.pose === 'weld') spawn(22, dt, 'wd' + i, () => emit('spark', p.x + 22 * p.dir, p.y - 24, 1, () => ({ vx: rnd(-50, 50), vy: rnd(-70, -10), g: 220, max: rnd(0.35, 0.8) })));
    });
    if (s.dig) spawn(6, dt, 'rov', () => emit('dust', 190 + 25 * Math.sin(t * 0.8) , 384, 1, () => ({ vx: rnd(-20, 5), vy: rnd(-30, -8), g: 50, max: rnd(0.8, 1.3), size: rnd(1, 2), floor: 388 })));
    if (s.leak) {
      spawn(46, dt, 'gas', () => emit('gas', 608, 285, 1, () => ({ vx: rnd(60, 130), vy: rnd(-26, 8), g: 0, max: rnd(0.9, 1.6), size: rnd(2, 4) })));
      spawn(24, dt, 'ice', () => emit('ice', 612, 285, 1, () => ({ vx: rnd(70, 150), vy: rnd(-30, 20), g: 10, max: rnd(0.6, 1.1) })));
    }
    if (s.broken) spawn(6, dt, 'steam', () => emit('steam', 640 + rnd(-6, 8), 276, 1, () => ({ vx: rnd(-4, 8), vy: rnd(-22, -12), g: 0, max: rnd(1.4, 2.4), size: rnd(2, 4) })));
    if (s.storm) {
      spawn(46, dt, 'storm', () => { const x0 = rnd(-40, W + 120); streaks.push({ x: x0, y: -20, vx: -170, vy: 640, len: rnd(30, 80), life: 1, w: rnd(1, 2.2), end: rnd(250, 430) }); });
    }
    stepParticles(dt);
    for (let i = streaks.length - 1; i >= 0; i--) { const q = streaks[i]; q.x += q.vx * dt; q.y += q.vy * dt; if (q.y > q.end) { if (Math.random() < 0.5) emit('spark', q.x, q.y, 1, { vx: rnd(-20, 20), vy: rnd(-30, -5), g: 120, max: 0.3 }); streaks.splice(i, 1); } }
    if (!s.storm && streaks.length > 0) streaks.length = Math.max(0, streaks.length - 4);
  }

  function draw(t) {
    const s = tgt; DAY = s.sunlit; LT = DAY ? 1 : 0.2; TR = DAY ? 1 : 0.8; TG = DAY ? 1 : 0.92; TB = DAY ? 1 : 1.25;
    const g = ctx; g.setTransform(S, 0, 0, S, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.drawImage(getBg(DAY), 0, 0, W, H);
    // night lights on ground
    if (!DAY && s.powered) {
      glow(g, 330, 345, 130, 'rgba(255,236,190,.5)'); glow(g, 560, 346, 150, 'rgba(255,236,190,.42)');
      [[272, 262, 205], [600, 262, 520]].forEach((l) => { const cone = g.createLinearGradient(l[0], l[1], l[0], 345); cone.addColorStop(0, 'rgba(255,240,200,.5)'); cone.addColorStop(1, 'rgba(255,240,200,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = cone; g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[0] - 80, 350); g.lineTo(l[0] + 80, 350); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over'; });
    }
    drawHabitat(g, t); drawBerm(g, t);
    // floodlight bulbs
    if (s.powered) { [[272, 262], [600, 262]].forEach((l) => { g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(l[0], l[1], 2.6, 0, TAU); g.fill(); glow(g, l[0], l[1], DAY ? 10 : 22, 'rgba(255,240,200,.7)'); }); }
    drawPanels(g, t); drawGreenhouse(g, t); drawRecycler(g, t);
    drawPile(g); drawHatch(g, t);
    drawRover(g, t, s.dig ? 160 + 40 * (0.5 + 0.5 * Math.sin(t * 0.8)) : 150, s.dig);
    // crew sorted by depth
    const plan = crewPlan();
    plan.map((p, i) => ({ p, i })).sort((a, b) => a.p.y - b.p.y).forEach((o) => { const p = o.p, sc = 0.55 + (p.y - 320) * 0.0046; drawAstro(g, p.x, p.y, sc, p.dir, p.pose, t, p.ph, CREW_COL[o.i], cur.crew[o.i]); });
    // idle fade-out crews (left after plan shrinks)
    drawParticles(g);
    // storm
    if (cur.storm > 0.02) {
      streaks.forEach((q) => {
        const nx = q.x - q.vx / 640 * q.len * 0.8, ny = q.y - q.len * 0.9;
        let a = 0.9 * cur.storm;
        if (q.x > 250 && q.x < 725 && q.y > 240) a *= (0.12 + 0.88 * Math.exp(-cur.shield / 60));
        if (s.shelter && q.y > 330) a *= 0.2;
        const grd = g.createLinearGradient(q.x, q.y, nx, ny); grd.addColorStop(0, 'rgba(255,255,255,' + a.toFixed(2) + ')'); grd.addColorStop(1, 'rgba(120,180,255,0)');
        g.strokeStyle = grd; g.lineWidth = q.w; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(nx, ny); g.stroke();
      });
      const pulse = 0.5 + 0.5 * Math.sin(t * 5), vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95);
      vg.addColorStop(0, 'rgba(255,40,20,0)'); vg.addColorStop(1, 'rgba(255,40,20,' + (0.3 * cur.storm * (0.5 + pulse * 0.5)).toFixed(2) + ')'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
      g.save(); g.font = '700 12px system-ui,sans-serif'; if ('letterSpacing' in g) g.letterSpacing = '1.4px';
      const txt = s.shelter ? 'SOLAR STORM - CREW SHELTERED' : 'SOLAR STORM - RADIATION ALERT', w = g.measureText(txt).width + 28;
      g.fillStyle = s.shelter ? 'rgba(10,70,40,.9)' : 'rgba(150,18,12,.92)'; capsule(g, W / 2 - w / 2, 14, w, 26, 6); g.fill(); g.strokeStyle = 'rgba(255,255,255,.5)'; g.stroke(); g.fillStyle = '#fff'; g.fillText(txt, W / 2 - w / 2 + 14, 31.5); g.restore();
    }
    // shelter cutaway
    if (cur.shelterAmt > 0.02) {
      g.save(); g.globalAlpha = cur.shelterAmt; const bx = 330, by2 = 398, bw = 150, bh = 36;
      g.fillStyle = 'rgba(8,12,22,.9)'; capsule(g, bx, by2, bw, bh, 8); g.fill(); g.strokeStyle = 'rgba(80,230,150,.9)'; g.lineWidth = 1.4; g.stroke();
      for (let i = 0; i < 4; i++) { const px = bx + 24 + i * 34; g.fillStyle = CREW_COL[i]; g.beginPath(); g.arc(px, by2 + 14, 5.5, 0, TAU); g.fill(); g.fillStyle = '#e8edf6'; g.fillRect(px - 6, by2 + 20, 12, 11); }
      g.fillStyle = 'rgba(80,230,150,1)'; g.font = '600 8.5px system-ui'; g.fillText('STORM SHELTER - 4 CREW', bx + 8, by2 + 9); g.restore();
    }
    // callouts
    if (s.labels) {
      callout(g, 'GREENHOUSE ' + Math.round(cur.mat * 100) + '%', 150, 280, 150, 222, 'center');
      callout(g, s.shieldLabel || 'HABITAT', 380, 262, 380, 222, 'center');
      callout(g, s.dustLabel || 'SOLAR ARRAY', 838, 288, 838, 222, 'center');
      callout(g, s.broken ? 'RECYCLER - BROKEN' : 'WATER RECYCLER', 660, 300, 660, 252, 'center');
      callout(g, 'STORM SHELTER', 400, 380, 430, 424 - 6, 'left');
    }
    // vignette
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.5, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  }

  function frame(ts) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || !ctx) return;
    const t = ts / 1000; const dt = Math.min(0.05, t - last || 0.016); last = t;
    step(dt, t); draw(t);
  }

  const Scene = {
    init(canvas) {
      cv = canvas; cv.width = W * S; cv.height = H * S; cv.style.aspectRatio = W + ' / ' + H; ctx = cv.getContext('2d');
      if (started) return; started = true; raf = requestAnimationFrame(frame);
    },
    set(o) { Object.assign(tgt, o); },
    snapshot() { return cv ? cv.toDataURL('image/png') : null; },
    ready() { return started; }
  };
  root.Scene = Scene;
})(typeof self !== 'undefined' ? self : this);
