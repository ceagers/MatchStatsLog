// A headless countdown timer that keeps running no matter which screen is
// open — its state lives here, above the screens, so switching tabs (or
// swiping away) never stops it. When it reaches zero it rings: a repeating
// alarm tone through the speakers plus a repeating buzz through the Taptic
// Engine, until it is explicitly dismissed.
//
// Like everything in the app it only runs while the app is open — there is
// no background execution to keep it ticking with the app closed.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Notification } from 'konsta/react';
import { Icon } from './icons.js';
import { haptic, hapticStop } from './haptics.js';
import { startAlarm, stopAlarm, ensureAudio } from './alarm.js';

const CountdownContext = createContext(null);

export function CountdownProvider({ children }) {
  const [total, setTotal] = useState(0); // seconds the countdown was set for
  const [remaining, setRemaining] = useState(0); // seconds left
  const [running, setRunning] = useState(false);
  const [expired, setExpired] = useState(false);
  const endAt = useRef(0); // the timestamp the countdown is aiming at

  // The tick is driven off a real timestamp rather than by decrementing, so
  // rendering delays never make it drift.
  useEffect(() => {
    if (!running) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setExpired(true);
        startAlarm();
        haptic('alarm', 'countdownAlarm');
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  const start = (hours, minutes, seconds) => {
    const secs = hours * 3600 + minutes * 60 + seconds;
    if (secs <= 0) return;
    ensureAudio();
    setTotal(secs);
    setRemaining(secs);
    setExpired(false);
    endAt.current = Date.now() + secs * 1000;
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const resume = () => {
    if (remaining <= 0 || expired) return;
    ensureAudio();
    endAt.current = Date.now() + remaining * 1000;
    setRunning(true);
  };

  const reset = () => {
    stopAlarm();
    hapticStop('countdownAlarm');
    setRunning(false);
    setExpired(false);
    setRemaining(total);
  };

  const clear = () => {
    stopAlarm();
    hapticStop('countdownAlarm');
    setRunning(false);
    setExpired(false);
    setTotal(0);
    setRemaining(0);
  };

  // Stops the ringing — the sound and the buzz both.
  const dismiss = () => {
    stopAlarm();
    hapticStop('countdownAlarm');
    setExpired(false);
    setRemaining(0);
  };

  const value = useMemo(
    () => ({ total, remaining, running, expired, start, pause, resume, reset, clear, dismiss }),
    [total, remaining, running, expired],
  );

  return (
    <CountdownContext.Provider value={value}>
      {children}
      <Notification
        opened={expired}
        icon={<Icon name="alarm-clock" size={28} />}
        title="Countdown finished"
        titleRightText="now"
        subtitle="The countdown has reached zero — tap to stop the alarm."
        button
        onClick={dismiss}
      />
    </CountdownContext.Provider>
  );
}

export function useCountdown() {
  return useContext(CountdownContext);
}
