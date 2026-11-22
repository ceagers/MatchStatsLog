// Hands the match spreadsheet over: the share sheet first, since iOS saves the
// .csv straight into Files from there, a file download when the share sheet
// cannot take attachments, and the clipboard as a fallback that always works.

import { useMemo, useState } from 'react';
import {
  Block, Button, Link, List, ListItem, Navbar, Sheet, Toast,
} from 'konsta/react';
import { CSV_MIME, matchCsv, matchFileName } from '../export.js';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function ExportSheet({
  opened,
  onClose,
  match,
  // Overrides for season / player exports — when given, the match itself is
  // unused and the sheet hands over the provided spreadsheet instead.
  csv: csvProp,
  fileName: fileNameProp,
  description: descriptionProp,
  // Full backups travel as JSON, so the sheet's wording and MIME type are
  // overridable — everything else stays the share/download/copy routine.
  title: titleProp = 'Export To Excel',
  subtitle: subtitleProp = 'Comma-separated spreadsheet',
  mime: mimeProp = CSV_MIME,
}) {
  const [toast, setToast] = useState('');

  // Built when the sheet opens, so the clock time is the one the coach just saw.
  const csv = useMemo(
    () => (opened ? (csvProp !== undefined ? csvProp : matchCsv(match)) : ''),
    [opened, csvProp, match]
  );
  const fileName = useMemo(
    () => (fileNameProp !== undefined ? fileNameProp : matchFileName(match)),
    [fileNameProp, match]
  );

  const canShareFile = useMemo(() => {
    if (!opened || typeof navigator === 'undefined') return false;
    if (typeof navigator.canShare !== 'function') return false;
    try {
      return navigator.canShare({ files: [new File([csv], fileName, { type: mimeProp })] });
    } catch {
      return false;
    }
  }, [opened, csv, fileName, mimeProp]);

  const flash = (text) => {
    setToast(text);
    setTimeout(() => setToast(''), 2200);
  };

  const shareSpreadsheet = async () => {
    haptic('tick');
    try {
      const file = new File([csv], fileName, { type: mimeProp });
      await navigator.share({ files: [file], title: fileName });
      flash('File shared');
    } catch {
      flash('Could not share — save the file instead');
    }
  };

  const saveSpreadsheet = () => {
    haptic('tick');
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: mimeProp }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash('File ready');
    } catch {
      flash('Could not save the file — copy it instead');
    }
  };

  const copySpreadsheet = async () => {
    haptic('tick');
    try {
      await navigator.clipboard.writeText(csv);
      flash('Copied — paste it where you need it');
    } catch {
      flash('Select the text below and copy it');
    }
  };

  return (
    <>
      <Sheet
        className="no-safe-areas-top pb-safe"
        opened={opened}
        onBackdropClick={onClose}
      >
        <Navbar
          title={titleProp}
          right={<Link navbar onClick={onClose}>Done</Link>}
        />

        <List strong inset>
          <ListItem
            media={<Icon name="file-spreadsheet" size={24} />}
            title={fileName}
            subtitle={subtitleProp}
          />
        </List>

        <Block className="!mt-1 text-[13px] text-gray-500 dark:text-gray-400">
          {descriptionProp ??
            'Excel, Numbers and Google Sheets all open this file. It carries the fixture, the squad with every period, the match time, the goals and the substitutions.'}
        </Block>

        <Block className="grid grid-cols-1 gap-3">
          {canShareFile ? (
            <Button large rounded onClick={shareSpreadsheet}>
              <span className="inline-flex items-center gap-2">
                <Icon name="share-2" size={20} />
                Share Spreadsheet
              </span>
            </Button>
          ) : (
            <Button large rounded onClick={saveSpreadsheet}>
              <span className="inline-flex items-center gap-2">
                <Icon name="download" size={20} />
                Save .csv File
              </span>
            </Button>
          )}
          <Button large rounded tonal onClick={copySpreadsheet}>
            <span className="inline-flex items-center gap-2">
              <Icon name="clipboard-copy" size={20} />
              Copy Spreadsheet
            </span>
          </Button>
        </Block>

        <Block className="!my-0">
          <textarea
            readOnly
            value={csv}
            rows={6}
            onFocus={(e) => e.target.select()}
            className="w-full resize-none rounded-xl border-0 bg-black/5 p-3 font-mono
                       text-[11px] leading-relaxed text-gray-600 outline-none
                       dark:bg-white/10 dark:text-gray-300"
          />
        </Block>
        <Block className="!mt-2 text-[13px] text-gray-500 dark:text-gray-400">
          Nothing to tap above? Press and hold the text and copy it, then paste it
          wherever it is needed.
        </Block>
      </Sheet>

      <Toast position="center" opened={toast !== ''}>
        <div className="shrink">{toast}</div>
      </Toast>
    </>
  );
}
