// The match clock: one period timed at a time, every period added to the total.

import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListItem, Button, Dialog, DialogButton, Link,
} from 'konsta/react';
import { useMatch, MAX_PERIODS, livePeriodMs, formatClock } from '../store.jsx';
import MatchClock from '../components/MatchClock.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function TimerScreen() {
  const { match, startClock, pauseClock, nextPeriod, resetClock } = useMatch();
  const clock = match.clock;
  const [confirmReset, setConfirmReset] = useState(false);

  const running = clock.running;
  const periodNo = Math.min(clock.periodIndex + 1, MAX_PERIODS);
  const allBanked =
    !running &&
    clock.periodIndex >= MAX_PERIODS - 1 &&
    clock.periodMs.length >= MAX_PERIODS;
  const started =
    running || livePeriodMs(clock) > 0 || clock.periodMs.some((ms) => ms > 0);

  const toggle = () => {
    if (running) {
      haptic('clockPause');
      pauseClock();
    } else {
      haptic('clockStart');
      startClock();
    }
  };

  const endPeriod = () => {
    haptic('periodEnd');
    nextPeriod();
  };

  return (
    <Page className="pb-safe-24">
      <Navbar
        title="Match Clock"
        large
        transparent
        className="top-0 sticky"
        right={<Link navbar onClick={() => setConfirmReset(true)}>Reset</Link>}
      />

      <Block strong inset className="!mt-0 !py-6 text-center">
        <div className="flex items-center justify-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <span
            className={`h-2 w-2 rounded-full ${
              running ? 'bg-green-500' : 'bg-gray-300 dark:bg-white/25'
            }`}
          />
          {allBanked ? 'Match Complete' : `Period ${periodNo} of ${MAX_PERIODS}`}
        </div>

        <MatchClock
          clock={clock}
          className="mt-2 block text-[58px] font-bold leading-none tabular-nums tracking-tight"
        />

        <div className="mt-3 text-[13px] text-gray-500 dark:text-gray-400">
          Total match time{' '}
          <MatchClock
            clock={clock}
            mode="total"
            className="font-semibold tabular-nums text-gray-900 dark:text-white"
          />
        </div>
      </Block>

      <Block className="!my-2 grid grid-cols-2 gap-3">
        <Button large rounded onClick={toggle}>
          <span className="inline-flex items-center gap-2">
            <Icon name={running ? 'pause' : 'play'} size={20} />
            {running ? 'Pause' : 'Start'}
          </span>
        </Button>
        <Button large rounded tonal disabled={!started || allBanked} onClick={endPeriod}>
          <span className="inline-flex items-center gap-2">
            <Icon name="flag" size={20} />
            End Period
          </span>
        </Button>
      </Block>

      <BlockTitle>Period Times</BlockTitle>
      <List strong inset>
        {Array.from({ length: MAX_PERIODS }, (_, i) => {
          const done = i < clock.periodIndex || (allBanked && i === MAX_PERIODS - 1);
          const current = !done && i === clock.periodIndex;
          const bankedMs = Number.isFinite(clock.periodMs[i]) ? clock.periodMs[i] : 0;
          const ticking = current && (running || livePeriodMs(clock) > 0);

          return (
            <ListItem
              key={i}
              title={`Period ${i + 1}`}
              subtitle={current && running ? 'In progress' : undefined}
              className={done || current ? '' : 'opacity-50'}
              after={
                done ? (
                  <span className="tabular-nums">{formatClock(bankedMs)}</span>
                ) : ticking ? (
                  <MatchClock clock={clock} className="font-semibold tabular-nums" />
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">Not started</span>
                )
              }
            />
          );
        })}

        <ListItem
          title="Total Match Time"
          after={
            <MatchClock
              clock={clock}
              mode="total"
              className="font-semibold tabular-nums"
            />
          }
        />
      </List>

      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        Start with the kick-off and tap End Period at each break — every period is timed
        separately and added to the total. A new goal on the Goals tab takes its minute off
        this clock, and the times are saved with the match.
      </Block>

      <Dialog
        opened={confirmReset}
        onBackdropClick={() => setConfirmReset(false)}
        title="Reset the clock?"
        content="Every period time and the total will be cleared. The fixture, squad and logged goals are not affected."
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
