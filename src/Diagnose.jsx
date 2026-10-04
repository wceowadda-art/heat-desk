import React, { useState, useEffect, useMemo } from "react";
import Nav from "./Nav.jsx";

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

// 4축 레이더 차트. 순수 SVG로 그려서 별도 라이브러리 설치가 필요 없다.
// axes: { market, company, event, theme } 각 0~100 또는 null(데이터 없음).
function Radar({ axisDefs, axes, size = 220 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = axisDefs.length;
  const angleFor = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pointFor = (i, value) => {
    const a = angleFor(i);
    const rr = (Math.max(0, Math.min(100, value)) / 100) * r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };

  const dataPoints = axisDefs.map((d, i) => {
    const v = axes[d.key];
    return v === null || v === undefined ? null : pointFor(i, v);
  });
  const hasAnyData = dataPoints.some((p) => p !== null);
  // null인 축은 0으로 취급해 선을 이어 그리되(구멍처럼 보이게), 실제 값 유무는 점 유무로 구분한다.
  const polygonPoints = axisDefs
    .map((d, i) => pointFor(i, axes[d.key] ?? 0))
    .map((p) => p.join(","))
    .join(" ");

  const rings = [25, 50, 75, 100];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="4축 레이더 차트">
      {rings.map((ring) => {
        const pts = axisDefs.map((_, i) => pointFor(i, ring).join(",")).join(" ");
        return <polygon key={ring} points={pts} fill="none" stroke={C.line} strokeWidth="1" />;
      })}
      {axisDefs.map((d, i) => {
        const [x, y] = pointFor(i, 100);
        return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} strokeWidth="1" />;
      })}
      {hasAnyData && (
        <polygon points={polygonPoints} fill={C.ink} fillOpacity="0.12" stroke={C.ink} strokeWidth="2" />
      )}
      {dataPoints.map((p, i) =>
        p ? <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={axisDefs[i].color} /> : null
      )}
      {axisDefs.map((d, i) => {
        const [lx, ly] = pointFor(i, 100 + 26 / (r / 100));
        const v = axes[d.key];
        return (
          <text
            key={d.key}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="11"
            fontFamily="'Inter Tight','Noto Sans KR',sans-serif"
            fill={v === null || v === undefined ? C.muted : C.ink}
            fontWeight={v === null || v === undefined ? 400 : 600}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// 수급 패턴을 일반적인 케이스로 안내한다. "이 종목이 오른다/떨어진다"가 아니라
// "이런 조합은 통상 이렇게 해석되곤 한다"는 교과서적 설명까지만 준다.
// 조건은 위에서부터 먼저 맞는 것 하나만 적용한다(우선순위 순).
function matchFlowCase(flow, chgPct) {
  if (!flow) return null;
  const f5 = flow.foreign_5, i5 = flow.inst_5, p5 = flow.retail_5;
  if (f5 == null || i5 == null || p5 == null) return null;

  const isUp = chgPct != null && chgPct > 0;

  if (f5 > 0 && i5 > 0) {
    return {
      title: "외국인·기관이 같이 산다",
      shortNote: "단기: 보통 더 믿을 만한 신호로 봐요.",
      longNote: "장기: 꾸준히 이어지면 긍정적으로 보는 시각이 많아요.",
    };
  }
  if (f5 < 0 && i5 < 0 && isUp) {
    return {
      title: "오르는데 큰손들은 판다",
      shortNote: "단기: 차익실현으로 보는 경우가 많아요. 단기 고점 신호로도 자주 언급돼요.",
      longNote: "장기: 한 번만으론 추세 전환이라 보기 어렵고, 며칠 더 지켜보는 경우가 많아요.",
    };
  }
  if (f5 > 0 && p5 < 0) {
    return {
      title: "개인은 팔고 외국인은 산다",
      shortNote: "단기: 개인이 던진 걸 외국인이 받는 모습이에요.",
      longNote: "장기: '개미와 반대로 가라'는 말의 근거가 되는 패턴이에요.",
    };
  }
  if (f5 < 0 && p5 > 0 && isUp) {
    return {
      title: "개인만 몰리며 오른다",
      shortNote: "단기: 뒤늦게 뛰어드는 추격매수로 보는 경우가 많아요.",
      longNote: "장기: 고점에서 물리는 사례가 자주 언급되는 패턴이에요.",
    };
  }
  if (f5 < 0 && i5 > 0) {
    return {
      title: "기관은 사고 외국인은 판다",
      shortNote: "단기: 둘의 시각이 엇갈려요.",
      longNote: "장기: 각자 다른 이유(환헤지 등)일 수 있어 해석이 갈려요.",
    };
  }
  if (f5 < 0 && !isUp) {
    return {
      title: "외국인이 팔며 내린다",
      shortNote: "단기: 리스크 회피 움직임으로 보는 경우가 많아요.",
      longNote: "장기: 포트폴리오 조정 차원이면, 시간이 지나며 다시 돌아오기도 해요.",
    };
  }
  return null;
}

// 점수(0~100)를 등급(A+~D)으로 환산한다. 좋다·나쁘다 판정이 아니라 숫자를 더 직관적으로
// 읽게 돕는 표기일 뿐이며, 지금까지 써온 백분위 구간(과열주의/관찰필요/잠잠함)과 같은 성격이다.
function gradeOf(score) {
  if (score === null || score === undefined) return null;
  if (score >= 85) return { label: "A+", color: C.up };
  if (score >= 70) return { label: "A", color: C.up };
  if (score >= 55) return { label: "B+", color: C.warn };
  if (score >= 40) return { label: "B", color: C.warn };
  if (score >= 25) return { label: "C", color: C.down };
  return { label: "D", color: C.down };
}

function GradeBadge({ score }) {
  const g = gradeOf(score);
  if (!g) return null;
  return (
    <span
      className="mono"
      style={{
        fontSize: 13, fontWeight: 700, color: "#fff", background: g.color,
        padding: "2px 7px", borderRadius: 4, marginLeft: 8,
      }}
    >
      {g.label}
    </span>
  );
}

// 시장 신호 팩터 중 상위 10%(백분위 90 이상)인 것만 "패턴"으로 짚어 보여준다.
// 판정이 아니라, 지금 이 종목에서 어떤 지표가 유독 튀는지 짧게 이름 붙이는 것뿐이다.
const PATTERN_DEFS = [
  { key: "high", min: 90, label: "신고가 임박" },
  { key: "vol", min: 90, label: "거래량 폭발" },
];
function patternTags(f) {
  if (!f) return [];
  return PATTERN_DEFS.filter((p) => (f[p.key] ?? 0) >= p.min).map((p) => p.label);
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
  const [avgInput, setAvgInput] = useState("");

  // 종목이 바뀌면, 이 브라우저에 저장해둔 평단가가 있을 때만 불러온다 (서버로 전송하지 않음).
  useEffect(() => {
    if (!result) return;
    try {
      setAvgInput(localStorage.getItem(`avg:${result.id}`) || "");
    } catch {
      setAvgInput("");
    }
  }, [result?.id]);

  const handleAvgChange = (v) => {
    const cleaned = v.replace(/[^0-9.]/g, "");
    setAvgInput(cleaned);
    try {
      if (result) localStorage.setItem(`avg:${result.id}`, cleaned);
    } catch {}
    if (cleaned && window.gtag) window.gtag("event", "avg_price_input", { stock_name: result?.name });
  };

  const avgPrice = parseFloat(avgInput);
  const returnPct =
    result?.close && avgPrice > 0 ? (result.close / avgPrice - 1) * 100 : null;

  // 내 기준 종합점수: 4축(시장/기업/공시/테마) 가중치는 사용자가 직접 정한다.
  // Claude나 사이트가 임의로 "좋은 종목" 기준을 정하는 게 아니라, 사용자가 비중을 고르고
  // 그 결과를 계산해서 보여줄 뿐이다. 데이터 없는 축은 가중치와 함께 계산에서 자동 제외된다.
  const AXIS_DEFS = [
    { key: "market", label: "시장 신호", color: C.up },
    { key: "company", label: "기업 체력", color: C.warn },
    { key: "event", label: "공시 안전성", color: "#3E8E7E" },
    { key: "theme", label: "테마 화제성", color: C.down },
  ];
  const [weights, setWeights] = useState({ market: 3, company: 3, event: 3, theme: 3 });

  const composite = useMemo(() => {
    if (!result?.axes) return null;
    let sumW = 0, sumWV = 0;
    AXIS_DEFS.forEach(({ key }) => {
      const v = result.axes[key];
      const w = weights[key];
      if (v !== null && v !== undefined && w > 0) {
        sumW += w;
        sumWV += w * v;
      }
    });
    return sumW > 0 ? Math.round(sumWV / sumW) : null;
  }, [result, weights]);

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
        close: found.close ?? null,
        factors: found.f,
        marketScore,
        companyScore: found.company ?? null,
        event: found.event ?? null,
        themes: found.themes ?? null,
        themeBuzz: found.theme_buzz ?? null,
        gap: found.gap ?? null,
        axes: found.axes ?? null,
        flow: found.flow ?? null,
        sectorRank: found.sector_rank ?? null,
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
        <Nav page="diagnose" />
        <section className="wrap" style={{ paddingTop: 36, paddingBottom: 28 }}>
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

              {patternTags(result.factors).length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {patternTags(result.factors).map((t) => (
                    <span key={t} className="mono" style={{
                      fontSize: 11, fontWeight: 700, color: "#fff", background: C.up,
                      padding: "3px 9px", borderRadius: 999,
                    }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {/* 4축 요약: 종목 보자마자 바로 보이는 레이더 차트. 비중 조절은 아래 "내 기준 종합점수" 카드에서 */}
              {result.axes && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 14, textAlign: "left" }}>한눈에 보기</div>
                  <Radar axisDefs={AXIS_DEFS} axes={result.axes} />
                  {composite !== null && (
                    <div style={{ marginTop: 10 }}>
                      <span className="mono" style={{ fontSize: 13, color: C.muted }}>내 기준 종합점수 </span>
                      <span className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{composite}</span>
                      <span className="mono" style={{ fontSize: 13, color: C.muted }}> / 100</span>
                    </div>
                  )}
                </div>
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
                  <GradeBadge score={result.marketScore} />
                </div>
                <div style={{ fontSize: 14, marginBottom: 4 }}>
                  현재 상태: <span style={{ fontWeight: 700, color: statusInfo.color }}>{statusInfo.label}</span>
                </div>
                {result.sectorRank?.market && (
                  <div className="mono" style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                    {result.sectorRank.sector} {result.sectorRank.market[1]}개 중 {result.sectorRank.market[0]}위
                  </div>
                )}
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

              {result.gap && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>코스피 대비</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 12 }}>
                    {[
                      { k: "short", label: "5일" },
                      { k: "mid", label: "20일" },
                      { k: "long", label: "60일" },
                    ].map(({ k, label }) => {
                      const v = result.gap[k];
                      if (v === undefined) return <div key={k} />;
                      const col = v > 0 ? C.up : v < 0 ? C.down : C.muted;
                      return (
                        <div key={k}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
                          <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: col }}>
                            {v > 0 ? "+" : ""}{v.toFixed(1)}%p
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                    같은 기간 코스피 수익률과 비교한 초과 수익률입니다. 양수면 지수보다 더 올랐다(또는 덜 떨어졌다)는 뜻이며,
                    앞으로도 그럴 것이라는 의미는 아닙니다.
                  </div>
                </div>
              )}

              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>기업 체력</div>
                {result.companyScore !== null ? (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{result.companyScore}</span>
                      <span className="mono" style={{ fontSize: 16, color: C.muted }}>/ 100</span>
                      <GradeBadge score={result.companyScore} />
                    </div>
                    {result.sectorRank?.company && (
                      <div className="mono" style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                        {result.sectorRank.sector} {result.sectorRank.company[1]}개 중 {result.sectorRank.company[0]}위
                      </div>
                    )}
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

              {/* 수급 - 외국인/기관/개인 순매수 방향만 사실로 보여준다. 매수·매도 신호가 아니다.
                  아직 전 종목이 아니라 일부만 수집돼서, 없는 종목은 "자료 준비 중"으로 처리한다. */}
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginTop: 14 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>최근 수급</div>
                {result.flow ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, color: C.muted }}></div>
                      <div style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>5일</div>
                      <div style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>20일</div>
                    </div>
                    {[
                      { label: "외국인", k5: "foreign_5", k20: "foreign_20" },
                      { label: "기관", k5: "inst_5", k20: "inst_20" },
                      { label: "개인", k5: "retail_5", k20: "retail_20" },
                    ].map((row) => {
                      const v5 = result.flow[row.k5];
                      const v20 = result.flow[row.k20];
                      const fmt = (v) => {
                        if (v === null || v === undefined) return <span style={{ color: C.muted }}>–</span>;
                        const eok = v / 100000000; // 원 -> 억원
                        const col = v > 0 ? C.up : v < 0 ? C.down : C.muted;
                        return (
                          <span className="mono" style={{ color: col, fontWeight: 600 }}>
                            {v > 0 ? "+" : ""}{eok.toFixed(0)}억
                          </span>
                        );
                      };
                      return (
                        <div key={row.label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "7px 0", borderTop: `1px solid #F0F2F6`, fontSize: 13 }}>
                          <div>{row.label}</div>
                          <div style={{ textAlign: "right" }}>{fmt(v5)}</div>
                          <div style={{ textAlign: "right" }}>{fmt(v20)}</div>
                        </div>
                      );
                    })}
                    {(() => {
                      const matched = matchFlowCase(result.flow, result.chg);
                      if (!matched) return null;
                      return (
                        <div style={{ background: C.ground, borderRadius: 4, padding: 14, marginTop: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{matched.title}</div>
                          <div style={{ fontSize: 12, color: C.ink, lineHeight: 1.6, marginBottom: 4 }}>{matched.shortNote}</div>
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{matched.longNote}</div>
                        </div>
                      );
                    })()}

                    <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10 }}>
                      위 해석은 일반적으로 거론되는 패턴을 소개하는 것으로, 이 종목의 향후 주가를 예측하지 않습니다.
                      순매수 금액(+)과 순매도 금액(−)은 사실 데이터이며, 매수·매도를 추천하지 않습니다.
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>
                    이 종목은 수급 자료를 아직 준비 중입니다. 순차적으로 채워가고 있습니다.
                  </div>
                )}
              </div>

              {/* 비중 직접 정하기 - 사용자가 직접 정한 가중치로만 계산. 사이트가 임의로 비중을 정하지 않는다.
                  레이더 차트 자체는 위쪽 "한눈에 보기" 카드에 있고, 여기는 슬라이더 조작용 */}
              {result.axes && (
                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginTop: 14 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>내 기준 종합점수 조정</div>

                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                    {composite !== null ? (
                      <>
                        <span className="mono" style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{composite}</span>
                        <span className="mono" style={{ fontSize: 16, color: C.muted }}>/ 100</span>
                        <GradeBadge score={composite} />
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: C.muted }}>비중을 하나 이상 켜주세요.</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 18, lineHeight: 1.5 }}>
                    아래 네 가지 비중을 직접 정하면, 위쪽 레이더 차트와 이 점수가 그 비중으로 다시 계산됩니다. 추천이 아니라 계산기입니다.
                  </div>

                  <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
                    {AXIS_DEFS.map((d) => {
                      const v = result.axes[d.key];
                      return (
                        <div key={d.key} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <label style={{ fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ width: 8, height: 8, background: d.color, borderRadius: 1 }} />
                              {d.label}
                              {(v === null || v === undefined) && (
                                <span style={{ fontSize: 10, color: C.muted }}>(자료 없음)</span>
                              )}
                            </label>
                            <span className="mono" style={{ fontSize: 11, color: weights[d.key] === 0 ? C.line : C.muted }}>
                              비중 {weights[d.key]}
                            </span>
                          </div>
                          <input
                            type="range" min="0" max="5" step="1" value={weights[d.key]}
                            onChange={(e) => setWeights({ ...weights, [d.key]: Number(e.target.value) })}
                            style={{ width: "100%", accentColor: C.ink }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: 11, color: C.muted, borderTop: `1px solid ${C.line}`, paddingTop: 10, lineHeight: 1.6 }}>
                    비중은 이용자가 직접 정합니다. 사이트가 정한 "좋은 종목" 기준이 아니라,
                    고른 비중대로 계산한 숫자일 뿐이며 매수·매도를 추천하지 않습니다.
                  </div>
                </div>
              )}

              {/* 내 평단가 확인 - 수익률 계산만 보여주고, 보유·매도 판단은 하지 않는다 */}
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginTop: 14 }}>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 10 }}>내 평단가 확인</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={avgInput}
                    onChange={(e) => handleAvgChange(e.target.value)}
                    placeholder="내 평단가 입력 (원)"
                    style={{
                      flex: 1, fontFamily: "inherit", fontSize: 15, padding: "11px 12px",
                      borderRadius: 4, border: `1px solid ${C.line}`, background: C.panel, color: C.ink,
                    }}
                  />
                  <span style={{ fontSize: 13, color: C.muted }}>원</span>
                </div>

                {result.close === null ? (
                  <div style={{ fontSize: 12, color: C.muted }}>현재가 데이터를 준비 중입니다.</div>
                ) : returnPct === null ? (
                  <div style={{ fontSize: 12, color: C.muted }}>
                    현재가 {result.close.toLocaleString()}원 · 평단가를 입력하면 수익률을 계산해 드려요.
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
                      <span className="mono" style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color: returnPct >= 0 ? C.up : C.down }}>
                        {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
                      평단가 {avgPrice.toLocaleString()}원 → 현재가 {result.close.toLocaleString()}원
                    </div>
                  </>
                )}

                <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                  수익률만 계산해 보여드립니다. 보유·매도 판단은 하지 않습니다.
                  위의 시장 신호·기업 체력·공시·테마와 함께 참고용으로 봐주세요.
                  입력한 평단가는 이 기기에만 저장되고 서버로 전송되지 않습니다.
                </div>
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
