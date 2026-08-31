import json, pandas as pd
import config as cf
import datetime

FACTORS = ["vol", "mom", "high", "vola", "flow"]

def factors(g, col):
    v, cl = g[col["vol"]], g[col["close"]]
    rng = (g[col["high"]] - g[col["low"]]) / cl
    val = cl * v
    return {
        "vol":  v.iloc[-1] / v.iloc[:-1].mean() if len(v) > 1 else 0,
        "mom":  cl.iloc[-1] / cl.iloc[0] - 1 if len(cl) > 1 else 0,
        "high": cl.iloc[-1] / g[col["high"]].max() if g[col["high"]].max() > 0 else 0,
        "vola": rng.iloc[-1] / rng.iloc[:-1].mean() if len(rng) > 1 and rng.iloc[:-1].mean() != 0 else 0,
        "flow": val.iloc[-5:].mean() / val.iloc[:-5].mean() if len(val) > 5 and val.iloc[:-5].mean() != 0 else 0,
        "close": float(cl.iloc[-1]),
        "value": float(cl.iloc[-1] * v.iloc[-1]),
        "chg":   round((cl.iloc[-1] / cl.iloc[-2] - 1) * 100, 2) if len(cl) > 1 else 0,
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

def update_history():
    try:
        with open("../public/history.json", "r", encoding="utf-8") as f:
            hist = json.load(f)
            if isinstance(hist, dict) and "all" in hist:
                return hist
    except:
        pass
    return {"all": {}, "large": {}, "mid": {}}

if __name__ == "__main__":
    kr_list, kr_df = build("raw_kr.csv",
                           {"close": "종가", "high": "고가", "low": "저가", "vol": "거래량"},
                           "국내", 1500, cf.MIN_VALUE)
    
    coin_list, _ = build("raw_coin.csv",
                 {"close": "trade_price", "high": "high_price",
                  "low": "low_price", "vol": "candle_acc_trade_volume"},
                 "업비트", cf.TOP_COIN)

    kr_df_sorted = kr_df.sort_values("value", ascending=False)
    top_kr = kr_list[:cf.TOP_KR]
    
    def to_json(df_subset):
        return [{
            "id": r["id"], "name": r["name"], "sub": "국내", "chg": float(r["chg"]),
            "f": {k: float(r[k + "_s"]) for k in FACTORS},
        } for _, r in df_subset.iterrows()]
    
    all_stocks = to_json(kr_df_sorted)
    large = to_json(kr_df_sorted.iloc[:500])
    mid = to_json(kr_df_sorted.iloc[500:1000])

    merged = top_kr + coin_list
    
    output = {
        "updated": pd.Timestamp.now().isoformat(),
        "items": merged,
        "by_cap": {
            "all": all_stocks,
            "large": large,
            "mid": mid,
        }
    }

    with open("public/heat_kr.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    # history 업데이트
    hist = update_history()
    _today = datetime.datetime.now() + datetime.timedelta(hours=9)
    today_str = _today.strftime("%Y%m%d")
    
    if today_str not in hist["all"]:
        today_items = [{
            "id": r["id"], "name": r["name"], "chg": float(r["chg"]),
            "r1": None, "r5": None, "r20": None, "rnow": None,
            "f": r["f"]
        } for r in merged]
        
        hist["all"][today_str] = today_items
        
        # 시총별 필터
        large_ids = set(kr_df_sorted.iloc[:500]["id"])
        mid_ids = set(kr_df_sorted.iloc[500:1000]["id"])
        
        hist["large"][today_str] = [x for x in today_items if x["id"] in large_ids]
        hist["mid"][today_str] = [x for x in today_items if x["id"] in mid_ids]
    
    with open("../public/history.json", "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, indent=2)

    print(f"✓ heat_kr.json: {len(all_stocks)}개")
    print(f"✓ history.json: all={len(hist['all'])}, large={len(hist['large'])}, mid={len(hist['mid'])}")
