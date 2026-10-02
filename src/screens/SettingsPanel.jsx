// Settings: the floating panel behind the cog on the Match Info screen.
// Appearance (light/dark/system), accent colour, font, and the two
// wallpaper photos — each change applies instantly.

import { useRef } from 'react';
import {
  Panel, Page, Navbar, Link, Block, BlockTitle, BlockFooter,
  List, ListItem, Segmented, SegmentedButton, Button,
} from 'konsta/react';
import { Icon } from '../icons.js';
import { useSettings, ACCENTS, FONTS, fileToDataURL } from '../settings.jsx';
import { haptic } from '../haptics.js';

export default function SettingsPanel({ opened, onClose }) {
  const {
    theme, setTheme,
    accent, setAccent,
    font, setFont,
    homeImage, setHomeImage,
    badgeImage, setBadgeImage,
  } = useSettings();

  const homeInputRef = useRef(null);
  const badgeInputRef = useRef(null);

  const pick = async (event, apply) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // picking the same photo again still fires change
    if (!file) return;
    try {
      const dataUrl = await fileToDataURL(file);
      apply(dataUrl);
      haptic('archived');
    } catch {
      haptic('removed');
    }
  };

  return (
    <Panel side="right" floating opened={opened} onBackdropClick={onClose}>
      <Page
        colors={{ bgIos: 'bg-transparent' }}
        className="no-safe-areas-top no-safe-areas-bottom"
      >
        <Navbar
          title="Settings"
          right={<Link navbar onClick={onClose}>Done</Link>}
        />

        <BlockTitle>Appearance</BlockTitle>
        <Block strong inset>
          <Segmented strong rounded>
            {[
              { id: 'system', name: 'System' },
              { id: 'light', name: 'Light' },
              { id: 'dark', name: 'Dark' },
            ].map((option) => (
              <SegmentedButton
                key={option.id}
                strong
                rounded
                active={theme === option.id}
                onClick={() => { haptic('bump'); setTheme(option.id); }}
              >
                {option.name}
              </SegmentedButton>
            ))}
          </Segmented>
        </Block>

        <BlockTitle>Accent Colour</BlockTitle>
        <Block strong inset>
          <div className="grid grid-cols-4 place-items-center gap-y-3">
            {ACCENTS.map((c) => {
              const selected = accent === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.name}
                  onClick={() => { haptic('bump'); setAccent(c.id); }}
                  className={`flex h-9 w-9 items-center justify-center rounded-full
                              transition-transform active:scale-90 ${
                                selected ? 'scale-110 ring-2 ring-white/80' : ''
                              }`}
                  style={{ backgroundColor: c.value }}
                >
                  {selected && <Icon name="check" size={16} className="text-white" />}
                </button>
              );
            })}
          </div>
        </Block>

        <BlockTitle>Font</BlockTitle>
        <Block strong inset>
          <Segmented strong rounded>
            {FONTS.map((f) => (
              <SegmentedButton
                key={f.id}
                strong
                rounded
                active={font === f.id}
                onClick={() => { haptic('bump'); setFont(f.id); }}
              >
                {f.name}
              </SegmentedButton>
            ))}
          </Segmented>
        </Block>

        <BlockTitle>Photos</BlockTitle>
        <List strong inset>
          <ListItem
            media={
              <img
                src={homeImage || 'assets/home.jpg'}
                alt=""
                className="h-10 w-10 rounded-lg object-cover"
              />
            }
            title="Home Photo"
            footer={homeImage ? 'Custom photo in use' : 'Original photo (home.jpg)'}
            after={
              <div className="flex items-center gap-2">
                <Button
                  small
                  rounded
                  tonal
                  inline
                  onClick={() => homeInputRef.current && homeInputRef.current.click()}
                >
                  Change
                </Button>
                {homeImage && (
                  <Button
                    small
                    rounded
                    clear
                    inline
                    onClick={() => { haptic('removed'); setHomeImage(null); }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            }
          />
          <ListItem
            media={
              <img
                src={badgeImage || 'assets/badge.PNG'}
                alt=""
                className="h-10 w-10 rounded-lg object-contain"
              />
            }
            title="Badge Watermark"
            footer={badgeImage ? 'Custom badge in use' : 'Original badge (badge.PNG)'}
            after={
              <div className="flex items-center gap-2">
                <Button
                  small
                  rounded
                  tonal
                  inline
                  onClick={() => badgeInputRef.current && badgeInputRef.current.click()}
                >
                  Change
                </Button>
                {badgeImage && (
                  <Button
                    small
                    rounded
                    clear
                    inline
                    onClick={() => { haptic('removed'); setBadgeImage(null); }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            }
          />
        </List>
        <BlockFooter className="pt-1 text-[13px] text-gray-500 dark:text-gray-400">
          Photos are picked from your library and kept privately in the app.
        </BlockFooter>

        <input
          ref={homeInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e, setHomeImage)}
        />
        <input
          ref={badgeInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pick(e, setBadgeImage)}
        />
      </Page>
    </Panel>
  );
}
