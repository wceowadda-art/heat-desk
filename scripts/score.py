import json, pandas as pd
import config as cf
import datetime
import math
import os

FACTORS = ["vol", "mom", "high", "vola", "flow"]

HORIZON_DAYS = {"short": 5, "mid": 20, "long": 60}

def factors(g, col):
    v, cl = g[col["vol"]], g[col["close"]]
    rng = (g[col["high"]] - g[col["low"]]) / cl
    val = cl * v
    out = {
        "vol":  v.iloc[-1] / v.iloc[:-1].mean() if len(v) > 1 and v.iloc[:-1].mean() != 0 else 0,
        "mom":  cl.iloc[-1] / cl.iloc[0] - 1 if len(cl) > 1 and cl.iloc[0] != 0 else 0,
        "high": cl.iloc[-1] / g[col["high"]].max() if g[col["high"]].max() > 0 else 0,
        "vola": rng.iloc[-1] / rng.iloc[:-1].mean() if len(rng) > 1 and rng.iloc[:-1].mean() != 0 else 0,
        "flow": val.iloc[-5:].mean() / val.iloc[:-5].mean() if len(val) > 5 and val.iloc[:-5].mean() != 0 else 0,
        "close": float(cl.iloc[-1]),
        "value": float(cl.iloc[-1] * v.iloc[-1]),
        "chg":   round((cl.iloc[-1] / cl.iloc[-2] - 1) * 100, 2) if len(cl) > 1 and cl.iloc[-2] != 0 else 0,
    }
    # 종목 자체의 기간별 수익률 (지수 괴리도 계산용). 데이터가 그 기간만큼 없으면 생략한다.
    for hname, n in HORIZON_DAYS.items():
        if len(cl) > n and cl.iloc[-1 - n] != 0:
            out[f"ret_{hname}"] = round(float(cl.iloc[-1] / cl.iloc[-1 - n] - 1) * 100, 2)
    return out

def clean_nan(obj):
    if isinstance(obj, dict):
        return {k: clean_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_nan(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj

def load_company_scores():
    """corp_score.csv에서 종합점수뿐 아니라 세부 백분위(영업이익률/매출규모/부채비율/유동비율)도 같이 읽는다.
    스크리너에서 세부 지표로 걸러 쓸 수 있게 하기 위함. 컬럼이 없으면 조용히 건너뛴다."""
    if not os.path.exists("corp_score.csv"):
        return {}
    df = pd.read_csv("corp_score.csv", dtype={"code": str})
    detail_cols = ["operating_margin_pct", "revenue_pct", "debt_ratio_pct", "current_ratio_pct"]
    result = {}
    for _, r in df.iterrows():
        entry = {"score": r["company_score"]}
        for col in detail_cols:
            if col in df.columns and pd.notna(r.get(col)):
                entry[col] = float(r[col])
        result[r["code"]] = entry
    return result

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

# 공시 안전성 점수(0~100). 공시 자체의 호재/악재를 판정하는 게 아니라,
# "통상 어떤 방향으로 받아들여지는 경우가 많은지"를 교과서적으로 환산한 값이다.
# Diagnose.jsx의 DISCLOSURE_INFO 설명과 같은 분류 기준을 쓴다.
# 긍정적으로 해석되는 경우가 많은 유형 -> 높은 점수, 지분희석/부정적 유형 -> 낮은 점수.
EVENT_SAFETY_BY_TYPE = {
    "자기주식취득결정": 75,
    "자기주식취득신탁계약체결결정": 75,
    "자기전환사채만기전취득결정": 70,
    "유형자산양수결정": 60,
    "타법인주식및출자증권양수결정": 55,
    "자기주식처분결정": 45,
    "자기주식취득신탁계약해지결정": 45,
    "타법인주식및출자증권양도결정": 45,
    "유형자산양도결정": 45,
    "회사합병결정": 40,
    "상각형조건부자본증권발행결정": 35,
    "전환사채권발행결정": 25,
    "유상증자결정": 20,
    "영업정지": 5,
}
EVENT_SAFETY_DEFAULT = 50  # 목록에 없는 유형(분류 안 된 공시)
EVENT_SAFETY_NONE = 100    # 최근 60일 공시 없음

def event_safety_score(event):
    """event: attach_extra에서 만든 {"has":True,"type":...} 딕셔너리 또는 None."""
    if not event or not event.get("has"):
        return EVENT_SAFETY_NONE
    return EVENT_SAFETY_BY_TYPE.get(event.get("type"), EVENT_SAFETY_DEFAULT)

def load_flow():
    """flow.csv(투자자별 순매수)를 읽어온다. 아직 전 종목이 아니라 일부 종목만 있을 수 있는데,
    없는 종목은 그냥 데이터를 안 붙이고 프론트에서 '자료 없음'으로 처리한다."""
    if not os.path.exists("flow.csv"):
        return {}
    df = pd.read_csv("flow.csv", dtype={"code": str})
    result = {}
    for _, r in df.iterrows():
        vals = {
            "f_net_5": r.get("f_net_5"), "f_net_20": r.get("f_net_20"),
            "i_net_5": r.get("i_net_5"), "i_net_20": r.get("i_net_20"),
            "p_net_5": r.get("p_net_5"), "p_net_20": r.get("p_net_20"),
        }
        # 전부 NaN이면(해당 종목 수집 실패) 아예 건너뛴다.
        if all(pd.isna(v) for v in vals.values()):
            continue
        result[r["code"]] = {k: (None if pd.isna(v) else float(v)) for k, v in vals.items()}
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

def load_index_returns():
    """index_heat.json(코스피/코스닥 과열도)에서 종목 쪽에는 없는 '기간 수익률'만 뽑아온다.
    make_index_heat.py가 저장하는 팩터 백분위와 달리, 여기서는 실제 등락률이 필요해서
    index_heat.json에 있으면 쓰고, 없으면 종목 쪽에서 지수 괴리도를 계산하지 않는다."""
    path = "../public/index_heat.json"
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    result = {}
    for key, entry in (data.get("indexes") or {}).items():
        rets = entry.get("returns")  # {"short": %, "mid": %, "long": %} 형태를 기대
        if rets:
            result[key] = rets
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
    flow = load_flow()
    print(f"기업 체력 점수 로드: {len(company_scores)}개")
    print(f"공시 정보 로드: {len(disclosures)}개")
    print(f"테마 정보 로드: {len(themes)}개")
    print(f"테마 화제성 로드: {len(theme_buzz)}개 (전체 30개 중)")
    print(f"수급 정보 로드: {len(flow)}개 (아직 전 종목 아님, 수집 진행 중)")

    coin_list, _ = build("raw_coin.csv",
                 {"close": "trade_price", "high": "high_price",
                  "low": "low_price", "vol": "candle_acc_trade_volume"},
                 "업비트", cf.TOP_COIN)

    kr_df_by_cap = kr_df.sort_values("value", ascending=False).reset_index(drop=True)
    top_kr = kr_list[:cf.TOP_KR]

    def attach_extra(item, code):
        comp = company_scores.get(code)
        if comp is not None:
            score_val = comp.get("score")
            if score_val is not None and not (isinstance(score_val, float) and math.isnan(score_val)):
                item["company"] = round(float(score_val), 1)
            fin = {}
            if "operating_margin_pct" in comp:
                fin["margin"] = round(comp["operating_margin_pct"], 1)
            if "revenue_pct" in comp:
                fin["revenue"] = round(comp["revenue_pct"], 1)
            if "debt_ratio_pct" in comp:
                fin["debt"] = round(comp["debt_ratio_pct"], 1)
            if "current_ratio_pct" in comp:
                fin["current"] = round(comp["current_ratio_pct"], 1)
            if fin:
                item["fin"] = fin

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

        f = flow.get(code)
        if f:
            # 원 단위 금액 대신 방향(+면 순매수, -면 순매도)과 대략적 규모만 넘긴다.
            # 아직 전 종목이 아니라 일부만 있으므로, 없는 종목은 필드 자체를 생략해
            # 프론트에서 "수급 자료 없음"으로 자연스럽게 처리되게 한다.
            item["flow"] = {
                "foreign_5": f["f_net_5"], "foreign_20": f["f_net_20"],
                "inst_5": f["i_net_5"], "inst_20": f["i_net_20"],
                "retail_5": f["p_net_5"], "retail_20": f["p_net_20"],
            }

        # 4축(시장/기업/공시안전성/테마화제성) 레이더 차트 + 사용자 커스텀 종합점수용.
        # 기업 체력과 테마는 데이터가 없는 종목이 많아 None으로 두고, 프론트에서
        # "자료 없음"으로 표시하거나 가중치 계산에서 자동 제외하게 한다.
        market_vals = list(item.get("f", {}).values())
        market_score = round(sum(market_vals) / len(market_vals), 1) if market_vals else None

        theme_axis = None
        if item.get("theme_buzz"):
            grades = [b["grade"] for b in item["theme_buzz"]]
            theme_axis = round((sum(grades) / len(grades)) * 20, 1)  # 1~5 -> 20~100

        item["axes"] = {
            "market": market_score,
            "company": item.get("company"),
            "event": event_safety_score(item.get("event")),
            "theme": theme_axis,
        }

        return item

    index_returns = load_index_returns()
    # 코스피 기준으로 괴리도를 계산한다. 종목별 실제 소속 시장(코스피/코스닥) 구분은
    # 아직 데이터에 없어서, 다음 단계에서 시장 구분이 생기면 더 정교하게 나눌 수 있다.
    kospi_returns = index_returns.get("kospi", {})

    def to_json_sorted_by_score(df_subset):
        df_subset = df_subset.sort_values("total", ascending=False)
        result = []
        for _, r in df_subset.iterrows():
            item = {
                "id": r["id"], "name": r["name"], "sub": "국내", "chg": float(r["chg"]),
                "close": float(r["close"]),
                "f": {k: float(r[k + "_s"]) for k in FACTORS},
            }
            if kospi_returns:
                gap = {}
                for hname in HORIZON_DAYS:
                    stock_ret = r.get(f"ret_{hname}")
                    idx_ret = kospi_returns.get(hname)
                    if stock_ret is not None and not (isinstance(stock_ret, float) and math.isnan(stock_ret)) and idx_ret is not None:
                        gap[hname] = round(float(stock_ret) - float(idx_ret), 2)
                if gap:
                    item["gap"] = gap  # 같은 기간 코스피 대비 초과 수익률(%p). 양수면 지수보다 더 올랐다는 뜻
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
