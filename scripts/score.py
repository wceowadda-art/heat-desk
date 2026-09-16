import json, pandas as pd
import config as cf
import datetime
import math
import os

FACTORS = ["vol", "mom", "high", "vola", "flow"]

def factors(g, col):
    v, cl = g[col["vol"]], g[col["close"]]
    rng = (g[col["high"]] - g[col["low"]]) / cl
    val = cl * v
    return {
        "vol":  v.iloc[-1] / v.iloc[:-1].mean() if len(v) > 1 and v.iloc[:-1].mean() != 0 else 0,
        "mom":  cl.iloc[-1] / cl.iloc[0] - 1 if len(cl) > 1 and cl.iloc[0] != 0 else 0,
        "high": cl.iloc[-1] / g[col["high"]].max() if g[col["high"]].max() > 0 else 0,
        "vola": rng.iloc[-1] / rng.iloc[:-1].mean() if len(rng) > 1 and rng.iloc[:-1].mean() != 0 else 0,
        "flow": val.iloc[-5:].mean() / val.iloc[:-5].mean() if len(val) > 5 and val.iloc[:-5].mean() != 0 else 0,
        "close": float(cl.iloc[-1]),
        "value": float(cl.iloc[-1] * v.iloc[-1]),
        "chg":   round((cl.iloc[-1] / cl.iloc[-2] - 1) * 100, 2) if len(cl) > 1 and cl.iloc[-2] != 0 else 0,
    }

def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj

def load_company_scores():
    if not os.path.exists("corp_score.csv"):
        return {}
    df = pd.read_csv("corp_score.csv", dtype={"code": str})
    return dict(zip(df["code"], df["company_score"]))

def load_disclosures():
    if not os.path.exists("disclosures.csv"):
        return {}
    df = pd.read_csv("disclosures.csv", dtype={"code": str})
    result = {}
    for _, r in df.iterrows():
        if bool(r["has_recent_disclosure"]):
            result[r["code"]] = {
                "has": True,
                "date": r["latest_date"],
                "type": r["latest_type"],
                "types": r["all_types"],
                "count": int(r["count"]),
            }
    return result

def load_themes():
    if not os.path.exists("theme_map.csv"):
        return {}
    df = pd.read_csv("theme_map.csv", dtype={"code": str})
    result = {}
    for _, r in df.iterrows():
        themes_str = r.get("themes", "")
        if isinstance(themes_str, str) and themes_str.strip():
            result[r["code"]] = [t.strip() for t in themes_str.split(",")]
    return result

def load_theme_buzz():
    if not os.path.exists("theme_buzz.csv"):
        return {}
    df = pd.read_csv("theme_buzz.csv")
    result = {}
    for _, r in df.iterrows():
        result[r["theme"]] = {
            "grade": int(r["grade"]),
            "grade_label": r["grade_label"],
            "note": r["note"],
            "checked_date": r["checked_date"],
        }
    return result

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
    df = df.dropna(subset=FACTORS)
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
                hist.setdefault("large", {})
                hist.setdefault("mid", {})
                hist.setdefault("small", {})
                return hist
    except:
        pass
    return {"all": {}, "large": {}, "mid": {}, "small": {}}

if __name__ == "__main__":
    kr_list, kr_df = build("raw_kr.csv",
                           {"close": "종가", "high": "고가", "low": "저가", "vol": "거래량"},
                           "국내", 1500, 0)

    company_scores = load_company_scores()
    disclosures = load_disclosures()
    themes = load_themes()
    theme_buzz = load_theme_buzz()
    print(f"기업 체력 점수 로드: {len(company_scores)}개")
    print(f"공시 정보 로드: {len(disclosures)}개")
    print(f"테마 정보 로드: {len(themes)}개")
    print(f"테마 화제성 로드: {len(theme_buzz)}개 (전체 30개 중)")

    coin_list, _ = build("raw_coin.csv",
                 {"close": "trade_price", "high": "high_price",
                  "low": "low_price", "vol": "candle_acc_trade_volume"},
                 "업비트", cf.TOP_COIN)

    kr_df_by_cap = kr_df.sort_values("value", ascending=False).reset_index(drop=True)
    top_kr = kr_list[:cf.TOP_KR]

    def attach_extra(item, code):
        comp_score = company_scores.get(code)
        if comp_score is not None and not (isinstance(comp_score, float) and math.isnan(comp_score)):
            item["company"] = round(float(comp_score), 1)

        disc = disclosures.get(code)
        if disc:
            item["event"] = {
                "has": True,
                "date": disc["date"],
                "type": disc["type"],
                "types": disc["types"],
                "count": disc["count"],
            }

        theme_list = themes.get(code)
        if theme_list:
            item["themes"] = theme_list
            buzz_info = []
            for t in theme_list:
                if t in theme_buzz:
                    buzz_info.append({"theme": t, **theme_buzz[t]})
            if buzz_info:
                item["theme_buzz"] = buzz_info

        return item

    def to_json_sorted_by_score(df_subset):
        df_subset = df_subset.sort_values("total", ascending=False)
        result = []
        for _, r in df_subset.iterrows():
            item = {
                "id": r["id"], "name": r["name"], "sub": "국내", "chg": float(r["chg"]),
                "f": {k: float(r[k + "_s"]) for k in FACTORS},
            }
            item = attach_extra(item, r["id"])
            result.append(item)
        return result

    all_stocks = to_json_sorted_by_score(kr_df_by_cap)

    large_df = kr_df_by_cap.iloc[:500]
    mid_df = kr_df_by_cap.iloc[500:1000]
    small_df = kr_df_by_cap.iloc[1000:2000]

    large = to_json_sorted_by_score(large_df)
    mid = to_json_sorted_by_score(mid_df)
    small = to_json_sorted_by_score(small_df)

    top_kr = [attach_extra(item, item["id"]) for item in top_kr]
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
    output = clean_nan(output)

    with open("../public/heat_kr.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

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

        large_ids = set(kr_df_by_cap.iloc[:500]["id"])
        mid_ids = set(kr_df_by_cap.iloc[500:1000]["id"])
        small_ids = set(kr_df_by_cap.iloc[1000:2000]["id"])

        hist["large"][today_str] = [x for x in today_items if x["id"] in large_ids]
        hist["mid"][today_str] = [x for x in today_items if x["id"] in mid_ids]
        hist["small"][today_str] = [x for x in today_items if x["id"] in small_ids]

    hist = clean_nan(hist)
    with open("../public/history.json", "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, indent=2)

    with_company = sum(1 for x in all_stocks if "company" in x)
    with_event = sum(1 for x in all_stocks if "event" in x)
    with_theme = sum(1 for x in all_stocks if "themes" in x)
    with_buzz = sum(1 for x in all_stocks if "theme_buzz" in x)
    print(f"✓ heat_kr.json: all={len(all_stocks)} (기업점수={with_company}, 공시={with_event}, 테마={with_theme}, 화제성={with_buzz})")
    print(f"✓ history.json updated")
