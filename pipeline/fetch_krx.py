# -*- coding: utf-8 -*-
"""
TICKER FRONT 데이터 파이프라인 ① 수집 (PRD §10)
yfinance로 국내 주식 30종목의 최근 30일 1분봉 + 1년 일봉을 수집해
pipeline/out/raw/{symbol}.json 으로 저장한다. 네트워크는 이 스크립트만 사용한다.
"""
import json
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import yfinance as yf

OUT = Path(__file__).parent / "out" / "raw"
OUT.mkdir(parents=True, exist_ok=True)

# 지역별 10종목 (PRD FR-2.1 섹터 매핑)
TICKERS = {
    "R1": [  # 여의도 · 금융
        ("105560.KS", "KB금융"), ("055550.KS", "신한지주"), ("086790.KS", "하나금융지주"),
        ("316140.KS", "우리금융지주"), ("016360.KS", "삼성증권"), ("006800.KS", "미래에셋증권"),
        ("032830.KS", "삼성생명"), ("088350.KS", "한화생명"), ("000810.KS", "삼성화재"),
        ("005830.KS", "DB손해보험"),
    ],
    "R2": [  # 판교 · IT/플랫폼
        ("035420.KS", "NAVER"), ("035720.KS", "카카오"), ("036570.KS", "엔씨소프트"),
        ("251270.KS", "넷마블"), ("259960.KS", "크래프톤"), ("263750.KQ", "펄어비스"),
        ("293490.KQ", "카카오게임즈"), ("112040.KQ", "위메이드"), ("018260.KS", "삼성에스디에스"),
        ("030200.KS", "KT"),
    ],
    "R3": [  # 울산 · 중공업/에너지
        ("329180.KS", "HD현대중공업"), ("009540.KS", "HD한국조선해양"), ("010140.KS", "삼성중공업"),
        ("042660.KS", "한화오션"), ("010950.KS", "S-Oil"), ("096770.KS", "SK이노베이션"),
        ("005380.KS", "현대차"), ("000270.KS", "기아"), ("012330.KS", "현대모비스"),
        ("034020.KS", "두산에너빌리티"),
    ],
}


def fetch_1m(symbol: str):
    """야후 1m 제한(요청당 7일, 총 30일)에 맞춰 7일 단위 5회로 나눠 수집."""
    bars = []
    today = date.today()
    for back in range(4, -1, -1):
        end = today - timedelta(days=back * 7 - 1)
        start = end - timedelta(days=7)
        if (today - start).days > 29:
            start = today - timedelta(days=29)
        if start >= end:
            continue
        for attempt in range(3):
            try:
                df = yf.Ticker(symbol).history(start=str(start), end=str(end), interval="1m")
                break
            except Exception as e:
                print(f"    retry {attempt+1} {symbol} {start}~{end}: {e}", flush=True)
                time.sleep(2 * (attempt + 1))
        else:
            continue
        for ts, row in df.iterrows():
            bars.append({
                "ts": ts.isoformat(),
                "o": float(row["Open"]), "h": float(row["High"]),
                "l": float(row["Low"]), "c": float(row["Close"]),
                "v": float(row["Volume"]),
            })
        time.sleep(0.4)
    # 중복 제거(청크 경계) + 정렬
    seen, uniq = set(), []
    for b in sorted(bars, key=lambda x: x["ts"]):
        if b["ts"] not in seen:
            seen.add(b["ts"])
            uniq.append(b)
    return uniq


def fetch_daily(symbol: str):
    df = yf.Ticker(symbol).history(period="1y", interval="1d")
    out = []
    for ts, row in df.iterrows():
        out.append({
            "d": str(ts.date()),
            "o": float(row["Open"]), "h": float(row["High"]),
            "l": float(row["Low"]), "c": float(row["Close"]),
            "v": float(row["Volume"]),
        })
    return out


def main():
    total = sum(len(v) for v in TICKERS.values())
    n = 0
    for region, lst in TICKERS.items():
        for symbol, name in lst:
            n += 1
            out_file = OUT / f"{symbol}.json"
            if out_file.exists():
                print(f"[{n}/{total}] {symbol} {name} — 캐시 존재, 건너뜀", flush=True)
                continue
            print(f"[{n}/{total}] {symbol} {name} ({region}) 수집 중...", flush=True)
            try:
                m1 = fetch_1m(symbol)
                daily = fetch_daily(symbol)
                if len(m1) < 1000:
                    print(f"    경고: 1분봉 {len(m1)}개뿐 — 저장은 하되 build에서 QC", flush=True)
                out_file.write_text(json.dumps({
                    "symbol": symbol, "name": name, "region": region,
                    "market": "KRX", "bars1m": m1, "daily": daily,
                }, ensure_ascii=False), encoding="utf-8")
                print(f"    완료: 1분봉 {len(m1)}개, 일봉 {len(daily)}개", flush=True)
            except Exception as e:
                print(f"    실패: {e}", flush=True)
            time.sleep(0.6)
    print("수집 완료", flush=True)


if __name__ == "__main__":
    main()
