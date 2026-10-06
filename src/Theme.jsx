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

const marketScoreOf = (s) => {
  const v = Object.values(s.f || {});
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// Diagnose/Screener/Landing과 같은 등급 기준. 판정이 아니라 숫자를 읽기 쉽게 돕는 표기.
const gradeOf = (score) => {
  if (score === null || score === undefined) return null;
  if (score >= 85) return "A+";
  if (score >= 70) return "A";
  if (score >= 55) return "B+";
  if (score >= 40) return "B";
  if (score >= 25) return "C";
  return "D";
};

const mean = (arr) => {
  const xs = arr.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
};

// 진단 화면의 테마 카드와 같은 색 규칙(화제성 4 이상 빨강, 3 노랑, 그 아래 파랑).
const buzzColor = (g) => (g >= 4 ? C.up : g === 3 ? C.warn : C.down);

const pct = (v) => (v === null || v === undefined ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v) => (v === null || v === undefined ? C.muted : v >= 0 ? C.up : C.down);

const goDiagnose = (name) => {
  window.location.href = `/?page=diagnose&stock=${encodeURIComponent(name)}`;
};
const goTheme = (name) => {
  if (window.gtag) window.gtag("event", "theme_click", { theme: name });
  window.location.href = `/?page=theme&theme=${encodeURIComponent(name)}`;
};

const SORTS = [
  { key: "market", label: "시장 신호 순", get: (s) => marketScoreOf(s) },
  { key: "company", label: "기업 체력 순", get: (s) => s.company ?? null },
  { key: "chg", label: "등락률 순", get: (s) => s.chg ?? null },
];

export default function Theme() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState("market");

  const selectedName = useMemo(() => new URLSearchParams(window.location.search).get("theme"), []);

  useEffect(() => {
    fetch("/heat_kr.json")
      .then((r) => r.json())
      .then((j) => {
        setStocks(j?.by_cap?.all || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 테마별로 소속 종목을 모으고, 화제성(종목 데이터에 붙어있는 theme_buzz)과 평균값을 계산한다.
  const themes = useMemo(() => {
    const map = {};
    stocks.forEach((s) =>
      (s.themes || []).forEach((t) => {
        if (!map[t]) map[t] = { name: t, stocks: [], buzz: null };
        map[t].stocks.push(s);
        if (!map[t].buzz) {
          const b = (s.theme_buzz || []).find((x) => x.theme === t);
          if (b) map[t].buzz = b;
        }
      })
    );
    return Object.values(map)
      .map((t) => ({
        ...t,
        avgChg: mean(t.stocks.map((s) => s.chg)),
        avgMarket: mean(t.stocks.map((s) => marketScoreOf(s))),
      }))
      .sort((a, b) => (b.buzz?.grade ?? 0) - (a.buzz?.grade ?? 0) || b.stocks.length - a.stocks.length);
  }, [stocks]);

  const selected = selectedName ? themes.find((t) => t.name === selectedName) : null;

  const sortedStocks = useMemo(() => {
    if (!selected) return [];
    const getter = SORTS.find((s) => s.key === sortKey)?.get || SORTS[0].get;
    return [...selected.stocks].sort((a, b) => {
      const va = getter(a), vb = getter(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return vb - va;
    });
  }, [selected, sortKey]);

  return (
    <div style={{ background: C.ground, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .th { font-family:'Inter Tight','Noto Sans KR',system-ui,sans-serif; }
        .mono { font-family:'JetBrains Mono','Noto Sans KR',monospace; font-variant-numeric: tabular-nums; }
        .wrap { max-width: 1060px; margin: 0 auto; padding: 0 18px; }
        button:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        .tcard { cursor: pointer; text-align: left; font-family: inherit; }
        .tcard:hover { border-color: ${C.ink} !important; }
        .srow { cursor: pointer; }
        .srow:hover { background: ${C.ground}; }
        .clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}</style>

      <div className="th">
        <Nav page="theme" />

        {loading && (
          <section className="wrap" style={{ paddingTop: 36 }}>
            <div style={{ fontSize: 13, color: C.muted }}>테마 데이터 불러오는 중...</div>
          </section>
        )}

        {/* 상세: 한 테마의 화제성과 소속 종목 */}
        {!loading && selectedName && (
          <section className="wrap" style={{ paddingTop: 36, paddingBottom: 48 }}>
            <a href="/?page=theme" style={{ fontSize: 12, color: C.muted, textDecoration: "none" }}>← 테마 목록</a>

            {!selected ? (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 20, fontSize: 14, color: C.muted, marginTop: 12 }}>
                "{selectedName}" 테마를 찾을 수 없습니다.
              </div>
            ) : (
              <>
                <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "10px 0 14px" }}>{selected.name}</h1>

                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>화제성</div>
                  {selected.buzz ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 700, color: buzzColor(selected.buzz.grade), marginBottom: 8 }}>
                        {selected.buzz.grade_label}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{selected.buzz.note}</div>
                      <div className="mono" style={{ fontSize: 11, color: C.muted }}>{selected.buzz.checked_date} 확인</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: C.muted }}>이 테마는 아직 화제성 조사 전입니다.</div>
                  )}
                  <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, borderTop: `1px solid ${C.line}`, marginTop: 14, paddingTop: 10 }}>
                    화제성은 최근 뉴스·증권가 리포트에서 이 테마가 얼마나 자주 언급되는지를 관찰한 단계입니다.
                    앞으로 오를 테마라는 뜻이 아니며, 이미 많이 오른 뒤일 수도 있습니다.
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3,1fr)", marginBottom: 14 }}>
                  {[
                    { label: "집계 종목", value: `${selected.stocks.length}개` },
                    { label: "오늘 평균 등락", value: pct(selected.avgChg), color: tone(selected.avgChg) },
                    { label: "평균 시장 신호", value: selected.avgMarket === null ? "–" : Math.round(selected.avgMarket) },
                  ].map((m) => (
                    <div key={m.label} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 14 }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{m.label}</div>
                      <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: m.color || C.ink }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "16px 0" }}>
                  <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto" }}>
                    {SORTS.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setSortKey(s.key)}
                        style={{
                          cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 2, whiteSpace: "nowrap",
                          border: `1px solid ${sortKey === s.key ? C.ink : C.line}`,
                          background: sortKey === s.key ? C.ink : "transparent",
                          color: sortKey === s.key ? "#fff" : C.ink,
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {sortedStocks.map((s, i) => {
                    const ms = marketScoreOf(s);
                    return (
                      <div
                        key={s.id}
                        className="srow"
                        onClick={() => goDiagnose(s.name)}
                        style={{ padding: "10px 16px", borderTop: "1px solid #F0F2F6" }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span className="mono" style={{ fontSize: 12, color: C.muted, width: 22 }}>{String(i + 1).padStart(2, "0")}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{s.name}</span>
                          <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: tone(s.chg) }}>{pct(s.chg)}</span>
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: C.muted, marginTop: 4, paddingLeft: 32 }}>
                          시장 {Math.round(ms)} {gradeOf(ms)} · {s.company != null ? `기업 ${Math.round(s.company)} ${gradeOf(s.company)}` : "기업 –"}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 11, color: C.muted, padding: "12px 16px 0" }}>종목을 누르면 상세 진단으로 이동합니다.</div>
                </div>
              </>
            )}
          </section>
        )}

        {/* 목록: 화제성 높은 순 */}
        {!loading && !selectedName && (
          <section className="wrap" style={{ paddingTop: 36, paddingBottom: 48 }}>
            <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "0 0 8px" }}>테마별로 보기</h1>
            <p style={{ fontSize: 14, color: C.muted, margin: "0 0 6px", lineHeight: 1.6 }}>
              최근 뉴스에서 자주 언급되는 순서로 정렬했습니다. 테마를 누르면 소속 종목을 볼 수 있습니다.
            </p>
            <p style={{ fontSize: 11, color: C.muted, margin: "0 0 18px", lineHeight: 1.6 }}>
              화제성은 언급 빈도를 관찰한 것으로, 앞으로 오를 테마라는 뜻이 아니며 매수·매도를 추천하지 않습니다.
            </p>

            {themes.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>테마 데이터를 불러오지 못했습니다.</div>
            ) : (
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
                {themes.map((t) => (
                  <button
                    key={t.name}
                    className="tcard"
                    onClick={() => goTheme(t.name)}
                    style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16 }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{t.name}</span>
                      {t.buzz ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: buzzColor(t.buzz.grade), whiteSpace: "nowrap" }}>
                          화제성 {t.buzz.grade_label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>체크 예정</span>
                      )}
                    </div>
                    {t.buzz && (
                      <div className="clamp2" style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 10 }}>{t.buzz.note}</div>
                    )}
                    <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted }}>
                      <span>{t.stocks.length}개 종목</span>
                      <span style={{ color: tone(t.avgChg), fontWeight: 700 }}>오늘 평균 {pct(t.avgChg)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            테마와 소속 종목은 직접 선정한 대표 종목 기준이며 전체를 포괄하지 않습니다. 매수·매도를 추천하지 않으며,
            투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
