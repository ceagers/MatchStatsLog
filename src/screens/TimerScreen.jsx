// The match clock screen: start, pause, stop, reset, with the minute the
// clock counts on from chosen by hand.

import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListItem, ListInput,
  Button, Dialog, DialogButton,
} from 'konsta/react';
import {
  useMatch, clockState, CLOCK_STATE_LABELS, sessionMs,
} from '../store.jsx';
import MatchClock from '../components/MatchClock.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

const START_MINUTES = Array.from({ length: 121 }, (_, i) => i);

const STATE_DOT = {
  ready: 'bg-gray-300 dark:bg-white/25',
  running: 'bg-green-500',
  paused: 'bg-amber-500',
  stopped: 'bg-gray-400 dark:bg-white/40',
};

export default function TimerScreen({ onNext }) {
  const { match, startClock, pauseClock, stopClock, resetClock, setClockStart } = useMatch();
  const clock = match.clock;
  const [confirmReset, setConfirmReset] = useState(false);

  const state = clockState(clock);
  const running = state === 'running';
  const timed = sessionMs(clock) > 0;
  const startMinute = Math.round((clock.offsetMs || 0) / 60000);

  const tap = (effect, action) => () => {
    haptic(effect);
    action();
  };

  // The reset confirmation lifts this screen above the fixed tab bar.
  const modalOpen = confirmReset;

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className={`relative pb-safe-24 ${modalOpen ? 'z-40' : 'z-10'}`}
    >
      <Navbar
        title="Match Clock"
        large
        transparent
        className="top-0 sticky"
      />

      <Block strong inset className="!mt-0 !py-6 text-center">
        <div className="flex items-center justify-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span className={`h-2 w-2 rounded-full ${STATE_DOT[state] || STATE_DOT.ready}`} />
          {CLOCK_STATE_LABELS[state] || 'Ready'}
        </div>

        <MatchClock
          clock={clock}
          className="mt-2 block text-[58px] font-bold leading-none tabular-nums tracking-tight"
        />

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400">
          <span>{startMinute > 0 ? `Counting on from ${startMinute}' · timed` : 'Kick-off · timed'}</span>
          <MatchClock
            clock={clock}
            mode="session"
            className="font-semibold tabular-nums text-gray-700 dark:text-gray-200"
          />
        </div>
      </Block>

      <Block className="!my-2 grid grid-cols-2 gap-3">
        <Button large rounded disabled={running} onClick={tap('clockStart', startClock)}>
          <span className="inline-flex items-center gap-2">
            <Icon name="play" size={20} />
            Start
          </span>
        </Button>
        <Button
          large
          rounded
          tonal
          disabled={!running}
          onClick={tap('clockPause', pauseClock)}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="pause" size={20} />
            Pause
          </span>
        </Button>
        <Button
          large
          rounded
          tonal
          disabled={state === 'stopped' || !(running || timed)}
          onClick={tap('clockStop', stopClock)}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="square" size={18} />
            Stop
          </span>
        </Button>
        <Button
          large
          rounded
          tonal
          disabled={state === 'ready' && !timed && startMinute === 0}
          onClick={() => setConfirmReset(true)}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="rotate-ccw" size={20} />
            Reset
          </span>
        </Button>
      </Block>

      <BlockTitle>Clock</BlockTitle>
      <List strong inset>
        <ListItem
          title="Timed This Session"
          after={
            <MatchClock
              clock={clock}
              mode="session"
              className="font-semibold tabular-nums"
            />
          }
        />
        <ListInput
          label="Start From"
          type="select"
          dropdown
          disabled={running}
          value={String(startMinute)}
          onChange={(e) => {
            haptic('bump');
            setClockStart(Number(e.target.value));
          }}
        >
          {START_MINUTES.map((m) => (
            <option key={m} value={String(m)}>
              {m === 0 ? "0' — kick-off" : `${m}'`}
            </option>
          ))}
        </ListInput>
      </List>
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        Start From sets the minute the clock counts on from — 45' for a second half,
        say — and clears the time already timed. Stop ends the run and keeps the time,
        Reset takes the clock back to 0:00. Goals and substitutions read their minute
        off this clock, and the time is saved with the match.
      </Block>

      <Block className="mt-6">
        <Button
          large
          rounded
          onClick={() => {
            haptic('tick');
            onNext();
          }}
        >
          Go to Players
        </Button>
      </Block>

      <Dialog
        opened={confirmReset}
        onBackdropClick={() => setConfirmReset(false)}
        title="Reset the clock?"
        content="The clock goes back to 0:00 and the start minute is cleared. The fixture, squad, goals and substitutions are not affected."
        buttons={
          <>
            <DialogButton onClick={() => setConfirmReset(false)}>Cancel</DialogButton>
            <DialogButton
              strong
              onClick={() => {
                haptic('removed');
                resetClock();
                setConfirmReset(false);
              }}
            >
              Reset
            </DialogButton>
          </>
        }
      />
    </Page>
  );
}
