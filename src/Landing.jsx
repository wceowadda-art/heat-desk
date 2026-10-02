import React, { useState, useMemo, useEffect, useRef } from "react";
import Nav from "./Nav.jsx";

const TALLY_ID = "gDPDRO";

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

const FACTORS = [
  { id: "vol", label: "거래량 급증", color: "#E03A3E" },
  { id: "mom", label: "모멘텀", color: "#F2882D" },
  { id: "high", label: "신고가 근접", color: "#D9B434" },
  { id: "vola", label: "변동성 확대", color: "#3E8E7E" },
  { id: "flow", label: "거래대금 흐름", color: "#2F6FE0" },
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

const ROW_H = 92;
const HORIZONS = [
  { k: "r1", label: "다음날" },
  { k: "r5", label: "1주 뒤" },
  { k: "r20", label: "1개월 뒤" },
  { k: "rnow", label: "현재까지" },
];

const IDX_HORIZONS = [
  { k: "short", label: "단기", days: "5일" },
  { k: "mid", label: "중기", days: "20일" },
  { k: "long", label: "장기", days: "60일" },
];

const pct = (v) => (v === null || v === undefined ? "–" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);
const tone = (v) => (v === null || v === undefined ? C.muted : v >= 0 ? C.up : C.down);

const statusColor = (s) => (s === "과열 주의" ? C.up : s === "관찰 필요" ? C.warn : C.down);

const fmtDate = (s) => (s && String(s).length === 8 ? `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}` : "");

function goDiagnose(name) {
  window.location.href = `/?page=diagnose&stock=${encodeURIComponent(name)}`;
}

export default function Landing() {
  const [w, setW] = useState(PRESETS["균형"]);
  const [data, setData] = useState(DEMO);
  const [allNames, setAllNames] = useState([]);
  const [indexHeat, setIndexHeat] = useState(null);
  const [hist, setHist] = useState(null);
  const [day, setDay] = useState("");
  const [reduce, setReduce] = useState(false);
  const [factorFilter, setFactorFilter] = useState("vol");
  const [capTab, setCapTab] = useState("all");
  const [capData, setCapData] = useState({});
  const [histTab, setHistTab] = useState("all");
  const [q, setQ] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia) setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    fetch("/heat_kr.json").then(r => r.json()).then(j => {
      const list = Array.isArray(j) ? j : j.items;
      if (Array.isArray(list) && list.length) setData(list);

      if (j.by_cap) {
        setAllNames((j.by_cap.all || []).map(d => d.name));
        const capScored = Object.keys(j.by_cap).reduce((acc, key) => {
          acc[key] = j.by_cap[key].map(d => {
            const score = FACTORS.reduce((s, f) => s + (d.f[f.id] ?? 0), 0) / FACTORS.length;
            return { ...d, score };
          });
          return acc;
        }, {});
        setCapData(capScored);
      }
    }).catch(() => {});

    fetch("/index_heat.json").then(r => r.json()).then(setIndexHeat).catch(() => {});

    fetch("/history.json").then(r => r.json()).then(j => {
      const keys = Object.keys(j["all"] || j).sort();
      if (keys.length) { setHist(j); setDay(keys[keys.length - 1]); }
    }).catch(() => {});

    const s = document.createElement("script");
    s.src = "https://tally.so/widgets/embed.js";
    s.onload = () => window.Tally && window.Tally.loadEmbeds();
    document.body.appendChild(s);
  }, []);

  const suggestions = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return allNames.filter(n => n.toLowerCase().includes(t)).slice(0, 6);
  }, [q, allNames]);

  const submitSearch = (nameOverride) => {
    const t = (nameOverride ?? q).trim();
    if (!t) return;
    const exact = allNames.find(n => n.toLowerCase() === t.toLowerCase());
    const target = exact || (nameOverride ? nameOverride : suggestions[0] || t);
    if (window.gtag) window.gtag("event", "home_search", { stock_name: target });
    goDiagnose(target);
  };

  const total = FACTORS.reduce((s, f) => s + w[f.id], 0);

  const rows = useMemo(() => {
    const scored = data.map(d => {
      const parts = FACTORS.map(f => ({ ...f, value: total === 0 ? 0 : (w[f.id] * (d.f[f.id] ?? 0)) / total }));
      return { ...d, parts, score: parts.reduce((s, p) => s + p.value, 0) };
    });
    const order = [...scored].sort((a, b) => b.score - a.score).map(d => d.id);
    return scored.map(d => ({ ...d, rank: order.indexOf(d.id) }));
  }, [w, total, data]);

  const factorRows = useMemo(
    () => [...rows].sort((a, b) => (b.f[factorFilter] ?? 0) - (a.f[factorFilter] ?? 0)).slice(0, 10),
    [rows, factorFilter]
  );

  const days = useMemo(() => (hist ? Object.keys(hist["all"] || hist).sort().reverse() : []), [hist]);

  const avg = useMemo(() => {
    if (!hist) return null;
    const all = Object.values(hist["all"] || hist).flat();
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
        .cta { cursor:pointer; border:none; border-radius:3px; padding:14px 22px; font-size:15px; font-weight:600; font-family:inherit; background:${C.ink}; color:#fff; white-space:nowrap; }
        .cta-outline { cursor:pointer; border-radius:3px; padding:11px 16px; font-size:13px; font-weight:600; font-family:inherit; background:transparent; color:${C.ink}; border:1px solid ${C.line}; }
        .cta-outline:hover { border-color:${C.ink}; }
        .screener-tile:hover { border-color:${C.ink}; }
        .wrap { max-width:1060px; margin:0 auto; padding:0 18px; }
        .htable { width:100%; border-collapse:collapse; font-size:13px; }
        .htable th { text-align:right; font-weight:600; font-size:11px; color:${C.muted}; padding:7px 8px; border-bottom:1px solid ${C.line}; }
        .htable th:first-child { text-align:left; }
        .htable td { padding:9px 8px; border-bottom:1px solid #F0F2F6; text-align:right; }
        .hscroll { overflow-x:auto; }
        .rowcard { cursor: pointer; }
        .rowcard:hover { border-color: ${C.ink} !important; }
        .sug:hover { background:${C.ground}; }
        input.search:focus { outline:2px solid ${C.ink}; outline-offset:2px; }
      `}</style>

      <div className="hd">
        <Nav page="home" />
        {/* 1) 히어로: 종목 검색이 첫 화면의 주인공 */}
        <section className="wrap" style={{ paddingTop: 36, paddingBottom: 28 }}>
          <div className="mono" style={{ fontSize: 11, letterSpacing: ".18em", color: C.muted, marginBottom: 12 }}>KOSPI · KOSDAQ</div>
          <h1 className="anton" style={{ fontSize: "clamp(40px,9vw,76px)", lineHeight: 0.9, margin: 0 }}>HEAT DESK</h1>
          <p style={{ fontSize: "clamp(15px,2.2vw,18px)", lineHeight: 1.55, maxWidth: 560, marginTop: 16, marginBottom: 20 }}>
            종목 하나만 검색하세요. <strong>시장 신호 · 기업 체력 · 최근 공시 · 테마</strong>가 한 화면에 나옵니다.
          </p>

          <div style={{ position: "relative", maxWidth: 560 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="search"
                type="text"
                value={q}
                onChange={(e) => { setQ(e.target.value); setShowSuggest(true); }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
                placeholder="종목명 검색 (예: 삼성전자)"
                style={{
                  flex: 1, fontFamily: "inherit", fontSize: 16, padding: "14px 14px",
                  borderRadius: 4, border: `1px solid ${C.line}`, background: C.panel, color: C.ink, minWidth: 0,
                }}
              />
              <button className="cta" onClick={() => submitSearch()}>분석하기</button>
            </div>
            {showSuggest && suggestions.length > 0 && (
              <div style={{
                position: "absolute", left: 0, right: 0, top: "100%", marginTop: 4, zIndex: 20,
                background: C.panel, border: `1px solid ${C.line}`, borderRadius: 4,
                boxShadow: "0 4px 12px rgba(19,26,42,.08)", overflow: "hidden",
              }}>
                {suggestions.map(n => (
                  <div key={n} className="sug" onMouseDown={() => submitSearch(n)}
                    style={{ padding: "10px 14px", fontSize: 14, cursor: "pointer" }}>{n}</div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16, maxWidth: 560 }}>
            <button
              className="screener-tile"
              onClick={() => {
                if (window.gtag) window.gtag("event", "screener_entry_click", { from: "home_hero" });
                window.location.href = "/?page=screener";
              }}
              style={{
                cursor: "pointer", flex: "1 1 220px", display: "flex", alignItems: "center", gap: 10,
                padding: "12px 14px", borderRadius: 4, border: `1px solid ${C.line}`, background: C.panel,
                fontFamily: "inherit", textAlign: "left",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M4 5h16M7 12h10M10 19h4" stroke={C.ink} strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>내 기준으로 종목 찾기</div>
                <div style={{ fontSize: 11, color: C.muted }}>재무·기술적 지표·테마 조건 조합</div>
              </span>
            </button>
            <button className="cta-outline" style={{ flex: "0 0 auto" }} onClick={() => formRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" })}>오픈 알림 받기</button>
          </div>
        </section>

        {/* 2) 시장 과열도: 코스피 / 코스닥 */}
        {indexHeat?.indexes && (
          <section id="feargreed" className="wrap" style={{ paddingBottom: 40, scrollMarginTop: 64 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: ".06em" }}>공탐지수</h2>
              <span style={{ fontSize: 11, color: C.muted }}>공포·탐욕 지수 · 코스피/코스닥</span>
            </div>
            <p style={{ fontSize: 11, color: C.muted, margin: "0 0 12px" }}>
              앞으로 비트코인·금·환율 등 다른 자산도 추가될 예정입니다.
            </p>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
              {["kospi", "kosdaq"].map(k => {
                const ix = indexHeat.indexes[k];
                if (!ix) return null;
                return (
                  <div key={k} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
                      <span style={{ fontSize: 16, fontWeight: 700 }}>{ix.name}</span>
                      <span className="mono" style={{ fontSize: 13, color: C.muted }}>{ix.close.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: tone(ix.chg), marginLeft: "auto" }}>{pct(ix.chg)}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                      {IDX_HORIZONS.map(({ k: hk, label, days }) => {
                        const h = ix.horizons?.[hk];
                        if (!h) return <div key={hk} />;
                        const col = statusColor(h.status);
                        return (
                          <div key={hk}>
                            <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label} · {days}</div>
                            <div className="mono" style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>{Math.round(h.score)}</div>
                            <div style={{ height: 4, background: "#F0F2F6", borderRadius: 2, margin: "8px 0 6px" }}>
                              <div style={{ width: `${Math.min(100, h.score)}%`, height: "100%", background: col, borderRadius: 2 }} />
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: col }}>{h.status}</div>
                          </div>
                        );
                      })}
                    </div>
                    {k === "kospi" && ix.horizons?.mid && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                        {ix.horizons.mid.score < 40 ? (
                          <button
                            onClick={() => {
                              if (window.gtag) window.gtag("event", "feargreed_to_screener", { direction: "fear" });
                              window.location.href = "/?page=screener&preset=lagging_kospi";
                            }}
                            style={{
                              cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit",
                              fontSize: 12, padding: "9px 12px", borderRadius: 4, border: `1px solid ${C.line}`, background: "transparent", color: C.ink,
                            }}
                          >
                            공포 구간. 코스피보다 뒤처진 종목 찾아보기 →
                          </button>
                        ) : ix.horizons.mid.score > 60 ? (
                          <button
                            onClick={() => {
                              if (window.gtag) window.gtag("event", "feargreed_to_screener", { direction: "greed" });
                              window.location.href = "/?page=screener&preset=leading_kospi";
                            }}
                            style={{
                              cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit",
                              fontSize: 12, padding: "9px 12px", borderRadius: 4, border: `1px solid ${C.line}`, background: "transparent", color: C.ink,
                            }}
                          >
                            탐욕 구간. 코스피보다 앞선 종목 찾아보기 →
                          </button>
                        ) : (
                          <div style={{ fontSize: 11, color: C.muted }}>중립 구간입니다.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6, margin: "10px 0 0" }}>
              지수는 비교할 다른 종목이 없어서, <strong>최근 1년 중 지금이 얼마나 뜨거운 위치인지</strong>로 계산합니다.
              높을수록 최근 1년 기준으로 과열(탐욕)에 가깝다는 뜻이며, 매수·매도 신호를 의미하지 않습니다.
              {indexHeat.indexes.kospi?.date ? ` (${fmtDate(indexHeat.indexes.kospi.date)} 기준)` : ""}
            </p>
          </section>
        )}

        {/* 3) 내 기준 발열 랭킹 (슬라이더) */}
        <section className="wrap" style={{ paddingBottom: 44 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, letterSpacing: ".06em" }}>내 기준으로 만드는 발열 랭킹</h2>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(276px,1fr))" }}>
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 18, maxWidth: 360 }}>
              {FACTORS.map(f => (
                <div key={f.id} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <label style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 9, height: 9, background: f.color, borderRadius: 1 }} />{f.label}
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
                  <div
                    key={d.id}
                    className="rowcard"
                    onClick={() => goDiagnose(d.name)}
                    style={{
                      position: "absolute", left: 0, right: 0, height: ROW_H - 6,
                      transform: `translateY(${d.rank * ROW_H}px)`,
                      transition: "transform 480ms cubic-bezier(.2,.85,.25,1)",
                      background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: "11px 13px",
                      display: "flex", flexDirection: "column", justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span className="mono" style={{ fontSize: 12, color: C.muted, width: 20 }}>{String(d.rank + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{d.name}</span>
                      <span className="mono" style={{ fontSize: 11, color: C.muted, flex: 1 }}>{d.sub}</span>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: d.chg >= 0 ? C.up : C.down }}>{d.chg >= 0 ? "+" : ""}{d.chg.toFixed(1)}%</span>
                      <span className="mono" style={{ fontSize: 16, fontWeight: 700, width: 44, textAlign: "right" }}>{d.score.toFixed(1)}</span>
                    </div>
                    <div style={{ display: "flex", height: 9, background: "#F0F2F6", borderRadius: 1 }}>
                      {d.parts.map(p => (<div key={p.id} style={{ width: `${p.value}%`, background: p.color }} />))}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, textAlign: "right" }}>종목 상태 보기 →</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4) 팩터별 순위 */}
        <section className="wrap" style={{ paddingBottom: 44 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>팩터별 순위</h2>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16 }}>
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
                  {factorRows.map((d, i) => (
                    <tr key={d.id} onClick={() => goDiagnose(d.name)} style={{ cursor: "pointer" }}>
                      <td className="mono" style={{ color: C.muted }}>{String(i + 1).padStart(2, "0")}</td>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{(d.f[factorFilter] ?? 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5) 시총별 발열 순위 */}
        <section className="wrap" style={{ paddingBottom: 44 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>시총별 발열 순위</h2>
          <p style={{ fontSize: 12, color: C.muted, margin: "0 0 14px" }}>
            점수는 5개 팩터(거래량·모멘텀·신고가·변동성·거래대금 흐름)의 평균 백분위입니다. 높을수록 지금 더 뜨겁다는 뜻입니다.
          </p>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 16 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
              {[
                { k: "all", label: "전체" },
                { k: "large", label: "대형주 (1~500)" },
                { k: "mid", label: "중형주 (500~1000)" },
                { k: "small", label: "소형주 (1000~2000)" },
              ].map(tab => (
                <button key={tab.k} onClick={() => setCapTab(tab.k)}
                  style={{
                    cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 2,
                    border: `1px solid ${capTab === tab.k ? C.ink : C.line}`, background: capTab === tab.k ? C.ink : "transparent",
                    color: capTab === tab.k ? "#fff" : C.ink, whiteSpace: "nowrap",
                  }}
                >{tab.label}</button>
              ))}
            </div>
            <div className="hscroll">
              <table className="htable">
                <thead><tr><th>순위</th><th>종목</th><th>점수</th></tr></thead>
                <tbody>
                  {(capData[capTab] || []).slice(0, 10).map((d, i) => (
                    <tr key={d.id} onClick={() => goDiagnose(d.name)} style={{ cursor: "pointer" }}>
                      <td className="mono" style={{ color: C.muted }}>{String(i + 1).padStart(2, "0")}</td>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td className="mono" style={{ fontWeight: 700 }}>{d.score?.toFixed(1) || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 6) 그날 상위 10개, 그 뒤 어떻게 됐나 */}
        {hist && (
          <section className="wrap" style={{ paddingBottom: 44 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>그날 상위 10개, 그 뒤 어떻게 됐나</h2>
            {avg && (
              <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 14, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>전체 {days.length}일 · {avg.n}건 평균</div>
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))" }}>
                  {HORIZONS.map(({ k, label }) => (
                    <div key={k}><div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{label}</div><div className="mono" style={{ fontSize: 19, fontWeight: 700, color: tone(avg.out[k]) }}>{pct(avg.out[k])}</div></div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 14 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, overflowX: "auto" }}>
                {[
                  { k: "all", label: "전체" },
                  { k: "large", label: "대형주" },
                  { k: "mid", label: "중형주" },
                  { k: "small", label: "소형주" },
                ].map(tab => (
                  <button key={tab.k} onClick={() => setHistTab(tab.k)}
                    style={{
                      cursor: "pointer", fontSize: 12, fontWeight: 600, padding: "7px 11px", borderRadius: 2,
                      border: `1px solid ${histTab === tab.k ? C.ink : C.line}`, background: histTab === tab.k ? C.ink : "transparent",
                      color: histTab === tab.k ? "#fff" : C.ink, whiteSpace: "nowrap",
                    }}
                  >{tab.label}</button>
                ))}
              </div>
              <div style={{ marginBottom: 12 }}>
                <select style={{ fontFamily: "inherit", fontSize: 13, padding: "7px 10px", borderRadius: 3, border: `1px solid ${C.line}`, background: C.panel, color: C.ink }} value={day} onChange={e => setDay(e.target.value)}>
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="hscroll">
                <table className="htable">
                  <thead><tr><th>종목</th><th>당일</th>{HORIZONS.map(({ k, label }) => <th key={k}>{label}</th>)}</tr></thead>
                  <tbody>
                    {(hist[histTab]?.[day] || hist[day] || []).map((it, i) => (
                      <tr key={it.id} onClick={() => goDiagnose(it.name)} style={{ cursor: "pointer" }}>
                        <td><span className="mono" style={{ color: C.muted, marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span><span style={{ fontWeight: 600 }}>{it.name}</span></td>
                        <td className="mono" style={{ color: tone(it.chg) }}>{pct(it.chg)}</td>
                        {HORIZONS.map(({ k }) => <td key={k} className="mono" style={{ color: tone(it[k]) }}>{pct(it[k])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* 7) 오픈 시 열리는 것 */}
        <section className="wrap" style={{ paddingBottom: 44 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700 }}>오픈 시 열리는 것</h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {LOCKED.map(l => (
              <div key={l.t} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 18 }}>
                <div className="mono" style={{ fontSize: 10, letterSpacing: ".14em", color: C.muted, marginBottom: 9 }}>LOCKED</div>
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 7 }}>{l.t}</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: C.muted }}>{l.d}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 8) 알림 신청: 맨 아래로 이동 */}
        <section ref={formRef} className="wrap" style={{ paddingBottom: 48 }}>
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 6, padding: 26 }}>
            <h2 className="anton" style={{ margin: "0 0 8px", fontSize: "clamp(26px,5vw,38px)", lineHeight: 1 }}>먼저 써볼 사람</h2>
            <p style={{ fontSize: 14, color: C.muted, margin: "0 0 20px", lineHeight: 1.6 }}>새 기능이 열리면 가장 먼저 알려드립니다. 결제 없고, 광고 메일도 보내지 않습니다.</p>
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
              {FACTORS.map(f => (<span key={f.id} style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: f.color, borderRadius: 1 }} />{f.label}</span>))}
            </div>
            HEAT DESK는 시장 데이터를 지표화해 보여주는 분석 도구입니다. 매수·매도를 추천하지 않으며,
            투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
          </div>
        </footer>
      </div>
    </div>
  );
}
