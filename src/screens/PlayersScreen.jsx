import { useEffect, useRef, useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, Button, Link, Sheet, Toast,
  Glass, Actions, ActionsGroup, ActionsButton, ActionsLabel, Dialog, DialogButton,
} from 'konsta/react';
import { useMatch, formatSavedAt, PERIOD_GREEN, PERIOD_RED } from '../store.jsx';
import SubstitutionsPanel from '../components/SubstitutionsPanel.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

const PERIOD_STYLES = [
  'bg-black/5 dark:bg-white/10 text-gray-400 dark:text-gray-500',
  'bg-green-500 text-white shadow-sm shadow-green-500/30',
  'bg-red-500 text-white shadow-sm shadow-red-500/30',
];

export default function PlayersScreen({ onNext }) {
  const { match, savedMatches, cyclePeriod, addPlayer, removePlayer, clearPeriods, movePlayer, saveCurrentMatch } = useMatch();

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);
  const [dragName, setDragName] = useState(null);
  const dragRef = useRef(null);

  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 1800);
  };

  const savedRecord = savedMatches.find((r) => r.id === match.savedId) || null;
  const saveMatch = () => {
    haptic('archived');
    saveCurrentMatch();
    showToast(savedRecord ? 'Saved match updated' : 'Match saved');
  };

  const trimmed = newName.trim();
  const duplicate =
    trimmed !== '' &&
    match.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  const submitAdd = () => {
    if (!trimmed || duplicate) return;
    haptic('periodOn');
    addPlayer(trimmed);
    setNewName('');
    setAddOpen(false);
  };

  // --- Re-sort the squad by dragging (edit mode only) ------------------------
  // In edit mode, the grip beside a player's name picks that player up and the
  // row trades places as the finger crosses the next one. The list is re-ordered
  // live, so what the coach sees under the finger is what gets saved.
  const startDrag = (event, player, index) => {
    if (match.players.length < 2) return;
    const row = event.currentTarget.closest('li');
    const height = row ? row.getBoundingClientRect().height : 0;
    dragRef.current = { index, startY: event.clientY, rowHeight: height || 48 };
    setDragName(player.name);
    haptic('impact');
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety; the drag still works without it */
    }
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const crossed = Math.round((event.clientY - drag.startY) / drag.rowHeight);
    const target = Math.max(
      0,
      Math.min(match.players.length - 1, drag.index + crossed)
    );
    if (target === drag.index) return;
    movePlayer(drag.index, target);
    // Re-anchor the finger to the slot it just took, so it does not keep swapping.
    drag.startY += (target - drag.index) * drag.rowHeight;
    drag.index = target;
    haptic('tick');
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragName(null);
    haptic('bump');
  };

  return (
    <Page colors={{ bgIos: 'bg-transparent' }} className="relative z-10 pb-safe-24">
      <Navbar
        title="Players"
        large
        transparent
        className="top-0 sticky"
        left={
          <div className="flex items-center gap-2.5">
            {match.players.length > 0 && (
              <Link
                navbar
                className="!ml-0"
                onClick={() => {
                  haptic('tick');
                  setEditing((on) => !on);
                }}
              >
                {editing ? 'Done' : 'Edit'}
              </Link>
            )}
            <Glass
              component="button"
              aria-label="Add squad member"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              onClick={() => setAddOpen(true)}
            >
              <Icon name="plus" size={18} />
            </Glass>
          </div>
        }
        right={<Link navbar onClick={saveMatch}>Save</Link>}
      />

      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        {editing
          ? 'Drag the grip to re-sort the squad. Tap the red button to remove a player.'
          : 'Tap a period to cycle grey, green, red. Tap a name for more options.'}
      </Block>

      {editing ? null : (
        <Block className="!mt-0 !mb-2 flex items-center gap-4 text-[12px] text-gray-500 dark:text-gray-400">
          <LegendDot className="bg-green-500" label="Green" />
          <LegendDot className="bg-red-500" label="Red" />
          <LegendDot className="bg-black/15 dark:bg-white/25" label="Not set" />
        </Block>
      )}

      <BlockTitle>
        Squad{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({match.players.length})
        </span>
      </BlockTitle>
      {match.players.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No squad members yet. Tap + to add one.
        </Block>
      ) : (
        <List strong inset>
          {editing ? null : (
            <li className="flex items-center gap-2 px-3 pt-2 pb-1">
              <span className="w-10 shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Player
              </span>
              <div className="grid flex-1 grid-cols-8 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <span
                    key={n}
                    className="text-center text-[11px] tabular-nums text-gray-400 dark:text-gray-500"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </li>
          )}

          {match.players.map((player, i) => (
            <li
              key={player.name}
              className={`flex items-center gap-2 px-3 py-1.5 ${
                i < match.players.length - 1 ? 'hairline-b' : ''
              } ${
                dragName === player.name
                  ? 'relative z-10 bg-black/5 dark:bg-white/10'
                  : ''
              }`}
            >
              {editing ? (
                <div className="flex flex-1 items-center gap-3 py-1">
                  <button
                    aria-label={`Re-sort ${player.name}`}
                    onPointerDown={(event) => startDrag(event, player, i)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onLostPointerCapture={endDrag}
                    className={`flex h-9 w-5 shrink-0 items-center justify-center rounded-md
                      [touch-action:none] transition-colors duration-150 ${
                        dragName === player.name
                          ? 'text-gray-600 dark:text-gray-200'
                          : 'text-gray-300 active:text-gray-500 dark:text-gray-600'
                      }`}
                  >
                    <Icon name="grip-vertical" size={16} />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                    {player.name}
                  </span>
                  <button
                    onClick={() => {
                      haptic('tick');
                      setPendingRemove(player.name);
                    }}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-500/10
                               px-3 text-[14px] font-semibold text-red-500
                               transition-all duration-150 active:scale-95"
                  >
                    <Icon name="trash-2" size={16} />
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      haptic('tick');
                      setMenuFor(player.name);
                    }}
                    className="w-10 shrink-0 truncate text-left text-[15px] font-semibold
                               transition-opacity duration-150 active:opacity-50"
                  >
                    {player.name}
                  </button>

                  <div className="grid flex-1 grid-cols-8 gap-1">
                    {player.periods.map((state, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          const next = (state + 1) % 3;
                          haptic(
                            next === PERIOD_GREEN
                              ? 'periodOn'
                              : next === PERIOD_RED
                                ? 'bump'
                                : 'periodOff'
                          );
                          cyclePeriod(player.name, index);
                        }}
                        className={`h-9 rounded-lg text-[13px] font-semibold tabular-nums
                          transition-all duration-150 active:scale-90 ${PERIOD_STYLES[state] || PERIOD_STYLES[0]}`}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </li>
          ))}
        </List>
      )}

      <SubstitutionsPanel />

      <Block className="mt-6">
        <Button
          large
          rounded
          onClick={() => {
            haptic('tick');
            onNext();
          }}
        >
          Go to Goal Logger
        </Button>
      </Block>

      <Sheet
        className="no-safe-areas-top pb-safe"
        opened={addOpen}
        onBackdropClick={() => setAddOpen(false)}
      >
        <Navbar
          title="Add Squad Member"
          right={<Link navbar onClick={() => setAddOpen(false)}>Cancel</Link>}
        />
        <List strong inset>
          <ListInput
            label="Name or initials"
            type="text"
            placeholder="e.g. JW"
            value={newName}
            onInput={(e) => setNewName(e.target.value)}
            error={duplicate ? 'Already in the squad' : undefined}
            clearButton
            onClear={() => setNewName('')}
          />
        </List>
        <Block>
          <Button large rounded disabled={!trimmed || duplicate} onClick={submitAdd}>
            Add to Squad
          </Button>
        </Block>
      </Sheet>

      <Actions opened={menuFor !== null} onBackdropClick={() => setMenuFor(null)}>
        <ActionsGroup>
          <ActionsLabel>{menuFor || ''}</ActionsLabel>
          <ActionsButton
            onClick={() => {
              haptic('periodOff');
              if (menuFor) clearPeriods(menuFor);
              setMenuFor(null);
            }}
          >
            Clear All Periods
          </ActionsButton>
          <ActionsButton
            bold
            className="k-color-brand-red"
            onClick={() => {
              setPendingRemove(menuFor);
              setMenuFor(null);
            }}
          >
            Remove From Squad
          </ActionsButton>
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setMenuFor(null)}>Cancel</ActionsButton>
        </ActionsGroup>
      </Actions>

      <Dialog
        opened={pendingRemove !== null}
        onBackdropClick={() => setPendingRemove(null)}
        title="Remove player?"
        content={
          pendingRemove
            ? `${pendingRemove} will be taken out of the squad. Goals already logged are kept.`
            : ''
        }
        buttons={
          <>
            <DialogButton onClick={() => setPendingRemove(null)}>Cancel</DialogButton>
            <DialogButton
              strong
              onClick={() => {
                haptic('removed');
                if (pendingRemove) removePlayer(pendingRemove);
                if (match.players.length <= 1) setEditing(false);
                setPendingRemove(null);
              }}
            >
              Remove
            </DialogButton>
          </>
        }
      />

      <Toast position="center" opened={toast !== ''}>
        <div className="shrink">{toast}</div>
      </Toast>
    </Page>
  );
}

function LegendDot({ className, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded ${className}`} />
      {label}
    </span>
  );
}
