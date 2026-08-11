import json, pandas as pd
import config as cf

FACTORS = ["vol", "mom", "high", "vola", "flow"]

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

    df = pd.DataFrame(rows)
    for k in FACTORS:
        df[k + "_s"] = (df[k].rank(pct=True) * 100).round(1)
    df["total"] = df[[k + "_s" for k in FACTORS]].mean(axis=1)

    return [{
        "id": r["id"], "name": r["name"], "sub": sub, "chg": float(r["chg"]),
        "f": {k: float(r[k + "_s"]) for k in FACTORS},
    } for _, r in df.sort_values("total", ascending=False).head(top).iterrows()]

if __name__ == "__main__":
    kr = build("raw_kr.csv",
               {"close": "종가", "high": "고가", "low": "저가", "vol": "거래량"},
               "국내", cf.TOP_KR, cf.MIN_VALUE)

    coin = build("raw_coin.csv",
                 {"close": "trade_price", "high": "high_price",
                  "low": "low_price", "vol": "candle_acc_trade_volume"},
                 "업비트", cf.TOP_COIN)

    merged = kr + coin
    with open("heat_kr.json", "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    for m in merged:
        print(f"{m['sub']:5} {m['name']:12} {m['chg']:+.2f}%")
    print(f"\n{len(merged)}개 저장 → heat_kr.json")
