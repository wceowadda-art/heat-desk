import React, { useState } from "react";

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
  },
  {
    key: "momentum",
    label: "상승 흐름 탄 종목",
    desc: "최근 모멘텀이 강하고, 거래량도 같이 늘어난 종목",
  },
  {
    key: "oversold",
    label: "많이 빠진 종목",
    desc: "RSI가 낮고, 최근 하락이 컸던 종목",
  },
  {
    key: "breakout",
    label: "돌파 임박 종목",
    desc: "신고가 근접, 거래량 급증이 겹치는 종목",
  },
];

export default function Screener() {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ background: C.ground, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .sc { font-family:'Inter Tight','Noto Sans KR',system-ui,sans-serif; }
        .wrap { max-width: 640px; margin: 0 auto; padding: 0 18px; }
        button:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
      `}</style>

      <div className="sc">
        <section className="wrap" style={{ paddingTop: 56, paddingBottom: 28 }}>
          <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "0 0 8px" }}>
            내 기준으로 종목 찾기
          </h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0 }}>
            원하는 조건을 고르면, 지금 그 조건에 맞는 종목을 보여드립니다.
          </p>
        </section>

        <section className="wrap" style={{ paddingBottom: 32 }}>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelected(p.key)}
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
        </section>

        {selected && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>
                "{PRESETS.find((p) => p.key === selected)?.label}" 결과
              </div>
              <div style={{ fontSize: 13, color: C.muted }}>
                실제 필터링 기능은 준비 중입니다.
              </div>
            </div>
          </section>
        )}

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            이 화면은 개발 중입니다. 조건에 맞는 종목을 매수·매도 추천하지 않으며,
            투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
