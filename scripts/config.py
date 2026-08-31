import datetime

# 오늘 기준으로 자동 설정
_today = datetime.datetime.now() + datetime.timedelta(hours=9)   # KST
END   = _today.strftime("%Y%m%d")
START = (_today - datetime.timedelta(days=75)).strftime("%Y%m%d")

MAX_STOCKS = None           # 티커 목록 전부 사용
MIN_VALUE  = 0  # 최소 거래대금(원)
SLEEP      = 0.4            # 호출 간격(초)

TOP_KR   = 20
TOP_COIN = 0

COINS = ["KRW-BTC","KRW-ETH","KRW-XRP","KRW-SOL","KRW-DOGE","KRW-ADA",
         "KRW-AVAX","KRW-LINK","KRW-DOT","KRW-TRX","KRW-SAND","KRW-ATOM",
         "KRW-NEAR","KRW-APT","KRW-ARB","KRW-SUI","KRW-SEI","KRW-STX","KRW-INJ"]
