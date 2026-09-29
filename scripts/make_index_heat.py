"""
코스피/코스닥 지수 과열도 계산 (단기 5일 / 중기 20일 / 장기 60일).

개별 종목은 '같은 시점의 다른 종목들'과 비교해 백분위를 내지만,
지수는 비교 대상이 없으므로 '자기 자신의 과거 1년 대비 지금 위치'로 백분위를 낸다.

팩터 4개 (기간 n마다 계산):
  - 모멘텀      : 최근 n일 수익률
  - 거래대금 급증: 최근 n일 평균 거래대금 / 직전 3n일 평균
  - 고점 근접   : 종가 / 최근 3n일 최고가
  - 변동성 확대  : 최근 n일 평균 일중변동폭 / 직전 3n일 평균

결과: ../public/index_heat.json
"""
import json
import datetime
import pandas as pd
from pykrx import stock

INDEXES = {"kospi": ("1001", "코스피"), "kosdaq": ("2001", "코스닥")}
HORIZONS = {"short": 5, "mid": 20, "long": 60}
HIST = 250  # 백분위 비교 대상: 최근 250영업일(약 1년)

_now = datetime.datetime.now() + datetime.timedelta(hours=9)
END = _now.strftime("%Y%m%d")
START = (_now - datetime.timedelta(days=800)).strftime("%Y%m%d")


def factor_series(df, n):
    close, high, low = df["종가"], df["고가"], df["저가"]
    value = df["거래대금"]
    rng = (high - low) / close
    base = n * 3
    return {
        "mom": close / close.shift(n) - 1,
        "value": value.rolling(n).mean() / value.rolling(base).mean(),
        "high": close / high.rolling(base).max(),
        "vola": rng.rolling(n).mean() / rng.rolling(base).mean(),
    }


def percentile_of_last(s):
    s = s.dropna()
    if len(s) < 30:
        return None
    ref = s.iloc[-HIST:]
    return float((ref <= s.iloc[-1]).mean() * 100)


def status_of(score):
    if score >= 70:
        return "과열 주의"
    if score >= 40:
        return "관찰 필요"
    return "잠잠함"


def main():
    out = {"updated": _now.isoformat(), "indexes": {}}

    for key, (ticker, label) in INDEXES.items():
        df = stock.get_index_ohlcv_by_date(START, END, ticker)
        if df is None or len(df) < 100:
            print(f"{label}: 데이터 부족 (KRX 로그인 확인)")
            continue

        entry = {
            "name": label,
            "close": float(df["종가"].iloc[-1]),
            "chg": round(float((df["종가"].iloc[-1] / df["종가"].iloc[-2] - 1) * 100), 2),
            "date": df.index[-1].strftime("%Y%m%d"),
            "horizons": {},
            "returns": {},  # 종목-지수 괴리도 계산용 실제 등락률(%)
        }

        close = df["종가"]
        for hname, n in HORIZONS.items():
            if len(close) > n and close.iloc[-1 - n] != 0:
                entry["returns"][hname] = round(float(close.iloc[-1] / close.iloc[-1 - n] - 1) * 100, 2)

            pcts = {}
            for fname, series in factor_series(df, n).items():
                p = percentile_of_last(series)
                if p is not None:
                    pcts[fname] = round(p, 1)
            if not pcts:
                continue
            score = round(sum(pcts.values()) / len(pcts), 1)
            entry["horizons"][hname] = {
                "days": n,
                "score": score,
                "status": status_of(score),
                "factors": pcts,
            }

        out["indexes"][key] = entry
        print(f"\n[{label}] {entry['close']:,.2f} ({entry['chg']:+.2f}%) 기준일 {entry['date']}")
        for hname, h in entry["horizons"].items():
            print(f"  {hname:5s} ({h['days']}일): {h['score']:5.1f} / 100  {h['status']}  {h['factors']}")

    with open("../public/index_heat.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\n✓ 저장 완료: ../public/index_heat.json")


if __name__ == "__main__":
    main()
