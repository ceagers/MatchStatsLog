// Entry point: mounts the app inside Konsta's App shell.
//
// Keep the shell here and the app itself in app.jsx — screens and components
// grow in src/, this file should stay this small.

import { createRoot } from 'react-dom/client';
import { App } from 'konsta/react';
import AppScreen from './app.jsx';

// Follow the system appearance. Tailwind's dark: variant and Konsta's dark
// palette both key off the `dark` class on <html>.
const media = window.matchMedia('(prefers-color-scheme: dark)');
function applyAppearance() {
  document.documentElement.classList.toggle('dark', media.matches);
}
applyAppearance();
media.addEventListener('change', applyAppearance);

createRoot(document.getElementById('root')).render(
  <App theme="ios" safeAreas>
    <AppScreen />
  </App>
);
