// Utilities: match-day housekeeping in one place — keep the record, hand it
// over as a spreadsheet, and clear the decks for the next game. The actions
// were moved here from the Match Info screen and the match summary so the
// screens a coach works through on the day stay focused on the match itself.

import { useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListButton, Button, Dialog, DialogButton,
} from 'konsta/react';
import { useMatch, formatSavedAt } from '../store.jsx';
import { showToast } from '../toast.jsx';
import ExportSheet from '../components/ExportSheet.jsx';
import PhotosSheet from '../components/PhotosSheet.jsx';
import { buildMatchPhotos } from '../photos.js';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function UtilitiesScreen() {
  const { match, savedMatches, resetMatch, saveCurrentMatch } = useMatch();
  const [confirmReset, setConfirmReset] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [whatsappText, setWhatsappText] = useState(null);

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

  // The export sheet, reset confirmation and photos sheet lift this screen
  // above the tab bar.
  const modalOpen = confirmReset || exportOpen || photosOpen;

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
