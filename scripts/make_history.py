"""과거 3개월 날짜별 상위 10개를 만든다. 이미 받아둔 raw_kr.csv를 재사용한다."""
import json
import pandas as pd

TOP = 10
LOOKBACK = 20        # 팩터 계산에 쓸 영업일
FACTORS = ["vol", "mom", "high", "vola", "flow"]

tk = pd.read_csv("tickers.csv", dtype={"code": str})
names = dict(zip(tk["code"], tk["name"]))

# --- 이미 받아둔 원본 재사용 (재수집 안 함) ---
raw = pd.read_csv("raw_kr.csv", dtype={"code": str})
raw["날짜"] = pd.to_datetime(raw["날짜"])
print("원본 로드 완료:", raw["code"].nunique(), "종목 /", raw["날짜"].nunique(), "거래일")

dates = sorted(raw["날짜"].unique())
new_history = {}

for di in range(LOOKBACK, len(dates)):
    day = dates[di]
    window = dates[di - LOOKBACK: di + 1]
    w = raw[raw["날짜"].isin(window)]

    rows = []
    for code, g in w.groupby("code"):
        g = g.sort_values("날짜")
        if len(g) < LOOKBACK:
            continue
        v, cl = g["거래량"], g["종가"]
        rng = (g["고가"] - g["저가"]) / cl
        val = cl * v
        if v.iloc[:-1].mean() == 0 or val.iloc[:-5].mean() == 0:
            continue
        rows.append({
            "code": code,
            "close": float(cl.iloc[-1]),
            "chg": round((cl.iloc[-1] / cl.iloc[-2] - 1) * 100, 2),
            "vol": v.iloc[-1] / v.iloc[:-1].mean(),
            "mom": cl.iloc[-1] / cl.iloc[0] - 1,
            "high": cl.iloc[-1] / g["고가"].max(),
            "vola": rng.iloc[-1] / rng.iloc[:-1].mean(),
            "flow": val.iloc[-5:].mean() / val.iloc[:-5].mean(),
        })

    if len(rows) < 50:
        continue

    df = pd.DataFrame(rows)
    for k in FACTORS:
        df[k + "_s"] = (df[k].rank(pct=True) * 100).round(1)
    df["total"] = df[[k + "_s" for k in FACTORS]].mean(axis=1)

    key = pd.Timestamp(day).strftime("%Y-%m-%d")
    new_history[key] = [{
        "id": r["code"],
        "name": names.get(r["code"], r["code"]),
        "close": r["close"],
        "chg": float(r["chg"]),
        "r1": None, "r5": None, "r20": None, "rnow": None,
        "f": {k: float(r[k + "_s"]) for k in FACTORS},
    } for _, r in df.sort_values("total", ascending=False).head(TOP).iterrows()]

print(f"\n{len(new_history)}일치 재현 완료")
if new_history:
    print("첫날:", list(new_history)[0], "/ 마지막:", list(new_history)[-1])

# --- 기존 history.json과 병합 (덮어쓰지 않음) ---
try:
    with open("../public/history.json", "r", encoding="utf-8") as f:
        hist = json.load(f)
        if not isinstance(hist, dict) or "all" not in hist:
            hist = {"all": {}, "large": {}, "mid": {}, "small": {}}
except FileNotFoundError:
    hist = {"all": {}, "large": {}, "mid": {}, "small": {}}

hist.setdefault("large", {})
hist.setdefault("mid", {})
hist.setdefault("small", {})

added = 0
for key, items in new_history.items():
    # 이미 실시간으로 쌓인 날짜(예: 8/18 이후)는 재현 데이터로 덮어쓰지 않는다
    if key not in hist["all"]:
        hist["all"][key] = items
        added += 1

with open("../public/history.json", "w", encoding="utf-8") as f:
    json.dump(hist, f, ensure_ascii=False, indent=1)

print(f"\n✓ 새로 추가된 날짜: {added}일")
print(f"✓ 전체 history.json 날짜 수: {len(hist['all'])}일")
