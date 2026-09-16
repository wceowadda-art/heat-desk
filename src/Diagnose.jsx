import React, { useState, useEffect, useMemo } from "react";

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

const FACTOR_LABELS = {
  vol: "거래량 급증",
  mom: "모멘텀",
  high: "신고가 근접",
  vola: "변동성 확대",
  flow: "거래대금 흐름",
};

const DISCLOSURE_INFO = {
  "유상증자결정": "회사가 새 주식을 발행해 자금을 조달하는 결정입니다. 사업 확장 목적일 수도, 재무구조 개선 목적일 수도 있습니다. 기존 주주 입장에서는 지분율이 낮아질 수 있어, 통상 단기적으로 주가에 부담 요인으로 작용하는 경우가 많습니다.",
  "전환사채권발행결정": "일정 조건에서 주식으로 바꿀 수 있는 채권을 발행하는 결정입니다. 회사가 자금을 조달하는 방법 중 하나이며, 향후 주식 전환이 이뤄지면 유상증자와 비슷하게 지분 희석 요인이 될 수 있습니다.",
  "회사합병결정": "다른 회사와 합쳐지는 결정입니다. 사업 시너지나 구조조정 목적일 수 있으며, 합병 비율과 목적에 따라 시장 반응이 크게 갈리는 경우가 많습니다.",
  "자기주식취득결정": "회사가 자기 회사 주식을 사들이는 결정입니다. 통상 주가 안정이나 주주가치 제고 목적으로 해석되며, 시장에서는 비교적 긍정적으로 받아들여지는 경우가 많습니다.",
  "자기주식취득신탁계약체결결정": "회사가 자기 회사 주식을 사들이는 결정입니다. 통상 주가 안정이나 주주가치 제고 목적으로 해석되며, 시장에서는 비교적 긍정적으로 받아들여지는 경우가 많습니다.",
  "자기주식처분결정": "회사가 보유하던 자기주식을 파는 결정입니다. 임직원 상여, 자금 조달 등 다양한 목적이 있을 수 있으며, 목적에 따라 시장 반응이 다릅니다.",
  "자기주식취득신탁계약해지결정": "회사가 자기주식 매입 계약을 종료하는 결정입니다. 임직원 상여, 자금 조달 등 다양한 목적이 있을 수 있으며, 목적에 따라 시장 반응이 다릅니다.",
  "타법인주식및출자증권양수결정": "다른 회사의 지분을 사들이는 결정입니다. 사업 확장이나 구조조정의 일환일 수 있습니다.",
  "타법인주식및출자증권양도결정": "다른 회사의 지분을 파는 결정입니다. 사업 확장이나 구조조정의 일환일 수 있습니다.",
  "자기전환사채만기전취득결정": "회사가 만기 전에 자기 전환사채를 다시 사들이는 결정입니다. 통상 잠재적 지분 희석 요인을 미리 줄이는 조치로 해석되는 경우가 많습니다.",
  "유형자산양수결정": "회사가 토지, 건물, 설비 같은 유형자산을 사들이는 결정입니다. 통상 사업 확장이나 생산능력 확대 목적으로 해석되는 경우가 많습니다.",
  "유형자산양도결정": "회사가 보유하던 유형자산을 파는 결정입니다. 자금 조달이나 사업 구조조정의 일환일 수 있습니다.",
  "상각형조건부자본증권발행결정": "특정 조건(예: 재무 위기)이 발생하면 상각(감액)될 수 있는 조건부 채권을 발행하는 결정입니다. 주로 금융회사가 자본 확충 목적으로 활용합니다.",
  "영업정지": "회사의 영업 일부 또는 전부가 정지된 결정입니다. 통상 부정적인 신호로 해석되는 경우가 많습니다.",
};

function statusFromMarketScore(score) {
  if (score === null || score === undefined) return { label: "데이터 없음", color: C.muted };
  if (score >= 70) return { label: "과열 주의", color: C.up };
  if (score >= 40) return { label: "관찰 필요", color: C.warn };
  return { label: "잠잠함", color: C.down };
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd) return "";
  const s = String(yyyymmdd);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

export default function Diagnose() {
  const [query, setQuery] = useState("");
  const [allStocks, setAllStocks] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loadingData, setLoadingData] = useState(true);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("idle");
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    fetch("/heat_kr.json")
      .then((r) => r.json())
      .then((j) => {
        const list = j?.by_cap?.all || [];
        setAllStocks(list);
        setUpdatedAt(j?.updated || null);
        setLoadingData(false);

        const params = new URLSearchParams(window.location.search);
        const stockParam = params.get("stock");
        if (stockParam) {
          setQuery(stockParam);
          runSearch(stockParam, list);
        }
      })
      .catch(() => setLoadingData(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = (name, list) => {
    const trimmed = (name || "").trim();
    if (!trimmed) return;

    if (window.gtag) window.gtag("event", "diagnose_search", { stock_name: trimmed });

    setStatus("analyzing");
    setShowSuggest(false);

    setTimeout(() => {
      const found = list.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
      if (!found) {
        setResult(null);
        setStatus("notfound");
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
        companyScore: found.company ?? null,
        event: found.event ?? null,
        themes: found.themes ?? null,
        themeBuzz: found.theme_buzz ?? null,
      });
      setStatus("found");
    }, 300);
  };

  const handleSearch = () => runSearch(query, allStocks);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q || status === "found") return [];
    return allStocks.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  }, [query, allStocks, status]);

  const statusInfo = result ? statusFromMarketScore(result.marketScore) : null;

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
        .suggest-item:hover { background: ${C.ground}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spinner { animation: spin 0.8s linear infinite; }
        .theme-tag { display: inline-block; font-size: 12px; padding: 4px 10px; border-radius: 999px; background: ${C.ground}; color: ${C.ink}; margin: 0 6px 6px 0; }
      `}</style>

      <div className="dg">
        <section className="wrap" style={{ paddingTop: 56, paddingBottom: 28 }}>
          <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "0 0 8px" }}>
            내 종목의 시장 신호를 확인하세요
          </h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
            가격·거래량 흐름, 재무 체력, 최근 공시, 관련 테마를 바탕으로 현재 상태를 보여드립니다.
          </p>
        </section>

        <section className="wrap" style={{ paddingBottom: 8, position: "relative" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggest(true);
                if (status !== "idle") setStatus("idle");
              }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              onKeyDown={handleKeyDown}
              placeholder="종목명 입력 (예: 삼성전자)"
              style={{
                flex: 1, fontFamily: "inherit", fontSize: 15, padding: "13px 14px",
                borderRadius: 4, border: `1px solid ${C.line}`, background: C.panel, color: C.ink,
              }}
            />
            <button
              onClick={handleSearch}
              disabled={status === "analyzing"}
              style={{
                cursor: status === "analyzing" ? "default" : "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600,
                padding: "13px 20px", borderRadius: 4, border: "none",
                background: C.ink, color: "#fff", whiteSpace: "nowrap",
                opacity: status === "analyzing" ? 0.6 : 1,
              }}
            >
              {status === "analyzing" ? "분석 중..." : "분석하기"}
            </button>
          </div>

          {showSuggest && suggestions.length > 0 && (
            <div style={{
              position: "absolute", left: 18, right: 82, top: "100%", marginTop: 4,
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4,
              boxShadow: "0 4px 12px rgba(19,26,42,.08)", zIndex: 10, overflow: "hidden",
            }}>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className="suggest-item"
                  onMouseDown={() => {
                    setQuery(s.name);
                    runSearch(s.name, allStocks);
                  }}
                  style={{ padding: "10px 14px", fontSize: 14, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
                >
                  <span>{s.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: C.muted }}>{s.sub}</span>
                </div>
              ))}
            </div>
          )}

          {loadingData && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>종목 데이터 불러오는 중...</div>
          )}
        </section>

        {status === "idle" && !loadingData && (
          <section className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "24px 0" }}>
              종목명을 입력하면 시장 신호를 보여드립니다.
            </div>
          </section>
        )}

        {status === "analyzing" && (
          <section className="wrap" style={{ paddingTop: 24, paddingBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "24px 0", color: C.muted, fontSize: 13 }}>
              <svg className="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke={C.line} strokeWidth="3" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
              </svg>
              분석 중입니다...
            </div>
          </section>
        )}

        {status === "notfound" && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 20, fontSize: 14, color: C.muted }}>
              "{query}" 종목을 찾을 수 없습니다. 정확한 종목명으로 다시 시도해주세요.
            </div>
          </section>
        )}

        {status === "found" && result && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 24 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{result.name}</span>
                <span className="mono" style={{ fontSize: 12, color: C.muted }}>{result.sub}</span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: result.chg >= 0 ? C.up : C.down, marginLeft: "auto" }}>
                  {result.chg >= 0 ? "+" : ""}{result.chg.toFixed(1)}%
                </span>
              </div>
              {formattedDate && (
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>{formattedDate}</div>
              )}

              {result.themes && result.themes.length > 0 && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>테마</div>
                  {result.themes.map((t) => {
                    const buzz = result.themeBuzz?.find((b) => b.theme === t);
                    return (
                      <div key={t} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 16, fontWeight: 700 }}>{t}</span>
                          {buzz ? (
                            <span style={{ fontSize: 13, fontWeight: 700, color: buzz.grade >= 4 ? C.up : buzz.grade === 3 ? C.warn : C.down }}>
                              화제성 {buzz.grade_label}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: C.muted }}>화제성 체크 예정</span>
                          )}
                        </div>
                        {buzz ? (
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                            {buzz.note} ({buzz.checked_date} 확인)
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
                            이 테마는 아직 화제성 조사 전입니다. 순차적으로 채워가고 있습니다.
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 11, color: C.muted, borderTop: `1px solid ${C.line}`, paddingTop: 10, lineHeight: 1.5 }}>
                    화제성은 최근 뉴스·증권가 리포트에서 이 테마가 얼마나 자주 언급되는지를 나타냅니다.
                    높다고 좋은 신호는 아니며, 이미 많이 오른 뒤일 수도 있습니다.
                  </div>
                </div>
              )}

              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>시장 신호</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{result.marketScore}</span>
                  <span className="mono" style={{ fontSize: 16, color: C.muted }}>/ 100</span>
                </div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  현재 상태: <span style={{ fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
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

              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>기업 체력</div>
                {result.companyScore !== null ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{result.companyScore}</span>
                      <span className="mono" style={{ fontSize: 16, color: C.muted }}>/ 100</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                      같은 업종 안에서의 상대 순위입니다. 영업이익률과 매출 규모, 부채비율 등을 반영했습니다.
                      아직 초기 버전이라 지표를 계속 보강하고 있습니다.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>
                    이 종목은 재무 데이터가 아직 확인되지 않았습니다.
                  </div>
                )}
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>최근 공시</div>
                {result.event && result.event.has ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 3,
                        background: "#FCEAEA", color: C.up,
                      }}>
                        있음
                      </span>
                      <span className="mono" style={{ fontSize: 12, color: C.muted }}>
                        {formatDate(result.event.date)}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{result.event.type}</span>
                    </div>
                    {DISCLOSURE_INFO[result.event.type] && (
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 8 }}>
                        {DISCLOSURE_INFO[result.event.type]}
                      </div>
                    )}
                    {result.event.count > 1 && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        최근 60일간 총 {result.event.count}건의 주요 공시가 있었습니다: {result.event.types}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>
                    최근 60일간 특별한 주요 공시가 확인되지 않았습니다.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            시장 신호는 거래량·모멘텀·신고가 근접·변동성·거래대금 흐름 5개 지표를 종합한 점수이며,
            기업 체력은 같은 업종 내 재무 지표 상대비교, 최근 공시는 DART 주요사항보고 기준, 테마는 직접 선정한 대표 종목 기준입니다.
            공시 설명은 일반적인 의미를 안내하는 것으로, 개별 종목의 주가 방향을 예측하지 않습니다.
            매수·매도를 추천하지 않으며, 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
