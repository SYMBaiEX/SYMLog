'use client';

import {
  Activity,
  AlignCenter,
  AlignLeft,
  AlignRight,
  BarChart,
  Bold,
  BookOpen,
  Bot,
  Brain,
  Bug,
  CheckSquare,
  ChevronDown,
  Clipboard,
  Clock,
  Code,
  Columns,
  Command,
  Copy,
  Database,
  Download,
  Edit,
  Eye,
  FileJson,
  FileText,
  Filter,
  FlaskConical,
  Globe,
  Grid,
  HelpCircle,
  Home,
  Image,
  Info,
  Italic,
  Keyboard,
  Laptop,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  Mail,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  Palette,
  PieChart,
  Printer,
  Quote,
  Redo,
  RefreshCw,
  Save,
  Scissors,
  Search,
  Send,
  Settings,
  Shield,
  Smartphone,
  SortAsc,
  SortDesc,
  Sparkles,
  Sun,
  Table,
  Tablet,
  Terminal,
  TrendingUp,
  Type,
  Underline,
  Undo,
  Upload,
  Users,
  Video,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import * as React from 'react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type MenuItem =
  | {
      label: string;
      icon?: React.ElementType;
      shortcut?: string;
      action?: () => void;
      submenu?: MenuItem[];
    }
  | {
      separator: true;
    };

interface MenuBarItem {
  label: string;
  items: MenuItem[];
}

export function AppMenuBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isTauri, setIsTauri] = React.useState(false);
  const [viewOptions, setViewOptions] = React.useState({
    sidebar: true,
    statusBar: true,
    minimap: false,
  });
  const [zoomLevel, setZoomLevel] = React.useState('100%');

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
            if (e.shiftKey) {
              console.log('Save as');
            } else {
              console.log('Save file');
            }
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              document.execCommand('redo');
            } else {
              document.execCommand('undo');
            }
            break;
          case 'x':
            e.preventDefault();
            document.execCommand('cut');
            break;
          case 'c':
            e.preventDefault();
            document.execCommand('copy');
            break;
          case 'v':
            e.preventDefault();
            document.execCommand('paste');
            break;
          case 'a':
            e.preventDefault();
            document.execCommand('selectAll');
            break;
          case 'f':
            e.preventDefault();
            console.log('Find');
            break;
          case 'r':
            if (!e.shiftKey) {
              e.preventDefault();
              window.location.reload();
            }
            break;
          case '=':
          case '+':
            e.preventDefault();
            handleZoom('in');
            break;
          case '-':
            e.preventDefault();
            handleZoom('out');
            break;
          case '0':
            e.preventDefault();
            handleZoom('reset');
            break;
          case ',':
            e.preventDefault();
            router.push('/settings');
            break;
          case '/':
            e.preventDefault();
            console.log('Show shortcuts');
            break;
        }
      }

      // Alt-based menu activation
      if (e.altKey) {
        const menuAccessKeys: Record<string, string> = {
          f: 'file-menu',
          e: 'edit-menu',
          v: 'view-menu',
          c: 'chat-menu',
          a: 'analyze-menu',
          t: 'tools-menu',
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

  const handleZoom = (action: 'in' | 'out' | 'reset') => {
    let newZoom = 1;
    const currentZoom = Number.parseFloat(document.body.style.zoom || '1');

    switch (action) {
      case 'in':
        newZoom = Math.min(currentZoom * 1.1, 2);
        break;
      case 'out':
        newZoom = Math.max(currentZoom * 0.9, 0.5);
        break;
      case 'reset':
        newZoom = 1;
        break;
    }

    document.body.style.zoom = newZoom.toString();
    setZoomLevel(`${Math.round(newZoom * 100)}%`);
  };

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
          label: 'New Window',
          shortcut: '⇧⌘N',
          action: () => window.open(window.location.href, '_blank'),
        },
        { separator: true },
        {
          label: 'Open...',
          icon: FileJson,
          shortcut: '⌘O',
          action: () => console.log('Open file'),
        },
        {
          label: 'Open Recent',
          icon: Clock,
          submenu: [
            {
              label: 'research-notes.md',
              action: () => console.log('Open recent 1'),
            },
            {
              label: 'blog-draft.md',
              action: () => console.log('Open recent 2'),
            },
            {
              label: 'api-docs.json',
              action: () => console.log('Open recent 3'),
            },
            { separator: true },
            {
              label: 'Clear Recent Files',
              action: () => console.log('Clear recent'),
            },
          ],
        },
        { separator: true },
        {
          label: 'Save',
          icon: Save,
          shortcut: '⌘S',
          action: () => console.log('Save'),
        },
        {
          label: 'Save As...',
          shortcut: '⇧⌘S',
          action: () => console.log('Save as'),
        },
        {
          label: 'Export',
          icon: Download,
          submenu: [
            { label: 'Export as PDF', action: () => console.log('Export PDF') },
            {
              label: 'Export as Markdown',
              action: () => console.log('Export MD'),
            },
            {
              label: 'Export as HTML',
              action: () => console.log('Export HTML'),
            },
          ],
        },
        { separator: true },
        { label: 'Import', icon: Upload, action: () => console.log('Import') },
        {
          label: 'Print',
          icon: Printer,
          shortcut: '⌘P',
          action: () => window.print(),
        },
        { separator: true },
        {
          label: 'Settings',
          icon: Settings,
          shortcut: '⌘,',
          action: () => router.push('/settings'),
        },
      ],
    },
    {
      label: 'Edit',
      items: [
        {
          label: 'Undo',
          icon: Undo,
          shortcut: '⌘Z',
          action: () => document.execCommand('undo'),
        },
        {
          label: 'Redo',
          icon: Redo,
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
        {
          label: 'Select All',
          shortcut: '⌘A',
          action: () => document.execCommand('selectAll'),
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
        {
          label: 'Find in Files',
          shortcut: '⇧⌘F',
          action: () => console.log('Find in files'),
        },
        { separator: true },
        {
          label: 'Format',
          icon: Type,
          submenu: [
            {
              label: 'Bold',
              icon: Bold,
              shortcut: '⌘B',
              action: () => document.execCommand('bold'),
            },
            {
              label: 'Italic',
              icon: Italic,
              shortcut: '⌘I',
              action: () => document.execCommand('italic'),
            },
            {
              label: 'Underline',
              icon: Underline,
              shortcut: '⌘U',
              action: () => document.execCommand('underline'),
            },
            { separator: true },
            {
              label: 'Align Left',
              icon: AlignLeft,
              action: () => document.execCommand('justifyLeft'),
            },
            {
              label: 'Align Center',
              icon: AlignCenter,
              action: () => document.execCommand('justifyCenter'),
            },
            {
              label: 'Align Right',
              icon: AlignRight,
              action: () => document.execCommand('justifyRight'),
            },
          ],
        },
        {
          label: 'Insert',
          submenu: [
            {
              label: 'Link',
              icon: Link2,
              shortcut: '⌘K',
              action: () => console.log('Insert link'),
            },
            {
              label: 'Image',
              icon: Image,
              action: () => console.log('Insert image'),
            },
            {
              label: 'Code Block',
              icon: Code,
              action: () => console.log('Insert code'),
            },
            {
              label: 'Table',
              icon: Table,
              action: () => console.log('Insert table'),
            },
            { separator: true },
            {
              label: 'Bullet List',
              icon: List,
              action: () => console.log('Insert list'),
            },
            {
              label: 'Numbered List',
              icon: ListOrdered,
              action: () => console.log('Insert numbered list'),
            },
            {
              label: 'Quote',
              icon: Quote,
              action: () => console.log('Insert quote'),
            },
          ],
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
        {
          label: 'Force Reload',
          shortcut: '⇧⌘R',
          action: () => {
            if ('caches' in window) {
              caches.keys().then((names) => {
                names.forEach((name) => caches.delete(name));
              });
            }
            window.location.reload();
          },
        },
        { separator: true },
        {
          label: 'Zoom In',
          icon: ZoomIn,
          shortcut: '⌘+',
          action: () => handleZoom('in'),
        },
        {
          label: 'Zoom Out',
          icon: ZoomOut,
          shortcut: '⌘-',
          action: () => handleZoom('out'),
        },
        {
          label: 'Reset Zoom',
          shortcut: '⌘0',
          action: () => handleZoom('reset'),
        },
        {
          label: 'Zoom Level',
          icon: Eye,
          submenu: [
            {
              label: '50%',
              action: () => {
                document.body.style.zoom = '0.5';
                setZoomLevel('50%');
              },
            },
            {
              label: '75%',
              action: () => {
                document.body.style.zoom = '0.75';
                setZoomLevel('75%');
              },
            },
            {
              label: '100%',
              action: () => {
                document.body.style.zoom = '1';
                setZoomLevel('100%');
              },
            },
            {
              label: '125%',
              action: () => {
                document.body.style.zoom = '1.25';
                setZoomLevel('125%');
              },
            },
            {
              label: '150%',
              action: () => {
                document.body.style.zoom = '1.5';
                setZoomLevel('150%');
              },
            },
            {
              label: '200%',
              action: () => {
                document.body.style.zoom = '2';
                setZoomLevel('200%');
              },
            },
          ],
        },
        { separator: true },
        {
          label: 'Theme',
          icon: Palette,
          submenu: [
            { label: 'Light', icon: Sun, action: () => setTheme('light') },
            { label: 'Dark', icon: Moon, action: () => setTheme('dark') },
            {
              label: 'System',
              icon: Monitor,
              action: () => setTheme('system'),
            },
          ],
        },
        {
          label: 'Layout',
          icon: LayoutGrid,
          submenu: [
            {
              label: 'Grid View',
              icon: Grid,
              action: () => console.log('Grid view'),
            },
            {
              label: 'List View',
              icon: List,
              action: () => console.log('List view'),
            },
            {
              label: 'Columns',
              icon: Columns,
              action: () => console.log('Columns view'),
            },
          ],
        },
        { separator: true },
        {
          label: 'Device Preview',
          submenu: [
            {
              label: 'Desktop',
              icon: Monitor,
              action: () => console.log('Desktop preview'),
            },
            {
              label: 'Tablet',
              icon: Tablet,
              action: () => console.log('Tablet preview'),
            },
            {
              label: 'Mobile',
              icon: Smartphone,
              action: () => console.log('Mobile preview'),
            },
          ],
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
      ],
    },
    {
      label: 'Chat',
      items: [
        {
          label: 'New Chat',
          icon: MessageSquare,
          shortcut: '⌘N',
          action: () => console.log('New chat'),
        },
        {
          label: 'Chat History',
          icon: Clock,
          shortcut: '⌘H',
          action: () => console.log('Chat history'),
        },
        { separator: true },
        {
          label: 'Voice Chat',
          icon: Mic,
          shortcut: '⌘⇧V',
          action: () => console.log('Voice chat'),
        },
        {
          label: 'Video Chat',
          icon: Video,
          shortcut: '⌘⇧C',
          action: () => console.log('Video chat'),
        },
        { separator: true },
        {
          label: 'AI Assistant',
          icon: Bot,
          submenu: [
            {
              label: 'Ask Question',
              icon: HelpCircle,
              action: () => console.log('Ask AI'),
            },
            {
              label: 'Generate Code',
              icon: Code,
              action: () => console.log('Generate code'),
            },
            {
              label: 'Explain Code',
              icon: Info,
              action: () => console.log('Explain code'),
            },
            {
              label: 'Suggest Improvements',
              icon: Sparkles,
              action: () => console.log('Suggest improvements'),
            },
          ],
        },
        {
          label: 'Send Message',
          icon: Send,
          shortcut: '⌘Enter',
          action: () => console.log('Send message'),
        },
        { separator: true },
        {
          label: 'Chat Settings',
          icon: Settings,
          action: () => router.push('/settings/chat'),
        },
      ],
    },
    {
      label: 'Analyze',
      items: [
        {
          label: 'Code Analysis',
          icon: Code,
          shortcut: '⌘⇧A',
          action: () => console.log('Analyze code'),
        },
        {
          label: 'Performance',
          icon: Zap,
          action: () => console.log('Performance analysis'),
        },
        {
          label: 'Security Scan',
          icon: Shield,
          action: () => console.log('Security scan'),
        },
        { separator: true },
        {
          label: 'Metrics',
          icon: BarChart,
          submenu: [
            {
              label: 'Usage Statistics',
              icon: Activity,
              action: () => console.log('Usage stats'),
            },
            {
              label: 'Performance Metrics',
              icon: TrendingUp,
              action: () => console.log('Performance metrics'),
            },
            {
              label: 'Error Tracking',
              icon: Bug,
              action: () => console.log('Error tracking'),
            },
          ],
        },
        {
          label: 'Reports',
          icon: FileText,
          submenu: [
            {
              label: 'Daily Report',
              action: () => console.log('Daily report'),
            },
            {
              label: 'Weekly Report',
              action: () => console.log('Weekly report'),
            },
            {
              label: 'Monthly Report',
              action: () => console.log('Monthly report'),
            },
            {
              label: 'Custom Report',
              action: () => console.log('Custom report'),
            },
          ],
        },
        { separator: true },
        {
          label: 'Data Visualization',
          icon: PieChart,
          action: () => console.log('Data viz'),
        },
        {
          label: 'Export Analytics',
          icon: Download,
          action: () => console.log('Export analytics'),
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
          action: () => console.log('Dev tools'),
        },
        {
          label: 'Console',
          icon: Terminal,
          shortcut: '⌥⌘C',
          action: () => console.log('Console'),
        },
        { separator: true },
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
        {
          label: 'Network Monitor',
          icon: Activity,
          action: () => console.log('Network monitor'),
        },
        { separator: true },
        {
          label: 'Extensions',
          icon: Sparkles,
          action: () => router.push('/extensions'),
        },
        {
          label: 'Integrations',
          icon: Link2,
          action: () => router.push('/integrations'),
        },
        { separator: true },
        {
          label: 'Import/Export',
          submenu: [
            {
              label: 'Import Data',
              icon: Upload,
              action: () => console.log('Import data'),
            },
            {
              label: 'Export Data',
              icon: Download,
              action: () => console.log('Export data'),
            },
            {
              label: 'Backup',
              icon: Save,
              action: () => console.log('Backup'),
            },
            {
              label: 'Restore',
              icon: RefreshCw,
              action: () => console.log('Restore'),
            },
          ],
        },
      ],
    },
    {
      label: 'Help',
      items: [
        {
          label: 'Documentation',
          icon: BookOpen,
          shortcut: '⌘?',
          action: () => window.open('/docs', '_blank'),
        },
        {
          label: 'Getting Started',
          icon: Sparkles,
          action: () => router.push('/getting-started'),
        },
        {
          label: 'Tutorials',
          icon: Video,
          action: () => router.push('/tutorials'),
        },
        { separator: true },
        {
          label: 'Keyboard Shortcuts',
          icon: Keyboard,
          shortcut: '⌘/',
          action: () => console.log('Show shortcuts'),
        },
        {
          label: 'Command Palette',
          icon: Command,
          shortcut: '⌘K',
          action: () => console.log('Command palette'),
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
          label: 'Check for Updates',
          icon: RefreshCw,
          action: () => console.log('Check updates'),
        },
        {
          label: 'About SYMLog',
          icon: Info,
          action: () => router.push('/about'),
        },
      ],
    },
  ];

  // Don't show web menu bar in Tauri - use native menus instead
  if (isTauri) {
    return null;
  }

  return (
    <div className="flex h-9 items-center border-border border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center space-x-0">
        {menuBar.map((menu) => (
          <DropdownMenu key={menu.label}>
            <DropdownMenuTrigger
              className={cn(
                'inline-flex h-7 items-center justify-center rounded-sm px-3 text-sm transition-colors',
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

      {/* Status indicators */}
      <div className="ml-auto flex items-center space-x-3 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          AI Ready
        </span>
        <span>|</span>
        <span>{zoomLevel}</span>
        <span>|</span>
        <span className="capitalize">{theme || 'system'} theme</span>
      </div>
    </div>
  );
}
