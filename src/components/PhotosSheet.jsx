// The sheet that hands the generated match photos over. Each picture can be
// sent through the iOS share sheet (which offers "Save to Photos"), or touched
// and held to pick "Add to Photos" from the context menu — the two ways a
// web app can get a picture into the camera roll.

import { Sheet, Navbar, Link, Block } from 'konsta/react';
import { dataUrlToFile } from '../photos.js';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';

export default function PhotosSheet({ opened, photos, onClose }) {
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function';

  const sharePhoto = async (photo) => {
    haptic('tick');
    try {
      const file = await dataUrlToFile(photo.dataUrl, photo.name);
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: photo.title });
      }
    } catch {
      // The user cancelled the share sheet — nothing to do.
    }
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
        <Block className="!mt-2 !mb-1 text-[13px] text-gray-500 dark:text-gray-400">
          Touch and hold a picture, then choose Add to Photos to save it to your
          camera roll.
        </Block>
        {photos.map((photo) => (
          <div key={photo.name} className="mt-3">
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-[13px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {photo.title}
              </span>
              {canShareFiles ? (
                <Link navbar onClick={() => sharePhoto(photo)}>
                  <Icon name="share" size={18} />
                </Link>
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
