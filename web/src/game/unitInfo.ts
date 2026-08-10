// 유닛·타워 도움말 (? 버튼) — 역할/스킬 설명. 수치는 BALANCE에서 표시 시점에 읽는다 (이중 관리 방지)
import { TOWERS, UNITS, type TowerSpec, type UnitSpec } from '@tf/shared';

export interface InfoCard {
  role: string; // 한 줄 역할 태그
  desc: string; // 역할·운용 설명
  skill: string; // 고유 스킬/특성 설명
}

/** [임시] 프리뷰 유닛 카드 생성기 */
const tmpCard = (role: string, desc: string): InfoCard => ({
  role: `${role} · 임시 프리뷰 (1G)`,
  desc: `${desc} 신규 아트 확인용 임시 유닛이라 스탯·비용은 가안입니다.`,
  skill: '자동 스킬 없음 — 기본 공격만 수행합니다.',
});

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
  cane: {
    role: '임시 테스트 유닛',
    desc: '신규 아트 스타일 프리뷰용 임시 캐릭터입니다 (PNG 스프라이트). 느낌 확인 후 정식 편입 여부·스탯을 결정합니다.',
    skill: '지팡이 내려침 — 근접 단일 타격. 자동 스킬 없음.',
  },
  // FR-6.5c 신규 로스터 — 스킬 이펙트에 맞춘 효과 (2026-08-10 확정)
  apprentice: { role: '근접 · 저가 딜러', desc: '망치를 짧게 휘두르는 견습공. 값이 싸고 스킬 회전이 가장 빠릅니다.', skill: '견습의 연타 (8초) — 4연타 ×0.7, 명중 시 다음 스킬 쿨다운 −1.5초.' },
  scissor: { role: '근접 · 단일 특화', desc: '거대 가위로 한 대상을 집중 공략합니다. 뒤에 오는 딜러의 피해를 받쳐 주는 역할입니다.', skill: '십자 절단 (9초) — 2회 ×1.1 + 출혈(초당 ×0.25, 4초) + 방어 −25% 4초.' },
  club: { role: '근접 · 광역 기절', desc: '종머리 곤봉으로 전방을 쓸어칩니다. 근접 중 유일한 다중 기절원이라 물량 웨이브를 끊는 데 씁니다.', skill: '종울림 강타 (9초) — 전방 4명 ×1.8 + 0.9초 기절 + 소폭 넉백.' },
  roundshield: { role: '탱커 · 밀어내기', desc: '방패로 밀어붙여 전선을 되돌립니다. 본진이 뚫릴 때 시간을 버는 용도로 좋습니다.', skill: '돌격 방패 (12초) — 3명 ×1.2 + 140px 넉백, 자신 받는 피해 −60% 3초.' },
  bricker: { role: '탱커 · 광역 딜', desc: '짊어진 벽돌을 던져 전방을 강타합니다. 맷집을 유지하면서 광역 피해를 넣습니다.', skill: '벽돌 투척 (11초) — 광역 4명 ×1.6 + 파편 둔화 40% 3초.' },
  shutter: { role: '탱커 · 보호', desc: '셔터를 전개해 전열 아군을 지킵니다. 유일한 보호막 공급원입니다.', skill: '셔터 전개 (12초) — 전열 3명에 최대체력 25% 보호막 5초 + 기절·둔화 정화, 닿은 적 ×0.8.' },
  gasmask: { role: '원거리 · 장악', desc: '독가스탄으로 밀집 지점을 무력화합니다. 적 힐러(확성기 드론)를 무력화하는 유일한 수단입니다.', skill: '독가스탄 (12초) — 착탄 광역 ×1.0 + 둔화 20% + 회복 차단 5초.' },
  foreman: { role: '탱커 · 광역 강타', desc: '대형 망치로 내리찍는 주력 전열. 체력이 가장 높고 광역 기절까지 겸합니다.', skill: '작업 개시 (11초) — 광역 5명 ×2.2 + 0.8초 기절 + 둔화 45% 2초, 자신 방어 4초.' },
  sniper: { role: '원거리 · 관통 화력', desc: '장거리 관통 저격수. 일렬로 늘어선 적을 한 번에 꿰뚫습니다. 물몸이라 전열 뒤에 두세요.', skill: '조준 관통 사격 (12초) — 경로 관통(첫 대상 ×3.4, 이후 60%씩) + 방어 무시 50%.' },
  pistol: { role: '원거리 (미사용)', desc: '스킬 시트가 없어 현재 로스터에서 제외돼 있습니다.', skill: '없음.' },
};

export const TOWER_INFO: Record<TowerSpec['key'], InfoCard> = {
  limit: {
    role: '단일 저격 · 지상+공중',
    desc: '사거리가 가장 길어 전선 뒤에서 꾸준히 화력을 보태는 기본 화망입니다. 지상·공중을 모두 노리므로 연 정찰기 같은 공중 유닛에도 대응합니다. 타겟팅 모드(선두/후미/강적/근접)를 상황에 맞게 바꾸세요.',
    skill: 'Lv2 철갑탄 — 포탄이 마법 판정이 되어 중장갑(방패 파쇄병 등)을 관통합니다.',
  },
  cannon: {
    role: '광역 포격 · 지상 전용',
    desc: '느리지만 착탄 지점 주변을 통째로 날립니다. 창 망령·석궁 사수가 줄지어 몰려오는 물량 웨이브의 카운터입니다. 공중은 맞히지 못하니 지정가 포탑이나 스파이어와 함께 쓰세요.',
    skill: '공매도 포탄 — 폭발 반경 60의 광역 피해 (Lv2 피해 ×1.8).',
  },
  spire: {
    role: '마법 저격 + 감속 · 지상+공중',
    desc: '마법 피해라 방어를 무시하고, 맞은 적을 30% 느리게 만듭니다. 적이 화망 안에 머무는 시간을 늘려 다른 포탑의 딜을 끌어올리는 컨트롤 타워입니다.',
    skill: '콜/풋 감속 — 명중 시 1.5초간 이동 30% 감속 (Lv2 40%).',
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
  return parts.join(' · ');
}
