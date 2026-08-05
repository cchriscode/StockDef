// 유닛·타워 도움말 (? 버튼) — 역할/스킬 설명. 수치는 BALANCE에서 표시 시점에 읽는다 (이중 관리 방지)
import { TOWERS, UNITS, type TowerSpec, type UnitSpec } from '@tf/shared';

export interface InfoCard {
  role: string; // 한 줄 역할 태그
  desc: string; // 역할·운용 설명
  skill: string; // 고유 스킬/특성 설명
}

export const UNIT_INFO: Record<UnitSpec['key'], InfoCard> = {
  intern: {
    role: '전열 블로커',
    desc: '방패로 적 3기까지 붙잡아 전선을 고정합니다. 싸고 빠르게 재소환해 원거리 딜러가 때릴 시간을 버는 소모품 탱커입니다.',
    skill: '원금 보장 (자동, 12초) — 교전 중 방패 돔을 펼쳐 3초간 받는 피해 −60%.',
  },
  analyst: {
    role: '원거리 딜러 · 대공',
    desc: '후방에서 활로 저격합니다. 공중 유닛(알고 드론)을 때릴 수 있는 몇 안 되는 아군이니 드론 웨이브 전에 미리 확보하세요.',
    skill: '화살 세례 (자동, 12초) — 사거리 내 최대 4기를 동시 사격 (발당 DPS×1.2).',
  },
  lancer: {
    role: '관통 근접 딜러',
    desc: '할버드 찌르기가 일직선의 적 3기를 동시에 꿰뚫습니다. 적이 방벽·블로커 앞에 줄지어 설 때 가장 강합니다.',
    skill: '리밸런싱 (자동, 10초) — 적 2기 이상 밀집 시 확장 사거리 관통 일격 (DPS×1.8).',
  },
  trader: {
    role: '근접 브루저',
    desc: '높은 체력으로 2기를 블로킹하면서 대검 횡베기로 2기를 동시에 타격합니다. 전선을 밀어올리는 주력 근접 유닛입니다.',
    skill: '복리 참격 (자동, 9초) — 주변 지상 적 전체에 대검 일격 (DPS×2.5).',
  },
  mage: {
    role: '마법 원거리 · 중장갑 카운터',
    desc: '오브 사출은 마법 피해라 실드베어러·크롤러의 장갑(armor)을 무시합니다. 체력이 약하니 반드시 블로커 뒤에 세우세요.',
    skill: '레버리지 오브 (자동, 14초) — 마법 광역탄 사출 (DPS×2.2, 폭발 반경 70, armor 관통).',
  },
  riskmgr: {
    role: '서포터 (비공격)',
    desc: '전열 뒤를 따라다니며 사옥 체력을 회복시키고 주변 아군이 받는 피해를 20% 줄입니다. 공격하지 않습니다.',
    skill: '헤지 커버 (자동, 5초) — 황금 링 시전마다 사옥 +3 즉시 회복. 패시브: +0.5HP/s + 반경 내 아군 피해 −20%.',
  },
};

export const TOWER_INFO: Record<TowerSpec['key'], InfoCard> = {
  limit: {
    role: '단일 저격 · 지상+공중',
    desc: '사거리가 가장 길고 지상·공중을 모두 노리는 만능 화망입니다. 타겟팅 모드(선두/후미/강적/근접)를 상황에 맞게 바꾸세요.',
    skill: 'Lv2 철갑탄 — 볼트가 마법 판정이 되어 중장갑(armor)을 관통합니다.',
  },
  cannon: {
    role: '광역 포격 · 지상 전용',
    desc: '느리지만 착탄 지점 주변을 통째로 날립니다. 그런트·러너가 몰려오는 물량 웨이브 카운터. 공중은 못 맞춥니다.',
    skill: '공매도 포탄 — 폭발 반경 60의 스플래시 피해 (Lv2 피해 ×1.8).',
  },
  spire: {
    role: '마법 저격 + 슬로우 · 지상+공중',
    desc: '마법 피해로 장갑을 무시하고, 명중한 적을 30% 느리게 만듭니다. 화망의 타격 시간을 늘려주는 컨트롤 타워입니다.',
    skill: '콜/풋 감속 — 명중 시 1.5초간 이동 30% 감속 (Lv2 40%).',
  },
  flame: {
    role: '램프 지속딜 · 지상 전용',
    desc: '연사가 빠르고, 같은 대상을 계속 때릴수록 피해가 복리로 불어납니다 (최대 +120%). 탱커·보스처럼 오래 버티는 적 카운터.',
    skill: '복리 화염 — 같은 대상 연속 명중당 피해 +12%, 대상이 바뀌면 초기화.',
  },
  dividend: {
    role: '경제 (비공격)',
    desc: '슬롯 하나를 경제에 투자합니다. 10초마다 골드를 생산하니 이르게 지을수록 이득이 커집니다.',
    skill: '배당 지급 — 10초마다 +8G (Lv2 +14G). 스테이지 내내 ~250-450G.',
  },
  barrier: {
    role: '경로 차단 (비공격)',
    desc: '지상 적을 물리적으로 막아 세웁니다. 적은 방벽을 부술 때까지 전진하지 못하므로 화망 한가운데 세우면 최대 효율.',
    skill: '서킷 브레이커 — 내구 260 소진까지 경로 차단 (Lv2 내구 ×1.8 + 완전 수리). 공중은 통과.',
  },
};

/** ? 카드 하단 수치 줄 — BALANCE 현재값으로 생성 */
export function unitStatsLine(key: UnitSpec['key']): string {
  const u = UNITS.find((s) => s.key === key)!;
  const parts = [`비용 ${u.cost}G`, `체력 ${u.hp}`];
  if (u.dps > 0) parts.push(`DPS ${u.dps}${u.cleave > 1 ? `×${u.cleave}` : ''}`, u.dmgType === 'magic' ? '마법' : '물리');
  if (u.block > 0) parts.push(`블록 ${u.block}`);
  if (u.antiAirPct > 0) parts.push(`대공 ${u.antiAirPct * 100}%`);
  if (u.baseHealPerSec > 0) parts.push(`사옥 +${u.baseHealPerSec}/s`);
  return parts.join(' · ');
}

export function towerStatsLine(key: TowerSpec['key']): string {
  const t = TOWERS.find((s) => s.key === key)!;
  const parts = [`건설 ${t.cost}G`, `업글 ${t.upgradeCost}G`];
  if (t.dmg > 0) {
    parts.push(`피해 ${t.dmg}`, `연사 ${t.rate}/s`, `사거리 ${t.range}`, t.dmgType === 'magic' ? '마법' : '물리');
    if (t.splashRadius > 0) parts.push(`광역 ${t.splashRadius}`);
    if (t.slowPct > 0) parts.push(`슬로우 ${t.slowPct * 100}%`);
  }
  if (t.incomeAmount > 0) parts.push(`+${t.incomeAmount}G/${t.incomePeriod}초`);
  if (t.barrierHP > 0) parts.push(`내구 ${t.barrierHP}`);
  return parts.join(' · ');
}
