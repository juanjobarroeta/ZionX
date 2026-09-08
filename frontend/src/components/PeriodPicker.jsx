import React, { useMemo, useRef, useState, useEffect } from "react";
import "./PeriodPicker.css";

/**
 * El período, en un solo control.
 *
 * Antes eran dos <select> cuadrados, uno para el mes y otro para el año: cuatro
 * clics para moverse un mes, y ningún indicio de que el mes anterior es el que
 * casi siempre quieres. Esto es un paso atrás/adelante con el período en medio;
 * el nombre abre el calendario de meses cuando de verdad hay que saltar lejos.
 *
 * Vive en components/ y no dentro de una página porque el mismo control tiene
 * que servir a estados financieros, balance y declaraciones — que cada pantalla
 * invente el suyo es cómo se llega a un producto que se siente cosido a mano.
 */

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function PeriodPicker({
  year, month, onChange,
  minYear, maxDate = new Date(),
  ytd = null, onYtdChange = null,
}) {
  const [open, setOpen] = useState(false);
  const [panelYear, setPanelYear] = useState(year);
  const boxRef = useRef(null);

  useEffect(() => { setPanelYear(year); }, [year, open]);

  // Cerrar al hacer clic fuera y con Escape: se comporta como un menú.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const limite = useMemo(() => ({ y: maxDate.getFullYear(), m: maxDate.getMonth() + 1 }), [maxDate]);
  const primerAnio = minYear ?? limite.y - 3;

  const futuro = (y, m) => y > limite.y || (y === limite.y && m > limite.m);
  const antiguo = (y) => y < primerAnio;

  const mover = (paso) => {
    let m = month + paso;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    if (futuro(y, m) || antiguo(y)) return;
    onChange({ year: y, month: m });
  };

  const esteMes = year === limite.y && month === limite.m;
  const puedeAtras = !antiguo(month === 1 ? year - 1 : year);

  return (
    <div className="zxpp" ref={boxRef}>
      <div className="zxpp-nav">
        <button type="button" className="zxpp-arrow" onClick={() => mover(-1)}
                disabled={!puedeAtras} aria-label="Mes anterior">‹</button>

        <button type="button" className="zxpp-label" onClick={() => setOpen((o) => !o)}
                aria-haspopup="dialog" aria-expanded={open}>
          <span className="m">{MESES[month - 1]}</span>
          <span className="y">{year}</span>
        </button>

        <button type="button" className="zxpp-arrow" onClick={() => mover(1)}
                disabled={esteMes} aria-label="Mes siguiente">›</button>
      </div>

      {!esteMes && (
        <button type="button" className="zxpp-today"
                onClick={() => onChange({ year: limite.y, month: limite.m })}>
          Este mes
        </button>
      )}

      {ytd !== null && (
        <label className="zxpp-ytd">
          <input type="checkbox" checked={ytd} onChange={(e) => onYtdChange?.(e.target.checked)} />
          <span>Acumulado del año</span>
        </label>
      )}

      {open && (
        <div className="zxpp-panel" role="dialog" aria-label="Elegir período">
          <div className="zxpp-panel-head">
            <button type="button" className="zxpp-arrow sm" onClick={() => setPanelYear((y) => Math.max(primerAnio, y - 1))}
                    disabled={panelYear <= primerAnio} aria-label="Año anterior">‹</button>
            <span>{panelYear}</span>
            <button type="button" className="zxpp-arrow sm" onClick={() => setPanelYear((y) => Math.min(limite.y, y + 1))}
                    disabled={panelYear >= limite.y} aria-label="Año siguiente">›</button>
          </div>
          <div className="zxpp-months">
            {CORTOS.map((mm, i) => {
              const m = i + 1;
              const bloqueado = futuro(panelYear, m);
              const activo = panelYear === year && m === month;
              return (
                <button key={mm} type="button" disabled={bloqueado}
                        className={`zxpp-month${activo ? " on" : ""}`}
                        onClick={() => { onChange({ year: panelYear, month: m }); setOpen(false); }}>
                  {mm}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
