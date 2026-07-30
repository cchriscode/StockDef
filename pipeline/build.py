# -*- coding: utf-8 -*-
"""
TICKER FRONT 데이터 파이프라인 ②~⑦ (PRD §10)
raw 수집본 → 390봉 정제 → σ/이벤트/아키타입/희귀도 계산 →
server/static/bars/{uuid}.json (블라인드) + out/chart_sets.json (마스터) 출력.
네트워크 호출 없음 (오프라인 배치).
"""
import json
import math
import statistics
import uuid
from datetime import datetime, date
from pathlib import Path

ROOT = Path(__file__).parent.parent
RAW = Path(__file__).parent / "out" / "raw"
BARS_OUT = ROOT / "server" / "static" / "bars"
SETS_OUT = Path(__file__).parent / "out" / "chart_sets.json"
BARS_OUT.mkdir(parents=True, exist_ok=True)

STAGE_BARS = 390          # 09:00 ~ 15:29
MIN_REAL_BARS = 280       # 이보다 결측 많으면 그 날 폐기 (QC)
MAX_DAYS_PER_TICKER = 20  # PRD 목표: 종목당 20거래일
EVENT_MAX = 4
SECTOR = {"R1": "금융", "R2": "IT·플랫폼", "R3": "중공업·에너지"}


def minute_offset(ts: str) -> int:
    """09:00 기준 분 오프셋. 장외/동시호가는 -1."""
    t = datetime.fromisoformat(ts)
    off = (t.hour - 9) * 60 + t.minute
    return off if 0 <= off < STAGE_BARS else -1


def build_day(day_bars):
    """1분봉 리스트 → 390봉 정합 배열 (결측 forward-fill)."""
    slots = [None] * STAGE_BARS
    real = 0
    for b in day_bars:
        off = minute_offset(b["ts"])
        if off >= 0 and b["c"] > 0:
            slots[off] = b
            real += 1
    if real < MIN_REAL_BARS or slots[0] is None:
        return None
    out = []
    prev_c = slots[0]["c"]
    for i in range(STAGE_BARS):
        s = slots[i]
        if s is None:
            out.append({"t": i, "o": prev_c, "h": prev_c, "l": prev_c, "c": prev_c, "v": 0})
        else:
            out.append({"t": i, "o": s["o"], "h": s["h"], "l": s["l"], "c": s["c"], "v": s["v"]})
            prev_c = s["c"]
    return out


def sigma_k(closes, k):
    rets = [(closes[i + k] / closes[i] - 1) * 100 for i in range(len(closes) - k) if closes[i] > 0]
    if len(rets) < 5:
        return 0.3
    return max(round(statistics.pstdev(rets), 5), 0.05)


def find_events(closes, sig15):
    """직전 15분 수익률이 ±1.0σ를 넘는 시점 → 강도순 상위 4개 (FR-7)."""
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


def classify(day_change, gap_pct, closes, high, low, open_price, sig15):
    """아키타입 분류 (휴리스틱 — 봇 시뮬레이터로 재검증 가능)."""
    max_z = max(
        (abs((closes[i] / closes[i - 15] - 1) * 100) / sig15 for i in range(15, STAGE_BARS)),
        default=0,
    )
    morning = (closes[STAGE_BARS // 2] / open_price - 1) * 100
    afternoon = day_change - morning
    if abs(gap_pct) >= 4:
        return "earnings"
    if max_z >= 2.5 and day_change < -1.5:
        return "panic"
    if day_change >= 3:
        return "surge"
    if day_change <= -3:
        return "plunge"
    if morning * afternoon < 0 and abs(morning) >= 1 and abs(afternoon) >= 1:
        return "reversal"
    if (high - low) / open_price * 100 < 1.8:
        return "range"
    return "range" if abs(day_change) < 1.5 else "reversal"


def rarity_of(day_change):
    a = abs(day_change)
    if a <= 2:
        return "common"
    if a <= 5:
        return "rare"
    if a <= 10:
        return "epic"
    return "legendary"


def process_ticker(raw):
    """티커 1개 → (chart_set 후보 리스트, bars 파일 dict 리스트)"""
    by_day = {}
    for b in raw["bars1m"]:
        d = b["ts"][:10]
        by_day.setdefault(d, []).append(b)

    daily = raw["daily"]
    daily_idx = {d["d"]: i for i, d in enumerate(daily)}
    total_v, total_slots = 0.0, 0
    day_arrays = {}
    for d, bars in sorted(by_day.items()):
        arr = build_day(bars)
        if arr is None:
            continue
        day_arrays[d] = arr
        total_v += sum(x["v"] for x in arr)
        total_slots += STAGE_BARS
    vol_avg = max(total_v / total_slots, 1.0) if total_slots else 1.0

    results = []
    for d, arr in sorted(day_arrays.items())[-MAX_DAYS_PER_TICKER:]:
        closes = [x["c"] for x in arr]
        open_price = arr[0]["o"]
        high = max(x["h"] for x in arr)
        low = min(x["l"] for x in arr)
        s15, s30, s60 = sigma_k(closes, 15), sigma_k(closes, 30), sigma_k(closes, 60)

        di = daily_idx.get(d)
        if di is not None and di > 0:
            prev_close = daily[di - 1]["c"]
            day_change = round((closes[-1] / prev_close - 1) * 100, 3)
            gap_pct = (open_price / prev_close - 1) * 100
        else:
            day_change = round((closes[-1] / open_price - 1) * 100, 3)
            gap_pct = 0.0

        events = find_events(closes, s15)
        arche = classify(day_change, gap_pct, closes, high, low, open_price, s15)

        # 공개 연출용 전후 60거래일 일봉 (수집 범위 내에서)
        around, day_index = [], 0
        if di is not None:
            lo = max(0, di - 60)
            hi = min(len(daily), di + 61)
            around = [{"d": x["d"], "o": x["o"], "h": x["h"], "l": x["l"], "c": x["c"]} for x in daily[lo:hi]]
            day_index = di - lo

        set_id = str(uuid.uuid4())
        bars_file = {
            "v": 1, "barCount": STAGE_BARS, "openPrice": open_price,
            "bars": [{k: (round(v, 4) if isinstance(v, float) else v) for k, v in x.items()} for x in arr],
            "volumeAvg20d": round(vol_avg, 1),
            "sigma": {"15": s15, "30": s30, "60": s60},
            "events": events,
            "tags": {"region": "아시아", "sector": SECTOR[raw["region"]], "capTier": "large" if raw["symbol"].endswith(".KS") else "mid"},
        }
        results.append(({
            "id": set_id,
            "ticker": raw["symbol"].split(".")[0],
            "company_name": raw["name"],
            "trade_date": d,
            "market": "KRX",
            "sector": SECTOR[raw["region"]],
            "cap_tier": bars_file["tags"]["capTier"],
            "region_id": raw["region"],
            "archetype": arche,
            "day_change_pct": day_change,
            "rarity": rarity_of(day_change),
            "difficulty": 0,  # 아래에서 지역 내 변동성 순위로 부여
            "bars_url": f"/static/bars/{set_id}.json",
            "sigma_15m": s15, "sigma_30m": s30, "sigma_60m": s60,
            "events": events,
            "news": [],
            "ohlcv_day": {"around": around, "dayIndex": day_index,
                          "o": open_price, "h": high, "l": low, "c": closes[-1],
                          "v": sum(x["v"] for x in arr)},
            "_vol30": s30,
        }, bars_file))
    return results


def make_tutorial():
    """FR-12: 5웨이브(150봉) 합성 데이터. 25~70봉 강한 상승 → LONG 30봉 만기 WIN 보장."""
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
    # WIN 보장 검증: 가이드 구간(25~35봉 진입, 30봉 만기)의 z가 DRAW_BAND(0.25) 초과 & 양수
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
        "ohlcv_day": {"around": [], "dayIndex": 0, "o": 10000, "h": max(b["h"] for b in bars),
                      "l": min(b["l"] for b in bars), "c": closes[-1], "v": 800000},
    }
    return cs, bars_file


def main():
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
    sizes = [(BARS_OUT / f"{c['id']}.json").stat().st_size for c in all_sets]
    print(f"bars 파일 크기: 평균 {sum(sizes)//len(sizes)//1024}KB, 최대 {max(sizes)//1024}KB")


if __name__ == "__main__":
    main()
