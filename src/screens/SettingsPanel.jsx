// Settings: the floating panel opened from the Settings section at the top
// of the Utilities screen. Appearance (light/dark/system), accent colour,
// font, the two wallpaper photos, and the editable option lists behind the
// JPL/PDJAL and Type dropdowns — each change applies instantly.

import { useRef, useState } from 'react';
import {
  Panel, Page, Navbar, Link, Block, BlockTitle, BlockFooter,
  List, ListItem, ListInput, ListButton, Segmented, SegmentedButton, Button,
} from 'konsta/react';
import { Icon } from '../icons.js';
import { useSettings, ACCENTS, FONTS, fileToDataURL } from '../settings.jsx';
import { haptic } from '../haptics.js';

// One editable dropdown-option list: rows with rename/delete, plus an add
// row at the bottom. Values stay unique — a rename that would clash is
// refused with a buzz instead.
function EditableListSection({ title, footer, addLabel, values, onChange }) {
  const [draft, setDraft] = useState('');
  const [editIdx, setEditIdx] = useState(null);
  const [editText, setEditText] = useState('');

  const trimmed = draft.trim();
  const duplicate =
    trimmed !== '' &&
    values.some((v) => v.toLowerCase() === trimmed.toLowerCase());

  const add = () => {
    if (!trimmed || duplicate) return;
    haptic('archived');
    onChange((list) => [...list, trimmed]);
    setDraft('');
  };

  const startEdit = (i) => {
    haptic('tick');
    setEditIdx(i);
    setEditText(values[i]);
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    const t = editText.trim();
    const clash =
      t === '' ||
      values.some(
        (v, i) => i !== editIdx && v.toLowerCase() === t.toLowerCase()
      );
    if (clash) {
      haptic('removed');
      return;
    }
    haptic('archived');
    onChange((list) => list.map((v, i) => (i === editIdx ? t : v)));
    setEditIdx(null);
  };

  return (
    <>
      <BlockTitle>{title}</BlockTitle>
      <List strong inset>
        {values.map((v, i) =>
          editIdx === i ? (
            <ListInput
              key={`edit-${i}`}
              label="Rename"
              type="text"
              value={editText}
              onInput={(e) => setEditText(e.target.value)}
            />
          ) : (
            <ListItem
              key={v}
              title={v}
              after={
                <div className="flex items-center gap-2">
                  <Button
                    small
                    rounded
                    tonal
                    inline
                    onClick={() => startEdit(i)}
                  >
                    Rename
                  </Button>
                  <Button
                    small
                    rounded
                    clear
                    inline
                    className="k-color-brand-red"
                    onClick={() => {
                      haptic('removed');
                      setEditIdx(null);
                      onChange((list) => list.filter((_, j) => j !== i));
                    }}
                  >
                    Delete
                  </Button>
                </div>
              }
            />
          )
        )}

        {editIdx !== null && (
          <>
            <ListButton disabled={!editText.trim()} onClick={saveEdit}>
              Save Name
            </ListButton>
            <ListButton onClick={() => setEditIdx(null)}>Cancel</ListButton>
          </>
        )}

        <ListInput
          label="Add"
          type="text"
          placeholder="New value"
          value={draft}
          onInput={(e) => setDraft(e.target.value)}
          clearButton
          onClear={() => setDraft('')}
          error={duplicate ? 'Already in the list' : undefined}
        />
        <ListButton disabled={!trimmed || duplicate} onClick={add}>
          {addLabel}
        </ListButton>
      </List>
      {footer && (
        <BlockFooter className="pt-1 text-[13px] text-gray-500 dark:text-gray-400">
          {footer}
        </BlockFooter>
      )}
    </>
  );
}

export default function SettingsPanel({ opened, onClose }) {
  const {
    theme, setTheme,
    accent, setAccent,
    font, setFont,
    homeImage, setHomeImage,
    badgeImage, setBadgeImage,
    competitions, setCompetitions,
    matchTypes, setMatchTypes,
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

        <EditableListSection
          title="JPL/PDJAL"
          addLabel="Add Division"
          values={competitions}
          onChange={setCompetitions}
          footer="The options in the JPL/PDJAL dropdown on the Match Info screen. Saved matches keep the value they were stored with."
        />
        <EditableListSection
          title="Match Types"
          addLabel="Add Type"
          values={matchTypes}
          onChange={setMatchTypes}
          footer="The options in the Type dropdown on the Match Info screen. Saved matches keep the value they were stored with."
        />

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