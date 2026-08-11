import time, requests, pandas as pd
from pykrx import stock
import config as cf

def fetch_kr():
    t = pd.read_html(
        "http://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13",
        header=0, encoding="euc-kr")[0]
    t["종목코드"] = t["종목코드"].astype(str).str.zfill(6)
    names = dict(zip(t["종목코드"], t["회사명"]))

    codes = [c for c in t["종목코드"] if c.isdigit() and c.endswith("0")]
    if cf.MAX_STOCKS:
        import random
        random.seed(1)
        codes = random.sample(codes, cf.MAX_STOCKS)

    out, fail = [], 0
    for i, c in enumerate(codes):
        try:
            d = stock.get_market_ohlcv(cf.START, cf.END, c)
            if len(d) > 10:
                d = d.reset_index()
                d["code"] = c
                d["name"] = names.get(c, c)
                out.append(d)
        except Exception:
            fail += 1
        if i % 30 == 0:
            print(f"  국내 {i}/{len(codes)}")
        time.sleep(cf.SLEEP)

    df = pd.concat(out, ignore_index=True)
    df.to_csv("raw_kr.csv", index=False, encoding="utf-8-sig")
    print(f"국내 저장 완료: {df['code'].nunique()}종목 / 실패 {fail}")

def fetch_coin():
    out = []
    for m in cf.COINS:
        try:
            r = requests.get("https://api.upbit.com/v1/candles/days",
                             params={"market": m, "count": 30}, timeout=10)
            d = pd.DataFrame(r.json()).iloc[::-1].reset_index(drop=True)
            d["code"] = m.replace("KRW-", "")
            out.append(d)
        except Exception as e:
            print("  실패", m, e)
        time.sleep(0.15)

    df = pd.concat(out, ignore_index=True)
    df.to_csv("raw_coin.csv", index=False, encoding="utf-8-sig")
    print(f"코인 저장 완료: {df['code'].nunique()}개")

if __name__ == "__main__":
    fetch_kr()
    fetch_coin()
