import React from "react";

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
          {String(v ?? 0).padStart(2, "0")}
        </span>
      </span>
    ))}
  </div>
);

export default Telemetry;
