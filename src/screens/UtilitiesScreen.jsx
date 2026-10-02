// Utilities: match-day housekeeping in one place — keep the record, hand it
// over as a spreadsheet, and clear the decks for the next game. The actions
// were moved here from the Match Info screen and the match summary so the
// screens a coach works through on the day stay focused on the match itself.

import { useEffect, useRef, useState } from 'react';
import {
  Page, Navbar, Block, BlockTitle, List, ListButton, Dialog, DialogButton, Toast,
} from 'konsta/react';
import { useMatch, formatSavedAt } from '../store.jsx';
import ExportSheet from '../components/ExportSheet.jsx';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function UtilitiesScreen() {
  const { match, savedMatches, resetMatch, saveCurrentMatch } = useMatch();
  const [confirmReset, setConfirmReset] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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

  return (
    <Page colors={{ bgIos: 'bg-transparent' }} className="relative z-10 pb-safe-24">
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
          : 'Keeps a full copy of this match — fixture, squad, clock, goals and substitutions — on the Saved tab.'}
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

      <Toast position="center" opened={toast !== ''}>
        <div className="shrink">{toast}</div>
      </Toast>
    </Page>
  );
}
