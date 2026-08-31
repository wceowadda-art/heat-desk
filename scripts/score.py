import json, pandas as pd
import config as cf
import os

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

    scored = [{
        "id": r["id"], "name": r["name"], "sub": sub, "chg": float(r["chg"]),
        "f": {k: float(r[k + "_s"]) for k in FACTORS},
    } for _, r in df.iterrows()]
    
    return scored, df

if __name__ == "__main__":
    kr_list, kr_df = build("raw_kr.csv",
                           {"close": "종가", "high": "고가", "low": "저가", "vol": "거래량"},
                           "국내", 1500, cf.MIN_VALUE)
    
    coin_list, _ = build("raw_coin.csv",
                 {"close": "trade_price", "high": "high_price",
                  "low": "low_price", "vol": "candle_acc_trade_volume"},
                 "업비트", cf.TOP_COIN)

    # 시총 기준 정렬
    kr_df_sorted = kr_df.sort_values("value", ascending=False)
    
    # 상위 종합 (기존처럼)
    top_kr = kr_list[:cf.TOP_KR]
    
    # 시총별 분류
    def to_json(df_subset):
        return [{
            "id": r["id"], "name": r["name"], "sub": "국내", "chg": float(r["chg"]),
            "f": {k: float(r[k + "_s"]) for k in FACTORS},
        } for _, r in df_subset.iterrows()]
    
    all_stocks = to_json(kr_df_sorted)
    large = to_json(kr_df_sorted.iloc[:500])      # 1~500
    mid = to_json(kr_df_sorted.iloc[500:1000])    # 500~1000
    small = to_json(kr_df_sorted.iloc[1000:])     # 1000~1500

    merged = top_kr + coin_list
    
    output = {
        "updated": pd.Timestamp.now().isoformat(),
        "items": merged,
        "by_cap": {
            "all": all_stocks,
            "large": large,
            "mid": mid,
            "small": small,
        }
    }

    with open("public/heat_kr.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✓ 전체: {len(all_stocks)}개")
    print(f"✓ 대형주(1~500): {len(large)}개")
    print(f"✓ 중형주(500~1000): {len(mid)}개")
    print(f"✓ 소형주(1000~1500): {len(small)}개")
