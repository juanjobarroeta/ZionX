import React, { useEffect, useRef } from "react";

// Loads Pinterest's public embed widget (no API credentials needed) and renders
// a board or pin embed. If the script is blocked or fails, the inner anchor
// stays a normal link — so it always degrades to "open in Pinterest".

let pinitPromise = null;
function loadPinit() {
  if (typeof window === "undefined") return Promise.reject();
  if (window.PinUtils) return Promise.resolve();
  if (pinitPromise) return pinitPromise;
  pinitPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://assets.pinterest.com/js/pinit.js";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.body.appendChild(s);
  });
  return pinitPromise;
}

const isPinterest = (u) => /pinterest\.[a-z.]+/i.test(u || "");
const looksLikePin = (u) => /\/pin\//i.test(u || "");

const PinterestEmbed = ({ url, kind }) => {
  const ref = useRef(null);
  const doKind = kind || (looksLikePin(url) ? "embedPin" : "embedBoard");

  useEffect(() => {
    if (!isPinterest(url)) return;
    let cancelled = false;
    loadPinit()
      .then(() => {
        if (!cancelled && window.PinUtils && typeof window.PinUtils.build === "function") {
          window.PinUtils.build();
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url, doKind]);

  if (!url) return null;

  // Non-Pinterest URL (or nothing to embed): just a link.
  if (!isPinterest(url)) {
    return (
      <a className="pin-link" href={url} target="_blank" rel="noopener noreferrer">Ver referencia</a>
    );
  }

  return (
    <div className="pin-embed" ref={ref}>
      <a
        key={url}
        data-pin-do={doKind}
        data-pin-board-width="380"
        data-pin-scale-height="220"
        data-pin-scale-width="80"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Ver en Pinterest
      </a>
    </div>
  );
};

export default PinterestEmbed;
