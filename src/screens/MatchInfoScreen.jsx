import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, ListButton,
  Button, Dialog, DialogButton,
} from 'konsta/react';
import { useMatch, formatDate } from '../store.jsx';
import { haptic } from '../haptics.js';

export default function MatchInfoScreen({ onNext }) {
  const { match, setOpposition, setDate, resetMatch } = useMatch();
  const [confirmReset, setConfirmReset] = useState(false);

  const totalGoals = match.players.reduce((sum, p) => sum + p.goals, 0);
  const totalAssists = match.players.reduce((sum, p) => sum + p.assists, 0);
  const used = match.players.filter((p) => p.periods.some(Boolean)).length;

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
          label="Date"
          type="date"
          value={match.date}
          onChange={(e) => setDate(e.target.value)}
        />
      </List>

      <BlockTitle>Summary</BlockTitle>
      <Block strong inset className="space-y-3">
        <div>
          <div className="text-[22px] font-bold leading-tight">
            {match.opposition ? `vs ${match.opposition}` : 'No opposition set'}
          </div>
          <div className="text-[15px] text-gray-500 dark:text-gray-400">
            {formatDate(match.date)}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Stat label="Goals" value={totalGoals} />
          <Stat label="Assists" value={totalAssists} />
          <Stat label="Played" value={`${used}/${match.players.length}`} />
        </div>
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

      <BlockTitle>Reset</BlockTitle>
      <List strong inset>
        <ListButton className="k-color-brand-red" onClick={() => setConfirmReset(true)}>
          Start New Match
        </ListButton>
      </List>
      <Block className="text-[13px] text-gray-500 dark:text-gray-400 !mt-1">
        Clears the opposition, every period, and all logged goals.
      </Block>

      <Dialog
        opened={confirmReset}
        onBackdropClick={() => setConfirmReset(false)}
        title="Start new match?"
        content="All periods, goals and assists for this match will be cleared."
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

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-black/5 dark:bg-white/10 py-3 text-center">
      <div className="text-[20px] font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}
