'use client';

import {
  BookOpen,
  Bug,
  CheckSquare,
  ChevronDown,
  Clipboard,
  Command,
  Copy,
  Database,
  Edit,
  Eye,
  FileJson,
  FileText,
  FlaskConical,
  Globe,
  HelpCircle,
  Home,
  Info,
  Keyboard,
  Mail,
  MessageSquare,
  Palette,
  RefreshCw,
  Scissors,
  Search,
  Settings,
  Shield,
  Terminal,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TauriWindow } from '@/types/tauri';

type TauriMenuItem =
  | {
      label: string;
      icon?: React.ElementType;
      shortcut?: string;
      action?: () => void;
      submenu?: TauriMenuItem[];
    }
  | {
      separator: true;
    };

interface MenuBarItem {
  label: string;
  items: TauriMenuItem[];
}

// Helper function to safely access Tauri window API
const getTauriWindow = (): TauriWindow | null => {
  if (typeof window !== 'undefined' && window.__TAURI__?.window) {
    return window.__TAURI__.window.getCurrent();
  }
  return null;
};

export function TauriAppBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isTauri, setIsTauri] = React.useState(false);

  React.useEffect(() => {
    // Check if we're running in Tauri
    setIsTauri(typeof window !== 'undefined' && '__TAURI__' in window);
  }, []);

  // Keyboard shortcuts handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl based shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            console.log('New file');
            break;
          case 'o':
            e.preventDefault();
            console.log('Open file');
            break;
          case 's':
            e.preventDefault();
            console.log('Save file');
            break;
          case 'q': {
            e.preventDefault();
            const tauriWindow = getTauriWindow();
            if (tauriWindow) {
              tauriWindow.close();
            }
            break;
          }
          case 'r':
            e.preventDefault();
            window.location.reload();
            break;
          case '=':
          case '+':
            e.preventDefault();
            document.body.style.zoom = `${Number.parseFloat(document.body.style.zoom || '1') * 1.1}`;
            break;
          case '-':
            e.preventDefault();
            document.body.style.zoom = `${Number.parseFloat(document.body.style.zoom || '1') * 0.9}`;
            break;
          case '0':
            e.preventDefault();
            document.body.style.zoom = '1';
            break;
          case ',':
            e.preventDefault();
            router.push('/settings');
            break;
        }

        // Cmd/Ctrl + number for quick navigation
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          const routes = ['/', '/blog', '/research', '/contact'];
          const index = Number.parseInt(e.key) - 1;
          if (routes[index]) {
            router.push(routes[index]);
          }
        }
      }

      // Alt-based menu activation
      if (e.altKey) {
        const menuAccessKeys: Record<string, string> = {
          f: 'file-menu',
          e: 'edit-menu',
          v: 'view-menu',
          g: 'go-menu',
          t: 'tools-menu',
          w: 'window-menu',
          h: 'help-menu',
        };

        const menuId = menuAccessKeys[e.key.toLowerCase()];
        if (menuId) {
          e.preventDefault();
          const menuButton = document.getElementById(menuId);
          menuButton?.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  const menuBar: MenuBarItem[] = [
    {
      label: 'File',
      items: [
        {
          label: 'New File',
          icon: FileText,
          shortcut: '⌘N',
          action: () => console.log('New file'),
        },
        {
          label: 'Open...',
          icon: FileJson,
          shortcut: '⌘O',
          action: () => console.log('Open file'),
        },
        { label: 'Save', shortcut: '⌘S', action: () => console.log('Save') },
        {
          label: 'Save As...',
          shortcut: '⇧⌘S',
          action: () => console.log('Save as'),
        },
        { separator: true },
        {
          label: 'Settings',
          icon: Settings,
          shortcut: '⌘,',
          action: () => router.push('/settings'),
        },
        { separator: true },
        {
          label: 'Quit',
          shortcut: '⌘Q',
          action: () => {
            const tauriWindow = getTauriWindow();
            if (tauriWindow) {
              tauriWindow.close();
            }
          },
        },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'Undo',
          shortcut: '⌘Z',
          action: () => document.execCommand('undo'),
        },
        {
          label: 'Redo',
          shortcut: '⇧⌘Z',
          action: () => document.execCommand('redo'),
        },
        { separator: true },
        {
          label: 'Cut',
          icon: Scissors,
          shortcut: '⌘X',
          action: () => document.execCommand('cut'),
        },
        {
          label: 'Copy',
          icon: Copy,
          shortcut: '⌘C',
          action: () => document.execCommand('copy'),
        },
        {
          label: 'Paste',
          icon: Clipboard,
          shortcut: '⌘V',
          action: () => document.execCommand('paste'),
        },
        { separator: true },
        {
          label: 'Find',
          icon: Search,
          shortcut: '⌘F',
          action: () => console.log('Find'),
        },
        {
          label: 'Replace',
          shortcut: '⌥⌘F',
          action: () => console.log('Replace'),
        },
      ],
    },
    {
      label: 'View',
      items: [
        {
          label: 'Reload',
          icon: RefreshCw,
          shortcut: '⌘R',
          action: () => window.location.reload(),
        },
        { separator: true },
        {
          label: 'Zoom In',
          icon: ZoomIn,
          shortcut: '⌘+',
          action: () => {
            document.body.style.zoom = `${Number.parseFloat(document.body.style.zoom || '1') * 1.1}`;
          },
        },
        {
          label: 'Zoom Out',
          icon: ZoomOut,
          shortcut: '⌘-',
          action: () => {
            document.body.style.zoom = `${Number.parseFloat(document.body.style.zoom || '1') * 0.9}`;
          },
        },
        {
          label: 'Reset Zoom',
          shortcut: '⌘0',
          action: () => {
            document.body.style.zoom = '1';
          },
        },
        { separator: true },
        {
          label: 'Toggle Fullscreen',
          shortcut: '⌃⌘F',
          action: () => {
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen();
            }
          },
        },
        {
          label: 'Theme',
          icon: Palette,
          submenu: [
            {
              label: 'Light',
              action: () => {
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
              },
            },
            {
              label: 'Dark',
              action: () => {
                document.documentElement.classList.remove('light');
                document.documentElement.classList.add('dark');
              },
            },
            {
              label: 'System',
              action: () => {
                document.documentElement.classList.remove('light', 'dark');
              },
            },
          ],
        },
      ],
    },
    {
      label: 'Go',
      items: [
        {
          label: 'Home',
          icon: Home,
          shortcut: '⌘1',
          action: () => router.push('/'),
        },
        {
          label: 'Blog',
          icon: BookOpen,
          shortcut: '⌘2',
          action: () => router.push('/blog'),
        },
        {
          label: 'Research',
          icon: FlaskConical,
          shortcut: '⌘3',
          action: () => router.push('/research'),
        },
        {
          label: 'Contact',
          icon: Mail,
          shortcut: '⌘4',
          action: () => router.push('/contact'),
        },
        { separator: true },
        { label: 'Back', shortcut: '⌘[', action: () => window.history.back() },
        {
          label: 'Forward',
          shortcut: '⌘]',
          action: () => window.history.forward(),
        },
      ],
    },
    {
      label: 'Tools',
      items: [
        {
          label: 'Developer Tools',
          icon: Terminal,
          shortcut: '⌥⌘I',
          action: () => {
            const tauriWindow = getTauriWindow();
            if (tauriWindow) {
              tauriWindow.emit('toggle-devtools');
            }
          },
        },
        {
          label: 'Database Manager',
          icon: Database,
          action: () => console.log('Database'),
        },
        {
          label: 'API Explorer',
          icon: Globe,
          action: () => console.log('API Explorer'),
        },
        { separator: true },
        {
          label: 'Security Settings',
          icon: Shield,
          action: () => router.push('/settings/security'),
        },
      ],
    },
    {
      label: 'Window',
      items: [
        {
          label: 'Minimize',
          shortcut: '⌘M',
          action: () => {
            const tauriWindow = getTauriWindow();
            if (tauriWindow) {
              tauriWindow.minimize();
            }
          },
        },
        {
          label: 'Close',
          shortcut: '⌘W',
          action: () => {
            const tauriWindow = getTauriWindow();
            if (tauriWindow) {
              tauriWindow.close();
            }
          },
        },
        { separator: true },
        {
          label: 'Bring All to Front',
          action: () => console.log('Bring all to front'),
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'Documentation',
          icon: BookOpen,
          action: () => window.open('/docs', '_blank'),
        },
        {
          label: 'Keyboard Shortcuts',
          icon: Keyboard,
          shortcut: '⌘?',
          action: () => console.log('Show shortcuts'),
        },
        { separator: true },
        {
          label: 'Report Issue',
          icon: Bug,
          action: () =>
            window.open('https://github.com/symlog/issues', '_blank'),
        },
        {
          label: 'Feature Request',
          icon: CheckSquare,
          action: () =>
            window.open('https://github.com/symlog/discussions', '_blank'),
        },
        { separator: true },
        {
          label: 'Community',
          icon: Users,
          action: () => window.open('/community', '_blank'),
        },
        {
          label: 'Support',
          icon: MessageSquare,
          action: () => window.open('/support', '_blank'),
        },
        { separator: true },
        {
          label: 'About SYMLog',
          icon: Info,
          action: () => router.push('/about'),
        },
      ],
    },
  ];

  if (!isTauri) {
    return null;
  }

  return (
    <div className="flex h-10 items-center border-border border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center space-x-1">
        {menuBar.map((menu, index) => (
          <DropdownMenu key={menu.label}>
            <DropdownMenuTrigger
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-md px-3 font-medium text-sm transition-colors',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-50',
                'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground'
              )}
              id={`${menu.label.toLowerCase()}-menu`}
            >
              {menu.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              {menu.items.map((item, itemIndex) => {
                if ('separator' in item && item.separator) {
                  return (
                    <DropdownMenuSeparator key={`separator-${itemIndex}`} />
                  );
                }

                if ('submenu' in item && item.submenu) {
                  return (
                    <DropdownMenuSub key={item.label}>
                      <DropdownMenuSubTrigger>
                        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                        {item.label}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {item.submenu.map((subItem, subIndex) => {
                          if ('separator' in subItem && subItem.separator) {
                            return (
                              <DropdownMenuSeparator
                                key={`sub-separator-${subIndex}`}
                              />
                            );
                          }
                          return (
                            <DropdownMenuItem
                              key={
                                'label' in subItem
                                  ? subItem.label
                                  : `sub-item-${subIndex}`
                              }
                              onClick={
                                'action' in subItem ? subItem.action : undefined
                              }
                            >
                              {'icon' in subItem && subItem.icon && (
                                <subItem.icon className="mr-2 h-4 w-4" />
                              )}
                              {'label' in subItem && subItem.label}
                              {'shortcut' in subItem && subItem.shortcut && (
                                <DropdownMenuShortcut>
                                  {subItem.shortcut}
                                </DropdownMenuShortcut>
                              )}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  );
                }

                return (
                  <DropdownMenuItem
                    key={'label' in item ? item.label : `item-${itemIndex}`}
                    onClick={'action' in item ? item.action : undefined}
                  >
                    {'icon' in item && item.icon && (
                      <item.icon className="mr-2 h-4 w-4" />
                    )}
                    {'label' in item && item.label}
                    {'shortcut' in item && item.shortcut && (
                      <DropdownMenuShortcut>
                        {item.shortcut}
                      </DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>

      {/* Show current page */}
      <div className="ml-auto flex items-center space-x-2">
        <span className="text-muted-foreground text-xs">
          {pathname === '/'
            ? 'Home'
            : pathname === '/blog'
              ? 'Blog'
              : pathname === '/research'
                ? 'Research'
                : pathname === '/contact'
                  ? 'Contact'
                  : pathname}
        </span>
      </div>
    </div>
  );
}
