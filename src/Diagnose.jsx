import React, { useState, useEffect } from "react";

const C = {
  ground: "#E9ECF2",
  panel: "#FFFFFF",
  ink: "#131A2A",
  line: "#D3D8E2",
  muted: "#6B7689",
  up: "#E03A3E",
  down: "#2F6FE0",
  warn: "#D9B434",
};

// 시장 점수 하단 팩터 이름. "자금 유입" -> "거래대금 흐름"으로 정정 (실제로는 수급이 아니라 OHLCV 기반 계산).
const FACTOR_LABELS = {
  vol: "거래량 급증",
  mom: "모멘텀",
  high: "신고가 근접",
  vola: "변동성 확대",
  flow: "거래대금 흐름",
};

const PENDING_ITEMS = [
  { key: "company", label: "기업" },
  { key: "theme", label: "테마" },
  { key: "event", label: "이벤트" },
];

function statusFromMarketScore(score) {
  if (score === null || score === undefined) return { label: "데이터 없음", color: C.muted };
  if (score >= 70) return { label: "과열 주의", color: C.up };
  if (score >= 40) return { label: "관찰 필요", color: C.warn };
  return { label: "잠잠함", color: C.down };
}

export default function Diagnose() {
  const [query, setQuery] = useState("");
  const [allStocks, setAllStocks] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch("/heat_kr.json")
      .then((r) => r.json())
      .then((j) => {
        const list = j?.by_cap?.all || [];
        setAllStocks(list);
        setUpdatedAt(j?.updated || null);
      })
      .catch(() => {});
  }, []);

  const handleSearch = () => {
    const name = query.trim();
    if (!name) return;

    const found = allStocks.find((s) => s.name === name);

    if (!found) {
      setNotFound(true);
      setResult(null);
      setSearched(true);
      return;
    }

    const marketScore = Math.round(
      Object.values(found.f).reduce((a, b) => a + b, 0) / Object.values(found.f).length
    );

    setResult({
      id: found.id,
      name: found.name,
      sub: found.sub,
      chg: found.chg,
      factors: found.f,
      marketScore,
    });
    setNotFound(false);
    setSearched(true);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const status = result ? statusFromMarketScore(result.marketScore) : null;

  const formattedDate = (() => {
    if (!updatedAt) return null;
    try {
      const d = new Date(updatedAt);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} 기준`;
    } catch {
      return null;
    }
  })();

  return (
    <div style={{ background: C.ground, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .dg { font-family:'Inter Tight','Noto Sans KR',system-ui,sans-serif; }
        .mono { font-family:'JetBrains Mono','Noto Sans KR',monospace; font-variant-numeric: tabular-nums; }
        .wrap { max-width: 640px; margin: 0 auto; padding: 0 18px; }
        input:focus, button:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
      `}</style>

      <div className="dg">
        <section className="wrap" style={{ paddingTop: 56, paddingBottom: 28 }}>
          <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "0 0 8px" }}>
            내 종목의 시장 신호를 확인하세요
          </h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
            가격·거래량 흐름을 바탕으로 현재 상태를 보여드립니다.
          </p>
        </section>

        <section className="wrap" style={{ paddingBottom: 32 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="종목명 입력 (예: 삼성전자)"
              style={{
                flex: 1, fontFamily: "inherit", fontSize: 15, padding: "13px 14px",
                borderRadius: 4, border: `1px solid ${C.line}`, background: C.panel, color: C.ink,
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600,
                padding: "13px 20px", borderRadius: 4, border: "none",
                background: C.ink, color: "#fff", whiteSpace: "nowrap",
              }}
            >
              분석하기
            </button>
          </div>
          {allStocks.length === 0 && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>종목 데이터 불러오는 중...</div>
          )}
        </section>

        {searched && notFound && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 20, fontSize: 14, color: C.muted }}>
              "{query}" 종목을 찾을 수 없습니다. 정확한 종목명으로 다시 시도해주세요.
            </div>
          </section>
        )}

        {searched && result && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
              {/* 종목 헤더 */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{result.name}</span>
                <span className="mono" style={{ fontSize: 12, color: C.muted }}>{result.sub}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: result.chg >= 0 ? C.up : C.down, marginLeft: "auto" }}>
                  {result.chg >= 0 ? "+" : ""}{result.chg.toFixed(1)}%
                </span>
              </div>
              {formattedDate && (
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 20 }}>{formattedDate}</div>
              )}

              {/* 시장 점수 - 이 화면의 주인공 */}
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>시장 신호</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{result.marketScore}</span>
                  <span className="mono" style={{ fontSize: 16, color: C.muted }}>/ 100</span>
                </div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  현재 상태: <span style={{ fontWeight: 700, color: status.color }}>{status.label}</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 1.5 }}>
                  같은 시점 전체 종목 중 상대적 위치입니다. 높을수록 거래량·모멘텀·신고가 근접 신호가 강하다는 뜻이며,
                  좋다·나쁘다를 의미하지 않습니다.
                </div>

                <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>왜 이런 결과인가?</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {Object.entries(result.factors)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, v]) => (
                        <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                          <span style={{ color: C.muted }}>{FACTOR_LABELS[k]}</span>
                          <span className="mono" style={{ fontWeight: 600 }}>{v.toFixed(0)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* 준비 중 항목 - 작게, 하단에 */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {PENDING_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      flex: "1 1 100px", textAlign: "center", padding: "10px 8px",
                      border: `1px dashed ${C.line}`, borderRadius: 4, fontSize: 12, color: C.muted,
                    }}
                  >
                    {item.label} · 준비 중
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            시장 신호는 거래량·모멘텀·신고가 근접·변동성·거래대금 흐름 5개 지표를 종합한 점수이며,
            기업·테마·이벤트 분석은 준비 중입니다.
            매수·매도를 추천하지 않으며, 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
