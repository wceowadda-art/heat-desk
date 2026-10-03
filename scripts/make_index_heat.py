"""
코스피/코스닥 지수 과열도(= HEAT DESK의 "공탐지수") 계산.

[v2 - 온도계 UI용 데이터 추가]
기존 short/5일·mid/20일·long/60일 구조는 그대로 두고(score.py가 returns를 쓰고 있어서
깨면 안 됨), 거기에 더해 "오늘의 온도"(mid=20일 기준) 하나를 대표값으로 뽑아서:
  1) 최근 90거래일 동안 이 온도가 어떻게 움직였는지(history)
  2) 그 온도를 구성하는 4개 지표 분해(breakdown)
  3) 과거에 비슷한 온도였던 날들 각각의, 그 뒤 20일 수익률을 모아 평균 낸 표(backtest)
를 추가한다. 전부 과거 관찰치 통계이지, 미래를 맞히는 예측이 아니다.

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
HIST = 250          # 백분위 비교 대상: 최근 250영업일(약 1년)
TEMP_HORIZON = 20   # "오늘의 온도" 대표값으로 쓸 기간(= mid와 동일)
TREND_DAYS = 90      # 온도계 클릭 시 보여줄 추이 길이
BACKTEST_FWD = 20    # 과거 성적 계산에 쓸 "그 뒤 며칠" 수익률

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
    """3단계(기존 horizons 표시용. score.py나 다른 화면이 참조할 수 있어 그대로 유지)."""
    if score >= 70:
        return "과열 주의"
    if score >= 40:
        return "관찰 필요"
    return "잠잠함"


def status5_of(score):
    """5단계(온도계 라벨용). CNN Fear & Greed 식 5단계를 빌렸다."""
    if score >= 80:
        return "극단적 탐욕"
    if score >= 60:
        return "탐욕"
    if score >= 40:
        return "중립"
    if score >= 20:
        return "공포"
    return "극단적 공포"


def rolling_percentile_series(s, hist=HIST):
    """s의 각 시점에서, 그 시점 기준 과거 hist개 구간 내 백분위를 돌려준다(최근 필요한 구간만).
    계산량을 줄이려고 전체가 아니라 필요한 구간만 돈다."""
    s = s.dropna()
    out = {}
    need = TREND_DAYS + 400  # 백테스트용으로 더 과거까지 필요해서 넉넉히
    idxs = s.index[-need:] if len(s) > need else s.index
    for dt in idxs:
        pos = s.index.get_loc(dt)
        window = s.iloc[max(0, pos - hist + 1):pos + 1]
        if len(window) < 30:
            continue
        out[dt] = float((window <= s.loc[dt]).mean() * 100)
    return out


def compute_temp_series(df):
    """TEMP_HORIZON(20일) 기준 4팩터 평균 = '오늘의 온도'를, 최근 구간 전체에 대해 날짜별로 계산한다."""
    factors = factor_series(df, TEMP_HORIZON)
    pct_series = {name: rolling_percentile_series(s) for name, s in factors.items()}

    if not all(pct_series.values()):
        return {}, {}

    common_dates = set.intersection(*[set(p.keys()) for p in pct_series.values()])
    dates = sorted(common_dates)
    temp = {}
    breakdown = {}
    for dt in dates:
        vals = {name: pct_series[name][dt] for name in pct_series}
        temp[dt] = sum(vals.values()) / len(vals)
        breakdown[dt] = vals
    return temp, breakdown


def backtest_table(temp, close):
    """온도 구간(버킷)별로, 그날로부터 BACKTEST_FWD일 뒤 수익률을 모아 평균 낸다.
    '이 온도였던 과거엔 평균 이랬다'는 관찰 통계이지, 예측이 아니다."""
    buckets = [
        (0, 20, "극단적 공포"), (20, 40, "공포"), (40, 60, "중립"),
        (60, 80, "탐욕"), (80, 101, "극단적 탐욕"),
    ]
    rows = []
    close_idx = {d: i for i, d in enumerate(close.index)}

    for lo, hi, label in buckets:
        rets = []
        for dt, score in temp.items():
            if not (lo <= score < hi):
                continue
            pos = close_idx.get(dt)
            if pos is None or pos + BACKTEST_FWD >= len(close):
                continue
            fwd = close.iloc[pos + BACKTEST_FWD] / close.iloc[pos] - 1
            rets.append(fwd)
        rows.append({
            "bucket": label,
            "count": len(rets),
            "avg_fwd_return": round(float(sum(rets) / len(rets) * 100), 2) if rets else None,
        })
    return rows


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
            "returns": {},
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

        # 온도계용: 오늘의 온도, 90일 추이, 4지표 분해, 과거 성적
        temp, breakdown = compute_temp_series(df)
        if temp:
            last_dt = max(temp.keys())
            today_score = round(temp[last_dt], 1)
            entry["temperature"] = {
                "score": today_score,
                "label": status5_of(today_score),
                "breakdown": {k: round(v, 1) for k, v in breakdown[last_dt].items()},
            }
            trend_dates = sorted(temp.keys())[-TREND_DAYS:]
            entry["temp_trend"] = [
                {"date": dt.strftime("%Y%m%d"), "score": round(temp[dt], 1)} for dt in trend_dates
            ]
            entry["backtest"] = backtest_table(temp, close)
        else:
            print(f"{label}: 온도계 데이터 계산에 필요한 기간이 부족합니다.")

        out["indexes"][key] = entry
        print(f"\n[{label}] {entry['close']:,.2f} ({entry['chg']:+.2f}%) 기준일 {entry['date']}")
        for hname, h in entry["horizons"].items():
            print(f"  {hname:5s} ({h['days']}일): {h['score']:5.1f} / 100  {h['status']}  {h['factors']}")
        if "temperature" in entry:
            t = entry["temperature"]
            print(f"  오늘의 온도: {t['score']}도 ({t['label']})  구성: {t['breakdown']}")
            print(f"  과거 성적(그 뒤 {BACKTEST_FWD}일 평균):")
            for row in entry["backtest"]:
                avg = f"{row['avg_fwd_return']:+.2f}%" if row["avg_fwd_return"] is not None else "표본 부족"
                print(f"    {row['bucket']:8s} (표본 {row['count']:3d}개): {avg}")

    with open("../public/index_heat.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\n✓ 저장 완료: ../public/index_heat.json")


if __name__ == "__main__":
    main()
