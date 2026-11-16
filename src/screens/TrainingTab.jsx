// The Training tab on the Squad screen. A date field at the top, the squad
// list down the side with a green Y / red N attendance mark per player — the
// same tap-to-select as the starting line-up — and a Save button that files
// the session under the date entered. Saved sessions sit at the bottom in
// date order, latest at the top, laid out like the Season screen's list.
//
// Training is static data, like the squad list itself: starting a new match
// never clears it, and saving or importing merges into whatever is already
// held rather than replacing it.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Block, BlockTitle, Button, Dialog, DialogButton, Link, List, ListButton,
  ListInput, Navbar, Sheet,
} from 'konsta/react';
import {
  useMatch, formatDate, todayISO,
  TRAINING_UNSET, TRAINING_Y, TRAINING_N,
} from '../store.jsx';
import { trainingCsv, trainingFileName, parseTrainingCsv } from '../training.js';
import { buildTrainingPhotos } from '../photos.js';
import ExportSheet from '../components/ExportSheet.jsx';
import PhotosSheet from '../components/PhotosSheet.jsx';
import { showToast } from '../toast.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

const MARK_STYLES = {
  unset: 'bg-black/5 dark:bg-white/10 text-gray-400 dark:text-gray-500',
  y: 'bg-green-500 text-white shadow-sm shadow-green-500/30',
  n: 'bg-red-500 text-white shadow-sm shadow-red-500/30',
};

export default function TrainingTab({ onModalChange }) {
  const {
    match,
    trainingSessions,
    saveTrainingSession,
    deleteTrainingSession,
    importTrainingSessions,
  } = useMatch();

  // The editor: the date entered at the top and the marks typed against it.
  // Picking a date that already has a session loads that session's marks;
  // a fresh date starts blank.
  const [date, setDate] = useState(todayISO());
  const [marks, setMarks] = useState(() => {
    const existing = trainingSessions.find((s) => s.date === todayISO());
    return existing ? { ...existing.attendance } : {};
  });

  const [exportOpen, setExportOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importParsed, setImportParsed] = useState(null);
  const [importError, setImportError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  // Summary table sorting — the same discipline as the Squad Summary: tap a
  // column title to sort by it (desc first), tap again to flip, tap again to
  // return to squad order. Sessions is the same number for everyone, so it
  // stays out of the sorting.
  const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' } | null
  const importInputRef = useRef(null);

  // Any open sheet or dialog lifts the whole Squad screen above the tab bar.
  const modalOpen =
    exportOpen || photosOpen || importOpen || pendingDelete !== null;
  useEffect(() => {
    if (onModalChange) onModalChange(modalOpen);
  }, [onModalChange, modalOpen]);
  useEffect(() => () => {
    if (onModalChange) onModalChange(false);
  }, [onModalChange]);

  const squadNames = useMemo(
    () => match.players.map((p) => p.name),
    [match.players]
  );

  const saved = useMemo(() => {
    const key = (d) => {
      const t = new Date(d).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    return [...trainingSessions].sort((a, b) => key(b.date) - key(a.date));
  }, [trainingSessions]);

  const changeDate = (value) => {
    setDate(value);
    const existing = trainingSessions.find((s) => s.date === value);
    setMarks(existing ? { ...existing.attendance } : {});
  };

  // Tap Y to mark present, N to mark absent; tapping the one already on
  // clears the mark — grey, green, red, exactly the grid's cycle.
  const mark = (name, value) => {
    setMarks((m) => {
      const next = { ...m };
      if (next[name] === value) delete next[name];
      else next[name] = value;
      return next;
    });
    haptic(value === TRAINING_Y ? 'periodOn' : 'bump');
  };

  const markedCount = Object.keys(marks).length;
  const yCount = Object.values(marks).filter((v) => v === TRAINING_Y).length;

  const save = () => {
    haptic('archived');
    saveTrainingSession(date, marks);
    showToast(`Training saved — ${formatDate(date)}`);
  };

  const loadSession = (record) => {
    haptic('tick');
    setDate(record.date);
    setMarks({ ...record.attendance });
  };

  // --- Export & import -------------------------------------------------------

  const csv = useMemo(
    () => (exportOpen ? trainingCsv(trainingSessions, squadNames) : ''),
    [exportOpen, trainingSessions, squadNames]
  );

  const exportPhotos = () => {
    haptic('archived');
    setPhotos(buildTrainingPhotos(trainingSessions, squadNames));
    setPhotosOpen(true);
  };

  const pickImportFile = () => {
    haptic('tick');
    if (importInputRef.current) importInputRef.current.click();
  };

  const onImportFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // so picking the same file again still fires
    if (!file) return;
    try {
      const parsed = parseTrainingCsv(await file.text());
      if (!parsed.ok) {
        haptic('removed');
        setImportError(parsed.error);
        return;
      }
      haptic('tick');
      setImportError('');
      setImportParsed(parsed.sessions);
      setImportOpen(true);
    } catch {
      haptic('removed');
      setImportError('That file could not be read.');
    }
  };

  const doImport = () => {
    haptic('archived');
    const count = importTrainingSessions(importParsed || []);
    setImportOpen(false);
    setImportParsed(null);
    showToast(
      `Imported ${count} training session${count === 1 ? '' : 's'}`
    );
  };

  // One preview line per imported session.
  const importRowText = (s) => {
    const att = (s && s.attendance) || {};
    const y = Object.values(att).filter((v) => v === TRAINING_Y).length;
    const n = Object.values(att).filter((v) => v === TRAINING_N).length;
    return `${y} in · ${n} out`;
  };

  const confirmDelete = () => {
    haptic('removed');
    if (pendingDelete) deleteTrainingSession(pendingDelete.id);
    setPendingDelete(null);
  };

  // The summary table: one row per player — the squad in its saved order
  // first, then any names the sessions still carry but the squad no longer
  // lists — with every saved session counted, however it was marked.
  const summaryRows = useMemo(() => {
    const names = [...squadNames];
    trainingSessions.forEach((s) =>
      Object.keys((s && s.attendance) || {}).forEach((n) => {
        if (n && !names.includes(n)) names.push(n);
      })
    );
    const total = trainingSessions.length;
    return names.map((name) => {
      const attended = trainingSessions.reduce(
        (acc, s) =>
          acc + (s && s.attendance && s.attendance[name] === TRAINING_Y ? 1 : 0),
        0
      );
      return {
        name,
        sessions: total,
        attended,
        pct: total ? Math.round((100 * attended) / total) : null,
      };
    });
  }, [squadNames, trainingSessions]);

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
      ? summaryRows
      : [...summaryRows].sort((a, b) => {
          let cmp;
          if (sort.key === 'name') cmp = a.name.localeCompare(b.name);
          else if (sort.key === 'pct') {
            // A dash (no sessions yet) sorts as the lowest value.
            const av = a.pct === null ? -1 : a.pct;
            const bv = b.pct === null ? -1 : b.pct;
            cmp = av - bv;
          } else {
            cmp = a.attended - b.attended;
          }
          return sort.dir === 'asc' ? cmp : -cmp;
        });

  // A sortable column heading — label over a chevron, the indicator showing
  // only on the active column, exactly as the Squad Summary does it.
  const sortTh = (key, label, pad) => {
    const active = sort !== null && sort.key === key;
    return (
      <th
        className={`border border-black/10 ${pad} py-1.5 align-middle dark:border-white/15 ${
          active ? 'text-primary' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={`flex w-full flex-col gap-0.5 transition-colors active:opacity-60 ${
            key === 'name' ? 'items-start text-left' : 'items-center'
          }`}
        >
          <span className="text-[10px] font-medium uppercase tracking-wide">
            {label}
          </span>
          <Icon
            name={active && sort.dir === 'desc' ? 'chevron-down' : 'chevron-up'}
            size={11}
            className={active ? '' : 'opacity-0'}
          />
        </button>
      </th>
    );
  };

  return (
    <>
      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        Training attendance, kept per session date. Mark each player in with
        the green Y or out with the red N — tap a mark again to clear it.
        Training is static data: starting a new match never clears it.
      </Block>

      <List strong inset>
        <ListInput
          label="Session Date"
          type="date"
          value={date}
          onChange={(e) => changeDate(e.target.value)}
        />
      </List>

      {match.players.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No squad members yet. Add players on the Squad tab.
        </Block>
      ) : (
        <>
          <Block className="!mt-0 !mb-2 flex items-center gap-4 text-[12px] text-gray-500 dark:text-gray-400">
            <LegendDot className="bg-green-500" label="Y — in" />
            <LegendDot className="bg-red-500" label="N — out" />
            <LegendDot className="bg-black/15 dark:bg-white/25" label="Not set" />
          </Block>

          <BlockTitle>
            Attendance{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">
              ({match.players.length})
            </span>
          </BlockTitle>
          <List strong inset>
            {match.players.map((player, i) => {
              const v = marks[player.name] || TRAINING_UNSET;
              return (
                <li
                  key={player.name}
                  className={`flex items-center gap-2 px-3 py-1.5 ${
                    i < match.players.length - 1 ? 'hairline-b' : ''
                  }`}
                >
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
                  <button
                    aria-label={`${player.name} attended`}
                    onClick={() => mark(player.name, TRAINING_Y)}
                    className={`h-9 w-12 shrink-0 rounded-lg text-[13px] font-semibold
                                transition-all duration-150 active:scale-90 ${
                                  v === TRAINING_Y ? MARK_STYLES.y : MARK_STYLES.unset
                                }`}
                  >
                    Y
                  </button>
                  <button
                    aria-label={`${player.name} absent`}
                    onClick={() => mark(player.name, TRAINING_N)}
                    className={`h-9 w-12 shrink-0 rounded-lg text-[13px] font-semibold
                                transition-all duration-150 active:scale-90 ${
                                  v === TRAINING_N ? MARK_STYLES.n : MARK_STYLES.unset
                                }`}
                  >
                    N
                  </button>
                </li>
              );
            })}
          </List>

          <Block className="mt-4">
            <Button large rounded onClick={save}>
              Save Training
            </Button>
            <div className="mt-2 text-center text-[12px] text-gray-500 dark:text-gray-400">
              {yCount} of {match.players.length} in · {markedCount} marked ·
              saves under {formatDate(date)}
            </div>
          </Block>
        </>
      )}

      <BlockTitle className="mt-2">
        Summary{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({trainingSessions.length} session{trainingSessions.length === 1 ? '' : 's'})
        </span>
      </BlockTitle>
      {summaryRows.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          Nothing to summarise yet — the table fills in as sessions are saved.
        </Block>
      ) : (
        <div className="mx-4 mt-3 mb-2 overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/15 dark:bg-[#1c1c1e]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {sortTh('name', 'Player', 'px-2')}
                <th className="w-14 border border-black/10 px-1 py-1.5 align-middle
                               text-center text-[10px] font-medium uppercase
                               tracking-wide text-gray-400 dark:text-gray-500
                               dark:border-white/15">
                  Sessions
                </th>
                {sortTh('attended', 'Attended', 'px-1')}
                {sortTh('pct', '%', 'px-1')}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.name}>
                  <td className="border border-black/10 px-2 py-2 align-middle font-medium dark:border-white/15">
                    {r.name}
                  </td>
                  <td className="w-14 border border-black/10 px-1 py-2 text-center align-middle tabular-nums dark:border-white/15">
                    {r.sessions}
                  </td>
                  <td className="w-14 border border-black/10 px-1 py-2 text-center align-middle tabular-nums dark:border-white/15">
                    {r.attended}
                  </td>
                  <td className="w-12 border border-black/10 px-1 py-2 text-center align-middle font-semibold tabular-nums dark:border-white/15">
                    {r.pct === null ? '—' : `${r.pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Block className="!mt-1 text-[12px] text-gray-500 dark:text-gray-400">
        Sessions counts every training session saved under this tab, however it
        was marked; Attended is the green Y marks; % is attended against the
        sessions saved. A dash means no sessions are saved yet. Tap a column
        title to sort the table — Sessions is the same for everyone, so it
        stays put — and tap again to flip the order, then again to return to
        squad order.
      </Block>

      <BlockTitle className="mt-2">Export &amp; Import</BlockTitle>
      <List strong inset>
        <ListButton
          onClick={() => {
            haptic('tick');
            setExportOpen(true);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="file-spreadsheet" size={20} />
            Export To Excel
          </span>
        </ListButton>
        <ListButton onClick={exportPhotos}>
          <span className="inline-flex items-center gap-2">
            <Icon name="camera" size={20} />
            Export To Photos
          </span>
        </ListButton>
        <ListButton onClick={pickImportFile}>
          <span className="inline-flex items-center gap-2">
            <Icon name="file-input" size={20} />
            Import (CSV)
          </span>
        </ListButton>
      </List>
      {importError !== '' && (
        <Block className="!mt-1 !mb-0 text-[13px] k-color-brand-red">
          {importError}
        </Block>
      )}
      <Block className="!mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        The spreadsheet has the session dates down the first column and the
        player names across the top row, with Y or N as the data — the same
        layout Export To Excel writes. Importing merges into what is saved
        already: a session for a date that exists keeps its record and gains
        the file's marks.
      </Block>

      <BlockTitle className="mt-2">
        Saved Sessions{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({saved.length})
        </span>
      </BlockTitle>
      {saved.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No sessions saved yet. Pick a date, mark the squad and tap Save
          Training.
        </Block>
      ) : (
        <List strong inset>
          {saved.map((record, i) => {
            const att = record.attendance || {};
            const y = Object.values(att).filter((v) => v === TRAINING_Y).length;
            const n = Object.keys(att).length;
            return (
              <li
                key={record.id}
                className={`flex items-center gap-2 px-3 py-2 ${
                  i < saved.length - 1 ? 'hairline-b' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadSession(record)}
                  className="min-w-0 flex-1 py-1 text-left transition-opacity active:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Icon
                      name="calendar-days"
                      size={18}
                      className="shrink-0 text-gray-400 dark:text-gray-500"
                    />
                    <span className="truncate text-[16px] font-semibold">
                      {formatDate(record.date)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-gray-500 dark:text-gray-400">
                    {n === 0
                      ? 'No marks'
                      : `${y} of ${n} in · tap to edit this session`}
                  </span>
                </button>
                <button
                  aria-label={`Delete ${formatDate(record.date)}`}
                  onClick={() => {
                    haptic('tick');
                    setPendingDelete(record);
                  }}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-red-500/10
                             px-3 text-[14px] font-semibold text-red-500
                             transition-all duration-150 active:scale-95"
                >
                  <Icon name="trash-2" size={16} />
                </button>
              </li>
            );
          })}
        </List>
      )}

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,text/plain"
        className="hidden"
        onChange={onImportFile}
      />

      <Sheet
        className="no-safe-areas-top pb-safe flex flex-col max-h-[85dvh]"
        opened={importOpen}
        onBackdropClick={() => setImportOpen(false)}
      >
        <Navbar
          title="Training import"
          right={<Link navbar onClick={() => setImportOpen(false)}>Cancel</Link>}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {importParsed && (
            <>
              <Block className="!mb-1 !mt-3 text-[13px] text-gray-500 dark:text-gray-400">
                {importParsed.length} training session
                {importParsed.length === 1 ? '' : 's'} found — they merge into
                what is saved already, by date.
              </Block>
              <List strong inset>
                {importParsed.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">
                        {formatDate(s.date)}
                      </span>
                      <span className="block truncate text-[12px] text-gray-500 dark:text-gray-400">
                        {importRowText(s)}
                      </span>
                    </div>
                  </li>
                ))}
              </List>
            </>
          )}
        </div>
        <Block className="shrink-0">
          <Button
            large
            rounded
            disabled={!importParsed || importParsed.length === 0}
            onClick={doImport}
          >
            Import {importParsed ? importParsed.length : 0} session
            {importParsed && importParsed.length === 1 ? '' : 's'}
          </Button>
        </Block>
      </Sheet>

      <Dialog
        opened={pendingDelete !== null}
        onBackdropClick={() => setPendingDelete(null)}
        title="Delete session?"
        content={
          pendingDelete
            ? `The training session for ${formatDate(pendingDelete.date)} will be removed. Player attendance percentages are counted again without it.`
            : ''
        }
        buttons={
          <>
            <DialogButton onClick={() => setPendingDelete(null)}>Cancel</DialogButton>
            <DialogButton strong onClick={confirmDelete}>
              Delete
            </DialogButton>
          </>
        }
      />

      <PhotosSheet
        opened={photosOpen}
        photos={photos}
        onClose={() => setPhotosOpen(false)}
      />

      <ExportSheet
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        match={null}
        csv={csv}
        fileName={trainingFileName()}
        description="Every saved training session in one spreadsheet — the dates down the side, the player names across the top, Y or N as the data. The exact layout Import (CSV) reads back."
      />
    </>
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
