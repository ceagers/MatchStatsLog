// Utilities: match-day housekeeping in one place — keep the record, hand it
// over as a spreadsheet, and clear the decks for the next game. The actions
// were moved here from the Match Info screen and the match summary so the
// screens a coach works through on the day stay focused on the match itself.

import { useRef, useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListButton, ListItem, Button,
  Dialog, DialogButton, Sheet, Link, Checkbox,
  Actions, ActionsGroup, ActionsButton, ActionsLabel,
} from 'konsta/react';
import { useMatch, formatDate, formatSavedAt, PERIOD_GREEN, PERIOD_RED } from '../store.jsx';
import { fullMatchCsv, fullMatchFileName, parseFullMatchCsv } from '../fullmatch.js';
import {
  parseBulkMatchesCsv, bulkMatchesCsv, bulkImportFileName,
} from '../bulkimport.js';
import { showToast } from '../toast.jsx';
import ExportSheet from '../components/ExportSheet.jsx';
import PhotosSheet from '../components/PhotosSheet.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { buildMatchPhotos } from '../photos.js';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function UtilitiesScreen() {
  const { match, savedMatches, currentSeason, resetMatch, saveCurrentMatch, importMatch, importMatchesAsSaved } = useMatch();
  const [confirmReset, setConfirmReset] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [whatsappText, setWhatsappText] = useState(null);
  const [fullExportOpen, setFullExportOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Which layout the match picker exports into — the complete full-match
  // transfer, or the simplified one-row-per-match bulk format.
  const [exportMode, setExportMode] = useState('full');
  const [pickedIds, setPickedIds] = useState(() => new Set());
  const [fullExportList, setFullExportList] = useState([match]);
  const [importChoices, setImportChoices] = useState(null);
  const [imported, setImported] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef(null);

  // Bulk import from a simple spreadsheet: one row per match, the Match Info
  // sections only. The file is parsed up front, previewed in a sheet, and on
  // confirm every match is filed into history under the current season.
  const [bulkParsed, setBulkParsed] = useState(null);
  const [bulkError, setBulkError] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkInputRef = useRef(null);

  const savedRecord = savedMatches.find((r) => r.id === match.savedId) || null;

  const saveMatch = () => {
    haptic('archived');
    saveCurrentMatch();
    showToast(savedRecord ? 'Saved match updated' : 'Match saved');
  };

  // The WhatsApp summary, straight from the goal log: scorers in the order
  // they first scored, a ball for every goal with the minute after each one,
  // then everyone who assisted. Empty lines aside, it is exactly what gets
  // pasted into a team chat.
  const buildWhatsAppText = (goals) => {
    const sorted = [...goals].sort((a, b) => a.minute - b.minute);
    const scorerOrder = [];
    const scorerMinutes = new Map();
    const assistOrder = [];
    const assistCounts = new Map();
    sorted.forEach((g) => {
      if (g.scorer) {
        if (!scorerMinutes.has(g.scorer)) {
          scorerMinutes.set(g.scorer, []);
          scorerOrder.push(g.scorer);
        }
        scorerMinutes.get(g.scorer).push(g.minute);
      }
      if (g.assist) {
        if (!assistCounts.has(g.assist)) {
          assistCounts.set(g.assist, 0);
          assistOrder.push(g.assist);
        }
        assistCounts.set(g.assist, assistCounts.get(g.assist) + 1);
      }
    });
    const goalLines = scorerOrder.map(
      (name) =>
        `${name} ${'⚽️'.repeat(scorerMinutes.get(name).length)} ` +
        scorerMinutes.get(name).map((m) => `(${m})`).join(' ')
    );
    const assistLines = assistOrder.map(
      (name) => `${name} ${'👟'.repeat(assistCounts.get(name))}`
    );
    return [...goalLines, '', ...assistLines].join('\n');
  };

  const openWhatsApp = () => {
    haptic('tick');
    setWhatsappText((open) => (open === null ? buildWhatsAppText(match.goalTimes) : null));
  };

  const copyWhatsApp = async () => {
    if (whatsappText === null) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(whatsappText);
      } else {
        // Older WebKit: a temporary textarea is the only way onto the clipboard.
        const hold = document.createElement('textarea');
        hold.value = whatsappText;
        hold.style.position = 'fixed';
        hold.style.opacity = '0';
        document.body.appendChild(hold);
        hold.select();
        document.execCommand('copy');
        document.body.removeChild(hold);
      }
      haptic('archived');
      showToast('Copied — paste it into WhatsApp');
    } catch {
      showToast('Could not copy — select the text by hand');
    }
  };

  // Render the Match Info summary sections as pictures and hand them over in
  // the photos sheet, where they can be saved to the camera roll or shared.
  const downloadPhotos = () => {
    haptic('archived');
    setPhotos(buildMatchPhotos(match));
    setPhotosOpen(true);
  };

  // --- Full match transfer ---------------------------------------------------
  // One CSV carries whole matches; Import reads one back and rebuilds them.

  // Export Full Match offers the current match plus everything in history —
  // tick any number of them and one file carries them all. The record that
  // is this match's own saved copy is folded into the current-match option.
  const matchOptions = [
    {
      key: 'current',
      match,
      title: match.opposition || 'Unnamed match',
      subtitle: savedRecord
        ? `This match · saved ${formatSavedAt(savedRecord.savedAt)}`
        : 'This match · not saved yet',
    },
    ...savedMatches
      .filter((r) => r.id !== match.savedId)
      // Latest match played first; undated records sink to the bottom.
      .slice()
      .sort((a, b) => {
        const da = (a.match && a.match.date) || '';
        const db = (b.match && b.match.date) || '';
        if (da === db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da < db ? 1 : -1;
      })
      .map((r) => ({
        key: r.id,
        match: r.match,
        title: (r.match && r.match.opposition) || 'Unnamed match',
        subtitle: [
          r.match && r.match.date ? formatDate(r.match.date) : 'Undated',
          `saved ${formatSavedAt(r.savedAt)}`,
        ].join(' · '),
      })),
  ];

  const exportFullMatch = () => {
    haptic('tick');
    setExportMode('full');
    setPickedIds(new Set(['current']));
    setPickerOpen(true);
  };

  // The bulk-format export shares the match picker with the full-match one —
  // the same tick list, a different spreadsheet built from whatever is picked.
  const exportBulkFormat = () => {
    haptic('tick');
    setExportMode('bulk');
    setPickedIds(new Set(['current']));
    setPickerOpen(true);
  };

  const togglePicked = (key) =>
    setPickedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const startFullExport = () => {
    haptic('archived');
    setFullExportList(
      matchOptions.filter((o) => pickedIds.has(o.key)).map((o) => o.match)
    );
    setPickerOpen(false);
    setFullExportOpen(true);
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
      const parsed = parseFullMatchCsv(await file.text());
      if (!parsed.ok) {
        haptic('removed');
        setImportError(parsed.error);
        return;
      }
      setImportError('');
      if (parsed.matches.length > 1) {
        setImportChoices(parsed.matches);
      } else {
        setImported(parsed.matches[0]);
        setConfirmImport(true);
      }
    } catch {
      haptic('removed');
      setImportError('That file could not be read.');
    }
  };

  const describeImported = (m) => {
    if (!m) return 'the imported match';
    const who = m.opposition || 'an unnamed match';
    return m.date ? `${who}, ${formatDate(m.date)}` : who;
  };

  const confirmImportMatch = () => {
    haptic('archived');
    importMatch(imported);
    setConfirmImport(false);
    setImported(null);
    showToast('Match imported');
  };

  // --- Bulk import -------------------------------------------------------------
  // A season of matches from a simple spreadsheet — fixture, POTM, squad and
  // goals & assists per row — previewed, then filed into history in one go.

  const pickBulkFile = () => {
    haptic('tick');
    if (bulkInputRef.current) bulkInputRef.current.click();
  };

  const onBulkFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // so picking the same file again still fires
    if (!file) return;
    try {
      const parsed = parseBulkMatchesCsv(await file.text());
      if (!parsed.ok) {
        haptic('removed');
        setBulkError(parsed.error);
        return;
      }
      setBulkError('');
      setBulkParsed({ matches: parsed.matches, warnings: parsed.warnings });
      setBulkOpen(true);
    } catch {
      haptic('removed');
      setBulkError('That file could not be read.');
    }
  };

  // One preview line per match: date, result and the squad/goal counts.
  const bulkRowText = (m) => {
    const starting = m.players.filter((p) => p.periods[0] === PERIOD_GREEN).length;
    const subs = m.players.filter((p) => p.periods[0] === PERIOD_RED).length;
    const goals = m.players.reduce((n, p) => n + p.goals, 0);
    return [
      m.date ? formatDate(m.date) : 'Undated',
      m.result,
      `${starting} starting`,
      `${subs} subs`,
      `${goals} goal${goals === 1 ? '' : 's'}`,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  const bulkImport = () => {
    haptic('archived');
    const count = importMatchesAsSaved(bulkParsed.matches);
    setBulkOpen(false);
    setBulkParsed(null);
    showToast(
      `Imported ${count} match${count === 1 ? '' : 'es'} to ${
        currentSeason ? currentSeason.name : 'the current season'
      }`
    );
  };

  // The settings panel, export sheet, reset confirmation and photos sheet
  // lift this screen above the tab bar.
  const modalOpen =
    settingsOpened || confirmReset || exportOpen || photosOpen ||
    fullExportOpen || confirmImport || pickerOpen ||
    importChoices !== null || bulkOpen;

  return (
    <>
      <Page
        colors={{ bgIos: 'bg-transparent' }}
        className={`relative pb-safe-24 ${modalOpen ? 'z-40' : 'z-10'}`}
      >
      <Navbar title="Utilities" large transparent className="top-0 sticky" />

      <Block className="!mb-2 !mt-0 text-[13px] text-gray-500 dark:text-gray-400">
        Match-day housekeeping: keep the record, hand it over, clear the decks.
      </Block>

      <BlockTitle>Settings</BlockTitle>
      <List strong inset>
        <ListButton
          onClick={() => {
            haptic('tick');
            setSettingsOpened(true);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="settings" size={20} />
            Open Settings
          </span>
        </ListButton>
      </List>
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        The look of the app — theme, accent colour and font — plus the division
        and match type lists behind the JPL/PDJAL and Type dropdowns, and the
        home photo and badge watermark. Changes apply instantly.
      </Block>

      <BlockTitle>Save</BlockTitle>
      <List strong inset>
        <ListButton onClick={saveMatch}>
          {savedRecord ? 'Update Saved Match' : 'Save Match To History'}
        </ListButton>
      </List>
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        {savedRecord
          ? `Last saved ${formatSavedAt(savedRecord.savedAt)}. Saving again updates that record.`
          : 'Keeps a full copy of this match — fixture, squad, clock, goals and substitutions — on the Season tab.'}
      </Block>

      <BlockTitle>WhatsApp</BlockTitle>
      <List strong inset>
        <ListButton onClick={openWhatsApp}>
          <span className="inline-flex items-center gap-2">
            <Icon name="message-circle" size={20} />
            WhatsApp
          </span>
        </ListButton>
      </List>
      {whatsappText !== null && (
        <Block strong inset>
          {whatsappText.trim() === '' ? (
            <div className="text-[15px] text-gray-500 dark:text-gray-400">
              No goals logged yet — the summary appears once the Goal Logger has goals in it.
            </div>
          ) : (
            <>
              <div className="select-text whitespace-pre-wrap break-words text-[17px] leading-[2]">
                {whatsappText}
              </div>
              <Button className="mt-4" rounded onClick={copyWhatsApp}>
                Copy
              </Button>
              <div className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
                Touch and hold the text above to select and copy it, or tap Copy for the whole thing.
              </div>
            </>
          )}
        </Block>
      )}
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        A short goal-and-assist summary built from the Goal Logger — a ball for every
        goal with its minute, a boot for every assist — ready to paste into the team chat.
      </Block>

      <BlockTitle>Photos</BlockTitle>
      <List strong inset>
        <ListButton onClick={downloadPhotos}>
          <span className="inline-flex items-center gap-2">
            <Icon name="camera" size={20} />
            Download Photos
          </span>
        </ListButton>
      </List>
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        Pictures of the fixture, the Period 1 squad, goals & assists by player and
        the goals logged, made from this match. Save All puts the whole set in
        your camera roll in one go, or share them straight to Messages or WhatsApp.
      </Block>

      <BlockTitle>Export</BlockTitle>
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
      </List>
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        A spreadsheet of this match — fixture, squad with every period, match time, goals
        and substitutions — for Excel, Numbers or Google Sheets. To export a match from
        history, open it as the current match first.
      </Block>

      <BlockTitle>Full Match Transfer</BlockTitle>
      <List strong inset>
        <ListButton onClick={exportFullMatch}>
          <span className="inline-flex items-center gap-2">
            <Icon name="file-output" size={20} />
            Export Full Match
          </span>
        </ListButton>
        <ListButton onClick={pickImportFile}>
          <span className="inline-flex items-center gap-2">
            <Icon name="file-input" size={20} />
            Import Full Match
          </span>
        </ListButton>
      </List>
      {importError !== '' && (
        <Block className="!mt-1 !mb-0 text-[13px] k-color-brand-red">
          {importError}
        </Block>
      )}
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        One spreadsheet carrying every detail — fixture, squad with every period, match
        time, goals and substitutions. Export offers this match and everything in
        history; tick any number and one file carries them all. Import reads a
        file back and rebuilds the match from scratch, replacing what is on the
        phone now.
      </Block>

      <BlockTitle>Bulk Import</BlockTitle>
      <List strong inset>
        <ListButton onClick={pickBulkFile}>
          <span className="inline-flex items-center gap-2">
            <Icon name="file-input" size={20} />
            Import Matches (CSV)
          </span>
        </ListButton>
        <ListButton onClick={exportBulkFormat}>
          <span className="inline-flex items-center gap-2">
            <Icon name="file-output" size={20} />
            Export Bulk Format
          </span>
        </ListButton>
      </List>
      {bulkError !== '' && (
        <Block className="!mt-1 !mb-0 text-[13px] k-color-brand-red">
          {bulkError}
        </Block>
      )}
      <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        Load a season of matches from a simple spreadsheet: one row per match,
        with columns for Opposition, Home/Away, Date, Result, POTM, Starting,
        Subs, Not Available, Goals, Assists and optional Goal Minutes
        (&quot;12:Name;25:Name:Assist&quot;). Only Opposition and Starting are
        required; names inside a cell are separated with &quot;;&quot; and a
        goal count is written after the name (&quot;Name 2&quot;). Every row
        becomes a saved match in the current season — nothing on this screen
        changes.
      </Block>

      <BlockTitle>Reset</BlockTitle>
      <List strong inset>
        <ListButton className="k-color-brand-red" onClick={() => setConfirmReset(true)}>
          Start New Match
        </ListButton>
      </List>
      <Block className="text-[13px] text-gray-500 dark:text-gray-400 !mt-1">
        Clears the fixture details, the match clock, all logged goals and substitutions.
        The squad list is kept, and anything already saved to history stays there.
      </Block>

      <SettingsPanel opened={settingsOpened} onClose={() => setSettingsOpened(false)} />

      <PhotosSheet
        opened={photosOpen}
        photos={photos}
        onClose={() => setPhotosOpen(false)}
      />

      <ExportSheet
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        match={match}
      />

      <ExportSheet
        opened={fullExportOpen}
        onClose={() => setFullExportOpen(false)}
        match={fullExportList[0] || match}
        csv={
          fullExportOpen
            ? exportMode === 'bulk'
              ? bulkMatchesCsv(fullExportList)
              : fullMatchCsv(fullExportList)
            : ''
        }
        fileName={
          exportMode === 'bulk'
            ? bulkImportFileName(fullExportList)
            : fullMatchFileName(fullExportList)
        }
        description={
          exportMode === 'bulk'
            ? 'The simplified layout — one row per match with the fixture, POTM, the squad split and the goals & assists tallies. This is exactly the format Import Matches reads, so you can see how a hand-made spreadsheet should look, edit it, and load it straight back in.'
            : fullExportList.length > 1
            ? `${fullExportList.length} complete matches in one spreadsheet — fixture, squad with every period, match time, goals and substitutions for each. Import Full Match reads this file back and offers every match in it.`
            : 'The complete match in one spreadsheet — fixture, squad with every period, match time, goals and substitutions. Import Full Match on another phone reads this file back and rebuilds the match exactly.'
        }
      />

      <Sheet
        className="no-safe-areas-top pb-safe flex flex-col max-h-[85dvh]"
        opened={pickerOpen}
        onBackdropClick={() => setPickerOpen(false)}
      >
        <Navbar
          title="Choose matches"
          right={<Link navbar onClick={() => setPickerOpen(false)}>Cancel</Link>}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <List strong inset>
            {matchOptions.map((o) => (
              <ListItem
                key={o.key}
                label
                title={o.title}
                subtitle={o.subtitle}
                media={
                  <Checkbox
                    component="div"
                    className="-my-1 k-color-brand-green"
                    checked={pickedIds.has(o.key)}
                    onChange={() => togglePicked(o.key)}
                  />
                }
              />
            ))}
          </List>
        </div>
        <Block className="shrink-0">
          <Button large rounded disabled={pickedIds.size === 0} onClick={startFullExport}>
            Export {pickedIds.size} match{pickedIds.size === 1 ? '' : 'es'}
          </Button>
        </Block>
      </Sheet>

      <Actions
        opened={importChoices !== null}
        onBackdropClick={() => setImportChoices(null)}
      >
        <ActionsGroup>
          <ActionsLabel>
            That file carries {importChoices ? importChoices.length : 0} matches — import which?
          </ActionsLabel>
          {(importChoices || []).map((m, i) => (
            <ActionsButton
              key={i}
              onClick={() => {
                haptic('tick');
                setImported(m);
                setImportChoices(null);
                setConfirmImport(true);
              }}
            >
              {m.opposition || 'Unnamed match'}
              {m.date ? ` — ${formatDate(m.date)}` : ''}
            </ActionsButton>
          ))}
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setImportChoices(null)}>Cancel</ActionsButton>
        </ActionsGroup>
      </Actions>

      <input
        ref={importInputRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values"
        className="hidden"
        onChange={onImportFile}
      />

      <input
        ref={bulkInputRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,text/plain"
        className="hidden"
        onChange={onBulkFile}
      />

      <Sheet
        className="no-safe-areas-top pb-safe flex flex-col max-h-[85dvh]"
        opened={bulkOpen}
        onBackdropClick={() => setBulkOpen(false)}
      >
        <Navbar
          title="Bulk import"
          right={<Link navbar onClick={() => setBulkOpen(false)}>Cancel</Link>}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {bulkParsed && (
            <>
              <Block className="!mb-1 !mt-3 text-[13px] text-gray-500 dark:text-gray-400">
                {bulkParsed.matches.length} match
                {bulkParsed.matches.length === 1 ? '' : 'es'} found — they will
                be saved to {currentSeason ? currentSeason.name : 'the current season'}.
              </Block>
              <List strong inset>
                {bulkParsed.matches.map((m, i) => (
                  <ListItem
                    key={i}
                    title={m.opposition || 'Unnamed match'}
                    subtitle={bulkRowText(m)}
                  />
                ))}
              </List>
              {bulkParsed.warnings.length > 0 && (
                <Block className="!mt-1 text-[13px] text-orange-600 dark:text-orange-400">
                  <div className="whitespace-pre-wrap">
                    {bulkParsed.warnings.join('\n')}
                  </div>
                </Block>
              )}
            </>
          )}
        </div>
        <Block className="shrink-0">
          <Button
            large
            rounded
            disabled={!bulkParsed || bulkParsed.matches.length === 0}
            onClick={bulkImport}
          >
            Import {bulkParsed ? bulkParsed.matches.length : 0} match
            {bulkParsed && bulkParsed.matches.length === 1 ? '' : 'es'}
          </Button>
        </Block>
      </Sheet>

      <Dialog
        opened={confirmImport}
        onBackdropClick={() => setConfirmImport(false)}
        title="Import this match?"
        content={`Replaces everything on the phone now with ${describeImported(imported)} — fixture, squad, clock, goals and substitutions. Save the current match first if you want to keep it.`}
        buttons={
          <>
            <DialogButton onClick={() => setConfirmImport(false)}>Cancel</DialogButton>
            <DialogButton strong onClick={confirmImportMatch}>
              Import
            </DialogButton>
          </>
        }
      />

      <Dialog
        opened={confirmReset}
        onBackdropClick={() => setConfirmReset(false)}
        title="Start new match?"
        content="All fixture details, clock times, goals and substitutions will be cleared. Save this match first if you want to keep it."
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
    </>
  );
}
