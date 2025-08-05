'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface MenuActionEvent extends CustomEvent {
  detail: {
    action: string;
    data?: any;
  };
}

export function useTauriMenu() {
  const router = useRouter();

  useEffect(() => {
    const handleMenuAction = (event: MenuActionEvent) => {
      const { action, data } = event.detail;

      switch (action) {
        case 'new_file':
          console.log('Creating new file...');
          // Implement new file logic
          break;

        case 'open_file':
          console.log('Opening file...');
          // Implement file open dialog
          break;

        case 'save':
          console.log('Saving file...');
          // Implement save logic
          break;

        case 'save_as':
          console.log('Save as...');
          // Implement save as dialog
          break;

        case 'find':
          console.log('Opening find dialog...');
          // Implement find dialog
          break;

        case 'replace':
          console.log('Opening replace dialog...');
          // Implement replace dialog
          break;

        case 'new_chat':
          console.log('Creating new chat...');
          // Implement new chat logic
          break;

        case 'voice_chat':
          console.log('Starting voice chat...');
          // Implement voice chat
          break;

        case 'send_message':
          console.log('Sending message...');
          // Implement send message
          break;

        case 'show_shortcuts':
          console.log('Showing keyboard shortcuts...');
          // Implement shortcuts dialog
          break;

        default:
          console.log('Unknown menu action:', action);
      }
    };

    // Listen for menu events from Tauri
    window.addEventListener('menu-action', handleMenuAction as EventListener);

    return () => {
      window.removeEventListener(
        'menu-action',
        handleMenuAction as EventListener
      );
    };
  }, [router]);
}

// Helper to check if running in Tauri
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
