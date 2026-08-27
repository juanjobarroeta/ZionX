import React from "react";

const grouped = new Intl.NumberFormat("es-MX");

// Small counts keep the zero-padded instrument look ("04"); anything that runs
// into the thousands gets separators, because "468523" is not a readable number.
const fmt = (v) => {
  const n = Number(v) || 0;
  return n >= 1000 ? grouped.format(Math.round(n)) : String(n).padStart(2, "0");
};

/**
 * The readout strip along the bottom of a command bar. Counts are the one thing
 * a user checks before anything else, so they get the instrument treatment:
 * monospace, zero-padded, aligned — and colored only when the number carries
 * urgency (brass = in flight, crit = broken).
 *
 * items: [{ k: "Programadas", v: 12, tone: "brass" | "crit" }]
 */
const Telemetry = ({ items }) => (
  <div className="zx-tele">
    {items.map(({ k, v, tone }) => (
      <span className="zx-tele-item" key={k}>
        <span className="k">{k}</span>
        <span className={`v${v === 0 ? " zero" : tone ? ` ${tone}` : ""}`}>
          {fmt(v)}
        </span>
      </span>
    ))}
  </div>
);

export default Telemetry;
