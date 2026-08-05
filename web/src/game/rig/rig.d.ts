// handoff 리그 팩 JS 모듈 타입 선언 (런타임 코드는 rig-player.js 등 원본 그대로)
declare module '*/rig/rig-player.js' {
  export interface RigData {
    kr: string;
    en: string;
    vb: string;
    parts: string[];
    markup: string;
    notes?: string;
    anim: (phase: number, motion: string, A: unknown) => void;
  }
  export interface RigPlayerOpts {
    unit?: number;
    motion?: string;
    speed?: number;
    height?: number;
    vfx?: boolean;
    onLoopEnd?: ((motion: string) => void) | null;
  }
  export class RigPlayer {
    constructor(container: HTMLElement, opts?: RigPlayerOpts);
    svg: SVGSVGElement;
    unit: number;
    motion: string;
    readonly rig: RigData;
    readonly period: number;
    setUnit(i: number): this;
    setMotion(m: string): this;
    setSpeed(s: number): this;
    seek(phase: number): this;
    update(dtMs: number): void;
    node(id: string): SVGElement | null;
    start(): this;
    stop(): this;
    destroy(): void;
  }
  export const RIGS: RigData[];
  export const MOTIONS: string[];
  export const MOTION_PERIODS: Record<string, number>;
  export const VFX: {
    drawFor(ctx: CanvasRenderingContext2D, w: number, h: number, unitIndex: number, motion: string, phase: number): boolean;
    setAnchor(fn: (lx: number, ly: number, partId: string) => { x: number; y: number } | null): unknown;
  };
}
declare module '*/rig/defs.js' {
  export const DEFS_SVG: string;
  export function injectDefs(doc?: Document): void;
}
