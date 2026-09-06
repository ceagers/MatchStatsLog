import { useEffect, useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListItem, ListInput,
  Button, Toast, Actions, ActionsGroup, ActionsButton, ActionsLabel, Badge,
} from 'konsta/react';
import { useMatch } from '../store.jsx';
import { haptic } from '../haptics.js';

const MINUTES = Array.from({ length: 120 }, (_, i) => i + 1);

export default function GoalLoggerScreen() {
  const { match, addGoal, removeGoal } = useMatch();
  const names = match.players.map((p) => p.name);

  const [minute, setMinute] = useState('1');
  const [scorer, setScorer] = useState(names[0] || '');
  const [assist, setAssist] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (!saved) return undefined;
    const id = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(id);
  }, [saved]);

  const sortedGoals = [...match.goalTimes].sort((a, b) => a.minute - b.minute);
  const target = pendingDelete
    ? match.goalTimes.find((g) => g.id === pendingDelete)
    : null;

  // The squad can change while this screen is open — keep the pickers valid.
  const activeScorer = names.includes(scorer) ? scorer : names[0] || '';
  const activeAssist = names.includes(assist) ? assist : '';

  const save = () => {
    if (!activeScorer) return;
    haptic('goalSaved');
    addGoal({
      minute: Number(minute),
      scorer: activeScorer,
      assist: activeAssist,
      notes: notes.trim(),
    });
    setAssist('');
    setNotes('');
    setSaved(true);
  };

  return (
    <Page className="pb-safe-24">
      <Navbar title="Goal Logger" large transparent className="top-0 sticky" />

      <BlockTitle>New Goal</BlockTitle>
      <List strong inset>
        <ListInput
          label="Minute"
          type="select"
          dropdown
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
        >
          {MINUTES.map((m) => (
            <option key={m} value={String(m)}>{`${m}'`}</option>
          ))}
        </ListInput>

        <ListInput
          label="Scorer"
          type="select"
          dropdown
          value={activeScorer}
          onChange={(e) => setScorer(e.target.value)}
        >
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </ListInput>

        <ListInput
          label="Assist"
          type="select"
          dropdown
          value={activeAssist}
          onChange={(e) => setAssist(e.target.value)}
        >
          <option value="">None</option>
          {names.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </ListInput>

        <ListInput
          label="Notes"
          type="text"
          placeholder="Optional detail"
          value={notes}
          onInput={(e) => setNotes(e.target.value)}
          clearButton
          onClear={() => setNotes('')}
        />
      </List>

      <Block>
        <Button large rounded onClick={save} disabled={!activeScorer}>
          Save Goal
        </Button>
      </Block>

      <BlockTitle>
        Logged Goals{' '}
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
          {sortedGoals.map((goal) => (
            <ListItem
              key={goal.id}
              link
              chevron={false}
              onClick={() => setPendingDelete(goal.id)}
              media={
                <Badge className="!bg-green-500">{`${goal.minute}'`}</Badge>
              }
              title={goal.scorer}
              subtitle={goal.assist ? `Assist: ${goal.assist}` : 'No assist'}
              text={goal.notes || undefined}
            />
          ))}
        </List>
      )}

      <Toast position="center" opened={saved}>
        <div className="shrink">Goal saved</div>
      </Toast>

      <Actions opened={pendingDelete !== null} onBackdropClick={() => setPendingDelete(null)}>
        <ActionsGroup>
          <ActionsLabel>
            {target ? `${target.minute}' — ${target.scorer}` : 'Goal'}
          </ActionsLabel>
          <ActionsButton
            bold
            className="k-color-brand-red"
            onClick={() => {
              haptic('removed');
              if (pendingDelete) removeGoal(pendingDelete);
              setPendingDelete(null);
            }}
          >
            Delete Goal
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setPendingDelete(null)}>Cancel</ActionsButton>
        </ActionsGroup>
      </Actions>
    </Page>
  );
}
