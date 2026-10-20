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
import { useMatch, formatDate, formatSavedAt } from '../store.jsx';
import { fullMatchCsv, fullMatchFileName, parseFullMatchCsv } from '../fullmatch.js';
import { showToast } from '../toast.jsx';
import ExportSheet from '../components/ExportSheet.jsx';
import PhotosSheet from '../components/PhotosSheet.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import { buildMatchPhotos } from '../photos.js';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function UtilitiesScreen() {
  const { match, savedMatches, resetMatch, saveCurrentMatch, importMatch } = useMatch();
  const [confirmReset, setConfirmReset] = useState(false);
  const [settingsOpened, setSettingsOpened] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [whatsappText, setWhatsappText] = useState(null);
  const [fullExportOpen, setFullExportOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedIds, setPickedIds] = useState(() => new Set());
  const [fullExportList, setFullExportList] = useState([match]);
  const [importChoices, setImportChoices] = useState(null);
  const [imported, setImported] = useState(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef(null);

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

  // The settings panel, export sheet, reset confirmation and photos sheet
  // lift this screen above the tab bar.
  const modalOpen =
    settingsOpened || confirmReset || exportOpen || photosOpen ||
    fullExportOpen || confirmImport || pickerOpen ||
    importChoices !== null;

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
        csv={fullExportOpen ? fullMatchCsv(fullExportList) : ''}
        fileName={fullMatchFileName(fullExportList)}
        description={
          fullExportList.length > 1
            ? `${fullExportList.length} complete matches in one spreadsheet — fixture, squad with every period, match time, goals and substitutions for each. Import Full Match reads this file back and offers every match in it.`
            : 'The complete match in one spreadsheet — fixture, squad with every period, match time, goals and substitutions. Import Full Match on another phone reads this file back and rebuilds the match exactly.'
        }
      />

      <Sheet
        className="no-safe-areas-top pb-safe"
        opened={pickerOpen}
        onBackdropClick={() => setPickerOpen(false)}
      >
        <Navbar
          title="Choose matches"
          right={<Link navbar onClick={() => setPickerOpen(false)}>Cancel</Link>}
        />
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
        <Block>
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
