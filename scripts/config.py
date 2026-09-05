# 수집·계산 설정. 여기 숫자만 바꾸면 됩니다.

START = "20260701"        # 수집 시작일
END   = "20260807"        # 수집 종료일 (장 마감 후 날짜)

MAX_STOCKS = None          # 국내 종목 수. 전체는 None
MIN_VALUE  = 0  # 최소 거래대금(원)
SLEEP      = 0.4          # 호출 간격(초). 줄이면 차단 위험

TOP_KR   = 20              # 화면에 낼 국내 개수
TOP_COIN = 0

COINS = ["KRW-BTC","KRW-ETH","KRW-XRP","KRW-SOL","KRW-DOGE","KRW-ADA",
         "KRW-AVAX","KRW-LINK","KRW-DOT","KRW-TRX","KRW-SAND","KRW-ATOM",
         "KRW-NEAR","KRW-APT","KRW-ARB","KRW-SUI","KRW-SEI","KRW-STX","KRW-INJ"]