import React, { useState } from "react";

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

const LABEL_COLOR = {
  "극단적 공포": C.down,
  "공포": "#5B8FE0",
  "중립": C.warn,
  "탐욕": "#E0732F",
  "극단적 탐욕": C.up,
};

const FACTOR_LABELS = {
  mom: "모멘텀",
  value: "거래대금",
  high: "고점 근접",
  vola: "변동성",
};

function ThermoSvg({ score, color, size = 120 }) {
  const w = size * 0.42;
  const h = size;
  const bulbR = w * 0.95;
  const tubeW = w * 0.46;
  const tubeTop = bulbR * 0.3;
  const tubeBottom = h - bulbR * 1.1;
  const tubeH = tubeBottom - tubeTop;
  const fillH = Math.max(6, (Math.max(0, Math.min(100, score)) / 100) * tubeH);

  const cx = w / 2 + 6;

  return (
    <svg width={w + 12} height={h} viewBox={`0 0 ${w + 12} ${h}`} role="img" aria-label={`온도 ${score}도`}>
      {/* 유리관 테두리 */}
      <rect x={cx - tubeW / 2} y={tubeTop} width={tubeW} height={tubeH} rx={tubeW / 2} fill={C.ground} stroke={C.line} strokeWidth="2" />
      <circle cx={cx} cy={tubeBottom + bulbR * 0.75} r={bulbR * 0.78} fill={C.ground} stroke={C.line} strokeWidth="2" />
      {/* 수은주 */}
      <rect x={cx - tubeW / 2 + 3} y={tubeBottom - fillH} width={tubeW - 6} height={fillH + bulbR} rx={(tubeW - 6) / 2} fill={color} />
      <circle cx={cx} cy={tubeBottom + bulbR * 0.75} r={bulbR * 0.62} fill={color} />
      {/* 눈금 */}
      {[25, 50, 75].map((t) => {
        const y = tubeBottom - (t / 100) * tubeH;
        return <line key={t} x1={cx + tubeW / 2 + 2} y1={y} x2={cx + tubeW / 2 + 8} y2={y} stroke={C.muted} strokeWidth="1.5" />;
      })}
    </svg>
  );
}

function MiniTrend({ points, color, width = 220, height = 48 }) {
  if (!points || points.length < 2) return null;
  const n = points.length;
  const step = width / (n - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${(height - (p.score / 100) * height).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={C.line} strokeWidth="1" strokeDasharray="3,3" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// 코스피/코스닥 온도계 하나. index_heat.json의 entry(온도 정보 포함)를 그대로 받는다.
export default function Thermometer({ entry }) {
  const [open, setOpen] = useState(false);
  if (!entry?.temperature) return null;

  const { score, label, breakdown } = entry.temperature;
  const color = LABEL_COLOR[label] || C.muted;
  const trend = entry.temp_trend || [];
  const backtest = entry.backtest || [];

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 18 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer", width: "100%", background: "transparent", border: "none", textAlign: "left",
          display: "flex", alignItems: "center", gap: 16, fontFamily: "inherit", padding: 0,
        }}
      >
        <ThermoSvg score={score} color={color} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{entry.name}</div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.1 }}>
            {score.toFixed(0)}<span style={{ fontSize: 16 }}>도</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 2 }}>{label}</div>
        </div>
        <span className="mono" style={{ fontSize: 11, color: C.muted, alignSelf: "flex-start" }}>{open ? "접기 ▲" : "자세히 ▼"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.line}` }}>
          {trend.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>최근 90일 추이</div>
              <MiniTrend points={trend} color={color} />
            </div>
          )}

          {breakdown && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>오늘 온도를 구성하는 4개 지표</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {Object.entries(breakdown).map(([k, v]) => (
                  <div key={k} style={{ textAlign: "center" }}>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>{Math.round(v)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{FACTOR_LABELS[k] || k}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {backtest.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>이 온도대였던 과거엔, 그 뒤 20일 평균</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {backtest.map((row) => (
                  <div key={row.bucket} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                    <span style={{ color: row.bucket === label ? C.ink : C.muted, fontWeight: row.bucket === label ? 700 : 400 }}>
                      {row.bucket}{row.bucket === label ? " (지금)" : ""}
                    </span>
                    <span className="mono" style={{ color: C.muted }}>
                      {row.avg_fwd_return === null
                        ? "표본 부족"
                        : <span style={{ color: row.avg_fwd_return >= 0 ? C.up : C.down, fontWeight: 600 }}>
                            {row.avg_fwd_return >= 0 ? "+" : ""}{row.avg_fwd_return}% <span style={{ color: C.muted, fontWeight: 400 }}>(표본 {row.count}개)</span>
                          </span>}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                과거에 이 온도대였던 날들을 모아, 그 뒤 20일 수익률을 평균 낸 관찰 통계입니다.
                앞으로도 같을 것이라는 예측이 아니며, 매수·매도를 추천하지 않습니다.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
