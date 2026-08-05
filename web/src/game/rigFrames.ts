// 리그 → 프레임 베이커 — handoff 리그 팩(RigPlayer)을 로드 시 1회 래스터화해
// 캔버스 렌더러가 그대로 blit할 수 있는 프레임 시퀀스로 만든다 (엔티티 수십 개 DOM 구동 회피)
import { RigPlayer, RIGS } from './rig/rig-player.js';
import { DEFS_SVG } from './rig/defs.js';

export type RigMotion = 'walk' | 'attack' | 'hit' | 'death' | 'skill';

// 우리 로스터 → 리그 인덱스 (handoff assets/ 파일 번호 - 1)
export const RIG_UNIT: Record<string, number> = {
  intern: 0, // 채권 수호병 (방패 블로커)
  analyst: 2, // 애널리스트 궁수
  trader: 1, // 성장주 검사 (대검 근접)
  riskmgr: 4, // 배당 사제 (서포터)
};
export const RIG_TOWER: Record<string, number> = {
  limit: 6, // 거래소 발리스타
  dividend: 11, // 중앙은행 금고
  barrier: 9, // 서킷 브레이커
};
export const RIG_ENEMY: Record<string, number> = {
  grunt: 13, // 베어 트루퍼
  runner: 15, // 플래시 크래시
  tank: 14, // 인플레이션 크롤러
  shield: 16, // 헤지 실드베어러
  healer: 12, // 패닉셀 드론
  air: 17, // 알고 드론
  boss: 18, // 마진콜 타이탄
};

// 모션당 굽는 프레임 수 (저작 루프 길이: walk 1.0s / attack 1.25s / hit 0.95s / death 3.0s / skill 2.0s)
const FRAME_COUNTS: Record<RigMotion, number> = { walk: 12, attack: 14, hit: 8, death: 14, skill: 14 };
const BAKE_H = 96; // 인게임 표시 최대 ~72px — 96px로 구우면 축소만 일어난다

const frames = new Map<string, HTMLCanvasElement[]>();
let baking: Promise<void> | null = null;

const DEFS_INNER = DEFS_SVG.slice(DEFS_SVG.indexOf('<defs>'), DEFS_SVG.indexOf('</defs>') + '</defs>'.length);

function rasterize(svgText: string, w: number, h: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      cv.getContext('2d')!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(cv);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('rig rasterize failed'));
    };
    img.src = url;
  });
}

/** RigPlayer로 위상별 포즈를 만든 뒤 defs를 인라인한 독립 SVG 문자열로 직렬화 */
function serializeFrames(player: RigPlayer, idx: number, motion: RigMotion): { texts: string[]; w: number } {
  const vb = RIGS[idx].vb.split(/\s+/).map(Number);
  const w = Math.max(1, Math.round((BAKE_H * vb[2]) / vb[3]));
  const n = FRAME_COUNTS[motion];
  const oneShot = motion !== 'walk';
  player.setMotion(motion);
  const texts: string[] = [];
  for (let i = 0; i < n; i++) {
    player.seek(oneShot ? i / (n - 1) : i / n); // 원샷은 끝 포즈 포함, 루프는 미포함
    const op = player.svg.style.opacity || '1';
    const fl = player.svg.style.filter && player.svg.style.filter !== 'none' ? `;filter:${player.svg.style.filter}` : '';
    texts.push(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${RIGS[idx].vb}" width="${w}" height="${BAKE_H}" style="opacity:${op}${fl}">${DEFS_INNER}${player.svg.innerHTML}</svg>`,
    );
  }
  return { texts, w };
}

/** 전 로스터 베이킹 (세션 1회, 재호출 시 같은 promise 반환) */
export function bakeAllRigs(): Promise<void> {
  if (baking) return baking;
  baking = (async () => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0;width:220px;height:220px;overflow:hidden';
    document.body.appendChild(host);
    try {
      const idxs = [...new Set([...Object.values(RIG_UNIT), ...Object.values(RIG_TOWER), ...Object.values(RIG_ENEMY)])];
      const jobs: Promise<void>[] = [];
      for (const idx of idxs) {
        const player = new RigPlayer(host, { unit: idx, vfx: false, height: BAKE_H });
        for (const motion of Object.keys(FRAME_COUNTS) as RigMotion[]) {
          const { texts, w } = serializeFrames(player, idx, motion);
          jobs.push(
            Promise.all(texts.map((t) => rasterize(t, w, BAKE_H))).then((cvs) => {
              frames.set(`${idx}:${motion}`, cvs);
            }),
          );
        }
        player.destroy();
      }
      await Promise.all(jobs);
    } finally {
      host.remove();
    }
  })();
  return baking;
}

/**
 * 프레임 조회. oneShot이면 phase 0~1 밖에서 null (재생 종료), 루프면 phase를 감아서 반환.
 * 베이킹 전이면 null — 렌더러는 폴백 도형을 그린다.
 */
export function rigFrame(idx: number, motion: RigMotion, phase: number, oneShot: boolean): HTMLCanvasElement | null {
  const f = frames.get(`${idx}:${motion}`);
  if (!f) return null;
  if (oneShot) {
    if (phase < 0 || phase >= 1) return null;
    return f[Math.min(Math.floor(phase * f.length), f.length - 1)];
  }
  return f[((Math.floor(phase * f.length) % f.length) + f.length) % f.length];
}
