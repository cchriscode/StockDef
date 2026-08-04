# -*- coding: utf-8 -*-
"""
TICKER FRONT 데이터 파이프라인 ②~⑦ (PRD §10)
raw 일봉 수집본 → 390봉(=390거래일) 윈도우 슬라이싱 → σ/이벤트/아키타입/희귀도 계산 →
server/static/bars/{uuid}.json (블라인드) + out/chart_sets.json (마스터) 출력.
네트워크 호출 없음 (오프라인 배치).

(2026-08-04 개정: 1분봉 하루 → 일봉 390거래일 윈도우. 1봉 = 1거래일 = 게임 1초.
 스테이지 하나 = 약 1년 7개월의 실제 장세. σ30 = 30거래일 수익률 표준편차.)
"""
import json
import statistics
import uuid
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent.parent
RAW = Path(__file__).parent / "out" / "raw"
BARS_OUT = ROOT / "server" / "static" / "bars"
SETS_OUT = Path(__file__).parent / "out" / "chart_sets.json"
BARS_OUT.mkdir(parents=True, exist_ok=True)

STAGE_BARS = 390          # 390거래일 (약 1년 7개월)
WINDOW_STRIDE = 65        # 윈도우 시작 간격 (약 3개월) — 과도한 중복 방지
MAX_WINDOWS_PER_TICKER = 40
EVENT_MAX = 4
CONTEXT_PAD = 130         # 공개 연출 문맥: 윈도우 앞뒤 여유 거래일
CONTEXT_STEP = 5          # 공개 연출 차트 다운샘플 (주봉 근사)
SECTOR = {"R1": "금융", "R2": "IT·플랫폼", "R3": "중공업·에너지"}


def sigma_k(closes, k):
    rets = [(closes[i + k] / closes[i] - 1) * 100 for i in range(len(closes) - k) if closes[i] > 0]
    if len(rets) < 5:
        return 0.3
    return max(round(statistics.pstdev(rets), 5), 0.05)


def find_events(closes, sig15):
    """직전 15봉 수익률이 ±1.0σ를 넘는 시점 → 강도순 상위 4개 (FR-7)."""
    cands = []
    for i in range(15, STAGE_BARS):
        r = (closes[i] / closes[i - 15] - 1) * 100
        z = abs(r) / sig15 if sig15 > 0 else 0
        if z >= 1.0 and 30 <= i <= 355:  # 다음 웨이브가 존재하는 구간만
            cands.append({"t": i, "type": "panic_sell" if r < 0 else "fomo_rally", "strength": round(z, 2)})
    cands.sort(key=lambda c: -c["strength"])
    picked = []
    for c in cands:
        if all(abs(c["t"] - p["t"]) >= 45 for p in picked):
            picked.append(c)
        if len(picked) >= EVENT_MAX:
            break
    picked.sort(key=lambda c: c["t"])
    return picked


def classify(change_pct, closes, high, low, open_price, sig15):
    """아키타입 분류 (390거래일 윈도우 스케일 휴리스틱 — 분포는 build 출력으로 확인)."""
    max_z = max(
        (abs((closes[i] / closes[i - 15] - 1) * 100) / sig15 for i in range(15, STAGE_BARS)),
        default=0,
    )
    # 단일 거래일 최대 급변 (상하한가·실적 쇼크 포함 기간)
    max_day_move = max(
        (abs(closes[i] / closes[i - 1] - 1) * 100 for i in range(1, STAGE_BARS) if closes[i - 1] > 0),
        default=0,
    )
    first_half = (closes[STAGE_BARS // 2] / open_price - 1) * 100
    second_half = change_pct - first_half
    # 추세(원웨이) 우선 — earnings(단일일 쇼크)는 추세가 아닌 기간에만
    if max_z >= 2.5 and change_pct < -15:
        return "panic"
    if change_pct >= 35:
        return "surge"
    if change_pct <= -35:
        return "plunge"
    if max_day_move >= 18:
        return "earnings"   # 추세 없는 기간에 하루 ±18% 이상 쇼크 포함
    if first_half * second_half < 0 and abs(first_half) >= 12 and abs(second_half) >= 12:
        return "reversal"
    if (high - low) / open_price * 100 < 35:
        return "range"
    return "range" if abs(change_pct) < 15 else "reversal"


def rarity_of(change_pct):
    a = abs(change_pct)
    if a <= 15:
        return "common"
    if a <= 35:
        return "rare"
    if a <= 70:
        return "epic"
    return "legendary"


def process_ticker(raw):
    """티커 1개 → (chart_set 후보 리스트, bars 파일 dict 리스트)"""
    daily = [d for d in raw["daily"] if d["c"] > 0 and d["o"] > 0]
    n = len(daily)
    if n < STAGE_BARS + 10:
        print(f"  {raw['symbol']}: 일봉 {n}개 — 윈도우 부족, 건너뜀", flush=True)
        return []

    results = []
    starts = list(range(0, n - STAGE_BARS + 1, WINDOW_STRIDE))[-MAX_WINDOWS_PER_TICKER:]
    for i0 in starts:
        i1 = i0 + STAGE_BARS - 1
        window = daily[i0:i1 + 1]
        arr = [{"t": t, "o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"], "v": b["v"]} for t, b in enumerate(window)]
        closes = [x["c"] for x in arr]
        open_price = arr[0]["o"]
        high = max(x["h"] for x in arr)
        low = min(x["l"] for x in arr)
        s15, s30, s60 = sigma_k(closes, 15), sigma_k(closes, 30), sigma_k(closes, 60)
        change_pct = round((closes[-1] / open_price - 1) * 100, 3)

        events = find_events(closes, s15)
        arche = classify(change_pct, closes, high, low, open_price, s15)

        # 공개 연출용 문맥 차트: 윈도우 앞뒤 CONTEXT_PAD 거래일 포함, CONTEXT_STEP 다운샘플 (주봉 근사)
        lo_i = max(0, i0 - CONTEXT_PAD)
        hi_i = min(n, i1 + 1 + CONTEXT_PAD)
        ctx = daily[lo_i:hi_i:CONTEXT_STEP]
        around = [{"d": x["d"], "o": x["o"], "h": x["h"], "l": x["l"], "c": x["c"]} for x in ctx]
        day_index = (i0 - lo_i) // CONTEXT_STEP
        window_len = STAGE_BARS // CONTEXT_STEP

        set_id = str(uuid.uuid4())
        bars_file = {
            "v": 1, "barCount": STAGE_BARS, "openPrice": open_price,
            "bars": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in x.items()} for x in arr],
            "volumeAvg20d": round(max(sum(x["v"] for x in arr) / STAGE_BARS, 1.0), 1),
            "sigma": {"15": s15, "30": s30, "60": s60},
            "events": events,
            "tags": {"region": "아시아", "sector": SECTOR[raw["region"]], "capTier": "large" if raw["symbol"].endswith(".KS") else "mid"},
        }
        results.append(({
            "id": set_id,
            "ticker": raw["symbol"].split(".")[0],
            "company_name": raw["name"],
            "trade_date": window[-1]["d"],  # 기간 종료일 (시작일은 ohlcv_day.dateStart)
            "market": "KRX",
            "sector": SECTOR[raw["region"]],
            "cap_tier": bars_file["tags"]["capTier"],
            "region_id": raw["region"],
            "archetype": arche,
            "day_change_pct": change_pct,  # 기간 전체 등락률
            "rarity": rarity_of(change_pct),
            "difficulty": 0,  # 아래에서 지역 내 변동성 순위로 부여
            "bars_url": f"/static/bars/{set_id}.json",
            "sigma_15m": s15, "sigma_30m": s30, "sigma_60m": s60,
            "events": events,
            "news": [],
            "ohlcv_day": {"around": around, "dayIndex": day_index, "windowLen": window_len,
                          "dateStart": window[0]["d"],
                          "o": open_price, "h": high, "l": low, "c": closes[-1],
                          "v": sum(x["v"] for x in arr)},
            "_vol30": s30,
        }, bars_file))
    return results


def make_tutorial():
    """FR-12: 5웨이브(150봉) 합성 데이터. 25~70봉 강한 상승 → LONG 30봉 보유 WIN 보장."""
    bars, price = [], 10000.0
    import random
    rng = random.Random(42)
    for i in range(150):
        drift = 0.0006 if 21 <= i <= 70 else 0.00003
        noise = rng.uniform(-0.0004, 0.0004)
        o = price
        c = price * (1 + drift + noise)
        h = max(o, c) * (1 + rng.uniform(0, 0.0003))
        l = min(o, c) * (1 - rng.uniform(0, 0.0003))
        bars.append({"t": i, "o": round(o, 2), "h": round(h, 2), "l": round(l, 2), "c": round(c, 2), "v": 5000 + rng.randint(-500, 2500)})
        price = c
    closes = [b["c"] for b in bars]
    s15, s30, s60 = sigma_k(closes, 15), sigma_k(closes, 30), sigma_k(closes, 60)
    # WIN 보장 검증: 가이드 구간(25~35봉 진입, 30봉 보유)의 z가 DRAW_BAND(0.25) 초과 & 양수
    for i in range(24, 36):
        delta = (closes[i + 30] / closes[i] - 1) * 100
        assert delta > 0 and delta / s30 > 0.30, f"튜토리얼 WIN 보장 실패 @bar{i}: Δ={delta:.3f} σ30={s30}"

    set_id = str(uuid.uuid4())
    bars_file = {
        "v": 1, "barCount": 150, "openPrice": 10000, "bars": bars,
        "volumeAvg20d": 5500.0,
        "sigma": {"15": s15, "30": s30, "60": s60},
        "events": [],
        "tags": {"region": "연습", "sector": "연습", "capTier": "large"},
    }
    cs = {
        "id": set_id, "ticker": "TUT", "company_name": "가상 연습 종목 (합성 데이터)",
        "trade_date": str(date.today()), "market": "SYNTH", "sector": "연습", "cap_tier": "large",
        "region_id": "TUT", "archetype": "surge", "day_change_pct": round((closes[-1] / 10000 - 1) * 100, 3),
        "rarity": "common", "difficulty": 0, "bars_url": f"/static/bars/{set_id}.json",
        "sigma_15m": s15, "sigma_30m": s30, "sigma_60m": s60,
        "events": [], "news": [],
        "ohlcv_day": {"around": [], "dayIndex": 0, "windowLen": 0, "dateStart": str(date.today()),
                      "o": 10000, "h": max(b["h"] for b in bars),
                      "l": min(b["l"] for b in bars), "c": closes[-1], "v": 800000},
    }
    return cs, bars_file


def main():
    # 이전 빌드 산출물 제거 (uuid 파일명이라 누적되면 고아 파일이 쌓임)
    for old in BARS_OUT.glob("*.json"):
        old.unlink()

    all_sets, all_bars = [], []
    for f in sorted(RAW.glob("*.json")):
        raw = json.loads(f.read_text(encoding="utf-8"))
        for cs, bf in process_ticker(raw):
            all_sets.append(cs)
            all_bars.append(bf)
        print(f"{raw['symbol']} {raw['name']}: 누적 {len(all_sets)}조합", flush=True)

    # difficulty: 지역 내 σ30 3분위 (PRD는 봇 시뮬 기반 — MVP는 변동성 프록시)
    for region in ("R1", "R2", "R3"):
        rs = [c for c in all_sets if c["region_id"] == region]
        rs.sort(key=lambda c: c["_vol30"])
        n = len(rs)
        for i, c in enumerate(rs):
            c["difficulty"] = 1 if i < n / 3 else (2 if i < 2 * n / 3 else 3)
    for c in all_sets:
        c.pop("_vol30", None)

    tut_cs, tut_bars = make_tutorial()
    all_sets.append(tut_cs)
    all_bars.append(tut_bars)

    for cs, bf in zip(all_sets, all_bars):
        (BARS_OUT / f"{cs['id']}.json").write_text(json.dumps(bf, ensure_ascii=False), encoding="utf-8")
    SETS_OUT.write_text(json.dumps(all_sets, ensure_ascii=False, indent=1), encoding="utf-8")

    from collections import Counter
    print(f"\n총 {len(all_sets)}조합 (튜토리얼 포함)")
    print("지역:", dict(Counter(c["region_id"] for c in all_sets)))
    print("아키타입:", dict(Counter(c["archetype"] for c in all_sets)))
    print("희귀도:", dict(Counter(c["rarity"] for c in all_sets)))
    for region in ("R1", "R2", "R3"):
        rs = [c for c in all_sets if c["region_id"] == region]
        print(f"  {region} 아키타입:", dict(Counter(c["archetype"] for c in rs)))
    sizes = [(BARS_OUT / f"{c['id']}.json").stat().st_size for c in all_sets]
    print(f"bars 파일 크기: 평균 {sum(sizes)//len(sizes)//1024}KB, 최대 {max(sizes)//1024}KB")


if __name__ == "__main__":
    main()
