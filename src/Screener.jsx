import React, { useState, useEffect, useMemo, useRef } from "react";

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

const TOP_N = 10;
const BUZZ_LABEL = ["없음", "매우 낮음", "낮음", "보통", "높음", "매우 높음"];

const marketScoreOf = (s) => {
  const v = Object.values(s.f || {});
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const maxBuzzOf = (s) =>
  s.theme_buzz && s.theme_buzz.length ? Math.max(...s.theme_buzz.map((b) => b.grade)) : 0;

/* ------------------------------------------------------------------
 * 지표 카탈로그: 이 배열이 스크리너의 "구조" 전부다.
 * 새 지표를 붙일 때는 (1) score.py가 종목 데이터에 필드를 넣고
 * (2) 여기에 한 줄 추가하면 끝. 화면·필터·정렬 코드는 건드리지 않는다.
 *
 * kind: score(0~100 점수, 이상/이하) | grade(1~5 단계) | theme(특정 테마) | flag(있음/없음)
 * ready: false 이면 "준비 중"으로 표시만 하고 선택은 막는다.
 * ------------------------------------------------------------------ */
const GROUPS = [
  { key: "finance", label: "재무" },
  { key: "tech", label: "기술적 지표" },
  { key: "theme", label: "테마" },
  { key: "event", label: "이벤트" },
];

const CATALOG = [
  // 재무
  { id: "company", group: "finance", label: "기업 체력", kind: "score", get: (s) => s.company ?? null, help: "같은 업종 안에서의 재무 상대 순위" },
  { id: "fin_margin", group: "finance", label: "영업이익률 (업종 내 순위)", kind: "score", get: (s) => s.fin?.margin ?? null, help: "같은 업종 안에서 영업이익률 백분위" },
  { id: "fin_revenue", group: "finance", label: "매출 규모 (업종 내 순위)", kind: "score", get: (s) => s.fin?.revenue ?? null, help: "같은 업종 안에서 매출 규모 백분위" },
  { id: "fin_debt", group: "finance", label: "부채비율 (낮을수록 좋음)", kind: "score", get: (s) => s.fin?.debt ?? null, help: "낮은 부채비율일수록 높은 점수 (이미 반전 처리됨)" },
  { id: "fin_current", group: "finance", label: "유동비율 (업종 내 순위)", kind: "score", get: (s) => s.fin?.current ?? null, help: "같은 업종 안에서 유동비율 백분위" },
  { id: "fin_growth", group: "finance", label: "매출·이익 성장률", ready: false },
  { id: "fin_val", group: "finance", label: "PER · PBR · ROE", ready: false },

  // 기술적 지표
  { id: "tech_market", group: "tech", label: "시장 신호 (종합)", kind: "score", get: marketScoreOf, help: "아래 5개 지표의 평균" },
  { id: "tech_vol", group: "tech", label: "거래량 급증", kind: "score", get: (s) => s.f?.vol ?? null },
  { id: "tech_mom", group: "tech", label: "모멘텀", kind: "score", get: (s) => s.f?.mom ?? null },
  { id: "tech_high", group: "tech", label: "신고가 근접", kind: "score", get: (s) => s.f?.high ?? null },
  { id: "tech_vola", group: "tech", label: "변동성 확대", kind: "score", get: (s) => s.f?.vola ?? null },
  { id: "tech_flow", group: "tech", label: "거래대금 흐름", kind: "score", get: (s) => s.f?.flow ?? null },
  { id: "tech_rsi", group: "tech", label: "RSI", ready: false },
  { id: "tech_ma", group: "tech", label: "이동평균 이격", ready: false },
  { id: "gap_short", group: "tech", label: "코스피 대비 (5일)", kind: "gap", get: (s) => s.gap?.short ?? null, help: "같은 기간 코스피 수익률 대비 초과 수익률(%p)" },
  { id: "gap_mid", group: "tech", label: "코스피 대비 (20일)", kind: "gap", get: (s) => s.gap?.mid ?? null, help: "같은 기간 코스피 수익률 대비 초과 수익률(%p)" },

  // 테마 (화제성 = 최근 뉴스·리포트 언급 정도. 유망도·전망이 아니다)
  { id: "theme_buzz", group: "theme", label: "테마 화제성", kind: "grade", get: maxBuzzOf, help: "소속 테마 중 가장 높은 화제성 단계 (아직 3개 테마만 조사됨)" },
  { id: "theme_in", group: "theme", label: "특정 테마 소속", kind: "theme" },

  // 이벤트
  { id: "event_has", group: "event", label: "최근 60일 주요 공시", kind: "flag", get: (s) => !!s.event },
  { id: "event_type", group: "event", label: "공시 유형별 (유상증자 등)", ready: false },
];

const byId = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

// 빠른 시작: "조건 배열"일 뿐이다. 누르면 빌더에 조건이 채워진다.
// key가 있는 프리셋은 /?page=screener&preset=<key> 로 외부(홈의 공탐지수 카드 등)에서 바로 연결할 수 있다.
const PRESETS = [
  { key: "solid_quiet_event", label: "재무 탄탄 + 최근 공시 없음", conds: [{ id: "company", op: "gte", value: 70 }, { id: "event_has", op: "is", value: false }] },
  { key: "solid_calm", label: "재무 탄탄한데 시장은 잠잠", conds: [{ id: "company", op: "gte", value: 70 }, { id: "tech_market", op: "lte", value: 40 }] },
  { key: "buzz_theme", label: "화제성 높은 테마", conds: [{ id: "theme_buzz", op: "gte", value: 4 }] },
  { key: "hot_weak", label: "재무 약한데 시장은 과열 (조심)", conds: [{ id: "company", op: "lte", value: 40 }, { id: "tech_market", op: "gte", value: 70 }] },
  { key: "breakout", label: "돌파 임박", conds: [{ id: "tech_high", op: "gte", value: 80 }, { id: "tech_vol", op: "gte", value: 80 }] },
  { key: "momentum", label: "상승 흐름", conds: [{ id: "tech_mom", op: "gte", value: 80 }, { id: "tech_vol", op: "gte", value: 70 }] },
  // 공탐지수 카드에서 연결되는 프리셋. "공포구간이니 사라"가 아니라, 괴리도 조건으로 직접 걸러보게 한다.
  { key: "lagging_kospi", label: "최근 코스피보다 뒤처진 종목", conds: [{ id: "gap_mid", op: "lte", value: -10 }] },
  { key: "leading_kospi", label: "최근 코스피보다 앞선 종목", conds: [{ id: "gap_mid", op: "gte", value: 10 }] },
];

const defaultCond = (id) => {
  const d = byId[id];
  if (d.kind === "score") return { id, op: "gte", value: 70 };
  if (d.kind === "gap") return { id, op: "gte", value: 10 };
  if (d.kind === "grade") return { id, op: "gte", value: 4 };
  if (d.kind === "flag") return { id, op: "is", value: false };
  return { id, op: "in", value: "" };
};

const passes = (s, c) => {
  const d = byId[c.id];
  if (!d) return true;
  if (d.kind === "score" || d.kind === "gap") {
    const v = d.get(s);
    if (v == null) return false;
    return c.op === "lte" ? v <= c.value : v >= c.value;
  }
  if (d.kind === "grade") return d.get(s) >= c.value;
  if (d.kind === "theme") return !c.value || (s.themes || []).includes(c.value);
  if (d.kind === "flag") return !!d.get(s) === c.value;
  return true;
};

// 정렬: 점수형 조건이 있으면 그 값들의 평균(이하 조건은 뒤집어서), 없으면 시장 신호 순.
// gap(코스피 대비, %p)은 점수(0~100)와 스케일이 달라서 0~100으로 맞춰 넣는다(-50%p~+50%p -> 0~100).
const sortValue = (s, conds) => {
  const vals = [];
  conds.forEach((c) => {
    const d = byId[c.id];
    if (!d) return;
    if (d.kind === "score") {
      const v = d.get(s);
      if (v != null) vals.push(c.op === "lte" ? 100 - v : v);
    } else if (d.kind === "gap") {
      const v = d.get(s);
      if (v != null) {
        const norm = Math.max(0, Math.min(100, v + 50));
        vals.push(c.op === "lte" ? 100 - norm : norm);
      }
    } else if (d.kind === "grade") {
      vals.push(d.get(s) * 20);
    }
  });
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : marketScoreOf(s) ?? 0;
};

function Chip({ children, color }) {
  return (
    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", background: C.ground, color: color || C.ink, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export default function Screener() {
  const [allStocks, setAllStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conds, setConds] = useState([]);
  const [group, setGroup] = useState("finance");
  const uid = useRef(0);

  useEffect(() => {
    fetch("/heat_kr.json")
      .then((r) => r.json())
      .then((j) => {
        setAllStocks(j?.by_cap?.all || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // 홈의 공탐지수 카드 등 외부에서 /?page=screener&preset=<key> 로 들어오면 그 프리셋을 바로 채워준다.
    const params = new URLSearchParams(window.location.search);
    const presetKey = params.get("preset");
    if (presetKey) {
      const matched = PRESETS.find((p) => p.key === presetKey);
      if (matched) {
        setConds(matched.conds.map((c) => ({ ...c, uid: ++uid.current })));
        if (window.gtag) window.gtag("event", "screener_preset_click", { preset: matched.label, source: "url" });
      }
    }
  }, []);

  const themeNames = useMemo(() => {
    const set = new Set();
    allStocks.forEach((s) => (s.themes || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }, [allStocks]);

  const withUid = (list) => list.map((c) => ({ ...c, uid: ++uid.current }));

  const addCond = (id) => {
    if (conds.some((c) => c.id === id)) return;
    setConds([...conds, ...withUid([defaultCond(id)])]);
    if (window.gtag) window.gtag("event", "screener_condition_add", { criterion: id });
  };
  const updateCond = (u, patch) => setConds(conds.map((c) => (c.uid === u ? { ...c, ...patch } : c)));
  const removeCond = (u) => setConds(conds.filter((c) => c.uid !== u));
  const applyPreset = (p) => {
    setConds(withUid(p.conds));
    if (window.gtag) window.gtag("event", "screener_preset_click", { preset: p.label });
  };

  const { results, matched } = useMemo(() => {
    if (!conds.length) return { results: [], matched: 0 };
    const hits = allStocks.filter((s) => conds.every((c) => passes(s, c)));
    const sorted = [...hits].sort((a, b) => sortValue(b, conds) - sortValue(a, conds));
    return { results: sorted.slice(0, TOP_N), matched: hits.length };
  }, [conds, allStocks]);

  const items = CATALOG.filter((c) => c.group === group);

  return (
    <div style={{ background: C.ground, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .sc { font-family:'Inter Tight','Noto Sans KR',system-ui,sans-serif; }
        .mono { font-family:'JetBrains Mono','Noto Sans KR',monospace; font-variant-numeric: tabular-nums; }
        .wrap { max-width: 680px; margin: 0 auto; padding: 0 18px; }
        button:focus-visible, select:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        .rrow { cursor: pointer; }
        .rrow:hover { background: ${C.ground}; }
        input[type=range] { width: 100%; accent-color: ${C.ink}; }
      `}</style>

      <div className="sc">
        <section className="wrap" style={{ paddingTop: 56, paddingBottom: 20 }}>
          <a href="/" style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}>← HEAT DESK</a>
          <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "10px 0 8px" }}>내 기준으로 종목 찾기</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            재무 · 기술적 지표 · 테마 · 이벤트에서 조건을 골라 담으면, 지금 그 조건에 맞는 종목을 보여드립니다.
          </p>
        </section>

        {/* 빠른 시작 */}
        <section className="wrap" style={{ paddingBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>빠른 시작</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRESETS.map((p) => (
              <button key={p.label} onClick={() => applyPreset(p)}
                style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 999, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }}>
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* 조건 고르기 */}
        <section className="wrap" style={{ paddingBottom: 16 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
              {GROUPS.map((g) => (
                <button key={g.key} onClick={() => setGroup(g.key)}
                  style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, padding: "7px 12px", borderRadius: 4, whiteSpace: "nowrap",
                    border: `1px solid ${group === g.key ? C.ink : C.line}`, background: group === g.key ? C.ink : "transparent", color: group === g.key ? "#fff" : C.ink }}>
                  {g.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {items.map((it) => {
                const ready = it.ready !== false;
                const added = conds.some((c) => c.id === it.id);
                return (
                  <button key={it.id} disabled={!ready || added} onClick={() => addCond(it.id)} title={it.help || ""}
                    style={{ cursor: ready && !added ? "pointer" : "default", fontFamily: "inherit", fontSize: 12, padding: "7px 10px", borderRadius: 4,
                      border: `1px dashed ${C.line}`, background: added ? C.ground : "transparent", color: ready ? C.ink : C.muted, opacity: ready ? 1 : 0.7 }}>
                    {ready ? (added ? "✓ " : "+ ") : ""}{it.label}{!ready && <span style={{ marginLeft: 6, fontSize: 10 }}>준비 중</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 담긴 조건 */}
        <section className="wrap" style={{ paddingBottom: 20 }}>
          {conds.length === 0 ? (
            <div style={{ fontSize: 13, color: C.muted, padding: "8px 2px" }}>위에서 조건을 담거나, 빠른 시작을 눌러보세요.</div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {conds.map((c) => {
                const d = byId[c.id];
                return (
                  <div key={c.uid} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: d.kind === "flag" || d.kind === "theme" ? 0 : 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{d.label}</span>

                      {(d.kind === "score" || d.kind === "gap") && (
                        <>
                          <select value={c.op} onChange={(e) => updateCond(c.uid, { op: e.target.value })}
                            style={{ fontFamily: "inherit", fontSize: 12, padding: "4px 6px", border: `1px solid ${C.line}`, borderRadius: 4, background: C.panel }}>
                            <option value="gte">이상</option>
                            <option value="lte">이하</option>
                          </select>
                          <span className="mono" style={{ fontSize: 13, fontWeight: 700, width: 38, textAlign: "right" }}>
                            {c.value > 0 && d.kind === "gap" ? "+" : ""}{c.value}{d.kind === "gap" ? "%p" : ""}
                          </span>
                        </>
                      )}
                      {d.kind === "grade" && (
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{BUZZ_LABEL[c.value]} 이상</span>
                      )}
                      {d.kind === "theme" && (
                        <select value={c.value} onChange={(e) => updateCond(c.uid, { value: e.target.value })}
                          style={{ fontFamily: "inherit", fontSize: 12, padding: "5px 6px", border: `1px solid ${C.line}`, borderRadius: 4, background: C.panel, maxWidth: 200 }}>
                          <option value="">테마 선택</option>
                          {themeNames.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      )}
                      {d.kind === "flag" && (
                        <div style={{ display: "flex", gap: 4 }}>
                          {[{ v: true, l: "있음" }, { v: false, l: "없음" }].map((o) => (
                            <button key={o.l} onClick={() => updateCond(c.uid, { value: o.v })}
                              style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 4,
                                border: `1px solid ${c.value === o.v ? C.ink : C.line}`, background: c.value === o.v ? C.ink : "transparent", color: c.value === o.v ? "#fff" : C.ink }}>
                              {o.l}
                            </button>
                          ))}
                        </div>
                      )}
                      <button onClick={() => removeCond(c.uid)} aria-label="조건 삭제"
                        style={{ cursor: "pointer", border: "none", background: "transparent", color: C.muted, fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
                    </div>
                    {d.kind === "score" && (
                      <input type="range" min="0" max="100" step="5" value={c.value} onChange={(e) => updateCond(c.uid, { value: Number(e.target.value) })} />
                    )}
                    {d.kind === "gap" && (
                      <input type="range" min="-50" max="50" step="5" value={c.value} onChange={(e) => updateCond(c.uid, { value: Number(e.target.value) })} />
                    )}
                    {d.kind === "grade" && (
                      <input type="range" min="1" max="5" step="1" value={c.value} onChange={(e) => updateCond(c.uid, { value: Number(e.target.value) })} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 결과 */}
        {conds.length > 0 && !loading && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "18px 0" }}>
              <div style={{ padding: "0 18px", marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
                조건에 맞는 종목 {matched.toLocaleString()}개{matched > TOP_N ? ` 중 상위 ${TOP_N}개` : ""}
              </div>
              {results.length === 0 ? (
                <div style={{ padding: "8px 18px", fontSize: 13, color: C.muted }}>지금은 조건에 맞는 종목이 없습니다. 기준을 조금 느슨하게 바꿔보세요.</div>
              ) : (
                results.map((r, i) => (
                  <div key={r.id} className="rrow"
                    onClick={() => (window.location.href = `/?page=diagnose&stock=${encodeURIComponent(r.name)}`)}
                    style={{ padding: "12px 18px", borderTop: "1px solid #F0F2F6" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span className="mono" style={{ fontSize: 12, color: C.muted, width: 20 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{r.name}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: r.chg >= 0 ? C.up : C.down }}>
                        {r.chg >= 0 ? "+" : ""}{r.chg.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, paddingLeft: 30 }}>
                      <Chip>시장 {Math.round(marketScoreOf(r))}</Chip>
                      <Chip>{r.company != null ? `기업 ${Math.round(r.company)}` : "기업 –"}</Chip>
                      {r.event ? <Chip color={C.up}>공시 {r.event.type}</Chip> : <Chip color={C.muted}>공시 없음</Chip>}
                      {(r.themes || []).slice(0, 2).map((t) => <Chip key={t} color={C.muted}>{t}</Chip>)}
                    </div>
                  </div>
                ))
              )}
              <div style={{ fontSize: 11, color: C.muted, padding: "12px 18px 0" }}>종목을 누르면 상세 진단으로 이동합니다.</div>
            </div>
          </section>
        )}

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            조건에 맞는 종목을 보여주는 필터일 뿐, 매수·매도를 추천하지 않습니다. 기업 체력은 재무 데이터가 확인된 종목에만 있으며(금융업 등 일부 제외),
            테마 화제성은 최근 뉴스·리포트 언급 정도를 관찰한 것으로 전망이나 유망도가 아닙니다. 모든 기준은 초기 버전이라 계속 다듬고 있습니다.
            투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
