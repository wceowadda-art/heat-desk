import React, { useState, useEffect, useMemo } from "react";

const C = {
  ground: "#E9ECF2",
  panel: "#FFFFFF",
  ink: "#131A2A",
  line: "#D3D8E2",
  muted: "#6B7689",
  up: "#E03A3E",
  down: "#2F6FE0",
};

const PRESETS = [
  {
    key: "stable",
    label: "안정적인 종목",
    desc: "변동성이 낮고, 거래량이 꾸준한 종목",
    score: (f) => 100 - f.vola,
  },
  {
    key: "momentum",
    label: "상승 흐름 탄 종목",
    desc: "최근 모멘텀이 강하고, 거래량도 같이 늘어난 종목",
    score: (f) => (f.mom + f.vol) / 2,
  },
  {
    key: "oversold",
    label: "많이 빠진 종목",
    desc: "최근 모멘텀이 약해 상대적으로 많이 빠진 종목",
    score: (f) => 100 - f.mom,
  },
  {
    key: "breakout",
    label: "돌파 임박 종목",
    desc: "신고가 근접, 거래량 급증이 겹치는 종목",
    score: (f) => (f.high + f.vol) / 2,
  },
];

export default function Screener() {
  const [selected, setSelected] = useState(null);
  const [allStocks, setAllStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/heat_kr.json")
      .then((r) => r.json())
      .then((j) => {
        setAllStocks(j?.by_cap?.all || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    if (!selected) return [];
    const preset = PRESETS.find((p) => p.key === selected);
    if (!preset) return [];
    return [...allStocks]
      .map((s) => ({ ...s, _score: preset.score(s.f) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 5);
  }, [selected, allStocks]);

  return (
    <div style={{ background: C.ground, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .sc { font-family:'Inter Tight','Noto Sans KR',system-ui,sans-serif; }
        .mono { font-family:'JetBrains Mono','Noto Sans KR',monospace; font-variant-numeric: tabular-nums; }
        .wrap { max-width: 640px; margin: 0 auto; padding: 0 18px; }
        button:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        .rrow { cursor: pointer; }
        .rrow:hover { background: ${C.ground}; }
      `}</style>

      <div className="sc">
        <section className="wrap" style={{ paddingTop: 56, paddingBottom: 28 }}>
          <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "0 0 8px" }}>
            내 기준으로 종목 찾기
          </h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
            원하는 조건을 고르면, 지금 그 조건에 맞는 상위 5개를 보여드립니다.
          </p>
        </section>

        <section className="wrap" style={{ paddingBottom: 32 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setSelected(p.key);
                  if (window.gtag) window.gtag("event", "screener_preset_click", { preset: p.key });
                }}
                style={{
                  cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  padding: "16px 18px", borderRadius: 6,
                  border: `1px solid ${selected === p.key ? C.ink : C.line}`,
                  background: selected === p.key ? C.ink : C.panel,
                  color: selected === p.key ? "#fff" : C.ink,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: selected === p.key ? "rgba(255,255,255,0.75)" : C.muted, lineHeight: 1.5 }}>
                  {p.desc}
                </div>
              </button>
            ))}
          </div>
          {loading && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>종목 데이터 불러오는 중...</div>
          )}
        </section>

        {selected && !loading && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "20px 0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, padding: "0 20px", marginBottom: 14 }}>
                "{PRESETS.find((p) => p.key === selected)?.label}" 상위 5개
              </div>
              {results.map((r, i) => (
                <div
                  key={r.id}
                  className="rrow"
                  onClick={() => window.location.href = `/?page=diagnose&stock=${encodeURIComponent(r.name)}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 20px", borderTop: i === 0 ? "none" : `1px solid #F0F2F6`,
                  }}
                >
                  <span className="mono" style={{ fontSize: 12, color: C.muted, width: 20 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{r.name}</span>
                  <span className="mono" style={{ fontSize: 11, color: C.muted }}>{r.sub}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: r.chg >= 0 ? C.up : C.down }}>
                    {r.chg >= 0 ? "+" : ""}{r.chg.toFixed(1)}%
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: C.muted, padding: "14px 20px 0" }}>
                종목을 누르면 상세 진단으로 이동합니다.
              </div>
            </div>
          </section>
        )}

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            지금은 거래량·모멘텀·신고가 근접·변동성 4개 지표로만 계산한 근사치입니다.
            매수·매도를 추천하지 않으며, 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
