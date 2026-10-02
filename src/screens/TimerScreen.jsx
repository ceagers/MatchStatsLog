// The timer screen, in two halves behind a segmented control: the match clock
// (start, pause, stop, reset, with the minute it counts on from chosen by
// hand) and a countdown that the coach sets in hours, minutes and seconds —
// it rings an alarm and buzzes until dismissed when it reaches zero.

import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListItem, ListInput, ListButton,
  Button, Dialog, DialogButton, Link, Segmented, SegmentedButton,
  Progressbar, Sheet,
} from 'konsta/react';
import {
  useMatch, clockState, CLOCK_STATE_LABELS, sessionMs,
} from '../store.jsx';
import { useCountdown } from '../countdown.jsx';
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

const PRESETS = [1, 5, 10, 15, 20, 30];

const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));

// 45:00 under an hour, 1:00:00 and beyond.
const fmt = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

export default function TimerScreen({ onNext }) {
  const { match, startClock, pauseClock, stopClock, resetClock, setClockStart } = useMatch();
  const cd = useCountdown();
  const clock = match.clock;
  const [mode, setMode] = useState('clock');
  const [confirmReset, setConfirmReset] = useState(false);
  const [sheetOpened, setSheetOpened] = useState(false);
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('5');
  const [seconds, setSeconds] = useState('0');

  const state = clockState(clock);
  const running = state === 'running';
  const timed = sessionMs(clock) > 0;
  const startMinute = Math.round((clock.offsetMs || 0) / 60000);

  const tap = (effect, action) => () => {
    haptic(effect);
    action();
  };

  const openSheet = () => {
    const t = cd.total;
    if (t > 0) {
      setHours(String(Math.floor(t / 3600)));
      setMinutes(String(Math.floor((t % 3600) / 60)));
      setSeconds(String(t % 60));
    } else {
      setHours('0');
      setMinutes('5');
      setSeconds('0');
    }
    haptic('bump');
    setSheetOpened(true);
  };

  const startCountdown = () => {
    const h = clamp(hours, 23);
    const m = clamp(minutes, 59);
    const s = clamp(seconds, 59);
    if (h + m + s === 0) return;
    haptic('clockStart');
    cd.start(h, m, s);
    setSheetOpened(false);
  };

  const usePreset = (mins) => () => {
    haptic('bump');
    setHours('0');
    setMinutes(String(mins));
    setSeconds('0');
  };

  const sheetTotal = clamp(hours, 23) * 3600 + clamp(minutes, 59) * 60 + clamp(seconds, 59);

  const switchMode = (next) => () => {
    if (next === mode) return;
    haptic('bump');
    setMode(next);
  };

  return (
    <Page colors={{ bgIos: 'bg-transparent' }} className="relative z-10 pb-safe-24">
      <Navbar
        title={mode === 'clock' ? 'Match Clock' : 'Countdown'}
        large
        transparent
        className="top-0 sticky"
      />

      <Block strong inset className="!mt-0 !py-2.5">
        <Segmented strong rounded>
          <SegmentedButton strong rounded active={mode === 'clock'} onClick={switchMode('clock')}>
            Match Clock
          </SegmentedButton>
          <SegmentedButton strong rounded active={mode === 'countdown'} onClick={switchMode('countdown')}>
            Countdown
          </SegmentedButton>
        </Segmented>
      </Block>

      {mode === 'clock' ? (
        <>
          <Block strong inset className="!mt-2 !py-6 text-center">
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
        </>
      ) : (
        <>
          <Block strong inset className="!mt-2 !py-6 text-center">
            {cd.expired ? (
              <>
                <div className="animate-pulse text-[12px] font-semibold uppercase tracking-wider text-red-500">
                  Time's Up
                </div>
                <div className="mt-2 text-[58px] font-bold leading-none tabular-nums tracking-tight">
                  0:00
                </div>
                <div className="mt-5">
                  <Button
                    large
                    rounded
                    className="k-color-brand-red"
                    onClick={() => {
                      haptic('impact');
                      cd.dismiss();
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon name="bell-off" size={20} />
                      Stop Alarm
                    </span>
                  </Button>
                </div>
              </>
            ) : cd.total === 0 ? (
              <>
                <Icon name="timer" size={46} className="mx-auto text-gray-400 dark:text-gray-500" />
                <p className="mt-3 text-[15px] text-gray-500 dark:text-gray-400">
                  No countdown set — how long do you need?
                </p>
                <div className="mt-5">
                  <Button large rounded onClick={openSheet}>
                    <span className="inline-flex items-center gap-2">
                      <Icon name="plus" size={20} />
                      Set Countdown
                    </span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <span className={`h-2 w-2 rounded-full ${cd.running ? STATE_DOT.running : STATE_DOT.paused}`} />
                  {cd.running ? 'Counting Down' : 'Paused'}
                </div>
                <div className="mt-2 text-[58px] font-bold leading-none tabular-nums tracking-tight">
                  {fmt(cd.remaining)}
                </div>
                <div className="mt-4 px-3">
                  <Progressbar progress={cd.total ? cd.remaining / cd.total : 0} />
                </div>
                <div className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
                  of {fmt(cd.total)}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {cd.running ? (
                    <Button
                      large
                      rounded
                      tonal
                      onClick={() => {
                        haptic('clockPause');
                        cd.pause();
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon name="pause" size={20} />
                        Pause
                      </span>
                    </Button>
                  ) : (
                    <Button
                      large
                      rounded
                      disabled={cd.remaining === 0}
                      onClick={() => {
                        haptic('clockStart');
                        cd.resume();
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon name="play" size={20} />
                        {cd.remaining === cd.total ? 'Start' : 'Resume'}
                      </span>
                    </Button>
                  )}
                  <Button
                    large
                    rounded
                    tonal
                    onClick={() => {
                      haptic('clockStop');
                      cd.reset();
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon name="rotate-ccw" size={20} />
                      Reset
                    </span>
                  </Button>
                </div>
              </>
            )}
          </Block>

          {cd.total > 0 && !cd.expired && (
            <List strong inset className="!mt-2">
              <ListItem title="Set For" after={fmt(cd.total)} />
              <ListButton onClick={openSheet}>Change Countdown</ListButton>
              <ListButton
                className="k-color-brand-red"
                onClick={() => {
                  haptic('removed');
                  cd.clear();
                }}
              >
                Clear Countdown
              </ListButton>
            </List>
          )}
          {cd.total === 0 && (
            <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              A countdown runs on its own — set one and switch to any other screen while
              it ticks. When it reaches zero the app rings and buzzes until you stop it.
            </Block>
          )}
        </>
      )}

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

      <Sheet
        className="no-safe-areas-top pb-safe"
        opened={sheetOpened}
        onBackdropClick={() => setSheetOpened(false)}
      >
        <Navbar
          title="Set Countdown"
          right={<Link navbar onClick={() => setSheetOpened(false)}>Cancel</Link>}
        />

        <BlockTitle>Quick Set</BlockTitle>
        <Block strong inset>
          <div className="grid grid-cols-3 gap-3">
            {PRESETS.map((mins) => (
              <Button key={mins} small rounded tonal onClick={usePreset(mins)}>
                {mins} min
              </Button>
            ))}
          </div>
        </Block>

        <BlockTitle>Hours · Minutes · Seconds</BlockTitle>
        <List strong inset>
          <ListInput
            label="Hours"
            type="number"
            min={0}
            max={23}
            inputMode="numeric"
            value={hours}
            onInput={(e) => setHours(e.target.value)}
          />
          <ListInput
            label="Minutes"
            type="number"
            min={0}
            max={59}
            inputMode="numeric"
            value={minutes}
            onInput={(e) => setMinutes(e.target.value)}
          />
          <ListInput
            label="Seconds"
            type="number"
            min={0}
            max={59}
            inputMode="numeric"
            value={seconds}
            onInput={(e) => setSeconds(e.target.value)}
          />
        </List>

        <Block>
          <Button large rounded disabled={sheetTotal === 0} onClick={startCountdown}>
            Start Countdown
          </Button>
        </Block>
      </Sheet>

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
