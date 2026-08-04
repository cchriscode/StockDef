import { useState } from 'react';
import { getSettings, saveSettings, type Settings } from '../net/api.js';

// FR-13 설정 — 화면 위 오버레이 (열려 있는 화면 위에 떠서 닫으면 제자리)
export function SettingsOverlay({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings>(getSettings());

  const apply = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="overlay center" onClick={onClose}>
      <div className="card settings" onClick={(e) => e.stopPropagation()}>
        <h3>설정 (FR-13)</h3>
        <label>배속 (스테이지 시작 전에만 적용)
          <div>
            {([0.5, 1, 2] as const).map((v) => (
              <button key={v} className={`opt ${settings.speed === v ? 'on' : ''}`} onClick={() => apply({ speed: v })}>{v}x</button>
            ))}
          </div>
        </label>
        <label>효과음 볼륨 — {Math.round(settings.volume * 100)}%
          <input
            type="range" min={0} max={100} step={5}
            value={Math.round(settings.volume * 100)}
            onChange={(e) => apply({ volume: Number(e.target.value) / 100 })}
          />
        </label>
        <label>
          <input type="checkbox" checked={settings.colorBlind} onChange={(e) => apply({ colorBlind: e.target.checked })} />
          색약 모드 (상승/하락 → 황/청)
        </label>
        <label>
          <input type="checkbox" checked={settings.reduceShake} onChange={(e) => apply({ reduceShake: e.target.checked })} />
          화면 흔들림 감소
        </label>
        <button className="primary" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
