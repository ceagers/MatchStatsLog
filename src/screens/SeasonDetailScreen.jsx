// Season detail: the matches filed under one season, plus the per-player
// season totals counted up from them. Matches can be selected and moved to
// another season; the season itself can be set current, renamed or deleted.

import { useState } from 'react';
import {
  Page, Navbar, NavbarBackLink, Block, BlockTitle, List, ListItem, ListButton,
  Button, Link, Sheet, ListInput, Segmented, SegmentedButton, Dialog,
  DialogButton, Actions, ActionsGroup, ActionsButton, ActionsLabel,
} from 'konsta/react';
import {
  useMatch, computeSeasonStats, formatDate, formatSavedAt, formatClock,
  clockTotalMs,
} from '../store.jsx';
import MatchSummary from '../components/MatchSummary.jsx';
import PlayerSeasonScreen from './PlayerSeasonScreen.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';
import { showToast } from '../toast.jsx';
import { useSettings } from '../settings.jsx';

export default function SeasonDetailScreen({ season, onNavigate, onBack }) {
  const { competitions } = useSettings();
  const {
    seasons,
    currentSeasonId,
    savedMatches,
    setCurrentSeason,
    renameSeason,
    deleteSeason,
    moveMatchesToSeason,
    savedOpenId,
    setSavedOpenId,
    setHomeView,
    deleteSavedMatch,
    restoreSavedMatch,
    updateSavedMatch,
  } = useMatch();

  const [seg, setSeg] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [moveOpen, setMoveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [confirmSeasonDelete, setConfirmSeasonDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  // The player whose own season screen is open, or null.
  const [openPlayer, setOpenPlayer] = useState(null);

  // Match played-day key: ISO dates parse directly; a dd/mm/yyyy fallback
  // keeps older records ordering correctly too. Undated matches sit last.
  const dateOf = (record) => {
    const d = record.match && record.match.date;
    if (!d) return 0;
    const t = new Date(d).getTime();
    if (!Number.isNaN(t)) return t;
    const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(String(d));
    return parts ? new Date(+parts[3], +parts[2] - 1, +parts[1]).getTime() : 0;
  };
  const matches = savedMatches
    .filter((r) => r.seasonId === season.id)
    .sort((a, b) => dateOf(b) - dateOf(a));
  const isCurrent = season.id === currentSeasonId;
  const otherSeasons = seasons.filter((s) => s.id !== season.id);

  // Matches grouped by division (JPL/PDJAL), in the order the divisions are
  // listed in Settings. Divisions in use but missing from that list follow in
  // alphabetical order, and matches with no division sit last. Within a group
  // the matches keep their date order, newest first.
  const competitionOf = (record) =>
    record.match && typeof record.match.competition === 'string'
      ? record.match.competition.trim()
      : '';
  const byCompetition = new Map();
  matches.forEach((r) => {
    const key = competitionOf(r);
    if (!byCompetition.has(key)) byCompetition.set(key, []);
    byCompetition.get(key).push(r);
  });
  const groupOrder = [
    ...competitions.filter((c) => byCompetition.has(c)),
    ...[...byCompetition.keys()]
      .filter((k) => k && !competitions.includes(k))
      .sort((a, b) => a.localeCompare(b)),
  ];
  if (byCompetition.has('')) groupOrder.push('');
  const matchGroups = groupOrder.map((key) => ({
    key,
    label: key || 'No Competition',
    items: byCompetition.get(key) || [],
  }));

  const open =
    savedOpenId
      ? savedMatches.find((r) => r.id === savedOpenId) || null
      : null;

  // --- Match detail (read-only, same as before) ------------------------------

  const doDelete = (id) => {
    haptic('removed');
    deleteSavedMatch(id);
    setConfirmDelete(null);
    if (savedOpenId === id) setSavedOpenId(null);
  };

  const doRestore = (id) => {
    haptic('archived');
    restoreSavedMatch(id);
    setConfirmRestore(null);
    setSavedOpenId(null);
  };

  const matchDialogs = (
    <>
      <Dialog
        opened={confirmDelete !== null}
        onBackdropClick={() => setConfirmDelete(null)}
        title="Delete saved match?"
        content="This saved record will be removed. Your current match is not affected."
        buttons={
          <>
            <DialogButton onClick={() => setConfirmDelete(null)}>Cancel</DialogButton>
            <DialogButton strong onClick={() => doDelete(confirmDelete)}>
              Delete
            </DialogButton>
          </>
        }
      />
      <Dialog
        opened={confirmRestore !== null}
        onBackdropClick={() => setConfirmRestore(null)}
        title="Open as current match?"
        content="This replaces the match you are working on now. Save that one first if you need it."
        buttons={
          <>
            <DialogButton onClick={() => setConfirmRestore(null)}>Cancel</DialogButton>
            <DialogButton strong onClick={() => doRestore(confirmRestore)}>
              Open
            </DialogButton>
          </>
        }
      />
    </>
  );

  // --- Season management ------------------------------------------------------

  const doSetCurrent = () => {
    haptic('tick');
    setCurrentSeason(season.id);
    showToast(`${season.name} is now the current season`);
  };

  const startRename = () => {
    setRenameText(season.name);
    setRenameOpen(true);
  };

  const submitRename = () => {
    const name = renameText.trim();
    if (!name) return;
    haptic('archived');
    renameSeason(season.id, name);
    setRenameOpen(false);
    showToast('Season renamed');
  };

  const doDeleteSeason = () => {
    if (matches.length > 0) return; // the dialog only offers delete when empty
    const ok = deleteSeason(season.id);
    setConfirmSeasonDelete(false);
    if (ok) {
      haptic('removed');
      showToast('Season deleted');
      onBack();
    }
  };

  // --- Selecting and moving matches -------------------------------------------

  const exitSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };

  const toggleSelect = (id) => {
    haptic('tick');
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));
  };

  const doMove = (target) => {
    const n = selected.length;
    moveMatchesToSeason(selected, target.id);
    haptic('archived');
    showToast(`${n} match${n === 1 ? '' : 'es'} moved to ${target.name}`);
    setMoveOpen(false);
    exitSelect();
  };

  // --- Rendering ---------------------------------------------------------------

  const modalOpen =
    moveOpen ||
    renameOpen ||
    confirmSeasonDelete ||
    confirmDelete !== null ||
    confirmRestore !== null;

  if (openPlayer) {
    return (
      <PlayerSeasonScreen
        season={season}
        playerName={openPlayer}
        matches={matches}
        onBack={() => setOpenPlayer(null)}
      />
    );
  }

  if (open) {
    return (
      <Page
        colors={{ bgIos: 'bg-transparent' }}
        className={`relative pb-safe-24 ${
          confirmDelete !== null || confirmRestore !== null ? 'z-40' : 'z-10'
        }`}
      >
        <Navbar
          title={open.match.opposition ? `vs ${open.match.opposition}` : 'Saved Match'}
          className="top-0 sticky"
          left={<NavbarBackLink text="Back" onClick={() => setSavedOpenId(null)} />}
        />

        <Block className="!mb-0 text-[13px] text-gray-500 dark:text-gray-400">
          Saved {formatSavedAt(open.savedAt)}
        </Block>

        <MatchSummary
          match={open.match}
          onPeriodsUsed={(n) => updateSavedMatch(open.id, { periodsUsed: n })}
        />

        <BlockTitle>Manage</BlockTitle>
        <List strong inset>
          <ListButton
            onClick={() => {
              haptic('tick');
              setHomeView(open.id);
              onNavigate('home');
            }}
          >
            Show Fixture On Home
          </ListButton>
          <ListButton onClick={() => setConfirmRestore(open.id)}>
            Open As Current Match
          </ListButton>
          <ListButton className="k-color-brand-red" onClick={() => setConfirmDelete(open.id)}>
            Delete Saved Match
          </ListButton>
        </List>

        {matchDialogs}
      </Page>
    );
  }

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className={`relative pb-safe-24 ${modalOpen ? 'z-40' : 'z-10'}`}
    >
      <Navbar
        title={season.name}
        className="top-0 sticky"
        left={<NavbarBackLink text="Season" onClick={onBack} />}
        right={
          seg === 0 && matches.length > 0 ? (
            <Link
              navbar
              onClick={() => {
                haptic('tick');
                if (selectMode) exitSelect();
                else setSelectMode(true);
              }}
            >
              {selectMode ? 'Done' : 'Select'}
            </Link>
          ) : undefined
        }
        subnavbar={
          <Segmented strong rounded className="mx-4 mb-2">
            <SegmentedButton
              strong
              rounded
              active={seg === 0}
              onClick={() => {
                haptic('tick');
                setSeg(0);
              }}
            >
              Matches ({matches.length})
            </SegmentedButton>
            <SegmentedButton
              strong
              rounded
              active={seg === 1}
              onClick={() => {
                haptic('tick');
                exitSelect();
                setSeg(1);
              }}
            >
              Players
            </SegmentedButton>
          </Segmented>
        }
      />

      {seg === 0 && (
        <>
          {selectMode && (
            <Block className="!mb-2 flex items-center justify-between">
              <Button
                small
                rounded
                clear
                inline
                onClick={() => {
                  haptic('tick');
                  setSelected(matches.map((r) => r.id));
                }}
              >
                Select All
              </Button>
              <Button small rounded clear inline onClick={() => setSelected([])}>
                Clear
              </Button>
            </Block>
          )}

          {matches.length === 0 ? (
            <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
              No matches in this season yet. Save a match on the Utilities tab —
              it lands in the current season — or move matches here from another
              season.
            </Block>
          ) : (
            <>
            {matchGroups.map((g) => (
              <div key={g.key || '__no-competition'}>
                <BlockTitle>
                  {g.label}{' '}
                  <span className="font-normal text-gray-500 dark:text-gray-400">
                    ({g.items.length})
                  </span>
                </BlockTitle>
                <List strong inset>
                  {g.items.map((record, i) => {
                    const m = record.match;
                    const goals = m.goalTimes.length;
                    const timeMs = m.clock ? clockTotalMs(m.clock) : 0;
                    const title = m.opposition ? `vs ${m.opposition}` : 'No opposition';
                    const subtitle = [m.competition, m.type, m.homeAway, formatDate(m.date)]
                      .filter(Boolean)
                      .join(' · ');
                    const textline = [
                      m.result || 'No result',
                      `${goals} goal${goals === 1 ? '' : 's'}`,
                      timeMs > 0 ? formatClock(timeMs) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    const checked = selected.includes(record.id);

                    if (selectMode) {
                      return (
                        <li
                          key={record.id}
                          className={i < g.items.length - 1 ? 'hairline-b' : ''}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSelect(record.id)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left
                                       transition-colors active:bg-black/5 dark:active:bg-white/10"
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center
                                          rounded-full border transition-colors ${
                                            checked
                                              ? 'border-primary bg-primary'
                                              : 'border-gray-300 dark:border-gray-600'
                                          }`}
                            >
                              {checked && <Icon name="check" size={14} className="text-white" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[15px] font-semibold">
                                {title}
                              </span>
                              <span className="block truncate text-[12px] text-gray-500 dark:text-gray-400">
                                {[subtitle, textline].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    }

                    return (
                      <ListItem
                        key={record.id}
                        link
                        onClick={() => {
                          haptic('tick');
                          setSavedOpenId(record.id);
                        }}
                        title={title}
                        subtitle={subtitle}
                        text={textline}
                        after={
                          <span className="text-[12px] text-gray-400 dark:text-gray-500">
                            {formatSavedAt(record.savedAt)}
                          </span>
                        }
                      />
                    );
                  })}
                </List>
              </div>
            ))}
            </>
          )}

          {selectMode && selected.length > 0 && (
            <Block className="mt-4">
              <Button
                large
                rounded
                onClick={() => {
                  haptic('tick');
                  setMoveOpen(true);
                }}
              >
                Move {selected.length} To Season
              </Button>
            </Block>
          )}

          <BlockTitle>Season Settings</BlockTitle>
          <List strong inset>
            {!isCurrent && (
              <ListButton onClick={doSetCurrent}>Set As Current Season</ListButton>
            )}
            <ListButton onClick={startRename}>Rename Season</ListButton>
            <ListButton
              className="k-color-brand-red"
              onClick={() => setConfirmSeasonDelete(true)}
            >
              Delete Season
            </ListButton>
          </List>
          <Block className="!mt-1 text-[12px] text-gray-500 dark:text-gray-400">
            {isCurrent
              ? 'This is the current season — newly saved matches are filed here.'
              : 'Set it current to file newly saved matches here.'}
          </Block>
        </>
      )}

      {seg === 1 && (
        <PlayerTotals matches={matches} onOpenPlayer={setOpenPlayer} />
      )}

      <Actions opened={moveOpen} onBackdropClick={() => setMoveOpen(false)}>
        <ActionsGroup>
          <ActionsLabel>
            Move {selected.length} match{selected.length === 1 ? '' : 'es'} to…
          </ActionsLabel>
          {otherSeasons.map((s) => (
            <ActionsButton key={s.id} onClick={() => doMove(s)}>
              {s.name}
            </ActionsButton>
          ))}
          {otherSeasons.length === 0 && (
            <ActionsLabel>Add another season first</ActionsLabel>
          )}
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setMoveOpen(false)}>Cancel</ActionsButton>
        </ActionsGroup>
      </Actions>

      <Sheet
        className="no-safe-areas-top pb-safe"
        opened={renameOpen}
        onBackdropClick={() => setRenameOpen(false)}
      >
        <Navbar
          title="Rename Season"
          right={
            <Link navbar onClick={() => setRenameOpen(false)}>
              Cancel
            </Link>
          }
        />
        <List strong inset>
          <ListInput
            label="Season name"
            type="text"
            value={renameText}
            onInput={(e) => setRenameText(e.target.value)}
            clearButton
            onClear={() => setRenameText('')}
          />
        </List>
        <Block>
          <Button large rounded disabled={!renameText.trim()} onClick={submitRename}>
            Save Name
          </Button>
        </Block>
      </Sheet>

      <Dialog
        opened={confirmSeasonDelete}
        onBackdropClick={() => setConfirmSeasonDelete(false)}
        title="Delete season?"
        content={
          matches.length > 0
            ? `“${season.name}” still has ${matches.length} match${
                matches.length === 1 ? '' : 'es'
              } in it. Move them to another season (or delete them) first.`
            : `“${season.name}” will be removed. This cannot be undone.`
        }
        buttons={
          matches.length > 0 ? (
            <DialogButton onClick={() => setConfirmSeasonDelete(false)}>
              OK
            </DialogButton>
          ) : (
            <>
              <DialogButton onClick={() => setConfirmSeasonDelete(false)}>
                Cancel
              </DialogButton>
              <DialogButton
                strong
                className="k-color-brand-red"
                onClick={doDeleteSeason}
              >
                Delete
              </DialogButton>
            </>
          )
        }
      />

      {matchDialogs}
    </Page>
  );
}

// The per-player season totals, counted up from the season's saved matches.
// Tap a column title to sort by it; tap again to flip the order. Tap a
// player's row to open their own match-by-match screen.
function PlayerTotals({ matches, onOpenPlayer }) {
  const { competitions } = useSettings();
  // Division filter: '__all' counts every game, a value counts only those
  // games. All is the default.
  const [compFilter, setCompFilter] = useState('__all');
  const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' } | null

  // The division options the season's matches actually use, ordered as the
  // divisions are listed in Settings; values missing from that list follow
  // alphabetically. Only offered when at least one game carries a division.
  const compOptions = (() => {
    const present = new Set();
    matches.forEach((r) => {
      const v =
        r.match && typeof r.match.competition === 'string'
          ? r.match.competition.trim()
          : '';
      if (v) present.add(v);
    });
    return [
      ...competitions.filter((c) => present.has(c)),
      ...[...present]
        .filter((v) => !competitions.includes(v))
        .sort((a, b) => a.localeCompare(b)),
    ];
  })();

  const filtered =
    compFilter === '__all'
      ? matches
      : matches.filter(
          (r) =>
            r.match &&
            typeof r.match.competition === 'string' &&
            r.match.competition.trim() === compFilter
        );

  const { players, matchesCounted } = computeSeasonStats(filtered);

  const cols = [
    { key: 'name', label: 'Player', w: 'min-w-0 flex-1' },
    { key: 'played', label: 'GP', w: 'w-8' },
    { key: 'starts', label: 'St', w: 'w-8' },
    { key: 'notAvailable', label: 'NA', w: 'w-8' },
    { key: 'goals', label: 'G', w: 'w-8' },
    { key: 'assists', label: 'A', w: 'w-8' },
    { key: 'potm', label: 'POTM', w: 'w-10' },
    { key: 'percentage', label: '%', w: 'w-8' },
  ];

  const toggleSort = (key) => {
    haptic('tick');
    setSort((s) =>
      s && s.key === key
        ? s.dir === 'desc'
          ? { key, dir: 'asc' }
          : null
        : { key, dir: 'desc' }
    );
  };

  const sorted =
    sort === null
      ? players
      : [...players].sort((a, b) => {
          const va = sort.key === 'percentage'
            ? (a.percentage === null ? -1 : a.percentage)
            : a[sort.key];
          const vb = sort.key === 'percentage'
            ? (b.percentage === null ? -1 : b.percentage)
            : b[sort.key];
          const cmp =
            typeof va === 'string'
              ? va.localeCompare(vb)
              : va - vb;
          return sort.dir === 'asc' ? cmp : -cmp;
        });

  if (matches.length === 0) {
    return (
      <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
        Totals appear once this season has matches in it.
      </Block>
    );
  }

  return (
    <>
      {compOptions.length > 0 && (
        <div className="mx-4 mb-2">
          <Segmented strong rounded>
            <SegmentedButton
              strong
              rounded
              active={compFilter === '__all'}
              onClick={() => {
                haptic('tick');
                setCompFilter('__all');
              }}
            >
              All
            </SegmentedButton>
            {compOptions.map((c) => (
              <SegmentedButton
                key={c}
                strong
                rounded
                active={compFilter === c}
                onClick={() => {
                  haptic('tick');
                  setCompFilter(c);
                }}
              >
                {c}
              </SegmentedButton>
            ))}
          </Segmented>
        </div>
      )}
      <BlockTitle>
        Squad Totals{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({matchesCounted} match{matchesCounted === 1 ? '' : 'es'} counted)
        </span>
      </BlockTitle>
      <List strong inset>
        <li className="flex items-end gap-2 px-3 pb-1 pt-2">
          {cols.map((c) => {
            const active = sort !== null && sort.key === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleSort(c.key)}
                className={`${c.w} flex shrink-0 flex-col items-start gap-0.5
                            text-[11px] font-medium uppercase tracking-wide
                            transition-colors active:opacity-60 ${
                              active
                                ? 'text-primary'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
              >
                <span className={c.key === 'name' ? '' : 'w-full text-center'}>
                  {c.label}
                </span>
                <Icon
                  name={active && sort.dir === 'desc' ? 'chevron-down' : 'chevron-up'}
                  size={11}
                  className={active ? '' : 'opacity-0'}
                />
              </button>
            );
          })}
        </li>
        {sorted.map((p, i) => (
          <li
            key={p.name}
            className={`flex items-center ${
              i < sorted.length - 1 ? 'hairline-b' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => {
                haptic('tick');
                onOpenPlayer(p.name);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left
                         transition-colors active:bg-black/5 dark:active:bg-white/10"
            >
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {p.name}
              </span>
            <span className="w-8 text-center text-[14px] tabular-nums">{p.played}</span>
            <span className="w-8 text-center text-[14px] tabular-nums">{p.starts}</span>
            <span className="w-8 text-center text-[14px] tabular-nums">
              {p.notAvailable}
            </span>
            <span className="w-8 text-center text-[14px] tabular-nums">{p.goals}</span>
            <span className="w-8 text-center text-[14px] tabular-nums">{p.assists}</span>
            <span className="w-10 text-center text-[14px] tabular-nums">{p.potm}</span>
            <span className="w-8 text-center text-[14px] font-semibold tabular-nums text-primary">
              {p.percentage === null ? '—' : `${p.percentage}%`}
            </span>
            <Icon
              name="chevron-right"
              size={14}
              className="shrink-0 text-gray-400 dark:text-gray-500"
            />
            </button>
          </li>
        ))}
      </List>
      <Block className="!mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        Stats cover the division picked at the top — All counts every game in
        the season. Counted from the saved matches in this season. Period 1 green is a
        start, red is the bench, no colour is not available — GP counts green or
        red. Percentage played is minutes on the pitch against the match time of
        only the games the player was available for (started or benched), not
        every match logged. POTM counts player-of-the-match awards. A match with an unmarked
        squad grid carries no appearance data and is left out of those counts;
        goals and awards logged in it still count. Tap a column title to sort
        the table; tap again to flip the order. Tap a player's row to see their
        match-by-match season.
      </Block>
    </>
  );
}