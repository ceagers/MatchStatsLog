// The live match clock readout. It owns its own tick so that a running clock
// re-renders this span only, never the whole screen around it.

import { useEffect, useState } from 'react';
import { clockTotalMs, livePeriodMs, formatClock } from '../store.jsx';

/// mode="period" shows the period being timed now, mode="total" the whole match.
export default function MatchClock({ clock, mode = 'period', className = '' }) {
  const running = Boolean(clock && clock.running);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const ms = mode === 'total' ? clockTotalMs(clock, now) : livePeriodMs(clock, now);

  return <span className={className}>{formatClock(ms)}</span>;
}
