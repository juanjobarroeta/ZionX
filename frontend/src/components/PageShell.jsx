import React from "react";
import Layout from "./Layout";
import PixelMark from "./PixelMark";
import Telemetry from "./Telemetry";
import "../styles/zionx.css";

/**
 * The shape every internal screen shares: an ink command bar (eyebrow, title
 * with its serif accent, actions, telemetry readout) over a paper working
 * surface.
 *
 * Six pages had been hand-assembling this markup, which is how a design system
 * quietly becomes six design systems — one page rounds a corner differently,
 * another forgets the telemetry, and the product starts changing personality
 * between screens. The structure lives here now; pages bring their content.
 *
 *   <PageShell
 *     eyebrow="Analítica"
 *     title="Rendimiento"
 *     titleAccent="en el tiempo"      // set in Nyght italic
 *     actions={<>…</>}                 // rendered on the ink ground
 *     telemetry={[{ k: "Vistas", v: 1200, tone: "brass", delta }]}
 *     below={<nav …/>}                 // optional row under the telemetry (tabs)
 *   >
 *     …the canvas…
 *   </PageShell>
 */
const PageShell = ({
  eyebrow,
  title,
  titleAccent,
  actions,
  telemetry,
  below,
  className = "",
  children,
}) => (
  <Layout>
    <div className={`zx-app ${className}`.trim()}>
      <header className="zx-cmd">
        <div className="zx-cmd-inner">
          <div className="zx-cmd-top">
            <div>
              {eyebrow && (
                <div className="zx-eyebrow">
                  <PixelMark size={11} />
                  {eyebrow}
                </div>
              )}
              <h1 className="zx-title">
                {title}
                {titleAccent && <> <span className="zx-serif">{titleAccent}</span></>}
              </h1>
            </div>
            {actions && <div className="zx-cmd-actions">{actions}</div>}
          </div>
          {telemetry?.length > 0 && <Telemetry items={telemetry} />}
          {below}
        </div>
      </header>
      <div className="zx-canvas">{children}</div>
    </div>
  </Layout>
);

export default PageShell;
