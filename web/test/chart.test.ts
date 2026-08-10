import { describe, expect, it } from 'vitest';
import { SLTP_CHIP, sltpChipHit } from '../src/game/chart.js';

// FR-5.15 라벨 칩 히트테스트 — 렌더 좌표와 클릭 판정이 같은 규격을 쓰는지
describe('손절·익절 라벨 칩', () => {
  const W = 1500;
  const lineY = 100;
  const chipLeft = W - SLTP_CHIP.right - SLTP_CHIP.w;

  it('칩 본체를 누르면 잡아끌기', () => {
    expect(sltpChipHit(chipLeft + 6, lineY, lineY, W)).toBe('body');
  });
  it('오른쪽 끝 × 영역은 취소', () => {
    expect(sltpChipHit(W - SLTP_CHIP.right - 4, lineY, lineY, W)).toBe('close');
  });
  it('칩 밖(라인 위)은 히트 아님 — 빈 곳 드래그로 새 레벨을 잡을 수 있어야 한다', () => {
    expect(sltpChipHit(200, lineY, lineY, W)).toBeNull();
  });
  it('세로로 칩 높이를 벗어나면 히트 아님', () => {
    expect(sltpChipHit(chipLeft + 6, lineY + SLTP_CHIP.h, lineY, W)).toBeNull();
  });
});
