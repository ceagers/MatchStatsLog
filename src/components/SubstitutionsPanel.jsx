// The substitutions UI. The New Substitution form mirrors the Goal Logger: a
// minute that can ride the match clock, then five On pickers and five Off
// pickers — one On/Off pair per substitution made at the same moment. The On
// pickers default to who is available to come on: those marked as the bench
// (red Period 1) plus everyone who has come off in a logged substitution, in
// the order the bench was marked and the subs were logged; the rest default
// blank. Every picker carries a blank row, so a default can be amended to
// blank by hand. Each fully picked pair is logged as its own substitution at
// the shared minute. The form and the Substitutions Logged list share one
// state hook, so they can be laid out apart — the In Game screen slots the
// logged goals between them — or together, as the Players screen shows them.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Block, BlockTitle, List, ListItem, ListInput, Button, Toggle,
  Actions, ActionsGroup, ActionsButton, ActionsLabel, Badge,
  Navbar, Link, Sheet,
} from 'konsta/react';
import {
  useMatch, clockMinute, clockState, CLOCK_STATE_LABELS, PERIOD_RED,
} from '../store.jsx';
import MatchClock from './MatchClock.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';
import { showToast } from '../toast.jsx';

const MINUTES = Array.from({ length: 120 }, (_, i) => i + 1);

// Five On and five Off pickers — enough for a whole bench of changes at once.
const SLOTS = 5;
const BLANK = '';
const blankPicks = () => Array.from({ length: SLOTS }, () => BLANK);

// The On defaults for one batch: the bench pool in order, then blanks.
const defaultPicks = (pool) =>
  Array.from({ length: SLOTS }, (_, i) => pool[i] || BLANK);

// The state and actions behind both halves. onModalOpen reports the edit sheet
// and confirmation sheet to the host screen, so it can lift itself (and this
// panel's action sheet) above the fixed tab bar while either is open.
export function useSubstitutions({ onModalOpen } = {}) {
  const { match, addSub, removeSub, updateSub } = useMatch();
  const names = match.players.map((p) => p.name);

  // Who can come on right now: the Period 1 bench (marked red) and everyone a
  // logged substitution has brought off — minus anyone already back on the
  // pitch. In squad order first, then the order the subs were logged.
  const benchPool = useMemo(() => {
    const subs = [...match.subs].sort((a, b) => a.minute - b.minute);
    const lastRole = new Map();
    subs.forEach((s) => {
      if (s.on) lastRole.set(s.on, 'on');
      if (s.off) lastRole.set(s.off, 'off');
    });
    const pool = [];
    const seen = new Set();
    const push = (name) => {
      if (name && names.includes(name) && !seen.has(name)) {
        seen.add(name);
        pool.push(name);
      }
    };
    match.players.forEach((p) => {
      const role = lastRole.get(p.name);
      if (role === 'on') return; // on the pitch — cannot come on again
      const marked = Array.isArray(p.periods) ? p.periods[0] : 0;
      if (role === 'off' || marked === PERIOD_RED) push(p.name);
    });
    return pool;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.players, match.subs]);

  const [minute, setMinute] = useState('1');
  const [onPicks, setOnPicks] = useState(() => defaultPicks(benchPool));
  const [offPicks, setOffPicks] = useState(blankPicks);
  const [notes, setNotes] = useState('');
  const [followClock, setFollowClock] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  // The logged substitution being edited, plus its form fields.
  const [editing, setEditing] = useState(null);
  const [editMinute, setEditMinute] = useState('1');
  const [editOn, setEditOn] = useState('');
  const [editOff, setEditOff] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Slots the coach has set by hand. Untouched slots keep following the bench
  // pool as it changes — a freshly marked bench or a newly logged substitution
  // re-defaults them — while touched slots hold their amended value, blank or
  // otherwise, until the next batch is saved.
  const touched = useRef(new Set());
  const setOnPick = (i, value) => {
    touched.current.add(i);
    setOnPicks((picks) => picks.map((v, j) => (j === i ? value : v)));
  };
  const setOffPick = (i, value) => {
    touched.current.add(i);
    setOffPicks((picks) => picks.map((v, j) => (j === i ? value : v)));
  };

  // While the clock is running the minute rides along with it; picking a minute
  // by hand stops it following.
  useEffect(() => {
    if (!followClock) return undefined;
    setMinute(String(clockMinute(match.clock)));
    const id = setInterval(() => setMinute(String(clockMinute(match.clock))), 1000);
    return () => clearInterval(id);
  }, [followClock, match.clock]);

  // As the bench pool changes, re-default every untouched slot and drop any
  // touched slot whose player has left the squad.
  useEffect(() => {
    setOnPicks((picks) =>
      picks.map((v, i) =>
        touched.current.has(i) ? (names.includes(v) ? v : BLANK) : benchPool[i] || BLANK
      )
    );
    setOffPicks((picks) =>
      picks.map((v) => (names.includes(v) ? v : BLANK))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchPool]);

  // The squad can change while this screen is open — read the pickers through
  // this so a name that has gone shows as blank rather than a dead value.
  const pickOn = (i) => (onPicks[i] && names.includes(onPicks[i]) ? onPicks[i] : BLANK);
  const pickOff = (i) => (offPicks[i] && names.includes(offPicks[i]) ? offPicks[i] : BLANK);

  const onVals = Array.from({ length: SLOTS }, (_, i) => pickOn(i));
  const offVals = Array.from({ length: SLOTS }, (_, i) => pickOff(i));
  const pairs = onVals.map((on, i) => ({ on, off: offVals[i] }));
  const filledPairs = pairs.filter((p) => p.on && p.off);
  const halfPair = pairs.some((p) => (p.on && !p.off) || (!p.on && p.off));
  const dupOn = onVals.some((v, i) => v && onVals.indexOf(v) !== i);
  const dupOff = offVals.some((v, i) => v && offVals.indexOf(v) !== i);
  const overlap = onVals.some((v) => v && offVals.includes(v));
  const shortage = names.length < 2;
  const canSave = !shortage && filledPairs.length > 0 && !halfPair && !dupOn && !dupOff && !overlap;

  const onErrors = onVals.map((v, i) => {
    if (v && onVals.indexOf(v) !== i) return 'Picked twice';
    if (v && offVals.includes(v)) return 'Also picked to come off';
    if (v && !offVals[i]) return 'Pick who is coming off';
    return undefined;
  });
  const offErrors = offVals.map((v, i) => {
    if (v && offVals.indexOf(v) !== i) return 'Picked twice';
    if (v && onVals.includes(v)) return 'Also picked to come on';
    if (v && !onVals[i]) return 'Pick who is coming on';
    return undefined;
  });

  const sortedSubs = [...match.subs].sort((a, b) => a.minute - b.minute);
  const target = pendingDelete ? match.subs.find((s) => s.id === pendingDelete) : null;

  useEffect(() => {
    if (onModalOpen) onModalOpen(pendingDelete !== null || editing !== null);
  }, [pendingDelete, editing, onModalOpen]);

  const save = () => {
    if (!canSave) return;
    haptic('subLogged');
    filledPairs.forEach((p) =>
      addSub({ minute: Number(minute), on: p.on, off: p.off, notes: notes.trim() })
    );
    // Default the next batch to whoever is on the bench now: the pool minus
    // everyone just brought on, plus everyone just subbed off.
    const nextPool = benchPool.filter((n) => !onVals.includes(n));
    offVals.forEach((n) => {
      if (n && !nextPool.includes(n)) nextPool.push(n);
    });
    touched.current = new Set();
    setOnPicks(defaultPicks(nextPool));
    setOffPicks(blankPicks());
    setNotes('');
    showToast(
      filledPairs.length === 1
        ? 'Substitution saved'
        : `${filledPairs.length} substitutions saved`
    );
  };

  // Open the edit sheet prefilled with the chosen logged substitution.
  const startEdit = () => {
    const sub = target;
    if (!sub) return;
    setEditMinute(String(sub.minute));
    setEditOn(sub.on);
    setEditOff(sub.off);
    setEditNotes(sub.notes || '');
    setEditing(sub.id);
    setPendingDelete(null);
  };

  const saveEdit = () => {
    if (!editing || !editOn || !editOff || editOn === editOff) return;
    haptic('subLogged');
    updateSub(editing, {
      minute: Number(editMinute),
      on: editOn,
      off: editOff,
      notes: editNotes.trim(),
    });
    setEditing(null);
    showToast('Substitution updated');
  };

  return {
    match, names, removeSub,
    minute, setMinute,
    onVals, offVals, onErrors, offErrors, setOnPick, setOffPick, filledPairs,
    notes, setNotes, followClock, setFollowClock,
    pendingDelete, setPendingDelete, editing, setEditing,
    editMinute, setEditMinute, editOn, setEditOn, editOff, setEditOff, editNotes, setEditNotes,
    shortage, canSave,
    sortedSubs, target, save, startEdit, saveEdit,
  };
}

// The New Substitution form: clock readout, follow toggle, then the pickers —
// On and Off interleaved, one On/Off pair per substitution made at the same
// moment.
export function SubstitutionForm({ sub }) {
  const {
    match, names, minute, setMinute, onVals, offVals, onErrors, offErrors,
    setOnPick, setOffPick, shortage, canSave, filledPairs,
    followClock, setFollowClock, notes, setNotes, save,
  } = sub;

  const pickerRow = (kind, i) => {
    const isOn = kind === 'on';
    return (
      <ListInput
        key={`${kind}-${i}`}
        label={`${isOn ? 'On' : 'Off'} ${i + 1}`}
        type="select"
        dropdown
        value={isOn ? onVals[i] : offVals[i]}
        error={(isOn ? onErrors : offErrors)[i]}
        onChange={(e) => (isOn ? setOnPick : setOffPick)(i, e.target.value)}
      >
        <option value="">—</option>
        {names.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </ListInput>
    );
  };

  return (
    <>
      <BlockTitle>New Substitution</BlockTitle>

      {shortage ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          Add at least two players to the squad to log a substitution.
        </Block>
      ) : (
        <>
          <List strong inset>
            <ListItem
              media={<Icon name="timer" size={24} />}
              title="Time On The Clock"
              subtitle={CLOCK_STATE_LABELS[clockState(match.clock)]}
              after={
                <MatchClock
                  clock={match.clock}
                  mode="match"
                  className="text-[17px] font-semibold tabular-nums"
                />
              }
            />
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

            {Array.from({ length: SLOTS }, (_, i) => (
              <Fragment key={i}>
                {pickerRow('on', i)}
                {pickerRow('off', i)}
              </Fragment>
            ))}

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
            <Button large rounded onClick={save} disabled={!canSave}>
              Save Substitution{filledPairs.length > 1 ? `s (${filledPairs.length})` : ''}
            </Button>
          </Block>
        </>
      )}
    </>
  );
}

// The Substitutions Logged list, with its edit sheet and delete confirmation.
export function SubstitutionsLog({ sub }) {
  const {
    sortedSubs, pendingDelete, setPendingDelete, target, startEdit, saveEdit,
    editing, setEditing, editMinute, setEditMinute, editOn, setEditOn,
    editOff, setEditOff, editNotes, setEditNotes, names, removeSub,
  } = sub;

  return (
    <>
      <BlockTitle>
        Substitutions Logged{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({sortedSubs.length})
        </span>
      </BlockTitle>

      {sortedSubs.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No substitutions logged yet.
        </Block>
      ) : (
        <List strong inset>
          {sortedSubs.map((s) => (
            <ListItem
              key={s.id}
              link
              chevron={false}
              onClick={() => setPendingDelete(s.id)}
              media={<Badge className="!bg-red-500">{`${s.minute}'`}</Badge>}
              title={`${s.on} on · ${s.off} off`}
              text={s.notes || undefined}
            />
          ))}
        </List>
      )}

      <Actions opened={pendingDelete !== null} onBackdropClick={() => setPendingDelete(null)}>
        <ActionsGroup>
          <ActionsLabel>
            {target ? `${target.minute}' — ${target.on} on for ${target.off}` : 'Substitution'}
          </ActionsLabel>
          <ActionsButton bold onClick={startEdit}>
            Edit Substitution
          </ActionsButton>
          <ActionsButton
            className="k-color-brand-red"
            onClick={() => {
              haptic('removed');
              if (pendingDelete) removeSub(pendingDelete);
              setPendingDelete(null);
            }}
          >
            Delete Substitution
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setPendingDelete(null)}>Cancel</ActionsButton>
        </ActionsGroup>
      </Actions>

      <Sheet
        className="no-safe-areas-top pb-safe"
        style={{ height: 'auto' }}
        opened={editing !== null}
        onBackdropClick={() => setEditing(null)}
      >
        <Navbar
          title="Edit Substitution"
          right={<Link navbar onClick={saveEdit}>Save</Link>}
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
            label="On"
            type="select"
            dropdown
            value={editOn}
            onChange={(e) => setEditOn(e.target.value)}
          >
            {(editOn && !names.includes(editOn) ? [editOn, ...names] : names).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </ListInput>

          <ListInput
            label="Off"
            type="select"
            dropdown
            value={editOff}
            error={editOn !== '' && editOn === editOff ? 'Pick two different players' : undefined}
            onChange={(e) => setEditOff(e.target.value)}
          >
            {(editOff && !names.includes(editOff) ? [editOff, ...names] : names).map((n) => (
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
          <Button large rounded onClick={saveEdit} disabled={!editOn || !editOff || editOn === editOff}>
            Save Changes
          </Button>
        </Block>
      </Sheet>
    </>
  );
}

// Both halves in sequence, as the Players screen shows them.
export default function SubstitutionsPanel({ onModalOpen }) {
  const sub = useSubstitutions({ onModalOpen });
  return (
    <>
      <SubstitutionForm sub={sub} />
      <SubstitutionsLog sub={sub} />
    </>
  );
}
