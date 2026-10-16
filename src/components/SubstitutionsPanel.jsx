// The substitutions log, sitting under the squad. It mirrors the Goal Logger:
// a minute that can ride the match clock, an On player and an Off player.

import { useEffect, useState } from 'react';
import {
  Block, BlockTitle, List, ListItem, ListInput, Button, Toggle,
  Actions, ActionsGroup, ActionsButton, ActionsLabel, Badge,
  Navbar, Link, Sheet,
} from 'konsta/react';
import { useMatch, clockMinute, clockState, CLOCK_STATE_LABELS } from '../store.jsx';
import MatchClock from './MatchClock.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';
import { showToast } from '../toast.jsx';

const MINUTES = Array.from({ length: 120 }, (_, i) => i + 1);

export default function SubstitutionsPanel({ onModalOpen }) {
  const { match, addSub, removeSub, updateSub } = useMatch();
  const names = match.players.map((p) => p.name);

  const [minute, setMinute] = useState('1');
  const [onPlayer, setOnPlayer] = useState(names[0] || '');
  const [offPlayer, setOffPlayer] = useState(names[1] || '');
  const [notes, setNotes] = useState('');
  const [followClock, setFollowClock] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  // The logged substitution being edited, plus its form fields.
  const [editing, setEditing] = useState(null);
  const [editMinute, setEditMinute] = useState('1');
  const [editOn, setEditOn] = useState('');
  const [editOff, setEditOff] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // While the clock is running the minute rides along with it; picking a minute
  // by hand stops it following.
  useEffect(() => {
    if (!followClock) return undefined;
    setMinute(String(clockMinute(match.clock)));
    const id = setInterval(() => setMinute(String(clockMinute(match.clock))), 1000);
    return () => clearInterval(id);
  }, [followClock, match.clock]);

  // The squad can change while this screen is open — keep the pickers valid.
  const activeOn = names.includes(onPlayer) ? onPlayer : names[0] || '';
  const activeOff = names.includes(offPlayer) ? offPlayer : names[1] || '';
  const samePlayer = activeOn !== '' && activeOn === activeOff;
  const shortage = names.length < 2;

  const sortedSubs = [...match.subs].sort((a, b) => a.minute - b.minute);
  const target = pendingDelete ? match.subs.find((s) => s.id === pendingDelete) : null;

  // Report the confirmation sheet to the host screen, so it can lift itself
  // (and this panel's action sheet) above the fixed tab bar while it is open.
  useEffect(() => {
    if (onModalOpen) onModalOpen(pendingDelete !== null || editing !== null);
  }, [pendingDelete, editing, onModalOpen]);

  const save = () => {
    if (!activeOn || !activeOff || samePlayer) return;
    haptic('subLogged');
    addSub({
      minute: Number(minute),
      on: activeOn,
      off: activeOff,
      notes: notes.trim(),
    });
    setNotes('');
    showToast('Substitution saved');
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

            <ListInput
              label="On"
              type="select"
              dropdown
              value={activeOn}
              onChange={(e) => setOnPlayer(e.target.value)}
            >
              {names.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </ListInput>

            <ListInput
              label="Off"
              type="select"
              dropdown
              value={activeOff}
              error={samePlayer ? 'Pick two different players' : undefined}
              onChange={(e) => setOffPlayer(e.target.value)}
            >
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
            <Button large rounded onClick={save} disabled={!activeOn || !activeOff || samePlayer}>
              Save Substitution
            </Button>
          </Block>
        </>
      )}

      <BlockTitle>
        Substitutions Logged{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({match.subs.length})
        </span>
      </BlockTitle>

      {sortedSubs.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No substitutions logged yet.
        </Block>
      ) : (
        <List strong inset>
          {sortedSubs.map((sub) => (
            <ListItem
              key={sub.id}
              link
              chevron={false}
              onClick={() => setPendingDelete(sub.id)}
              media={<Badge className="!bg-red-500">{`${sub.minute}'`}</Badge>}
              title={`${sub.on} on · ${sub.off} off`}
              text={sub.notes || undefined}
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
