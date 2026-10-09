import React, { useState } from "react";

const C = { ink: "#131A2A", line: "#D3D8E2", muted: "#6B7689" };

// 링크 공유 버튼. 모바일은 기본 공유창, PC는 링크 복사.
// 공유 문구에는 항상 "추천 아님"이 들어간다.
export default function ShareButton({ url, title, kind = "page", style }) {
  const [copied, setCopied] = useState(false);

  const fullUrl = () => {
    try { return new URL(url, window.location.origin).toString(); } catch { return url; }
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* 무시 */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const onClick = async () => {
    const link = fullUrl();
    const text = `${title} · 추천이 아니라 관측된 데이터만 보여줍니다`;
    if (window.gtag) window.gtag("event", "share_click", { kind });
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url: link });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return; // 사용자가 닫음
      }
    }
    copy(link);
  };

  return (
    <button
      onClick={onClick}
      aria-live="polite"
      style={{
        cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 600,
        padding: "7px 12px", borderRadius: 4, border: `1px solid ${C.line}`,
        background: copied ? C.ink : "transparent", color: copied ? "#fff" : C.ink,
        display: "inline-flex", alignItems: "center", gap: 6, ...style,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 16V4m0 0L8 8m4-4 4 4M5 13v6h14v-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {copied ? "링크 복사됨" : "공유하기"}
    </button>
  );
}
