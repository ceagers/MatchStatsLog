// Squad: the constant screen, the first tab to the left of Home. It holds the
// squad roster — the names the whole app works from, plus the full names typed
// in the Players tab's Edit screen — and the season squad totals from the
// Players tab of the Season screen, fed with whichever season is current.
// Nothing here is cleared when a match is reset: the roster and its names ride
// through untouched, and every change made here — adding, removing, renaming
// or re-sorting a player — uses the same squad the rest of the app reads, so
// the Players tab, the goal logger and the substitution logger all follow it.

import { useRef, useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListInput, Button, Link, Sheet,
  Glass, Dialog, DialogButton,
} from 'konsta/react';
import { useMatch } from '../store.jsx';
import PlayerTotals from '../components/PlayerTotals.jsx';
import PlayerSeasonScreen from './PlayerSeasonScreen.jsx';
import ExportSheet from '../components/ExportSheet.jsx';
import PhotosSheet from '../components/PhotosSheet.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function SquadScreen() {
  const {
    match,
    currentSeason,
    savedMatches,
    addPlayer,
    removePlayer,
    movePlayer,
    setPlayerDisplayName,
    setPlayerSquadNumber,
  } = useMatch();

  const [editing, setEditing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingRemove, setPendingRemove] = useState(null);
  const [dragName, setDragName] = useState(null);
  const dragRef = useRef(null);
  // The player whose own season screen is open, or null.
  const [openPlayer, setOpenPlayer] = useState(null);
  // Export & photos hand-over sheets for the season totals — the same sheets
  // the Season screen's Players tab uses.
  const [exportOpen, setExportOpen] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photosData, setPhotosData] = useState([]);

  // Any open sheet or dialog lifts this whole screen above the fixed tab bar.
  const modalOpen =
    addOpen || pendingRemove !== null || exportOpen || photosOpen;

  // The current season's saved matches, newest played date first — the same
  // feed the Season screen's Players tab counts its totals from. Match played
  // date key: ISO dates parse directly; a dd/mm/yyyy fallback keeps older
  // records ordering correctly too. Undated matches sit last.
  const dateOf = (record) => {
    const d = record.match && record.match.date;
    if (!d) return 0;
    const t = new Date(d).getTime();
    if (!Number.isNaN(t)) return t;
    const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(String(d));
    return parts ? new Date(+parts[3], +parts[2] - 1, +parts[1]).getTime() : 0;
  };
  const seasonMatches = currentSeason
    ? savedMatches
        .filter((r) => r.seasonId === currentSeason.id)
        .sort((a, b) => dateOf(b) - dateOf(a))
    : [];

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
  // The same grip behaviour as the Players tab's edit screen: the grip beside
  // a player's name picks that player up and the row trades places as the
  // finger crosses the next one. The list is re-ordered live, so what the
  // coach sees under the finger is what gets saved — and every picker in the
  // goal and substitution loggers follows the new order.
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

  // A player's own season screen, fed with the current season.
  if (openPlayer && currentSeason) {
    return (
      <PlayerSeasonScreen
        season={currentSeason}
        playerName={openPlayer}
        matches={seasonMatches}
        onBack={() => setOpenPlayer(null)}
      />
    );
  }

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className={`relative pb-safe-24 ${modalOpen ? 'z-40' : 'z-10'}`}
    >
      <Navbar
        title="Squad"
        large
        transparent
        className="top-0 sticky"
        left={
          match.players.length > 0 ? (
            <Link
              navbar
              onClick={() => {
                haptic('tick');
                setEditing((on) => !on);
              }}
            >
              {editing ? 'Done' : 'Edit'}
            </Link>
          ) : undefined
        }
      />

      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        {editing
          ? "Drag the grip to re-sort the squad. Type each player's full name and squad number in the fields. Tap the red button to remove a player."
          : 'The constant squad every part of the app works from. Changes made here — adding, removing, renaming or re-sorting a player — pull through to the Players tab, the goal logger and the substitution logger. Resetting a match never clears this screen.'}
      </Block>

      {(editing || match.players.length === 0) && (
        <Block className="!mt-1 !mb-1 flex justify-end">
          <Glass
            component="button"
            aria-label="Add player"
            className="flex h-16 w-16 items-center justify-center rounded-full
                       transition-transform duration-150 active:scale-95"
            onClick={() => {
              haptic('tick');
              setAddOpen(true);
            }}
          >
            <Icon name="plus" size={30} className="text-gray-900 dark:text-white" />
          </Glass>
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
                <div className="flex flex-1 flex-col gap-1.5 py-1">
                  <div className="flex items-center gap-3">
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
                  <div className="ml-8 flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Name
                      </span>
                      <input
                        type="text"
                        value={player.displayName || ''}
                        placeholder="Full name"
                        onChange={(e) => setPlayerDisplayName(player.name, e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-black/10 bg-white px-3 py-1.5
                                   text-[15px] text-black transition-colors duration-150
                                   dark:border-white/15 dark:bg-white/10 dark:text-white"
                      />
                    </div>
                    <div className="w-20 shrink-0">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        Squad No.
                      </span>
                      <input
                        type="text"
                        value={player.squadNumber || ''}
                        placeholder="e.g. 7"
                        onChange={(e) => setPlayerSquadNumber(player.name, e.target.value)}
                        className="mt-0.5 w-full rounded-lg border border-black/10 bg-white px-3 py-1.5
                                   text-[15px] text-black transition-colors duration-150
                                   dark:border-white/15 dark:bg-white/10 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1 py-0.5">
                    <span className="block truncate text-[15px] font-semibold">
                      {player.name}
                    </span>
                    {player.displayName ? (
                      <span className="block truncate text-[12px] text-gray-500 dark:text-gray-400">
                        {player.displayName}
                      </span>
                    ) : null}
                  </div>
                  {player.squadNumber ? (
                    <span className="shrink-0 rounded-md bg-black/5 px-2 py-0.5
                                    text-[12px] font-semibold tabular-nums
                                    dark:bg-white/10">
                      {player.squadNumber}
                    </span>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </List>
      )}

      {/* The season side: the same player totals the Season screen's Players
          tab shows, counted up from the current season's matches. Setting a
          different season current on the Season tab moves this with it. */}
      {currentSeason && (
        <>
          <BlockTitle className="mt-4">
            Season{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">
              {currentSeason.name}
            </span>
          </BlockTitle>
          {/* A little breathing room above the division tabs, so they sit
              clear of the title and the navbar above them. */}
          <div className="pt-3">
            <PlayerTotals
              season={currentSeason}
              matches={seasonMatches}
              onOpenPlayer={setOpenPlayer}
              onExport={(data) => {
                setExportData(data);
                setExportOpen(true);
              }}
              onPhotos={(list) => {
                setPhotosData(list);
                setPhotosOpen(true);
              }}
            />
          </div>
        </>
      )}

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

      <PhotosSheet
        opened={photosOpen}
        photos={photosData}
        onClose={() => setPhotosOpen(false)}
      />

      <ExportSheet
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        match={null}
        csv={exportData ? exportData.csv : undefined}
        fileName={exportData ? exportData.fileName : undefined}
        description={exportData ? exportData.description : undefined}
      />
    </Page>
  );
}
