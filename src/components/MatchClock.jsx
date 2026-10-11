// The live match clock readout. It owns its own tick so that a running clock
// re-renders this span only, never the whole screen around it.

import { useEffect, useState } from 'react';
import { clockTotalMs, sessionMs, totalTimedMs, formatClock } from '../store.jsx';

/// mode="match" shows the match time (start minute included), mode="session"
/// only the time timed since the clock was started, and mode="total" the
/// whole match's timed time across every stop and restart.
export default function MatchClock({ clock, mode = 'match', className = '' }) {
  const running = Boolean(clock && clock.running);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const ms =
    mode === 'session'
      ? sessionMs(clock, now)
      : mode === 'total'
        ? totalTimedMs(clock, now)
        : clockTotalMs(clock, now);

  return <span className={className}>{formatClock(ms)}</span>;
}
