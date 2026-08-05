// 타이틀 화면 — Dead Cat Bounce Flow 목업 19번(저녁판) 기반
import { useState } from 'react';
import { SettingsOverlay } from '../ui/SettingsOverlay.js';

interface Props {
  onStart: () => void;
  onCodex: () => void;
  onCompany: () => void;
}

const STICKS = [
  { h: 34, g: false }, { h: 26, g: false }, { h: 18, g: false },
  { h: 12, g: false }, { h: 24, g: true }, { h: 16, g: false },
];

export function TitleScreen({ onStart, onCodex, onCompany }: Props) {
  const [showSettings, setShowSettings] = useState(false);
  return (
    <div className="title-screen">
      <div className="title-bg" />
      <div className="title-shade" />
      <div className="title-body">
        <div className="title-kicker">YEOUIDO · 19:40 KST · MOONRISE</div>
        <div className="title-logo l1">DEAD CAT</div>
        <div className="title-candles">
          <div className="bar-l" />
          <div className="sticks">
            {STICKS.map((s, i) => <i key={i} className={s.g ? 'g' : ''} style={{ height: s.h }} />)}
          </div>
          <div className="bar-r" />
        </div>
        <div className="title-logo l2">BOUNCE</div>
        <div className="title-tagline">시장이 무너지는 자리에서, 사옥을 지켜라</div>
      </div>
      <div className="title-actions">
        <button className="primary" onClick={onStart}>출  전</button>
        <div className="title-sub">
          <button className="ghost" onClick={onCodex}>도  감</button>
          <button className="ghost" onClick={onCompany}>회  사</button>
          <button className="ghost" onClick={() => setShowSettings(true)}>설  정</button>
        </div>
      </div>
      {showSettings && <SettingsOverlay onClose={() => setShowSettings(false)} />}
      <div className="title-foot">
        <span>v0.1.0 · MVP BUILD</span>
        <span>TICKER FRONT · DUSK TRACE</span>
      </div>
    </div>
  );
}
