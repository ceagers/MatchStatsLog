// Entry point: mounts the app inside Konsta's App shell.
//
// Keep the shell here and the app itself in app.jsx — screens and components
// grow in src/, this file should stay this small.

import { createRoot } from 'react-dom/client';
import { App } from 'konsta/react';
import AppScreen from './app.jsx';
import { SettingsProvider } from './settings.jsx';

// Appearance (light/dark/system), accent colour, font and the wallpaper
// photos are owned by SettingsProvider — it applies them to the page on
// start and whenever they change.
createRoot(document.getElementById('root')).render(
  <App theme="ios" safeAreas>
    <SettingsProvider>
      <AppScreen />
    </SettingsProvider>
  </App>
);
