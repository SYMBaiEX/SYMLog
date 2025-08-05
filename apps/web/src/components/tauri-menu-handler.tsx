'use client';

import { useTauriMenu } from '@/hooks/use-tauri-menu';

export function TauriMenuHandler() {
  // This component just sets up the menu event listeners
  useTauriMenu();

  // No visual output - just handles events
  return null;
}
