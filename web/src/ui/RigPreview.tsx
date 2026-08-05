// ? 도움말 카드용 캐릭터 미리보기 — 리그 원본을 라이브 재생 (단일 인스턴스라 DOM 부담 없음)
import { useEffect, useRef } from 'react';
import { RigPlayer } from '../game/rig/rig-player.js';

export function RigPreview({ unit, height = 150 }: { unit: number; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const player = new RigPlayer(el, { unit, motion: 'walk', height, vfx: false });
    player.start();
    return () => player.destroy();
  }, [unit, height]);
  return <div ref={ref} style={{ width: Math.round(height * 0.95), height, margin: '0 auto' }} />;
}
