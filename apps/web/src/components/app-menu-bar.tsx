"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { 
  FileText, 
  Edit, 
  Search, 
  Eye, 
  Terminal,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Copy,
  Clipboard,
  Scissors,
  Settings,
  HelpCircle,
  Info,
  Users,
  MessageSquare,
  Bug,
  CheckSquare,
  ChevronDown,
  Command,
  FileJson,
  Globe,
  Database,
  Shield,
  Palette,
  Keyboard,
  Home,
  BookOpen,
  FlaskConical,
  Mail,
  Save,
  Download,
  Upload,
  Printer,
  Undo,
  Redo,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Link2,
  Image,
  Code,
  Table,
  List,
  ListOrdered,
  Quote,
  Mic,
  Video,
  Send,
  Bot,
  Brain,
  Sparkles,
  Zap,
  Activity,
  BarChart,
  PieChart,
  TrendingUp,
  Filter,
  SortAsc,
  SortDesc,
  Columns,
  Grid,
  LayoutGrid,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Clock
} from "lucide-react"
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
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"

type MenuItem = {
  label: string
  icon?: React.ElementType
  shortcut?: string
  action?: () => void
  submenu?: MenuItem[]
} | {
  separator: true
}

interface MenuBarItem {
  label: string
  items: MenuItem[]
}

export function AppMenuBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [isTauri, setIsTauri] = React.useState(false)
  const [viewOptions, setViewOptions] = React.useState({
    sidebar: true,
    statusBar: true,
    minimap: false,
  })
  const [zoomLevel, setZoomLevel] = React.useState("100%")

  React.useEffect(() => {
    // Check if we're running in Tauri
    setIsTauri(typeof window !== "undefined" && "__TAURI__" in window)
  }, [])

  // Keyboard shortcuts handler
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command/Ctrl based shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "n":
            e.preventDefault()
            // console.log("New file")
            break
          case "o":
            e.preventDefault()
            // console.log("Open file")
            break
          case "s":
            e.preventDefault()
            if (e.shiftKey) {
              // console.log("Save as")
            } else {
              // console.log("Save file")
            }
            break
          case "z":
            e.preventDefault()
            if (e.shiftKey) {
              document.execCommand("redo")
            } else {
              document.execCommand("undo")
            }
            break
          case "x":
            e.preventDefault()
            document.execCommand("cut")
            break
          case "c":
            e.preventDefault()
            document.execCommand("copy")
            break
          case "v":
            e.preventDefault()
            document.execCommand("paste")
            break
          case "a":
            e.preventDefault()
            document.execCommand("selectAll")
            break
          case "f":
            e.preventDefault()
            // console.log("Find")
            break
          case "r":
            if (!e.shiftKey) {
              e.preventDefault()
              window.location.reload()
            }
            break
          case "=":
          case "+":
            e.preventDefault()
            handleZoom("in")
            break
          case "-":
            e.preventDefault()
            handleZoom("out")
            break
          case "0":
            e.preventDefault()
            handleZoom("reset")
            break
          case ",":
            e.preventDefault()
            router.push("/settings")
            break
          case "/":
            e.preventDefault()
            // console.log("Show shortcuts")
            break
        }
      }

      // Alt-based menu activation
      if (e.altKey) {
        const menuAccessKeys: Record<string, string> = {
          "f": "file-menu",
          "e": "edit-menu",
          "v": "view-menu",
          "c": "chat-menu",
          "a": "analyze-menu",
          "t": "tools-menu",
          "h": "help-menu"
        }
        
        const menuId = menuAccessKeys[e.key.toLowerCase()]
        if (menuId) {
          e.preventDefault()
          const menuButton = document.getElementById(menuId)
          menuButton?.click()
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [router])

  const handleZoom = (action: "in" | "out" | "reset") => {
    let newZoom = 1
    const currentZoom = parseFloat(document.body.style.zoom || "1")
    
    switch (action) {
      case "in":
        newZoom = Math.min(currentZoom * 1.1, 2)
        break
      case "out":
        newZoom = Math.max(currentZoom * 0.9, 0.5)
        break
      case "reset":
        newZoom = 1
        break
    }
    
    document.body.style.zoom = newZoom.toString()
    setZoomLevel(`${Math.round(newZoom * 100)}%`)
  }

  const menuBar: MenuBarItem[] = [
    {
      label: "File",
      items: [
        { label: "New File", icon: FileText, shortcut: "⌘N", action: () => {} },
        { label: "New Window", shortcut: "⇧⌘N", action: () => window.open(window.location.href, "_blank") },
        { separator: true },
        { label: "Open...", icon: FileJson, shortcut: "⌘O", action: () => {} },
        { label: "Open Recent", icon: Clock, submenu: [
          { label: "research-notes.md", action: () => {} },
          { label: "blog-draft.md", action: () => {} },
          { label: "api-docs.json", action: () => {} },
          { separator: true },
          { label: "Clear Recent Files", action: () => {} },
        ]},
        { separator: true },
        { label: "Save", icon: Save, shortcut: "⌘S", action: () => {} },
        { label: "Save As...", shortcut: "⇧⌘S", action: () => {} },
        { label: "Export", icon: Download, submenu: [
          { label: "Export as PDF", action: () => {} },
          { label: "Export as Markdown", action: () => {} },
          { label: "Export as HTML", action: () => {} },
        ]},
        { separator: true },
        { label: "Import", icon: Upload, action: () => {} },
        { label: "Print", icon: Printer, shortcut: "⌘P", action: () => window.print() },
        { separator: true },
        { label: "Settings", icon: Settings, shortcut: "⌘,", action: () => router.push("/settings") },
      ]
    },
    {
      label: "Edit",
      items: [
        { label: "Undo", icon: Undo, shortcut: "⌘Z", action: () => document.execCommand("undo") },
        { label: "Redo", icon: Redo, shortcut: "⇧⌘Z", action: () => document.execCommand("redo") },
        { separator: true },
        { label: "Cut", icon: Scissors, shortcut: "⌘X", action: () => document.execCommand("cut") },
        { label: "Copy", icon: Copy, shortcut: "⌘C", action: () => document.execCommand("copy") },
        { label: "Paste", icon: Clipboard, shortcut: "⌘V", action: () => document.execCommand("paste") },
        { label: "Select All", shortcut: "⌘A", action: () => document.execCommand("selectAll") },
        { separator: true },
        { label: "Find", icon: Search, shortcut: "⌘F", action: () => {} },
        { label: "Replace", shortcut: "⌥⌘F", action: () => {} },
        { label: "Find in Files", shortcut: "⇧⌘F", action: () => {} },
        { separator: true },
        { label: "Format", icon: Type, submenu: [
          { label: "Bold", icon: Bold, shortcut: "⌘B", action: () => document.execCommand("bold") },
          { label: "Italic", icon: Italic, shortcut: "⌘I", action: () => document.execCommand("italic") },
          { label: "Underline", icon: Underline, shortcut: "⌘U", action: () => document.execCommand("underline") },
          { separator: true },
          { label: "Align Left", icon: AlignLeft, action: () => document.execCommand("justifyLeft") },
          { label: "Align Center", icon: AlignCenter, action: () => document.execCommand("justifyCenter") },
          { label: "Align Right", icon: AlignRight, action: () => document.execCommand("justifyRight") },
        ]},
        { label: "Insert", submenu: [
          { label: "Link", icon: Link2, shortcut: "⌘K", action: () => {} },
          { label: "Image", icon: Image, action: () => {} },
          { label: "Code Block", icon: Code, action: () => {} },
          { label: "Table", icon: Table, action: () => {} },
          { separator: true },
          { label: "Bullet List", icon: List, action: () => {} },
          { label: "Numbered List", icon: ListOrdered, action: () => {} },
          { label: "Quote", icon: Quote, action: () => {} },
        ]},
      ]
    },
    {
      label: "View",
      items: [
        { label: "Reload", icon: RefreshCw, shortcut: "⌘R", action: () => window.location.reload() },
        { label: "Force Reload", shortcut: "⇧⌘R", action: () => {
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => caches.delete(name))
            })
          }
          window.location.reload()
        }},
        { separator: true },
        { label: "Zoom In", icon: ZoomIn, shortcut: "⌘+", action: () => handleZoom("in") },
        { label: "Zoom Out", icon: ZoomOut, shortcut: "⌘-", action: () => handleZoom("out") },
        { label: "Reset Zoom", shortcut: "⌘0", action: () => handleZoom("reset") },
        { label: "Zoom Level", icon: Eye, submenu: [
          { label: "50%", action: () => { document.body.style.zoom = "0.5"; setZoomLevel("50%") }},
          { label: "75%", action: () => { document.body.style.zoom = "0.75"; setZoomLevel("75%") }},
          { label: "100%", action: () => { document.body.style.zoom = "1"; setZoomLevel("100%") }},
          { label: "125%", action: () => { document.body.style.zoom = "1.25"; setZoomLevel("125%") }},
          { label: "150%", action: () => { document.body.style.zoom = "1.5"; setZoomLevel("150%") }},
          { label: "200%", action: () => { document.body.style.zoom = "2"; setZoomLevel("200%") }},
        ]},
        { separator: true },
        { label: "Theme", icon: Palette, submenu: [
          { label: "Light", icon: Sun, action: () => setTheme("light") },
          { label: "Dark", icon: Moon, action: () => setTheme("dark") },
          { label: "System", icon: Monitor, action: () => setTheme("system") },
        ]},
        { label: "Layout", icon: LayoutGrid, submenu: [
          { label: "Grid View", icon: Grid, action: () => {} },
          { label: "List View", icon: List, action: () => {} },
          { label: "Columns", icon: Columns, action: () => {} },
        ]},
        { separator: true },
        { label: "Device Preview", submenu: [
          { label: "Desktop", icon: Monitor, action: () => {} },
          { label: "Tablet", icon: Tablet, action: () => {} },
          { label: "Mobile", icon: Smartphone, action: () => {} },
        ]},
        { separator: true },
        { label: "Toggle Fullscreen", shortcut: "⌃⌘F", action: () => {
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            document.documentElement.requestFullscreen()
          }
        }},
      ]
    },
    {
      label: "Chat",
      items: [
        { label: "New Chat", icon: MessageSquare, shortcut: "⌘N", action: () => {} },
        { label: "Chat History", icon: Clock, shortcut: "⌘H", action: () => {} },
        { separator: true },
        { label: "Voice Chat", icon: Mic, shortcut: "⌘⇧V", action: () => {} },
        { label: "Video Chat", icon: Video, shortcut: "⌘⇧C", action: () => {} },
        { separator: true },
        { label: "AI Assistant", icon: Bot, submenu: [
          { label: "Ask Question", icon: HelpCircle, action: () => {} },
          { label: "Generate Code", icon: Code, action: () => {} },
          { label: "Explain Code", icon: Info, action: () => {} },
          { label: "Suggest Improvements", icon: Sparkles, action: () => {} },
        ]},
        { label: "Send Message", icon: Send, shortcut: "⌘Enter", action: () => {} },
        { separator: true },
        { label: "Chat Settings", icon: Settings, action: () => router.push("/settings/chat") },
      ]
    },
    {
      label: "Analyze",
      items: [
        { label: "Code Analysis", icon: Code, shortcut: "⌘⇧A", action: () => {} },
        { label: "Performance", icon: Zap, action: () => {} },
        { label: "Security Scan", icon: Shield, action: () => {} },
        { separator: true },
        { label: "Metrics", icon: BarChart, submenu: [
          { label: "Usage Statistics", icon: Activity, action: () => {} },
          { label: "Performance Metrics", icon: TrendingUp, action: () => {} },
          { label: "Error Tracking", icon: Bug, action: () => {} },
        ]},
        { label: "Reports", icon: FileText, submenu: [
          { label: "Daily Report", action: () => {} },
          { label: "Weekly Report", action: () => {} },
          { label: "Monthly Report", action: () => {} },
          { label: "Custom Report", action: () => {} },
        ]},
        { separator: true },
        { label: "Data Visualization", icon: PieChart, action: () => {} },
        { label: "Export Analytics", icon: Download, action: () => {} },
      ]
    },
    {
      label: "Tools",
      items: [
        { label: "Developer Tools", icon: Terminal, shortcut: "⌥⌘I", action: () => {} },
        { label: "Console", icon: Terminal, shortcut: "⌥⌘C", action: () => {} },
        { separator: true },
        { label: "Database Manager", icon: Database, action: () => {} },
        { label: "API Explorer", icon: Globe, action: () => {} },
        { label: "Network Monitor", icon: Activity, action: () => {} },
        { separator: true },
        { label: "Extensions", icon: Sparkles, action: () => router.push("/extensions") },
        { label: "Integrations", icon: Link2, action: () => router.push("/integrations") },
        { separator: true },
        { label: "Import/Export", submenu: [
          { label: "Import Data", icon: Upload, action: () => {} },
          { label: "Export Data", icon: Download, action: () => {} },
          { label: "Backup", icon: Save, action: () => {} },
          { label: "Restore", icon: RefreshCw, action: () => {} },
        ]},
      ]
    },
    {
      label: "Help",
      items: [
        { label: "Documentation", icon: BookOpen, shortcut: "⌘?", action: () => window.open("/docs", "_blank") },
        { label: "Getting Started", icon: Sparkles, action: () => router.push("/getting-started") },
        { label: "Tutorials", icon: Video, action: () => router.push("/tutorials") },
        { separator: true },
        { label: "Keyboard Shortcuts", icon: Keyboard, shortcut: "⌘/", action: () => {} },
        { label: "Command Palette", icon: Command, shortcut: "⌘K", action: () => {} },
        { separator: true },
        { label: "Report Issue", icon: Bug, action: () => window.open("https://github.com/symlog/issues", "_blank") },
        { label: "Feature Request", icon: CheckSquare, action: () => window.open("https://github.com/symlog/discussions", "_blank") },
        { separator: true },
        { label: "Community", icon: Users, action: () => window.open("/community", "_blank") },
        { label: "Support", icon: MessageSquare, action: () => window.open("/support", "_blank") },
        { separator: true },
        { label: "Check for Updates", icon: RefreshCw, action: () => {} },
        { label: "About SYMLog", icon: Info, action: () => router.push("/about") },
      ]
    },
  ]

  // Don't show web menu bar in Tauri - use native menus instead
  if (isTauri) {
    return null
  }

  return (
    <div className="flex h-9 items-center border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3">
      <div className="flex items-center space-x-0">
        {menuBar.map((menu) => (
          <DropdownMenu key={menu.label}>
            <DropdownMenuTrigger
              id={`${menu.label.toLowerCase()}-menu`}
              className={cn(
                "inline-flex h-7 items-center justify-center rounded-sm px-3 text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:pointer-events-none disabled:opacity-50",
                "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
              )}
            >
              {menu.label}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              {menu.items.map((item, itemIndex) => {
                if ('separator' in item && item.separator) {
                  return <DropdownMenuSeparator key={`separator-${itemIndex}`} />
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
                            return <DropdownMenuSeparator key={`sub-separator-${subIndex}`} />
                          }
                          return (
                            <DropdownMenuItem
                              key={'label' in subItem ? subItem.label : `sub-item-${subIndex}`}
                              onClick={'action' in subItem ? subItem.action : undefined}
                            >
                              {'icon' in subItem && subItem.icon && <subItem.icon className="mr-2 h-4 w-4" />}
                              {'label' in subItem && subItem.label}
                              {'shortcut' in subItem && subItem.shortcut && (
                                <DropdownMenuShortcut>{subItem.shortcut}</DropdownMenuShortcut>
                              )}
                            </DropdownMenuItem>
                          )
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )
                }

                return (
                  <DropdownMenuItem
                    key={'label' in item ? item.label : `item-${itemIndex}`}
                    onClick={'action' in item ? item.action : undefined}
                  >
                    {'icon' in item && item.icon && <item.icon className="mr-2 h-4 w-4" />}
                    {'label' in item && item.label}
                    {'shortcut' in item && item.shortcut && (
                      <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>

      {/* Status indicators */}
      <div className="ml-auto flex items-center space-x-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Brain className="h-3 w-3" />
          AI Ready
        </span>
        <span>|</span>
        <span>{zoomLevel}</span>
        <span>|</span>
        <span className="capitalize">{theme || "system"} theme</span>
      </div>
    </div>
  )
}