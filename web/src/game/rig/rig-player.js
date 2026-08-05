import { injectDefs } from './defs.js';
import { RIGS } from './rig-data.js';
import { VFX, MOTION_PERIODS } from './vfx.js';

export const MOTIONS = ["walk","attack","hit","death","skill"];
export { RIGS, VFX, MOTION_PERIODS };

/**
 * Framework-free rig player.
 *
 *   const p = new RigPlayer(document.getElementById('stage'), { unit: 0 });
 *   p.setMotion('attack');
 *   p.start();                      // built-in rAF loop
 *   // or drive it from your own game loop:
 *   p.update(deltaMs);
 *
 * Renders an inline <svg> (the rig) plus a <canvas> above it (the VFX layer).
 * Both fill the container. Nothing else is created.
 */
export class RigPlayer {
  constructor(container, opts = {}) {
    this.el = container;
    this.unit = opts.unit ?? 0;
    this.motion = opts.motion ?? "walk";
    this.speed = opts.speed ?? 1;      // 1 = authored speed
    this.height = opts.height ?? 400;  // rendered rig height in px
    this.vfx = opts.vfx !== false;
    this.onLoopEnd = opts.onLoopEnd || null;
    this.t = 0;
    this._playing = false;

    injectDefs(this.el.ownerDocument);
    if (getComputedStyle(this.el).position === "static") this.el.style.position = "relative";

    const ns = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(ns, "svg");
    this.svg.style.cssText =
      "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);overflow:visible;display:block";
    this.el.appendChild(this.svg);

    if (this.vfx) {
      this.canvas = document.createElement("canvas");
      this.canvas.style.cssText =
        "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
      this.el.appendChild(this.canvas);
      // Effects that fire from a weapon tip (lance beams, ballista bolt, cannon
      // muzzle, barrier dome) resolve their origin through this.
      VFX.setAnchor((lx, ly, id) => {
        const n = id ? this.svg.querySelector("#" + id) : this.svg;
        if (!n || !n.getScreenCTM) return null;
        const m = n.getScreenCTM(); if (!m) return null;
        const p = new DOMPoint(lx, ly).matrixTransform(m);
        const r = this.canvas.getBoundingClientRect();
        return { x: p.x - r.left, y: p.y - r.top };
      });
    }
    this.setUnit(this.unit);
  }

  get rig() { return RIGS[this.unit]; }
  get period() { return MOTION_PERIODS[this.motion]; }

  setUnit(i) {
    this.unit = i;
    const rig = this.rig;
    this.svg.setAttribute("viewBox", rig.vb);
    this.svg.style.height = this.height + "px";
    this.svg.style.width = "auto";
    this.svg.innerHTML = '<g id="root">' + rig.markup + "</g>";
    this._nodes = null;
    this.t = 0;
    this.applyFrame(0);
    return this;
  }

  setMotion(m) { this.motion = m; this.t = 0; this.applyFrame(0); return this; }
  setSpeed(s)  { this.speed = s; return this; }

  /** Jump to a normalised phase (0..1) of the current motion without advancing time. */
  seek(phase) { this.t = phase * this.period * 1000; this.applyFrame(phase); return this; }

  node(id) {
    if (!this._nodes) this._nodes = {};
    if (this._nodes[id] !== undefined) return this._nodes[id];
    return (this._nodes[id] = this.svg.querySelector("#" + id));
  }

  /** Advance by dtMs and render. Call from your game loop, or use start(). */
  update(dtMs) {
    const per = this.period * 1000;
    const before = this.t;
    this.t += dtMs * this.speed;
    if (this.onLoopEnd && Math.floor(this.t / per) > Math.floor(before / per)) this.onLoopEnd(this.motion);
    this.applyFrame((this.t % per) / per);
  }

  applyFrame(phase) {
    const rig = this.rig, root = this.svg.firstChild;
    const touched = {};
    const A = {
      set: (id, o) => {
        const n = this.node(id); if (!n) return;
        let tf = "";
        if (o.t) tf += `translate(${(o.t[0]||0).toFixed(2)} ${(o.t[1]||0).toFixed(2)}) `;
        if (o.r) tf += `rotate(${(o.r[0]||0).toFixed(2)} ${o.r[1]} ${o.r[2]}) `;
        if (o.s) tf += `translate(${o.s[2]} ${o.s[3]}) scale(${o.s[0].toFixed(4)} ${o.s[1].toFixed(4)}) translate(${-o.s[2]} ${-o.s[3]}) `;
        if (o.k) tf += `translate(${o.k[1]} ${o.k[2]}) skewX(${o.k[0].toFixed(2)}) translate(${-o.k[1]} ${-o.k[2]}) `;
        n.setAttribute("transform", tf.trim());
        if (o.o !== undefined) n.setAttribute("opacity", Math.max(0, Math.min(1, o.o)).toFixed(3));
        else n.removeAttribute("opacity");
        touched[id] = 1;
      },
      attr: (id, k, v) => { const n = this.node(id); if (n) n.setAttribute(k, v); },
      opacity: (v) => { this.svg.style.opacity = String(Math.max(0, Math.min(1, v))); },
      filter: (fl) => { this.svg.style.filter = fl; }
    };
    this.svg.style.opacity = "1";
    this.svg.style.filter = "none";
    rig.parts.forEach(p => { const n = this.node(p); if (n && !touched[p]) n.removeAttribute("transform"); });
    if (root && root.removeAttribute) root.removeAttribute("transform");
    rig.anim(phase, this.motion, A);
    this.drawVfx(phase);
  }

  drawVfx(phase) {
    const c = this.canvas; if (!c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    VFX.drawFor(ctx, w, h, this.unit, this.motion, phase);
  }

  start() {
    if (this._playing) return this;
    this._playing = true;
    let last = performance.now();
    const step = (now) => {
      if (!this._playing) return;
      const dt = Math.min(50, now - last); last = now;
      this.update(dt);
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
    return this;
  }
  stop() { this._playing = false; cancelAnimationFrame(this._raf); return this; }
  destroy() { this.stop(); this.el.innerHTML = ""; }
}
