"""
theme_seed.py의 종목명들을 tickers.csv(실제 상장 종목코드)와 매칭한다.
매칭 성공한 것만 theme_map.csv로 저장하고, 매칭 실패한 이름은 화면에 출력해서
오타/상장폐지/합병/띄어쓰기 차이 등을 확인할 수 있게 한다.

한 종목이 여러 테마에 속할 수 있으므로(예: 삼성전자가 반도체+로봇),
결과는 "종목당 여러 행"이 아니라 "종목당 한 행 + 테마 리스트(콤마 구분)"으로 저장한다.
"""
import pandas as pd
from theme_seed import THEMES

def normalize(name):
    return name.replace(" ", "").replace(".", "").upper()

if __name__ == "__main__":
    tickers = pd.read_csv("tickers.csv", dtype={"code": str})
    name_to_code = {}
    for _, row in tickers.iterrows():
        name_to_code[normalize(row["name"])] = (row["code"], row["name"])

    code_to_themes = {}
    unmatched = []

    for theme, names in THEMES.items():
        for seed_name in names:
            key = normalize(seed_name)
            if key in name_to_code:
                code, real_name = name_to_code[key]
                if code not in code_to_themes:
                    code_to_themes[code] = {"name": real_name, "themes": []}
                if theme not in code_to_themes[code]["themes"]:
                    code_to_themes[code]["themes"].append(theme)
            else:
                unmatched.append((theme, seed_name))

    rows = []
    for code, info in code_to_themes.items():
        rows.append({
            "code": code,
            "name": info["name"],
            "themes": ", ".join(info["themes"]),
            "theme_count": len(info["themes"]),
        })

    result_df = pd.DataFrame(rows).sort_values("name")
    result_df.to_csv("theme_map.csv", index=False, encoding="utf-8-sig")

    total_seed = sum(len(v) for v in THEMES.values())
    print(f"시드 종목명 총 개수(중복 포함): {total_seed}")
    print(f"매칭 성공 (고유 종목코드 기준): {len(code_to_themes)}개")
    print(f"매칭 실패: {len(unmatched)}개")
    print(f"저장 완료: theme_map.csv")

    if unmatched:
        print("\n=== 매칭 실패 목록 (테마: 종목명) ===")
        for theme, name in unmatched:
            print(f"  [{theme}] {name}")

    print("\n=== 테마별 매칭 종목 수 ===")
    for theme in THEMES:
        cnt = sum(1 for info in code_to_themes.values() if theme in info["themes"])
        print(f"  {theme}: {cnt}개")
