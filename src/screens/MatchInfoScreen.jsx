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

  const sortedGoals = [...match.goalTimes].sort((a, b) => a.minute - b.minute);

  // Goals and assists tallied straight from the logged goals, so the table stays
  // right even for a name that has since left the squad.
  const tallies = new Map();
  const tallyFor = (name) => {
    if (!tallies.has(name)) tallies.set(name, { name, goals: 0, assists: 0 });
    return tallies.get(name);
  };
  match.goalTimes.forEach((g) => {
    if (g.scorer) tallyFor(g.scorer).goals += 1;
    if (g.assist) tallyFor(g.assist).assists += 1;
  });
  const scorerTable = [...tallies.values()].sort(
    (a, b) => b.goals - a.goals || b.assists - a.assists || a.name.localeCompare(b.name)
  );
  const totalGoals = scorerTable.reduce((n, r) => n + r.goals, 0);
  const totalAssists = scorerTable.reduce((n, r) => n + r.assists, 0);

  // Period 1 broken into the three states, in the order they matter on the day.
  const period1Groups = [
    {
      key: 'starting',
      label: 'Starting',
      dot: 'bg-green-500',
      players: match.players.filter((p) => p.periods[0] === PERIOD_GREEN),
    },
    {
      key: 'subs',
      label: 'Subs',
      dot: 'bg-red-500',
      players: match.players.filter((p) => p.periods[0] === PERIOD_RED),
    },
    {
      key: 'unavailable',
      label: 'Not Available',
      dot: 'bg-gray-300 dark:bg-white/25',
      players: match.players.filter(
        (p) => p.periods[0] !== PERIOD_GREEN && p.periods[0] !== PERIOD_RED
      ),
    },
  ];

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

      <BlockTitle>Squad — Period 1</BlockTitle>
      {match.players.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No squad members yet.
        </Block>
      ) : (
        period1Groups.map((group) => (
          <div key={group.key}>
            <BlockTitle className="!mt-4 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${group.dot}`} />
              {group.label}
              <span className="font-normal text-gray-500 dark:text-gray-400">
                ({group.players.length})
              </span>
            </BlockTitle>
            {group.players.length === 0 ? (
              <Block strong inset className="!py-2.5 text-[14px] text-gray-500 dark:text-gray-400">
                None
              </Block>
            ) : (
              <List strong inset>
                {group.players.map((player, i) => (
                  <li
                    key={player.name}
                    className={`px-4 py-2 text-[15px] font-semibold ${
                      i < group.players.length - 1 ? 'hairline-b' : ''
                    }`}
                  >
                    {player.name}
                  </li>
                ))}
              </List>
            )}
          </div>
        ))
      )}

      <BlockTitle>Goals &amp; Assists by Player</BlockTitle>
      {scorerTable.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No goals or assists yet.
        </Block>
      ) : (
        <List strong inset>
          <li className="flex items-center gap-2 px-4 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <span className="min-w-0 flex-1">Player</span>
            <span className="w-14 text-right">Goals</span>
            <span className="w-16 text-right">Assists</span>
          </li>
          {scorerTable.map((row) => (
            <li key={row.name} className="flex items-center gap-2 px-4 py-2 hairline-b">
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {row.name}
              </span>
              <span className="w-14 text-right text-[15px] tabular-nums">{row.goals}</span>
              <span className="w-16 text-right text-[15px] tabular-nums">{row.assists}</span>
            </li>
          ))}
          <li className="flex items-center gap-2 px-4 py-2 text-gray-500 dark:text-gray-400">
            <span className="min-w-0 flex-1 text-[14px] font-semibold">Total</span>
            <span className="w-14 text-right text-[15px] font-semibold tabular-nums">
              {totalGoals}
            </span>
            <span className="w-16 text-right text-[15px] font-semibold tabular-nums">
              {totalAssists}
            </span>
          </li>
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
