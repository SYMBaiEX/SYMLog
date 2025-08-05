'use client';

import { useEffect } from 'react';

export function TauriDetector() {
  useEffect(() => {
    // Add a class to the body when running in Tauri
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      document.body.classList.add('tauri-app');
    }
  }, []);

  return null;
}
