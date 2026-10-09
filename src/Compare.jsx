import React, { useState, useEffect, useMemo } from "react";
import Nav from "./Nav.jsx";
import ShareButton from "./ShareButton.jsx";

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

// 빨강/파랑은 이 사이트에서 "오름/내림, 뜨거움/차가움"을 뜻해서, 두 종목 색은 그 의미와 겹치지 않게 잡는다.
const COLOR_A = "#3E8E7E";
const COLOR_B = "#F2882D";

const AXES = [
  { key: "market", label: "시장 신호" },
  { key: "company", label: "기업 체력" },
  { key: "event", label: "공시 안전성" },
  { key: "theme", label: "테마 화제성" },
];

// Diagnose/Screener/Landing/Theme과 같은 등급 기준. 판정이 아니라 숫자를 읽기 쉽게 돕는 표기.
const gradeOf = (score) => {
  if (score === null || score === undefined) return null;
  if (score >= 85) return "A+";
  if (score >= 70) return "A";
  if (score >= 55) return "B+";
  if (score >= 40) return "B";
  if (score >= 25) return "C";
  return "D";
};

const pct = (v) => (v === null || v === undefined ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v) => (v === null || v === undefined ? C.muted : v >= 0 ? C.up : C.down);

const scoreText = (v) => (v === null || v === undefined ? "자료 없음" : `${Math.round(v)} ${gradeOf(v)}`);

// 두 종목의 4축을 한 그림에 겹쳐 그린다. 값이 없는 축(null)은 0으로 이어 그리되 점은 찍지 않는다.
function CompareRadar({ a, b }) {
  const W = 340, H = 300, cx = 170, cy = 150, r = 90;
  const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
  const pt = (i, v) => {
    const rr = (Math.max(0, Math.min(100, v)) / 100) * r;
    return [cx + rr * Math.cos(angle(i)), cy + rr * Math.sin(angle(i))];
  };
  const polygon = (axes) => AXES.map((d, i) => pt(i, axes?.[d.key] ?? 0).join(",")).join(" ");

  const labelPos = [
    { x: cx, y: cy - r - 12, anchor: "middle" },
    { x: cx + r + 10, y: cy + 4, anchor: "start" },
    { x: cx, y: cy + r + 22, anchor: "middle" },
    { x: cx - r - 10, y: cy + 4, anchor: "end" },
  ];

  const dots = (axes, color) =>
    AXES.map((d, i) => {
      const v = axes?.[d.key];
      if (v === null || v === undefined) return null;
      const [x, y] = pt(i, v);
      return <circle key={d.key} cx={x} cy={y} r="4" fill={color} />;
    });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340, display: "block", margin: "0 auto" }} role="img" aria-label="두 종목 4축 비교 레이더 차트">
      {[25, 50, 75, 100].map((ring) => (
        <polygon key={ring} points={AXES.map((_, i) => pt(i, ring).join(",")).join(" ")} fill="none" stroke={C.line} strokeWidth="1" />
      ))}
      {AXES.map((d, i) => {
        const [x, y] = pt(i, 100);
        return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke={C.line} strokeWidth="1" />;
      })}
      {a && <polygon points={polygon(a.axes)} fill={COLOR_A} fillOpacity="0.15" stroke={COLOR_A} strokeWidth="2" />}
      {b && <polygon points={polygon(b.axes)} fill={COLOR_B} fillOpacity="0.15" stroke={COLOR_B} strokeWidth="2" />}
      {a && dots(a.axes, COLOR_A)}
      {b && dots(b.axes, COLOR_B)}
      {AXES.map((d, i) => (
        <text
          key={d.key}
          x={labelPos[i].x}
          y={labelPos[i].y}
          textAnchor={labelPos[i].anchor}
          fontSize="11"
          fontWeight="600"
          fontFamily="'Inter Tight','Noto Sans KR',sans-serif"
          fill={C.ink}
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// 종목 하나를 고르는 입력칸 + 자동완성
function Picker({ label, color, value, onChange, names }) {
  const [text, setText] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setText(value || "");
  }, [value]);

  const suggestions = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (!t || t === (value || "").toLowerCase()) return [];
    return names.filter((n) => n.toLowerCase().includes(t)).slice(0, 6);
  }, [text, names, value]);

  const commit = (n) => {
    onChange(n);
    setText(n);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const t = text.trim().toLowerCase();
    const exact = names.find((n) => n.toLowerCase() === t);
    const pick = exact || suggestions[0];
    if (pick) commit(pick);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
        <span style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
        {label}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="종목명 입력"
        style={{
          width: "100%", fontFamily: "inherit", fontSize: 15, padding: "12px 12px",
          borderRadius: 4, border: `1px solid ${C.line}`, background: C.panel, color: C.ink,
        }}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20,
          background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4,
          boxShadow: "0 4px 12px rgba(19,26,42,.08)", overflow: "hidden",
        }}>
          {suggestions.map((n) => (
            <div key={n} className="sug" onMouseDown={() => commit(n)} style={{ padding: "10px 12px", fontSize: 14, cursor: "pointer" }}>
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const topBuzz = (s) => {
  const list = s?.theme_buzz || [];
  if (!list.length) return null;
  return list.reduce((best, x) => (x.grade > best.grade ? x : best), list[0]);
};

const ROWS = [
  { label: "오늘 등락", cell: (s) => <span className="mono" style={{ color: tone(s.chg), fontWeight: 700 }}>{pct(s.chg)}</span> },
  { label: "시장 신호", cell: (s) => <span className="mono">{scoreText(s.axes?.market)}</span> },
  { label: "기업 체력", cell: (s) => <span className="mono">{scoreText(s.axes?.company)}</span> },
  { label: "최근 공시", cell: (s) => (s.event ? s.event.type : "없음 (60일)") },
  {
    label: "테마 화제성",
    cell: (s) => {
      const b = topBuzz(s);
      return b ? `${b.grade_label} (${b.theme})` : "자료 없음";
    },
  },
  { label: "소속 테마", cell: (s) => (s.themes && s.themes.length ? s.themes.join(", ") : "–") },
  {
    label: "코스피 대비 20일",
    cell: (s) =>
      s.gap?.mid === undefined || s.gap?.mid === null ? (
        "–"
      ) : (
        <span className="mono" style={{ color: tone(s.gap.mid), fontWeight: 700 }}>{`${s.gap.mid >= 0 ? "+" : ""}${s.gap.mid.toFixed(1)}%p`}</span>
      ),
  },
];

export default function Compare() {
  const initial = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return { a: p.get("a") || "", b: p.get("b") || "" };
  }, []);

  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nameA, setNameA] = useState(initial.a);
  const [nameB, setNameB] = useState(initial.b);

  useEffect(() => {
    fetch("/heat_kr.json")
      .then((r) => r.json())
      .then((j) => {
        setStocks(j?.by_cap?.all || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const names = useMemo(() => stocks.map((s) => s.name), [stocks]);
  const byName = useMemo(() => {
    const m = {};
    stocks.forEach((s) => { m[s.name.toLowerCase()] = s; });
    return m;
  }, [stocks]);

  const A = nameA ? byName[nameA.toLowerCase()] : null;
  const B = nameB ? byName[nameB.toLowerCase()] : null;

  // 고른 종목을 주소에 반영해서, 그 주소를 그대로 공유할 수 있게 한다.
  useEffect(() => {
    const q = ["page=compare"];
    if (nameA) q.push(`a=${encodeURIComponent(nameA)}`);
    if (nameB) q.push(`b=${encodeURIComponent(nameB)}`);
    window.history.replaceState(null, "", `/?${q.join("&")}`);
  }, [nameA, nameB]);

  useEffect(() => {
    if (A && B && window.gtag) window.gtag("event", "compare_view", { stock_a: A.name, stock_b: B.name });
  }, [A?.name, B?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const goDiagnose = (n) => {
    window.location.href = `/?page=diagnose&stock=${encodeURIComponent(n)}`;
  };

  return (
    <div style={{ background: C.ground, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .cp { font-family:'Inter Tight','Noto Sans KR',system-ui,sans-serif; }
        .mono { font-family:'JetBrains Mono','Noto Sans KR',monospace; font-variant-numeric: tabular-nums; }
        .wrap { max-width: 720px; margin: 0 auto; padding: 0 18px; }
        input:focus, button:focus-visible { outline: 2px solid ${C.ink}; outline-offset: 2px; }
        .sug:hover { background: ${C.ground}; }
      `}</style>

      <div className="cp">
        <Nav page="compare" />

        <section className="wrap" style={{ paddingTop: 36, paddingBottom: 20 }}>
          <h1 style={{ fontSize: "clamp(24px,5vw,32px)", fontWeight: 700, margin: "0 0 8px" }}>두 종목 나란히 비교</h1>
          <p style={{ fontSize: 14, color: C.muted, margin: 0, lineHeight: 1.6 }}>
            종목 두 개를 고르면 시장 신호, 기업 체력, 공시, 테마를 한 그림에 겹쳐서 보여드립니다.
          </p>
        </section>

        <section className="wrap" style={{ paddingBottom: 16 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            <Picker label="종목 A" color={COLOR_A} value={A ? A.name : nameA} onChange={setNameA} names={names} />
            <Picker label="종목 B" color={COLOR_B} value={B ? B.name : nameB} onChange={setNameB} names={names} />
          </div>
          {loading && <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>종목 데이터 불러오는 중...</div>}
          {!loading && ((nameA && !A) || (nameB && !B)) && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>
              목록에서 정확한 종목명을 골라주세요. ({[nameA && !A ? `"${nameA}"` : null, nameB && !B ? `"${nameB}"` : null].filter(Boolean).join(", ")}를 찾지 못했습니다)
            </div>
          )}
        </section>

        {!loading && !A && !B && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>비교할 종목 두 개를 골라주세요.</div>
              <button
                onClick={() => { setNameA("삼성전자"); setNameB("SK하이닉스"); }}
                style={{
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, padding: "9px 14px",
                  borderRadius: 4, border: `1px solid ${C.line}`, background: "transparent", color: C.ink,
                }}
              >
                예시: 삼성전자 vs SK하이닉스
              </button>
            </div>
          </section>
        )}

        {!loading && (A || B) && (
          <section className="wrap" style={{ paddingBottom: 48 }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 24, marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center", marginBottom: 8, fontSize: 13, fontWeight: 700 }}>
                {A && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: COLOR_A, borderRadius: 2 }} />{A.name}</span>}
                {B && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 10, height: 10, background: COLOR_B, borderRadius: 2 }} />{B.name}</span>}
              </div>
              <CompareRadar a={A} b={B} />
              <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 8, lineHeight: 1.6 }}>
                바깥으로 갈수록 점수가 높습니다. 점은 값이 있는 축에만 찍히고, 자료가 없는 축은 0으로 이어집니다.
              </div>
              {A && B && (
                <div style={{ textAlign: "center", marginTop: 12 }}>
                  <ShareButton
                    kind="compare"
                    url={`/?page=compare&a=${encodeURIComponent(A.name)}&b=${encodeURIComponent(B.name)}`}
                    title={`${A.name} vs ${B.name} 비교 · HEAT DESK`}
                  />
                </div>
              )}
            </div>

            {A && B && (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "8px 16px", marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "92px 1fr 1fr", gap: 8, padding: "10px 0", fontSize: 12, fontWeight: 700 }}>
                  <span />
                  <span style={{ color: COLOR_A, cursor: "pointer" }} onClick={() => goDiagnose(A.name)}>{A.name} →</span>
                  <span style={{ color: COLOR_B, cursor: "pointer" }} onClick={() => goDiagnose(B.name)}>{B.name} →</span>
                </div>
                {ROWS.map((row) => (
                  <div key={row.label} style={{ display: "grid", gridTemplateColumns: "92px 1fr 1fr", gap: 8, padding: "10px 0", borderTop: "1px solid #F0F2F6", fontSize: 13, alignItems: "baseline" }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{row.label}</span>
                    <span style={{ wordBreak: "keep-all" }}>{row.cell(A)}</span>
                    <span style={{ wordBreak: "keep-all" }}>{row.cell(B)}</span>
                  </div>
                ))}
              </div>
            )}

            {(!A || !B) && (
              <div style={{ fontSize: 13, color: C.muted, padding: "4px 2px" }}>
                나머지 한 종목을 골라주세요.
              </div>
            )}
          </section>
        )}

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            점수가 높다고 더 좋은 종목이라는 뜻이 아닙니다. 시장 신호는 얼마나 뜨거운지, 기업 체력은 같은 업종 안의 재무 상대 순위,
            공시 안전성은 최근 공시 유형에 따른 일반적 해석, 테마 화제성은 언급 빈도입니다. 두 종목의 우열을 가리거나
            매수·매도를 추천하지 않으며, 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
