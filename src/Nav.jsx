import React from "react";

const C = {
  ground: "#E9ECF2",
  panel: "#FFFFFF",
  ink: "#131A2A",
  line: "#D3D8E2",
  muted: "#6B7689",
};

// 전 페이지 공통 상단 메뉴바. page: "home" | "diagnose" | "screener"
export default function Nav({ page = "home" }) {
  const items = [
    { key: "home", label: "홈", href: "/" },
    { key: "diagnose", label: "종목 진단", href: "/?page=diagnose" },
    { key: "screener", label: "스크리너", href: "/?page=screener" },
    { key: "feargreed", label: "공탐지수", href: "/#feargreed" },
  ];

  return (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 30,
        background: "rgba(233,236,242,0.92)", backdropFilter: "blur(6px)",
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div
        style={{
          maxWidth: 1060, margin: "0 auto", padding: "0 18px",
          display: "flex", alignItems: "center", gap: 6, height: 52,
          overflowX: "auto",
        }}
      >
        <a
          href="/"
          style={{
            fontFamily: "'Anton','Noto Sans KR',sans-serif", fontSize: 16, letterSpacing: ".01em",
            color: C.ink, textDecoration: "none", marginRight: 10, whiteSpace: "nowrap",
          }}
        >
          HEAT DESK
        </a>
        {items.map((it) => {
          const active = it.key === page;
          return (
            <a
              key={it.key}
              href={it.href}
              style={{
                fontFamily: "'Inter Tight','Noto Sans KR',sans-serif",
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? C.ink : C.muted,
                textDecoration: "none", whiteSpace: "nowrap",
                padding: "6px 10px", borderRadius: 4,
                background: active ? C.panel : "transparent",
                border: active ? `1px solid ${C.line}` : "1px solid transparent",
              }}
            >
              {it.label}
            </a>
          );
        })}
      </div>
    </div>
  );
}
