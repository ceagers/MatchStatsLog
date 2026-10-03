// One app-wide confirmation toast. Screens call showToast(text); the host
// below renders it once, at the root of the app — above the fixed tab bar,
// so no screen's own layering can ever cover it.

import { useEffect, useState } from 'react';
import { Toast } from 'konsta/react';

const listeners = new Set();
let hideTimer = null;

export function showToast(text, ms = 1800) {
  listeners.forEach((listen) => listen(text));
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    listeners.forEach((listen) => listen(''));
  }, ms);
}

export function ToastHost() {
  const [text, setText] = useState('');
  useEffect(() => {
    listeners.add(setText);
    return () => {
      listeners.delete(setText);
    };
  }, []);
  return (
    <Toast position="center" opened={text !== ''} className="z-50">
      <div className="shrink">{text}</div>
    </Toast>
  );
}
