// The sheet that hands the generated match photos over. A WebView cannot write
// to the Photos library itself, so the save path is the iOS share sheet: it
// offers "Save Image" for a single picture and "Save N Images" for the whole
// set, and either way the photos land in the camera roll directly — no Files
// app involved. Touch-and-hold ("Add to Photos") also works on any picture.

import { useState } from 'react';
import { Sheet, Navbar, Link, Block, Button, Preloader } from 'konsta/react';
import { dataUrlToFile } from '../photos.js';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function PhotosSheet({ opened, photos, onClose }) {
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function';
  const [busy, setBusy] = useState(''); // '' | 'all' | the photo name

  const shareFiles = async (list) => {
    const files = await Promise.all(
      list.map((photo) => dataUrlToFile(photo.dataUrl, photo.name))
    );
    if (navigator.canShare({ files })) await navigator.share({ files });
  };

  const saveAll = async () => {
    if (!canShareFiles || busy) return;
    haptic('tick');
    setBusy('all');
    try {
      await shareFiles(photos);
    } catch {
      // The user cancelled the share sheet — nothing to do.
    }
    setBusy('');
  };

  const saveOne = async (photo) => {
    if (!canShareFiles || busy) return;
    haptic('tick');
    setBusy(photo.name);
    try {
      await shareFiles([photo]);
    } catch {
      // The user cancelled the share sheet — nothing to do.
    }
    setBusy('');
  };

  return (
    <Sheet
      opened={opened}
      onBackdropClick={onClose}
      className="no-safe-areas-top pb-safe flex h-[88%] flex-col"
    >
      <Navbar
        title="Match Photos"
        right={<Link navbar onClick={onClose}>Done</Link>}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {canShareFiles && photos.length > 0 ? (
          <>
            <div className="pt-3">
              <Button large rounded onClick={saveAll} disabled={busy !== ''}>
                {busy === 'all' ? (
                  <span className="inline-flex items-center gap-2">
                    <Preloader size={20} /> Preparing…
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Icon name="image-down" size={20} />
                    Save All to Photos
                  </span>
                )}
              </Button>
            </div>
            <Block className="!mt-2 !mb-1 text-[13px] text-gray-500 dark:text-gray-400">
              In the share sheet, choose Save Image — every picture goes straight
              into your camera roll. You can also send them to Messages or
              WhatsApp from the same sheet.
            </Block>
          </>
        ) : (
          <Block className="!mt-2 !mb-1 text-[13px] text-gray-500 dark:text-gray-400">
            Touch and hold a picture, then choose Add to Photos to save it to
            your camera roll.
          </Block>
        )}
        {photos.map((photo) => (
          <div key={photo.name} className="mt-3">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {photo.title}
              </span>
              {canShareFiles ? (
                busy === photo.name ? (
                  <Preloader size={20} className="mr-2" />
                ) : (
                  <Link navbar onClick={() => saveOne(photo)}>
                    <Icon name="image-down" size={18} />
                  </Link>
                )
              ) : null}
            </div>
            <img
              src={photo.dataUrl}
              alt={photo.title}
              className="w-full rounded-xl shadow-md"
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
}
