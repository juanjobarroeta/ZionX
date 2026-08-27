/**
 * Countdown to an automatic publish, rendered the way the rest of the platform
 * renders time: as an instrument reading. "T-2 D" / "T-6 H" / "T-45 M".
 *
 * Returns null when there is nothing to count down to — no date, or the moment
 * already passed — so callers can render it only when it means something.
 */
export const tMinus = (when, now = new Date()) => {
  if (!when) return null;
  const target = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(target.getTime())) return null;

  const mins = Math.floor((target.getTime() - now.getTime()) / 60000);
  if (mins < 0) return null;
  if (mins < 1) return "T-0";
  if (mins < 60) return `T-${mins} M`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `T-${hours} H`;
  return `T-${Math.floor(hours / 24)} D`;
};
