// App-wide settings: light/dark appearance, accent colour, font, and the two
// wallpaper photos. Every choice is remembered in localStorage and applied to
// the page as classes and CSS variables, so it takes effect app-wide at once
// and survives relaunches.

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const KEYS = {
  theme: 'settings.theme.v1',
  accent: 'settings.accent.v1',
  font: 'settings.font.v1',
  homeImage: 'settings.homeImage.v1',
  badgeImage: 'settings.badgeImage.v1',
  competitions: 'settings.competitions.v1',
  matchTypes: 'settings.matchTypes.v1',
};

export const ACCENTS = [
  { id: 'blue', name: 'Blue', value: '#007aff' },
  { id: 'green', name: 'Green', value: '#34c759' },
  { id: 'red', name: 'Red', value: '#ff3b30' },
  { id: 'orange', name: 'Orange', value: '#ff9500' },
  { id: 'yellow', name: 'Yellow', value: '#ffcc00' },
  { id: 'purple', name: 'Purple', value: '#af52de' },
  { id: 'pink', name: 'Pink', value: '#ff2d55' },
  { id: 'teal', name: 'Teal', value: '#30b0c7' },
];

export const FONTS = [
  { id: 'system', name: 'System', stack: null },
  { id: 'rounded', name: 'Rounded', stack: '-apple-system-rounded, ui-rounded, "SF Pro Rounded", -apple-system, sans-serif' },
  { id: 'serif', name: 'Serif', stack: '-apple-system-ui-serif, ui-serif, "New York", Georgia, serif' },
  { id: 'mono', name: 'Mono', stack: 'ui-monospace, "SF Mono", Menlo, monospace' },
];

// The option lists behind the JPL/PDJAL and Type dropdowns on the Match Info
// screen. They start with these values and are edited in the settings panel;
// a saved list replaces the defaults entirely.
export const DEFAULT_COMPETITIONS = ['JPL', 'PDJAL'];
export const DEFAULT_MATCH_TYPES = ['League', 'Cup', 'League Cup', 'County Cup'];

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* too large or full — keep the choice for this session only */
  }
}

// A stored option list must be strings, trimmed, unique and non-empty. An
// emptied list is kept as-is — the coach may genuinely want none.
function loadList(key, fallback) {
  const raw = load(key, null);
  if (!Array.isArray(raw)) return [...fallback];
  const seen = new Set();
  const out = [];
  raw.forEach((v) => {
    if (typeof v !== 'string') return;
    const t = v.trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) return;
    seen.add(k);
    out.push(t);
  });
  return out;
}

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour.
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v) =>
    Math.max(0, Math.min(255, Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const r = channel((n >> 16) & 255);
  const g = channel((n >> 8) & 255);
  const b = channel(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(() => load(KEYS.theme, 'system'));
  const [accent, setAccent] = useState(() => load(KEYS.accent, 'blue'));
  const [font, setFont] = useState(() => load(KEYS.font, 'system'));
  const [homeImage, setHomeImage] = useState(() => load(KEYS.homeImage, null));
  const [badgeImage, setBadgeImage] = useState(() => load(KEYS.badgeImage, null));
  const [competitions, setCompetitions] = useState(() =>
    loadList(KEYS.competitions, DEFAULT_COMPETITIONS)
  );
  const [matchTypes, setMatchTypes] = useState(() =>
    loadList(KEYS.matchTypes, DEFAULT_MATCH_TYPES)
  );

  // Mirror every choice into storage.
  useEffect(() => {
    persist(KEYS.theme, theme);
    persist(KEYS.accent, accent);
    persist(KEYS.font, font);
    persist(KEYS.homeImage, homeImage);
    persist(KEYS.badgeImage, badgeImage);
    persist(KEYS.competitions, competitions);
    persist(KEYS.matchTypes, matchTypes);
  }, [theme, accent, font, homeImage, badgeImage, competitions, matchTypes]);

  // Light/dark: 'system' follows the phone, the other two force it.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  // Accent colour: retint the app's primary colour tokens everywhere —
  // buttons, segmented controls, the tab bar's active state, all of it.
  useEffect(() => {
    const c = ACCENTS.find((a) => a.id === accent) || ACCENTS[0];
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--k-color-primary', c.value);
    rootStyle.setProperty('--k-color-ios-primary', c.value);
    rootStyle.setProperty('--k-color-ios-primary-tint', shade(c.value, 0.18));
    rootStyle.setProperty('--k-color-ios-primary-shade', shade(c.value, -0.14));
  }, [accent]);

  // Font: swap the family the iOS theme stack inherits.
  useEffect(() => {
    const f = FONTS.find((x) => x.id === font) || FONTS[0];
    const rootStyle = document.documentElement.style;
    if (f.stack) rootStyle.setProperty('--font-ios', f.stack);
    else rootStyle.removeProperty('--font-ios');
  }, [font]);

  const value = useMemo(
    () => ({
      theme, setTheme,
      accent, setAccent,
      font, setFont,
      homeImage, setHomeImage,
      badgeImage, setBadgeImage,
      competitions, setCompetitions,
      matchTypes, setMatchTypes,
    }),
    [theme, accent, font, homeImage, badgeImage, competitions, matchTypes]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}

// Turn a picked photo into a downscaled data URL that fits comfortably in
// local storage. PNGs keep their transparency; everything else becomes JPEG.
export function fileToDataURL(file, maxDim = 1440) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const draw = (dim) => {
        const scale = Math.min(1, dim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        return canvas.toDataURL(
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.85
        );
      };
      let dataUrl = draw(maxDim);
      if (dataUrl.length > 1800000) dataUrl = draw(1000); // still too bulky — shrink more
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}
