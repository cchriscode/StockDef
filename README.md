# TICKER FRONT — MVP

정체를 가린 **실제 과거 국내 주식 차트**(1분봉)를 읽어 전쟁 자금을 만들고, 그 돈으로 일자형 타워디펜스 13웨이브를 막아 지역을 점령하고, 클리어 후 그것이 **어떤 회사의 어느 날이었는지** 알게 되는 게임. (PRD: `PRD_TICKER-FRONT_MVP.md`)

## 요구 사항

- Node.js 20+
- Python 3.11+ (`pip install yfinance` — 데이터 수집용)

## 실행

```bash
npm install

# 1) 데이터 수집 (최초 1회, ~3분) — yfinance로 국내 주식 30종목 × 최근 20거래일
npm run fetch

# 2) 데이터 빌드 — 390봉 정제, σ/이벤트/아키타입 계산, 블라인드 bars 파일 생성 (~600조합)
npm run build:data

# 3) DB 시드
npm run seed

# 4) 실행 (server :3000 + web :5173)
npm run dev
# → http://localhost:5173
```

## 검증 도구

```bash
npm run test   # 판정·정산·수입분배·전투 단위테스트 (PRD 수용 기준)
npm run sim    # 봇 시뮬레이터 — 승률별 클리어율을 §9.3 설계 곡선과 대조
```

## 구조

```
shared/    타입 + 밸런스 상수(§9) + 판정/정산 수식 + 전투 엔진 (서버·클라·봇 공유)
pipeline/  오프라인 데이터 배치 (§10): fetch_krx.py → build.py
server/    Express REST(§7.1) + WS 판정 엔진(§7.2~7.3, 서버 권위) + SQLite(§6.1)
web/       Vite+React: 인트로/튜토리얼/지도/스테이지/공개 연출/도감/회사
```

## PRD 대비 구현 노트

| 항목 | 상태 |
|---|---|
| 데이터 | 국내 주식 실데이터 (yfinance, **최근 30일 한정** — 역사적 날짜는 증권사 API 필요, 향후 과제) |
| DB | PostgreSQL → SQLite (로컬 MVP, 스키마는 §6.1 동일 구조) |
| 뉴스 헤드라인(FR-9 3단계) | 데이터 소스 미확보로 비어 있음 — 있으면 표시, 없으면 자동 생략 |
| 블라인드(FR-4) | 페이로드·URL에 종목/날짜 없음, 불투명 UUID. 가격 절대값 포함 여부는 오픈 이슈 O-3 |
| i18n 키 분리(FR-13.4) | 생략 (한국어 하드코딩) |
| R2·R3 웨이브 테이블 | 봇 시뮬 기준 튜닝 완료, 최종 스펙은 플레이테스트로 확정 (PRD §9.4) |

토큰 유실 시 진행도 복구는 지원하지 않습니다 (FR-1.4, localStorage `tf.token`).
