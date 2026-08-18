import json, datetime, os
import pandas as pd
import config as cf

FACTORS = ["vol", "mom", "high", "vola", "flow"]
HIST_PATH = "../public/history.json"
HORIZONS = {"r1": 1, "r5": 5, "r20": 20}


def factors(g, col):
    v, cl = g[col["vol"]], g[col["close"]]
    rng = (g[col["high"]] - g[col["low"]]) / cl
    val = cl * v
    return {
        "vol":  v.iloc[-1] / v.iloc[:-1].mean(),
        "mom":  cl.iloc[-1] / cl.iloc[0] - 1,
        "high": cl.iloc[-1] / g[col["high"]].max(),
        "vola": rng.iloc[-1] / rng.iloc[:-1].mean(),
        "flow": val.iloc[-5:].mean() / val.iloc[:-5].mean(),
        "close": float(cl.iloc[-1]),
        "value": float(cl.iloc[-1] * v.iloc[-1]),
        "chg":   round((cl.iloc[-1] / cl.iloc[-2] - 1) * 100, 2),
    }


def build(path, col, sub, top, min_value=0):
    if top <= 0 or not os.path.exists(path):
        return []

    raw = pd.read_csv(path, dtype={"code": str})
    rows = []
    for code, g in raw.groupby("code"):
        if len(g) < 10:
            continue
        f = factors(g.reset_index(drop=True), col)
        if f["value"] < min_value:
            continue
        f["id"] = code
        f["name"] = g["name"].iloc[-1] if "name" in g else code
        rows.append(f)

    if not rows:
        return []

    df = pd.DataFrame(rows)
    for k in FACTORS:
        df[k + "_s"] = (df[k].rank(pct=True) * 100).round(1)
    df["total"] = df[[k + "_s" for k in FACTORS]].mean(axis=1)

    return [{
        "id": r["id"], "name": r["name"], "sub": sub,
        "chg": float(r["chg"]), "close": float(r["close"]),
        "f": {k: float(r[k + "_s"]) for k in FACTORS},
    } for _, r in df.sort_values("total", ascending=False).head(top).iterrows()]


def update_history(kr_top):
    """오늘 기록을 추가하고, 과거 기록의 빈 수익률을 채운다."""
    raw = pd.read_csv("raw_kr.csv", dtype={"code": str})
    raw["날짜"] = pd.to_datetime(raw["날짜"])
    px = raw.pivot_table(index="날짜", columns="code", values="종가")
    dates = list(px.index)
    today = dates[-1]
    key = today.strftime("%Y-%m-%d")

    hist = {}
    if os.path.exists(HIST_PATH):
        with open(HIST_PATH, encoding="utf-8") as f:
            hist = json.load(f)

    # 오늘 기록 추가 (이미 있으면 덮어씀)
    hist[key] = [{
        "id": it["id"], "name": it["name"], "close": it["close"],
        "chg": it["chg"], "f": it["f"],
        "r1": None, "r5": None, "r20": None, "rnow": None,
    } for it in kr_top[:10]]

    # 과거 기록의 빈 수익률 채우기
    filled = 0
    for k, items in hist.items():
        base_day = pd.Timestamp(k)
        if base_day not in px.index:
            continue                      # 오래돼서 raw_kr.csv에 없는 날은 건너뜀
        i = dates.index(base_day)

        for it in items:
            c, base = it["id"], it.get("close")
            if not base or c not in px.columns:
                continue

            for field, gap in HORIZONS.items():
                if it.get(field) is not None:
                    continue              # 이미 채워진 값은 건드리지 않음
                j = i + gap
                if j < len(dates):
                    v = px[c].iloc[j]
                    if not pd.isna(v):
                        it[field] = round((v / base - 1) * 100, 2)
                        filled += 1

            v = px[c].iloc[-1]             # 현재까지는 매일 갱신
            if not pd.isna(v):
                it["rnow"] = round((v / base - 1) * 100, 2)

    with open(HIST_PATH, "w", encoding="utf-8") as f:
        json.dump(dict(sorted(hist.items())), f, ensure_ascii=False, indent=1)

    print(f"이력: {len(hist)}일 / 오늘({key}) 추가 / 수익률 {filled}건 채움")


if __name__ == "__main__":
    kr = build("raw_kr.csv",
               {"close": "종가", "high": "고가", "low": "저가", "vol": "거래량"},
               "국내", max(cf.TOP_KR, 10), cf.MIN_VALUE)

    coin = build("raw_coin.csv",
                 {"close": "trade_price", "high": "high_price",
                  "low": "low_price", "vol": "candle_acc_trade_volume"},
                 "업비트", cf.TOP_COIN)

    merged = kr[:cf.TOP_KR] + coin

    # --- 이상 감지 ---
    if len(merged) < 5:
        raise SystemExit(f"결과가 너무 적습니다: {len(merged)}개")

    raw_kr = pd.read_csv("raw_kr.csv", dtype={"code": str})
    n_kr = raw_kr["code"].nunique()
    if n_kr < 300:
        raise SystemExit(f"수집 종목이 비정상입니다: {n_kr}개")

    # --- 오늘 랭킹 저장 ---
    payload = {
        "updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "items": merged,
    }
    with open("heat_kr.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # --- 이력 갱신 ---
    update_history(kr)

    for m in merged:
        print(f"{m['sub']:5} {m['name']:12} {m['chg']:+.2f}%")
    print(f"\n검사 통과: {n_kr}종목 → {len(merged)}개 출력")
