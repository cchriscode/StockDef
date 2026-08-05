# Unit Rigs — 게임 적용 패키지

주식 테마 타워디펜스용 **19종 유닛 애니메이션 리그**입니다. 각 캐릭터가 파츠(다리·몸통·머리·팔·무기)로
분해돼 있고, 파츠별 회전 피벗과 모션당 키프레임 트랙으로 구동됩니다. 스프라이트 시트가 아니라
**런타임 벡터 리깅**이라 해상도 손실이 없고 모션 타이밍을 코드에서 바꿀 수 있습니다.

## 파일 구조

```
handoff/
├── README.md              이 문서
├── SPEC.md                19종 × 5모션 전체 스펙 (파츠·피벗·VFX 키)
├── assets/                원본 포즈 SVG 19종 + manifest.json (참조용, 런타임 불필요)
├── src/
│   ├── helpers.js         보간 · 키프레임 트랙 유틸 (Helpers, H)
│   ├── defs.js            그라디언트/패턴/필터 정의 + injectDefs()
│   ├── rig-data.js        19종 리그 데이터 (markup · parts · anim · notes)
│   ├── vfx.js             캔버스 VFX 레이어 (Vfx, VFX, MOTION_PERIODS)
│   └── rig-player.js      RigPlayer — 프레임워크 없는 플레이어
└── demo/index.html        전체 데모 (유닛 19종 × 모션 5종)
```

의존성 없음. 빌드 도구 없음. 순수 ES 모듈 + SVG + Canvas 2D입니다.

## 바로 확인

ES 모듈이라 `file://`로는 안 열립니다. 로컬 서버로 띄우세요.

```bash
cd handoff && python3 -m http.server 8080
# → http://localhost:8080/demo/index.html
```

## 최소 적용 코드

```js
import { RigPlayer } from './src/rig-player.js';

const player = new RigPlayer(document.getElementById('stage'), {
  unit: 0,          // 0..18 (SPEC.md 순서 = assets/ 파일 번호 - 1)
  motion: 'walk',   // walk | attack | hit | death | skill
  height: 400,      // 렌더 높이 px
  vfx: true         // 스킬/사망 이펙트 캔버스 레이어
});
player.start();     // 내장 rAF 루프
```

## 게임 루프에 붙이기

내장 루프를 쓰지 말고 직접 구동하세요. 게임의 일시정지·배속·타임스케일이 그대로 적용됩니다.

```js
const player = new RigPlayer(el, { unit: 12, motion: 'walk' });
// player.start() 호출하지 않음

function gameTick(dtMs) {
  player.update(dtMs * timeScale);
}
```

### 단발 모션(공격·피격·사망) 처리

모든 모션은 루프입니다. 한 번만 재생하려면 `onLoopEnd`로 되돌리세요.

```js
const player = new RigPlayer(el, { unit: 0, motion: 'walk' });
player.onLoopEnd = (motion) => {
  if (motion === 'attack' || motion === 'hit') player.setMotion('walk');
  if (motion === 'death') { player.stop(); despawn(); }
};

function onAttack() { player.setMotion('attack'); }   // t가 0으로 리셋됨
```

### 특정 프레임으로 점프

```js
player.seek(0.46);   // 공격 모션의 타격 순간 등, 0..1 위상
```

히트 판정 타이밍은 SPEC.md의 모션 설명에 위상이 적혀 있습니다. 대체로 `attack`은
**위상 0.42~0.52 구간이 타격 프레임**입니다(유닛별로 다름).

## API

| 멤버 | 설명 |
|---|---|
| `new RigPlayer(el, opts)` | `opts`: `unit`, `motion`, `speed`, `height`, `vfx`, `onLoopEnd` |
| `setUnit(i)` | 유닛 교체 (SVG 재생성, t 리셋) |
| `setMotion(m)` | 모션 교체 (t 리셋) |
| `setSpeed(s)` | 1 = 저작 속도. 검수할 때 0.2 권장 |
| `update(dtMs)` | 시간 전진 + 렌더. 게임 루프에서 호출 |
| `seek(phase)` | 0..1 위상으로 점프 |
| `start()` / `stop()` / `destroy()` | 내장 rAF 루프 제어 |
| `player.rig` | 현재 리그 데이터 (`kr`, `en`, `parts`, `notes`, `vb`) |
| `RIGS` | 19종 배열 |
| `MOTIONS` | `["walk","attack","hit","death","skill"]` |
| `MOTION_PERIODS` | 모션당 루프 길이(초) |
| `VFX.drawFor(ctx,w,h,unit,motion,phase)` | VFX만 따로 그릴 때 |
| `VFX.setAnchor(fn)` | 무기 끝 원점 리졸버 등록 (RigPlayer가 자동 등록) |

## 방향(좌우) 규칙

- **유닛 0~11 (아군)** — 오른쪽(+x)을 봅니다. 공격이 +x로 나갑니다.
- **유닛 12~18 (적군)** — 왼쪽(-x)을 봅니다. 공격이 -x로 나갑니다.

리그 자체에 방향이 구워져 있습니다. 반대로 세우려면 컨테이너에 `transform: scaleX(-1)`을 걸되,
VFX 캔버스는 `dir` 인자를 따르므로 함께 뒤집히지 않습니다. 좌우 대칭이 필요하면
`VFX.drawFor` 호출 전에 `ctx.scale(-1,1)`을 적용하세요.

## 파츠를 직접 만지기

```js
// 조준선, 장착 아이템 부착 등
const hand = player.node('armFront');   // <g id="armFront">
```

파츠 id와 페인트 순서는 SPEC.md에 유닛별로 정리돼 있습니다.

## 스킬 / 사망 VFX

VFX는 캐릭터 아트와 **완전히 분리**돼 캔버스에 `lighter` 합성으로 그려집니다. 캐릭터에 굽지
않았으므로 타이밍을 따로 조절하거나 여러 유닛이 같은 이펙트를 재사용할 수 있습니다.

- 벡터로 그린 것 — 배리어 돔, 육각 실드, 참격 링, 지면 확산 링, 관통 빔, 낙뢰, 얼음 결정,
  상승/하락 화살표, 조준 마름모, 톱니 링, 스캔 격자
- 파티클로 그린 것 — 금화, 잉걸불, 기체 파편, 눈송이, 스파크

사망 전용 VFX가 있는 유닛: **13 패닉셀 드론**(자폭), **17 헤지 실드베어러**(실드 파쇄).
나머지 유닛은 `death`에 VFX가 없습니다(필요하면 `deathFxKey`에 추가).

공격 전용 VFX가 있는 유닛: **8 공매도 캐논**(`cannonShell` — 포구 화염 + 날아가는 포탄 + 잔상).
추가는 `atkFxKey`에 넣으세요.

### 무기 끝에서 나가는 이펙트 — 앵커

일부 이펙트는 캔버스 중앙이 아니라 **무기 끝 좌표**에서 시작해야 합니다.
`RigPlayer`가 생성될 때 리졸버를 등록하므로 보통은 신경 쓸 필요가 없지만,
`VFX`를 직접 쓸 때는 등록해야 원점이 맞습니다.

```js
VFX.setAnchor((lx, ly, partId) => {
  // partId 그룹의 로컬 SVG 좌표 (lx,ly) -> 캔버스 픽셀 좌표
  const n = svg.querySelector('#' + partId);
  const m = n.getScreenCTM();
  const p = new DOMPoint(lx, ly).matrixTransform(m);
  const rect = canvas.getBoundingClientRect();
  return { x: p.x - rect.left, y: p.y - rect.top };
});
```

파츠의 **현재 트랜스폼을 따라가므로** 무기를 휘두르는 중에도 원점이 붙어 있습니다.
등록하지 않으면 각 이펙트가 캔버스 기준 근사 좌표로 폴백합니다(어긋나지만 크래시는 없음).

| 이펙트 | 앵커 파츠 · 로컬 좌표 | 의미 |
|---|---|---|
| `domeGold` | `shadow`(78,190) + `head`(80,30) | 발밑을 밑면으로, 머리 위까지 감싸는 반지름 |
| `lanceBeams` | `halberd`(137,15) | 할버드 스파이크 끝 |
| `boltImpact` | `bolt`(142,74) | 볼트 화살촉 |
| `cannonShell` | `barrelIn`(130,123) | 포신 포구 (`barrelIn`은 포신 안쪽 -15° 회전 그룹) |

### 적군 스킬은 아군 스킬과 시각 언어가 다릅니다

의도된 설계입니다. 그대로 유지하세요.

- 아군 = 황금/백색, 시전자 중심으로 피어오름
- 적군 = 마젠타(#FF3CAC)/시안(#2DE2E6), **대상이 플레이어 쪽이거나 적군 진영 전체**
- 인플레이션 크롤러의 버프만 독성 옐로그린(#C8F03C) + 톱니 링 — 아군 사제의 매끈한
  황금 링과 혼동되지 않게 일부러 다르게 잡았습니다

## 스프라이트 시트가 필요하면

Unity·Godot 등 벡터를 못 받는 엔진이면 프레임을 뽑아 쓰세요.

```js
const p = new RigPlayer(el, { unit: 0, motion: 'attack', vfx: false });
for (let i = 0; i < 24; i++) {           // 24fps 1루프
  p.seek(i / 24);
  // p.svg.outerHTML 을 캡처하거나 canvas로 래스터화
}
```

## 아직 없는 것

- **투사체 궤적 에셋** — 공격 모션의 화살·볼트·폭탄은 캐릭터 파츠로 들어가 있습니다.
  비행 중인 독립 투사체 에셋은 별도로 필요합니다.
- **피격 타격 이펙트** — `hit`은 실루엣 플래시(brightness/saturate 필터)만 있습니다.
  타격 스파크·경직 표시는 없습니다.
- **UI 아이콘, 지형, 배경** — 이 패키지 범위 밖입니다.
