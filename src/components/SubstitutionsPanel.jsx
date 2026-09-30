// The substitutions log, sitting under the squad. It mirrors the Goal Logger:
// a minute that can ride the match clock, an On player and an Off player.

import { useEffect, useState } from 'react';
import {
  Block, BlockTitle, List, ListItem, ListInput, Button, Toast, Toggle,
  Actions, ActionsGroup, ActionsButton, ActionsLabel, Badge,
} from 'konsta/react';
import { useMatch, clockMinute, clockState, CLOCK_STATE_LABELS } from '../store.jsx';
import MatchClock from './MatchClock.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

const MINUTES = Array.from({ length: 120 }, (_, i) => i + 1);

export default function SubstitutionsPanel() {
  const { match, addSub, removeSub } = useMatch();
  const names = match.players.map((p) => p.name);

  const [minute, setMinute] = useState('1');
  const [onPlayer, setOnPlayer] = useState(names[0] || '');
  const [offPlayer, setOffPlayer] = useState(names[1] || '');
  const [notes, setNotes] = useState('');
  const [followClock, setFollowClock] = useState(true);
  const [saved, setSaved] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (!saved) return undefined;
    const id = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(id);
  }, [saved]);

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
    setSaved(true);
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

      <Toast position="center" opened={saved}>
        <div className="shrink">Substitution saved</div>
      </Toast>

      <Actions opened={pendingDelete !== null} onBackdropClick={() => setPendingDelete(null)}>
        <ActionsGroup>
          <ActionsLabel>
            {target ? `${target.minute}' — ${target.on} on for ${target.off}` : 'Substitution'}
          </ActionsLabel>
          <ActionsButton
            bold
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
    </>
  );
}
