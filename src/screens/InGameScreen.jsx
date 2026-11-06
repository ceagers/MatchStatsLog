// The In Game screen: everything the coach works with while the match runs, in
// one walk down the screen — the match clock and its controls from the Timer
// screen, then logging a new goal (from the Goals screen), logging a new
// substitution (from the Players screen), and finally the two logs. The clock
// feeds the minutes both forms read.

import { useEffect, useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListItem, ListInput,
  Button, Toggle, Link, Actions, ActionsGroup, ActionsButton, ActionsLabel,
  Badge, Sheet, Dialog, DialogButton,
} from 'konsta/react';
import {
  useMatch, clockMinute, clockState, CLOCK_STATE_LABELS, totalTimedMs,
} from '../store.jsx';
import { showToast } from '../toast.jsx';
import MatchClock from '../components/MatchClock.jsx';
import { SubstitutionForm, SubstitutionsLog, useSubstitutions } from '../components/SubstitutionsPanel.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

const START_MINUTES = Array.from({ length: 121 }, (_, i) => i);
const MINUTES = Array.from({ length: 120 }, (_, i) => i + 1);

const STATE_DOT = {
  ready: 'bg-gray-300 dark:bg-white/25',
  running: 'bg-green-500',
  paused: 'bg-amber-500',
  stopped: 'bg-gray-400 dark:bg-white/40',
};

export default function InGameScreen() {
  const {
    match, savedMatches, startClock, pauseClock, stopClock, resetClock, setClockStart,
    addGoal, removeGoal, updateGoal, saveCurrentMatch,
  } = useMatch();
  const names = match.players.map((p) => p.name);

  // --- Match Clock ----------------------------------------------------------
  const clock = match.clock;
  const state = clockState(clock);
  const running = state === 'running';
  const timed = totalTimedMs(clock) > 0;
  const startMinute = Math.round((clock.offsetMs || 0) / 60000);
  const [confirmReset, setConfirmReset] = useState(false);

  const tap = (effect, action) => () => {
    haptic(effect);
    action();
  };

  // --- New Goal -------------------------------------------------------------
  const [minute, setMinute] = useState('1');
  const [scorer, setScorer] = useState(names[0] || '');
  const [assist, setAssist] = useState('');
  const [notes, setNotes] = useState('');
  const [followClock, setFollowClock] = useState(true);

  // While the clock is running the minute rides along with it; picking a minute
  // by hand stops it following.
  useEffect(() => {
    if (!followClock) return undefined;
    setMinute(String(clockMinute(match.clock)));
    const id = setInterval(() => setMinute(String(clockMinute(match.clock))), 1000);
    return () => clearInterval(id);
  }, [followClock, match.clock]);

  // The squad can change while this screen is open — keep the pickers valid.
  const activeScorer = names.includes(scorer) ? scorer : names[0] || '';
  const activeAssist = names.includes(assist) ? assist : '';

  const saveGoal = () => {
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
    showToast('Goal saved');
  };

  // --- Logged Goals ---------------------------------------------------------
  const sortedGoals = [...match.goalTimes].sort((a, b) => a.minute - b.minute);
  const [goalPending, setGoalPending] = useState(null);
  const goalTarget = goalPending
    ? match.goalTimes.find((g) => g.id === goalPending)
    : null;
  // The logged goal being edited, plus its form fields.
  const [goalEditing, setGoalEditing] = useState(null);
  const [editMinute, setEditMinute] = useState('1');
  const [editScorer, setEditScorer] = useState('');
  const [editAssist, setEditAssist] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Open the edit sheet prefilled with the chosen logged goal.
  const startGoalEdit = () => {
    const goal = goalTarget;
    if (!goal) return;
    setEditMinute(String(goal.minute));
    setEditScorer(goal.scorer);
    setEditAssist(goal.assist);
    setEditNotes(goal.notes || '');
    setGoalEditing(goal.id);
    setGoalPending(null);
  };

  const saveGoalEdit = () => {
    if (!goalEditing || !editScorer) return;
    haptic('goalSaved');
    updateGoal(goalEditing, {
      minute: Number(editMinute),
      scorer: editScorer,
      assist: editAssist,
      notes: editNotes.trim(),
    });
    setGoalEditing(null);
    showToast('Goal updated');
  };

  // The substitutions report their edit sheet and confirmation sheet here, so
  // the whole screen lifts above the fixed tab bar while any modal is open.
  const [subModalOpen, setSubModalOpen] = useState(false);
  const sub = useSubstitutions({ onModalOpen: setSubModalOpen });

  const savedRecord = savedMatches.find((r) => r.id === match.savedId) || null;
  const saveMatch = () => {
    haptic('archived');
    saveCurrentMatch();
    showToast(savedRecord ? 'Saved match updated' : 'Match saved');
  };

  // Any open dialog, action sheet or edit sheet lifts this screen above the
  // fixed tab bar, so the popup and its backdrop cover it like a native modal.
  const modalOpen =
    confirmReset || goalPending !== null || goalEditing !== null || subModalOpen;

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className={`relative pb-safe-24 ${modalOpen ? 'z-40' : 'z-10'}`}
    >
      <Navbar
        title="In Game"
        large
        transparent
        className="top-0 sticky"
        right={<Link navbar onClick={saveMatch}>Save</Link>}
      />

      {/* Match Clock — from the Timer screen */}
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
            mode="total"
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

      {/* Clock — from the Timer screen */}
      <BlockTitle>Clock</BlockTitle>
      <List strong inset>
        <ListItem
          title="Total Timed"
          after={
            <MatchClock
              clock={clock}
              mode="total"
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
        say — and banks everything timed so far into the total, so each quarter adds
        up. Stop ends the run and keeps the time, Reset takes the clock back to 0:00.
        Goals and substitutions read their minute off this clock, and the time is
        saved with the match.
      </Block>

      {/* New Goal — from the Goals screen */}
      <BlockTitle>New Goal</BlockTitle>
      <List strong inset>
        <ListItem
          label
          title="Follow Match Clock"
          after={
            <Toggle
              component="div"
              className="-my-1 k-color-brand-green"
              checked={followClock}
              onChange={() => {
                haptic('tick');
                setFollowClock((on) => !on);
              }}
            />
          }
        />
        <ListInput
          label="Minute"
          type="select"
          dropdown
          value={minute}
          onChange={(e) => {
            setFollowClock(false);
            setMinute(e.target.value);
          }}
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
        <Button large rounded onClick={saveGoal} disabled={!activeScorer}>
          Save Goal
        </Button>
      </Block>
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        {followClock
          ? 'The minute above counts along with the clock.'
          : 'Set the minute by hand above.'}
      </Block>

      {/* New Substitution — from the Players screen */}
      <SubstitutionForm sub={sub} />

      {/* Logged Goals — from the Goals screen */}
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
              onClick={() => setGoalPending(goal.id)}
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

      {/* Substitutions Logged — from the Players screen */}
      <SubstitutionsLog sub={sub} />

      <Actions opened={goalPending !== null} onBackdropClick={() => setGoalPending(null)}>
        <ActionsGroup>
          <ActionsLabel>
            {goalTarget ? `${goalTarget.minute}' — ${goalTarget.scorer}` : 'Goal'}
          </ActionsLabel>
          <ActionsButton bold onClick={startGoalEdit}>
            Edit Goal
          </ActionsButton>
          <ActionsButton
            className="k-color-brand-red"
            onClick={() => {
              haptic('removed');
              if (goalPending) removeGoal(goalPending);
              setGoalPending(null);
            }}
          >
            Delete Goal
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setGoalPending(null)}>Cancel</ActionsButton>
        </ActionsGroup>
      </Actions>

      <Sheet
        className="no-safe-areas-top pb-safe"
        style={{ height: 'auto' }}
        opened={goalEditing !== null}
        onBackdropClick={() => setGoalEditing(null)}
      >
        <Navbar
          title="Edit Goal"
          right={<Link navbar onClick={saveGoalEdit}>Save</Link>}
        />
        <List strong inset>
          <ListInput
            label="Minute"
            type="select"
            dropdown
            value={editMinute}
            onChange={(e) => setEditMinute(e.target.value)}
          >
            {MINUTES.map((m) => (
              <option key={m} value={String(m)}>{`${m}'`}</option>
            ))}
          </ListInput>

          <ListInput
            label="Scorer"
            type="select"
            dropdown
            value={editScorer}
            onChange={(e) => setEditScorer(e.target.value)}
          >
            {(editScorer && !names.includes(editScorer) ? [editScorer, ...names] : names).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </ListInput>

          <ListInput
            label="Assist"
            type="select"
            dropdown
            value={editAssist}
            onChange={(e) => setEditAssist(e.target.value)}
          >
            <option value="">None</option>
            {(editAssist && !names.includes(editAssist) ? [editAssist, ...names] : names).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </ListInput>

          <ListInput
            label="Notes"
            type="text"
            value={editNotes}
            onInput={(e) => setEditNotes(e.target.value)}
            clearButton
            onClear={() => setEditNotes('')}
          />
        </List>
        <Block>
          <Button large rounded onClick={saveGoalEdit} disabled={!editScorer}>
            Save Changes
          </Button>
        </Block>
      </Sheet>

      <Dialog
        opened={confirmReset}
        onBackdropClick={() => setConfirmReset(false)}
        title="Reset the clock?"
        content="The clock goes back to 0:00 and the start minute and total time are cleared. The fixture, squad, goals and substitutions are not affected."
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
