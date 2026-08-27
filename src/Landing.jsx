import React, { useState, useMemo, useEffect, useRef } from "react";

const TALLY_ID = "gDPDRO";

const C = {
  ground: "#E9ECF2",
  panel: "#FFFFFF",
  ink: "#131A2A",
  line: "#D3D8E2",
  muted: "#6B7689",
  up: "#E03A3E",
  down: "#2F6FE0",
};

const FACTORS = [
  { id: "vol", label: "거래량 급증", color: "#E03A3E" },
  { id: "mom", label: "모멘텀", color: "#F2882D" },
  { id: "high", label: "신고가 근접", color: "#D9B434" },
  { id: "vola", label: "변동성 확대", color: "#3E8E7E" },
  { id: "flow", label: "자금 유입", color: "#2F6FE0" },
];

const PRESETS = {
  균형: { vol: 3, mom: 3, high: 3, vola: 3, flow: 3 },
  "급등 추격": { vol: 5, mom: 5, high: 2, vola: 4, flow: 1 },
  "수급 추종": { vol: 2, mom: 2, high: 1, vola: 1, flow: 5 },
  "돌파 임박": { vol: 4, mom: 2, high: 5, vola: 3, flow: 3 },
};

const DEMO = [
  { id: "247540", name: "에코프로비엠", sub: "KOSDAQ", chg: 7.2, f: { vol: 96, mom: 88, high: 61, vola: 92, flow: 74 } },
  { id: "267260", name: "HD현대일렉트릭", sub: "KOSPI", chg: 4.6, f: { vol: 63, mom: 91, high: 97, vola: 41, flow: 79 } },
  { id: "PLTR", name: "Palantir", sub: "NASDAQ", chg: 5.8, f: { vol: 88, mom: 94, high: 90, vola: 78, flow: 72 } },
  { id: "NVDA", name: "NVIDIA", sub: "NASDAQ", chg: 2.4, f: { vol: 74, mom: 86, high: 93, vola: 51, flow: 95 } },
  { id: "SOL", name: "Solana", sub: "업비트", chg: 8.1, f: { vol: 91, mom: 89, high: 74, vola: 85, flow: 63 } },
  { id: "DOGE", name: "Dogecoin", sub: "업비트", chg: 12.7, f: { vol: 98, mom: 79, high: 48, vola: 96, flow: 31 } },
];

const LOCKED = [
  { t: "백테스트", d: "지금 이 가중치로 3년 전부터 상위 10개를 골랐다면, 수익률이 얼마였을지 즉시 계산합니다." },
  { t: "전체 종목", d: "코스피·코스닥·미국·코인 전 종목. 무료는 상위 6개만 보여드립니다." },
  { t: "발열 알림", d: "내 가중치 기준 상위권에 새로 진입한 종목을 장 마감 후 메일로." },
];

const ROW_H = 82;
const HORIZONS = [
  { k: "r1", label: "다음날" },
  { k: "r5", label: "1주 뒤" },
  { k: "r20", label: "1개월 뒤" },
  { k: "rnow", label: "현재까지" },
];

const pct = (v) => (v === null || v === undefined ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v) => (v === null || v === undefined ? C.muted : v >= 0 ? C.up : C.down);

export default function Landing() {
  const [w, setW] = useState(PRESETS["균형"]);
  const [data, setData] = useState(DEMO);
  const [live, setLive] = useState(false);
  const [hist, setHist] = useState(null);
  const [day, setDay] = useState("");
  const [reduce, setReduce] = useState(false);
  const [factorFilter, setFactorFilter] = useState("vol");
  const formRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia) setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    fetch("/heat_kr.json").then(r => r.json()).then(j => {
      const list = Array.isArray(j) ? j : j.items;
      if (Array.isArray(list) && list.length) { setData(list); setLive(j.updated || true); }
    }).catch(() => {});

    fetch("/history.json").then(r => r.json()).then(j => {
      const keys = Object.keys(j).sort();
      if (keys.length) { setHist(j); setDay(keys[keys.length - 1]); }
    }).catch(() => {});

    const s = document.createElement("script");
    s.src = "https://tally.so/widgets/embed.js";
    s.onload = () => window.Tally && window.Tally.loadEmbeds();
    document.body.appendChild(s);
  }, []);

  const total = FACTORS.reduce((s, f) => s + w[f.id], 0);

  const rows = useMemo(() => {
    const scored = data.map(d => {
      const parts = FACTORS.map(f => ({ ...f, value: total === 0 ? 0 : (w[f.id] * (d.f[f.id] ?? 0)) / total }));
      return { ...d, parts, score: parts.reduce((s, p) => s + p.value, 0) };
    });
    const order = [...scored].sort((a, b) => b.score - a.score).map(d => d.id);
    return scored.map(d => ({ ...d, rank: order.indexOf(d.id) }));
  }, [w, total, data]);

  const days = useMemo(() => (hist ? Object.keys(hist).sort().reverse() : []), [hist]);

  const avg = useMemo(() => {
    if (!hist) return null;
    const all = Object.values(hist).flat();
    const out = {};
    HORIZONS.forEach(({ k }) => {
      const xs = all.map(x => x[k]).filter(v => v !== null && v !== undefined);
      out[k] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    });
    return { out, n: all.length };
  }, [hist]);

  const preset = Object.keys(PRESETS).find(k => FACTORS.every(f => PRESETS[k][f.id] === w[f.id]));

  return (
    <div style={{ background: C.ground, minHeight: "100vh", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter+Tight:wght@400;500;600;700&family=JetBrains+Mono:wght@400;700&family=Noto+Sans+KR:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .hd { font-family:'Inter Tight','Noto Sans KR',system-ui,sans-serif; }
        .mono { font-family:'JetBrains Mono','Noto Sans KR',monospace; font-variant-numeric: tabular-nums; }
        .anton { font-family:'Anton','Noto Sans KR',sans-serif; letter-spacing:.01em; }
        .fader { appearance:none; width:100%; height:22px; background:transparent; cursor:pointer; }
        .fader::-webkit-slider-runnable-track { height:22px; background: linear-gradient(to right, ${C.line} 0%, ${C.line} 100%); }
        .fader::-webkit-slider-thumb { appearance:none; width:12px; height:22px; background:var(--fc); border-radius:2px; cursor:pointer; }
        .fader::-moz-range-track { background:${C.line}; border:none; }
        .fader::-moz-range-thumb { width:12px; height:22px; background:var(--fc); border-radius:2px; border:none; cursor:pointer; }
        .pre { cursor:pointer; font-family:inherit; font-size:12px; font-weight:600; padding:7px 11px; border-radius:2px; border:1px solid ${C.line}; background:transparent; color:${C.ink}; }
        .cta { cursor:pointer; border:none; border-radius:3px; padding:14px 26px; font-size:15px; font-weight:600; font-family:inherit; background:${C.ink}; color:#fff; }
        .wrap { max-width:1060px; margin:0 auto; padding:0 18px; }
        .htable { width:100%; border-collapse:collapse; font-size:13px; }
        .htable th { text-align:right; font-weight:600; font-size:11px; color:${C.muted}; padding:7px 8px; border-bottom:1px solid ${C.line}; }
        .htable th:first-child { text-align:left; }
        .htable td { padding:9px 8px; border-bottom:1px solid #F0F2F6; text-align:right; }
        .hscroll { overflow-x:auto; }
      `}</style>

      <div className="hd">
        <section className="wrap" style={{ paddingTop: 56, paddingBottom: 34 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", color: C.muted, marginBottom: 14 }}>KOSPI KOSDAQ US CRYPTO</div>
          <h1 className="anton" style={{ fontSize: "clamp(46px,10vw,92px)", lineHeight: 0.9, margin: 0 }}>HEAT DESK</h1>
          <p style={{ fontSize: "clamp(16px,2.4vw,20px)", lineHeight: 1.55, maxWidth: 560, marginTop: 20, marginBottom: 24 }}>
            남이 찍어주는 종목 말고, <strong>내 기준으로 거르는 종목.</strong><br/>다섯 개 페이더를 굴려서 나만의 발열 랭킹을 만드세요.
          </p>
          <button className="cta" onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })}>오픈 알림 받기 →</button>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>무료 · 이메일만 남기면 됩니다</div>
        </section>

        <section className="wrap" style={{ paddingBottom: 44 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, letterSpacing: ".06em" }}>지금 만져보세요</h2>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(276px,1fr))" }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 18, maxWidth: 360 }}>
              {FACTORS.map(f => (
                <div key={f.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, background: f.color, borderRadius: 1 }}/>{f.label}
                    </label>
                    <span className="mono" style={{ fontSize: 12, color: w[f.id] === 0 ? C.line : C.ink }}>{w[f.id]}</span>
                  </div>
                  <input className="fader" type="range" min="0" max="5" step="1" value={w[f.id]} 
                    style={{ "--fc": w[f.id] === 0 ? C.line : f.color }}
                    onChange={e => setW({ ...w, [f.id]: Number(e.target.value) })}
                  />
                </div>
              ))}
              <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.keys(PRESETS).map(k => (
                  <button key={k} className="pre" onClick={() => setW(PRESETS[k])}
                    style={{ borderColor: preset === k ? C.ink : C.line, background: preset === k ? C.ink : "transparent", color: preset === k ? "#fff" : C.ink }}
                  >{k}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ position: "relative", height: rows.length * ROW_H }}>
                {rows.map(d => (
                  <div key={d.id} style={{
                    position: "absolute", left: 0, right: 0, height: ROW_H - 6,
                    transform: `translateY(${d.rank * ROW_H}px)`,
                    transition: "transform 480ms cubic-bezier(.2,.85,.25,1)",
                    background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: "11px 13px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span className="mono" style={{ fontSize: 12, color: C.muted, width: 20 }}>{String(d.rank + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{d.name}</span>
                      <span className="mono" style={{ fontSize: 11, color: C.muted, flex: 1 }}>{d.sub}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: d.chg >= 0 ? C.up : C.down }}>{d.chg >= 0 ? "+" : ""}{d.chg.toFixed(1)}%</span>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 700, width: 44, textAlign: "right" }}>{d.score.toFixed(1)}</span>
                    </div>
                    <div style={{ display: "flex", height: 9, background: "#F0F2F6", borderRadius: 1 }}>
                      {d.parts.map(p => (<div key={p.id} style={{ width: `${p.value}%`, background: p.color }}/>))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="wrap" style={{ paddingBottom: 44 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>팩터별 순위</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
              {FACTORS.map(f => (
                <button key={f.id} onClick={() => setFactorFilter(f.id)}
                  style={{ cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 2,
                    border: `1px solid ${factorFilter === f.id ? C.ink : C.line}`, background: factorFilter === f.id ? f.color : "transparent",
                    color: factorFilter === f.id ? "#fff" : C.ink, whiteSpace: "nowrap" }}
                >{f.label}</button>
              ))}
            </div>
            <div className="hscroll">
              <table className="htable">
                <thead><tr><th>순위</th><th>종목</th><th>점수</th></tr></thead>
                <tbody>
                  {rows.sort((a, b) => (b.f[factorFilter] ?? 0) - (a.f[factorFilter] ?? 0)).slice(0, 10).map((d, i) => (
                    <tr key={d.id}><td className="mono" style={{ color: C.muted }}>{String(i + 1).padStart(2, "0")}</td><td style={{ fontWeight: 600 }}>{d.name}</td><td className="mono" style={{ fontWeight: 700 }}>{(d.f[factorFilter] ?? 0).toFixed(1)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {hist && (
          <section className="wrap" style={{ paddingBottom: 44 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>그날 상위 10개, 그 뒤 어떻게 됐나</h2>
            {avg && (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>전체 {days.length}일 · {avg.n}건 평균</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))" }}>
                  {HORIZONS.map(({ k, label }) => (
                    <div key={k}><div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{label}</div><div className="mono" style={{ fontSize: 19, fontWeight: 700, color: tone(avg.out[k]) }}>{pct(avg.out[k])}</div></div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <select style={{ fontFamily: "inherit", fontSize: 13, padding: "7px 10px", borderRadius: 3, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }} value={day} onChange={e => setDay(e.target.value)}>
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="hscroll">
                <table className="htable">
                  <thead><tr><th>종목</th><th>당일</th>{HORIZONS.map(({ k, label }) => <th key={k}>{label}</th>)}</tr></thead>
                  <tbody>
                    {(hist[day] || []).map((it, i) => (
                      <tr key={it.id}><td><span className="mono" style={{ color: C.muted, marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span><span style={{ fontWeight: 600 }}>{it.name}</span></td><td className="mono" style={{ color: tone(it.chg) }}>{pct(it.chg)}</td>{HORIZONS.map(({ k }) => <td key={k} className="mono" style={{ color: tone(it[k]) }}>{pct(it[k])}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section className="wrap" style={{ paddingBottom: 44 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>오픈 시 열리는 것</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {LOCKED.map(l => (
              <div key={l.t} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 18 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: ".14em", color: C.muted, marginBottom: 9 }}>LOCKED</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 7 }}>{l.t}</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: C.muted }}>{l.d}</div>
              </div>
            ))}
          </div>
        </section>

        <section ref={formRef} className="wrap" style={{ paddingBottom: 48 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4, padding: 26 }}>
            <h2 className="anton" style={{ margin: "0 0 8px", fontSize: "clamp(26px,5vw,38px)", lineHeight: 1 }}>먼저 써볼 사람</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: "0 0 20px", lineHeight: 1.6 }}>오픈하면 가장 먼저 알려드립니다. 결제 없고, 광고 메일도 보내지 않습니다.</p>
            <iframe
              data-tally-src={`https://tally.so/embed/${TALLY_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`}
              src={`https://tally.so/embed/${TALLY_ID}?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1`}
              loading="lazy" width="100%" height="330" frameBorder="0" marginHeight="0" marginWidth="0"
              title="HEAT DESK"
              style={{ border: 0, display: "block" }}
            />
          </div>
        </section>

        <footer style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="wrap" style={{ padding: "20px 18px 48px", fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 10 }}>
              {FACTORS.map(f => (<span key={f.id} style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: f.color, borderRadius: 1 }}/>{f.label}</span>))}
            </div>
            HEAT DESK는 시장 데이터를 지표화해 보여주는 분석 도구입니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
