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

// make_index_heat.py의 BACKTEST_HORIZONS와 이름이 같아야 한다(30일/60일/6개월/1년).
const HORIZON_LABELS = ["30일", "60일", "6개월", "1년"];

const FACTOR_LABELS = {
  mom: "모멘텀",
  value: "거래대금",
  high: "고점 근접",
  vola: "변동성",
};

function ThermoSvg({ score, color, size = 130 }) {
  const w = 56;
  const h = size;
  const cx = 30;
  const bulbR = 20;
  const bulbCy = h - bulbR - 4;
  const tubeW = 16;
  const tubeTop = 10;
  const tubeBottom = bulbCy - bulbR * 0.3;
  const tubeH = tubeBottom - tubeTop;
  const clamped = Math.max(0, Math.min(100, score));
  const fillH = Math.max(8, (clamped / 100) * tubeH);

  const ticks = [0, 25, 50, 75, 100];

  return (
    <svg width={w + 34} height={h} viewBox={`0 0 ${w + 34} ${h}`} role="img" aria-label={`온도 ${score}도`}>
      {/* 유리관 바깥 테두리: 위는 둥근 캡, 아래는 전구와 이어짐 */}
      <path
        d={`M ${cx - tubeW / 2} ${tubeTop + tubeW / 2}
            a ${tubeW / 2} ${tubeW / 2} 0 0 1 ${tubeW} 0
            L ${cx + tubeW / 2} ${tubeBottom}
            L ${cx - tubeW / 2} ${tubeBottom} Z`}
        fill={C.panel} stroke={C.line} strokeWidth="2.5"
      />
      <circle cx={cx} cy={bulbCy} r={bulbR + 2.5} fill={C.panel} stroke={C.line} strokeWidth="2.5" />

      {/* 수은주 채움 */}
      <rect x={cx - tubeW / 2 + 3} y={tubeBottom - fillH} width={tubeW - 6} height={fillH + bulbR + 6} fill={color} />
      <circle cx={cx} cy={bulbCy} r={bulbR - 1} fill={color} />

      {/* 눈금 + 숫자 */}
      {ticks.map((t) => {
        const y = tubeBottom - (t / 100) * tubeH;
        return (
          <g key={t}>
            <line x1={cx + tubeW / 2 + 3} y1={y} x2={cx + tubeW / 2 + 9} y2={y} stroke={C.muted} strokeWidth="1.5" />
            <text x={cx + tubeW / 2 + 13} y={y + 3} fontSize="9" fontFamily="'JetBrains Mono',monospace" fill={C.muted}>{t}</text>
          </g>
        );
      })}

      {/* 전구 안 숫자 */}
      <text x={cx} y={bulbCy + 4} textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="'JetBrains Mono',monospace" fill="#fff">
        {Math.round(clamped)}
      </text>
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
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>이 온도대였던 과거엔, 그 뒤 수익률 평균</div>
              <div className="hscroll-thermo" style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "4px 6px", color: C.muted, fontWeight: 600 }}>구간</th>
                      {HORIZON_LABELS.map((h) => (
                        <th key={h} style={{ textAlign: "right", padding: "4px 6px", color: C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {backtest.map((row) => (
                      <tr key={row.bucket} style={{ borderTop: `1px solid ${C.ground}` }}>
                        <td style={{ padding: "5px 6px", color: row.bucket === label ? C.ink : C.muted, fontWeight: row.bucket === label ? 700 : 400, whiteSpace: "nowrap" }}>
                          {row.bucket}{row.bucket === label ? " ●" : ""}
                        </td>
                        {HORIZON_LABELS.map((h) => {
                          const stat = row.horizons?.[h];
                          if (!stat || stat.avg_return === null) {
                            return <td key={h} className="mono" style={{ textAlign: "right", padding: "5px 6px", color: C.muted }}>–</td>;
                          }
                          return (
                            <td key={h} className="mono" style={{ textAlign: "right", padding: "5px 6px", color: stat.avg_return >= 0 ? C.up : C.down, fontWeight: 600 }}>
                              {stat.avg_return >= 0 ? "+" : ""}{stat.avg_return}%
                              <div style={{ fontSize: 9, color: C.muted, fontWeight: 400 }}>표본 {stat.count}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                과거에 이 온도대였던 날들을 모아, 실제 달력 날짜 기준(거래일 개수 아님) 그 뒤 수익률을 평균 낸
                관찰 통계입니다. 앞으로도 같을 것이라는 예측이 아니며, 매수·매도를 추천하지 않습니다.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
