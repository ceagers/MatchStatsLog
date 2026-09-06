import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, ListButton,
  Button, Dialog, DialogButton,
} from 'konsta/react';
import { useMatch, formatDate, PERIOD_GREEN, PERIOD_RED } from '../store.jsx';
import { haptic } from '../haptics.js';

export default function MatchInfoScreen({ onNext }) {
  const {
    match, setOpposition, setHomeAway, setDate, setResult, resetMatch,
  } = useMatch();
  const [confirmReset, setConfirmReset] = useState(false);

  const p1Green = match.players.filter((p) => p.periods[0] === PERIOD_GREEN).length;
  const p1Red = match.players.filter((p) => p.periods[0] === PERIOD_RED).length;
  const sortedGoals = [...match.goalTimes].sort((a, b) => a.minute - b.minute);

  return (
    <Page className="pb-safe-24">
      <Navbar title="Match Info" large transparent className="top-0 sticky" />

      <BlockTitle>Fixture</BlockTitle>
      <List strong inset>
        <ListInput
          label="Opposition"
          type="text"
          placeholder="e.g. Riverside FC"
          value={match.opposition}
          onInput={(e) => setOpposition(e.target.value)}
          clearButton
          onClear={() => setOpposition('')}
        />
        <ListInput
          label="Home/Away"
          type="text"
          placeholder="Home or Away"
          value={match.homeAway}
          onInput={(e) => setHomeAway(e.target.value)}
          clearButton
          onClear={() => setHomeAway('')}
        />
        <ListInput
          label="Date"
          type="date"
          value={match.date}
          onChange={(e) => setDate(e.target.value)}
        />
        <ListInput
          label="Result"
          type="text"
          placeholder="e.g. 3-1 win"
          value={match.result}
          onInput={(e) => setResult(e.target.value)}
          clearButton
          onClear={() => setResult('')}
        />
      </List>

      <BlockTitle>Summary</BlockTitle>
      <Block strong inset>
        <div className="text-[22px] font-bold leading-tight">
          {match.opposition ? `vs ${match.opposition}` : 'No opposition set'}
        </div>
        <div className="mt-0.5 text-[15px] text-gray-500 dark:text-gray-400">
          {[match.homeAway, formatDate(match.date)].filter(Boolean).join(' · ')}
        </div>
        {match.result ? (
          <div className="mt-2 text-[17px] font-semibold">{match.result}</div>
        ) : null}
      </Block>

      <BlockTitle>
        Squad — Period 1{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({p1Green} green · {p1Red} red)
        </span>
      </BlockTitle>
      {match.players.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No squad members yet.
        </Block>
      ) : (
        <List strong inset>
          {match.players.map((player, i) => (
            <li
              key={player.name}
              className={`flex items-center justify-between gap-3 px-4 py-2 ${
                i < match.players.length - 1 ? 'hairline-b' : ''
              }`}
            >
              <span className="truncate text-[15px] font-semibold">{player.name}</span>
              <PeriodPill state={player.periods[0]} />
            </li>
          ))}
        </List>
      )}

      <BlockTitle>
        Goals Logged{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({match.goalTimes.length})
        </span>
      </BlockTitle>
      {sortedGoals.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No goals logged yet.
        </Block>
      ) : (
        <List strong inset>
          {sortedGoals.map((goal, i) => (
            <li
              key={goal.id}
              className={`flex items-start gap-3 px-4 py-2.5 ${
                i < sortedGoals.length - 1 ? 'hairline-b' : ''
              }`}
            >
              <span
                className="mt-0.5 w-11 shrink-0 rounded-md bg-green-500 py-0.5 text-center
                           text-[13px] font-semibold tabular-nums text-white"
              >
                {goal.minute}&apos;
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{goal.scorer}</div>
                <div className="text-[13px] text-gray-500 dark:text-gray-400">
                  {goal.assist ? `Assist: ${goal.assist}` : 'No assist'}
                </div>
                {goal.notes ? (
                  <div className="mt-0.5 break-words text-[13px] text-gray-500 dark:text-gray-400">
                    {goal.notes}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </List>
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

      <BlockTitle>Reset</BlockTitle>
      <List strong inset>
        <ListButton className="k-color-brand-red" onClick={() => setConfirmReset(true)}>
          Start New Match
        </ListButton>
      </List>
      <Block className="text-[13px] text-gray-500 dark:text-gray-400 !mt-1">
        Clears the fixture details, every period and all logged goals. The squad list is kept.
      </Block>

      <Dialog
        opened={confirmReset}
        onBackdropClick={() => setConfirmReset(false)}
        title="Start new match?"
        content="All fixture details, periods and goals will be cleared. Your squad list stays."
        buttons={
          <>
            <DialogButton onClick={() => setConfirmReset(false)}>Cancel</DialogButton>
            <DialogButton
              strong
              onClick={() => {
                haptic('removed');
                resetMatch();
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

function PeriodPill({ state }) {
  const styles = [
    'bg-black/5 dark:bg-white/10 text-gray-400 dark:text-gray-500',
    'bg-green-500 text-white',
    'bg-red-500 text-white',
  ];
  const labels = ['Not set', 'Green', 'Red'];
  const s = state === PERIOD_GREEN || state === PERIOD_RED ? state : 0;
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${styles[s]}`}>
      {labels[s]}
    </span>
  );
}
