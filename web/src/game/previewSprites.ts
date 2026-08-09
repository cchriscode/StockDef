// [임시] 신규 스프라이트 프리뷰 — 아트 확인 전용 렌더 레이어 (엔진·밸런스와 무관)
// 아군/적군 모두 버튼 클릭으로 소환해 걷기·공격 모션을 전장 위에서 확인한다. 확정 시 이 파일과
// web/public/assets/preview/, StageScreen의 프리뷰 바를 함께 제거하면 흔적이 남지 않는다.

export type PreviewSide = 'ally' | 'enemy';
type PreviewKind = 'ground' | 'air' | 'boss';

export interface PreviewSpec {
  id: string;
  name: string;
  side: PreviewSide;
  kind: PreviewKind;
}

// SPRITES.md 로스터 (아군 10 / 적 지상 4 / 공중 2 / 보스 2)
export const PREVIEW_ROSTER: PreviewSpec[] = [
  { id: 'A-01_1', name: '종머리 곤봉병', side: 'ally', kind: 'ground' },
  { id: 'A-01_2', name: '가위 병사', side: 'ally', kind: 'ground' },
  { id: 'A-01_3', name: '망치 작업반장', side: 'ally', kind: 'ground' },
  { id: 'A-01_7', name: '망치 견습공', side: 'ally', kind: 'ground' },
  { id: 'A-02_1', name: '권총 장교', side: 'ally', kind: 'ground' },
  { id: 'A-02_2', name: '방독면 포수', side: 'ally', kind: 'ground' },
  { id: 'A-02_3', name: '저격수', side: 'ally', kind: 'ground' },
  { id: 'A-03_1', name: '원형 방패병', side: 'ally', kind: 'ground' },
  { id: 'A-03_2', name: '셔터 장교', side: 'ally', kind: 'ground' },
  { id: 'A-03_3', name: '벽돌 짐꾼', side: 'ally', kind: 'ground' },
  { id: 'enemy_a_1', name: '창 망령', side: 'enemy', kind: 'ground' },
  { id: 'enemy_a_2', name: '방패 파쇄병', side: 'enemy', kind: 'ground' },
  { id: 'enemy_b_1', name: '석궁 사수', side: 'enemy', kind: 'ground' },
  { id: 'enemy_b_2', name: '다연장 포병', side: 'enemy', kind: 'ground' },
  { id: 'enemy_c_1', name: '연 정찰기', side: 'enemy', kind: 'air' },
  { id: 'enemy_c_2', name: '확성기 드론', side: 'enemy', kind: 'air' },
  { id: 'enemy_d_1', name: '번개 왕', side: 'enemy', kind: 'boss' },
  { id: 'enemy_d_2', name: '드릴 워커', side: 'enemy', kind: 'boss' },
];

// 셀 앵커 (SPRITES.md setOrigin) — 가로는 전부 중앙
const ORIGIN_Y: Record<PreviewKind, number> = { ground: 0.9459, boss: 0.9268, air: 0.5 };
const WALK = { frames: 4, fps: 8 };
const ATTACK = { frames: 5, fps: 10 };
// 시트는 공통 px 공간으로 정규화돼 있어 배율 하나로 유닛 간 상대 크기가 유지된다.
// 기준: 가위 병사(원본 344px) → 화면 64px. 시트를 1/3로 축소해 뒀으므로 ×3 보정.
const SCALE = (64 / 344) * 3;

// SPRITES.md '서 있는 키(px)' — 체력바·이름표를 머리 위에 정확히 올리기 위한 원본 키
const STANDING_PX: Record<string, number> = {
  'A-01_1': 308, 'A-01_2': 344, 'A-01_3': 419, 'A-01_7': 277,
  'A-02_1': 336, 'A-02_2': 279, 'A-02_3': 434,
  'A-03_1': 354, 'A-03_2': 334, 'A-03_3': 326,
  enemy_a_1: 304, enemy_a_2: 283, enemy_b_1: 401, enemy_b_2: 379,
  enemy_c_1: 257, enemy_c_2: 378, enemy_d_1: 430, enemy_d_2: 451,
};

/** 시트 캐릭터의 화면상 키(px) — 체력바 위치 계산용 */
export function sheetCharHeight(sheetId: string): number {
  return (STANDING_PX[sheetId] ?? 344) * (64 / 344);
}

/** [임시] 1G 프리뷰 유닛 키 → 스프라이트 시트 id */
export const SHEET_UNIT: Record<string, string> = {
  club: 'A-01_1', scissor: 'A-01_2', foreman: 'A-01_3', apprentice: 'A-01_7',
  pistol: 'A-02_1', gasmask: 'A-02_2', sniper: 'A-02_3',
  roundshield: 'A-03_1', shutter: 'A-03_2', bricker: 'A-03_3',
};

/** 엔진 적 타입 → 신규 시트 id (보스는 지역별 변주) */
export const SHEET_ENEMY: Record<string, string> = {
  grunt: 'enemy_a_1', // 창 망령
  runner: 'enemy_b_1', // 석궁 사수
  tank: 'enemy_b_2', // 다연장 포병
  shield: 'enemy_a_2', // 방패 파쇄병
  healer: 'enemy_c_2', // 확성기 드론
  air: 'enemy_c_1', // 연 정찰기
  boss: 'enemy_d_1', // 번개 왕 (R3는 드릴 워커)
};
export function enemySheetId(type: string, regionId: string): string {
  if (type === 'boss' && regionId === 'R3') return 'enemy_d_2'; // 드릴 워커
  return SHEET_ENEMY[type] ?? 'enemy_a_1';
}

// ─── 스킬 시트 (skills.json 요약) — cueFrame에 판정·투사체 생성 ───
interface SkillSpec { frames: number; durationsMs: number[]; cueFrame: number; cell: 'skill' | 'skillEffect' }
const SK = (d: number[], cue: number, cell: 'skill' | 'skillEffect' = 'skill'): SkillSpec =>
  ({ frames: d.length, durationsMs: d, cueFrame: cue, cell });
const D8 = [90, 90, 90, 140, 90, 90, 90, 180];
export const SKILL_SPEC: Record<string, SkillSpec> = {
  'A-01_1': SK(D8, 3), 'A-01_2': SK([...D8.slice(0, 7), 90, 180], 3), 'A-01_3': SK(D8, 3),
  'A-01_7': SK([90, 140, 90, 180], 1),
  'A-02_2': SK(D8, 3), 'A-02_3': SK(D8, 3),
  'A-03_1': SK(D8, 3), 'A-03_2': SK(D8, 3), 'A-03_3': SK(D8, 3),
  enemy_a_1: SK(D8, 3), enemy_a_2: SK(D8, 3),
  enemy_b_1: SK(D8, 3), enemy_b_2: SK([90, 90, 90, 140, 140, 190], 3),
  enemy_c_1: SK([100, 100, 120, 180], 2, 'skillEffect'),
  enemy_d_1: SK([130, 150, 170, 200, 150, 140, 140, 220], 3),
  enemy_d_2: SK([120, 140, 150, 180, 140, 140, 140, 220], 3),
};
export const SKILL_TOTAL_MS: Record<string, number> = Object.fromEntries(
  Object.entries(SKILL_SPEC).map(([k, s]) => [k, s.durationsMs.reduce((a, b) => a + b, 0)]),
);
/** 스킬이 정의된 시트인지 (A-02_1 권총 장교는 스킬 시트 없음) */
export function hasSkillSheet(sheetId: string): boolean {
  return !!SKILL_SPEC[sheetId];
}

/** 경과(ms) → 프레임 인덱스, 끝나면 null */
function skillFrameAt(spec: SkillSpec, elapsedMs: number): number | null {
  let acc = 0;
  for (let i = 0; i < spec.frames; i++) {
    acc += spec.durationsMs[i];
    if (elapsedMs < acc) return i;
  }
  return null;
}

/** 스킬 모션 렌더 — 그려졌으면 true (셀이 일반 모션보다 커서 전용 앵커 사용) */
export function drawSkill(
  ctx: CanvasRenderingContext2D,
  sheetId: string,
  elapsedSec: number,
  cx: number,
  baseY: number,
): boolean {
  const spec = SKILL_SPEC[sheetId];
  if (!spec) return false;
  const f = skillFrameAt(spec, elapsedSec * 1000);
  if (f == null) return false;
  const img = sheet(sheetId, 'skill');
  if (!img) return false;
  const cellW = img.naturalWidth / spec.frames;
  const cellH = img.naturalHeight;
  const dw = cellW * SCALE;
  const dh = cellH * SCALE;
  const oy = spec.cell === 'skillEffect' ? 0.5 : 0.9318;
  ctx.drawImage(img, f * cellW, 0, cellW, cellH, cx - dw / 2, baseY - dh * oy, dw, dh);
  return true;
}

// ─── 투사체 (ally-sprites *_shot.png) — travel 0~1 루프 / impact 2~3 원샷 ───
const SHOT_ORIGIN: Record<string, [number, number]> = {
  ally: [313 / 416, 112 / 224],
  enemy: [182 / 560, 115 / 240],
  air: [182 / 512, 335 / 464],
};
export const SHOT_SHEET: Record<string, string> = { // 유닛/적 키 → 투사체 시트 id
  pistol: 'A-02_1', gasmask: 'A-02_2', sniper: 'A-02_3',
  runner: 'enemy_b_1', tank: 'enemy_b_2', air: 'enemy_c_1', healer: 'enemy_c_2',
};

/** 비행 중 투사체 / 착탄 이펙트 렌더 */
export function drawShot(
  ctx: CanvasRenderingContext2D,
  shotId: string,
  side: 'ally' | 'enemy' | 'air',
  t: number,
  cx: number,
  cy: number,
  impactPhase: number | null, // null = 비행 중, 0~1 = 착탄 재생
): boolean {
  const img = sheet(shotId, 'shot');
  if (!img) return false;
  const cellW = img.naturalWidth / 4;
  const cellH = img.naturalHeight;
  const f = impactPhase == null ? Math.floor(t * 16) % 2 : (impactPhase < 0.42 ? 2 : 3);
  const s = SCALE * 0.62; // 투사체는 캐릭터보다 작게
  const dw = cellW * s;
  const dh = cellH * s;
  const [ox, oy] = SHOT_ORIGIN[side];
  ctx.drawImage(img, f * cellW, 0, cellW, cellH, cx - dw * ox, cy - dh * oy, dw, dh);
  return true;
}

/** 번개 왕 낙뢰 FX — 대상 발밑에 세로 기둥 */
export function drawStrikeFx(ctx: CanvasRenderingContext2D, elapsedSec: number, cx: number, groundY: number): boolean {
  const durs = [60, 70, 140];
  const f = skillFrameAt({ frames: 3, durationsMs: durs, cueFrame: 0, cell: 'skill' }, elapsedSec * 1000);
  if (f == null) return false;
  const img = sheet('enemy_d_1', 'fx');
  if (!img) return false;
  const cellW = img.naturalWidth / 3;
  const cellH = img.naturalHeight;
  const dw = cellW * SCALE;
  const dh = cellH * SCALE;
  ctx.drawImage(img, f * cellW, 0, cellW, cellH, cx - dw * 0.5, groundY - dh * 0.9712, dw, dh);
  return true;
}

const imgCache = new Map<string, HTMLImageElement>();
function sheet(id: string, motion: 'walk' | 'attack' | 'skill' | 'shot' | 'fx'): HTMLImageElement | null {
  const key = `${id}_${motion}`;
  let img = imgCache.get(key);
  if (!img) {
    img = new Image();
    img.src = `/assets/preview/${key}.png`;
    imgCache.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/**
 * 시트 스프라이트 1체 드로잉 (전투에 실제 참여하는 1G 프리뷰 유닛용).
 * @returns 시트 미로딩이면 false (호출자가 폴백 도형)
 */
export function drawSheetChar(
  ctx: CanvasRenderingContext2D,
  sheetId: string,
  kind: 'ground' | 'air' | 'boss',
  attackPhase: number | null, // 0~1 (공격 중) / null (걷기)
  t: number,
  cx: number,
  baseY: number,
): boolean {
  const attacking = attackPhase != null && attackPhase >= 0 && attackPhase < 1;
  const img = sheet(sheetId, attacking ? 'attack' : 'walk');
  if (!img) return false;
  const cfg = attacking ? ATTACK : WALK;
  const f = attacking
    ? Math.min(Math.floor(attackPhase! * cfg.frames), cfg.frames - 1)
    : Math.floor(t * cfg.fps) % cfg.frames;
  const cellW = img.naturalWidth / cfg.frames;
  const cellH = img.naturalHeight;
  const dw = cellW * SCALE;
  const dh = cellH * SCALE;
  ctx.drawImage(img, f * cellW, 0, cellW, cellH, cx - dw / 2, baseY - dh * ORIGIN_Y[kind], dw, dh);
  return true;
}

interface PreviewEnt {
  spec: PreviewSpec;
  x: number; // 필드 좌표 (0~1000, 엔진과 동일 스케일)
  lastT: number;
  atkUntil: number; // 공격 모션 재생 종료 시각
  nextAtkAt: number;
}

const ents: PreviewEnt[] = [];
const ATTACK_DUR = ATTACK.frames / ATTACK.fps;

/** 프리뷰 소환 — 아군은 좌측에서 우측으로, 적군은 우측에서 좌측으로 걷는다 */
export function spawnPreview(id: string, now: number) {
  const spec = PREVIEW_ROSTER.find((s) => s.id === id);
  if (!spec) return;
  ents.push({
    spec,
    x: spec.side === 'ally' ? 60 : 940,
    lastT: now,
    atkUntil: -1,
    nextAtkAt: now + 2.2,
  });
  if (ents.length > 14) ents.splice(0, ents.length - 14);
}

export function clearPreviews() {
  ents.length = 0;
}

export function previewCount(): number {
  return ents.length;
}

/**
 * 프리뷰 엔티티 이동·렌더. battleRender가 유닛 레이어 뒤에 호출한다.
 * @param sx 필드 좌표 → 캔버스 x 변환
 */
export function drawPreviews(
  ctx: CanvasRenderingContext2D,
  t: number,
  sx: (x: number) => number,
  groundTop: number,
  airY: number,
) {
  ctx.imageSmoothingEnabled = true;
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i];
    const dt = Math.max(0, Math.min(t - e.lastT, 0.2));
    e.lastT = t;
    const attacking = t < e.atkUntil;
    if (!attacking && t >= e.nextAtkAt) {
      e.atkUntil = t + ATTACK_DUR;
      e.nextAtkAt = t + ATTACK_DUR + 2.2;
    }
    if (!attacking) e.x += (e.spec.side === 'ally' ? 1 : -1) * 34 * dt;
    if (e.x < -60 || e.x > 1060) { ents.splice(i, 1); continue; }

    const motion = attacking ? 'attack' : 'walk';
    const img = sheet(e.spec.id, motion);
    if (!img) continue;
    const cfg = attacking ? ATTACK : WALK;
    const elapsed = attacking ? ATTACK_DUR - (e.atkUntil - t) : t;
    const f = attacking
      ? Math.min(Math.floor(elapsed * cfg.fps), cfg.frames - 1)
      : Math.floor(elapsed * cfg.fps) % cfg.frames;

    const cellW = img.naturalWidth / cfg.frames;
    const cellH = img.naturalHeight;
    const dw = cellW * SCALE;
    const dh = cellH * SCALE;
    const anchorY = ORIGIN_Y[e.spec.kind];
    const baseY = e.spec.kind === 'air' ? airY : groundTop;
    const dx = sx(e.x) - dw / 2;
    const dy = baseY - dh * anchorY;
    ctx.drawImage(img, f * cellW, 0, cellW, cellH, dx, dy, dw, dh);

    // 이름표 — 셀 여백이 아니라 실제 머리 위에
    const charH = sheetCharHeight(e.spec.id);
    const headY = e.spec.kind === 'air' ? baseY - charH / 2 : baseY - charH;
    ctx.fillStyle = e.spec.side === 'ally' ? '#7BD8A0' : '#FF9E86';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(e.spec.name, sx(e.x), headY - 5);
  }
}
