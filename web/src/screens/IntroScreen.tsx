import { useState } from 'react';

// §4 인트로 3컷
const CUTS = [
  { icon: '🏢', text: '당신은 1인 투자회사의 대표다.\n가진 것은 차트를 읽는 눈 하나뿐.' },
  { icon: '👹', text: '공매도 세력 "베어"가 당신의 사옥을 노리고 몰려온다.' },
  { icon: '📈', text: '정체를 숨긴 실제 과거 차트를 읽어 전쟁 자금을 만들어라.\n클리어하면 — 그 차트가 어떤 회사의 어느 시기였는지 알게 된다.' },
];

export function IntroScreen({ onStart }: { onStart: () => void }) {
  const [cut, setCut] = useState(0);
  const c = CUTS[cut];
  return (
    <div className="screen center intro" onClick={() => (cut < 2 ? setCut(cut + 1) : onStart())}>
      <div className="cut">
        <div className="icon">{c.icon}</div>
        <p>{c.text.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}</p>
      </div>
      <div className="dots">{CUTS.map((_, i) => <i key={i} className={i === cut ? 'on' : ''} />)}</div>
      <button className="primary" onClick={(e) => { e.stopPropagation(); cut < 2 ? setCut(cut + 1) : onStart(); }}>
        {cut < 2 ? '다음' : '바로 시작'}
      </button>
    </div>
  );
}

// FR-12.4 튜토리얼 스킵 시 요약 카드 3장 강제 노출
const SUMMARY = [
  { title: '① 예측이 곧 자금', text: '차트(일봉, 1초=1거래일)를 보고 AUM으로 LONG/SHORT 진입, 원할 때 청산. 수익은 골드로 환전되고 손실은 AUM에서 깎입니다. 예측 없이는 타워 2개밖에 못 짓습니다.' },
  { title: '② 골드로 방어', text: '골드로 타워를 짓고(빈 슬롯 클릭) 유닛을 소환해 13웨이브를 막으세요. 적을 처치하면 AUM도 회복됩니다. 본진 HP 0 또는 파산이면 패배, 적 본진을 부수면 즉시 승리입니다.' },
  { title: '③ 클리어하면 공개', text: '스테이지가 끝나면 그 차트가 어떤 회사의 어느 시기였는지 공개되고 도감에 등록됩니다.' },
];

export function TutorialSummary({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  return (
    <div className="screen center intro">
      <div className="card summary">
        <h3>{SUMMARY[i].title}</h3>
        <p>{SUMMARY[i].text}</p>
      </div>
      <div className="dots">{SUMMARY.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
      <button className="primary" onClick={() => (i < 2 ? setI(i + 1) : onDone())}>{i < 2 ? '다음' : '시작'}</button>
    </div>
  );
}
