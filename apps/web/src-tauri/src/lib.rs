use std::env;
use tauri::Manager;

#[cfg(target_os = "linux")]
use std::process::Command;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  // Initialize GTK properly for Linux environments
  #[cfg(target_os = "linux")]
  {
    // Check if we're in WSL2
    if env::var("WSL_DISTRO_NAME").is_ok() {
      // Check for WSLg (Windows 11)
      if env::var("WAYLAND_DISPLAY").is_ok() || std::fs::metadata("/tmp/.X11-unix/X0").is_ok() {
        // WSLg uses local display :0
        env::set_var("DISPLAY", ":0");
      } else if env::var("DISPLAY").is_err() {
        // Windows 10: Set display to host IP
        if let Ok(output) = Command::new("grep")
          .args(&["nameserver", "/etc/resolv.conf"])
          .output()
        {
          if let Ok(content) = String::from_utf8(output.stdout) {
            if let Some(line) = content.lines().find(|l| l.contains("nameserver")) {
              if let Some(ip) = line.split_whitespace().nth(1) {
                env::set_var("DISPLAY", format!("{}:0", ip));
              }
            }
          }
        }
      }
      
      // WSL2-specific GTK settings
      env::set_var("GDK_BACKEND", "x11");
      env::set_var("NO_AT_BRIDGE", "1");
    }
    
    // Initialize GTK before Tauri
    if let Err(e) = gtk::init() {
      eprintln!("Failed to initialize GTK: {}", e);
      eprintln!("Please ensure X server is running and DISPLAY is set correctly.");
      std::process::exit(1);
    }
  }

  tauri::Builder::default()
    .setup(|app| {
      // Create and set menu on the main window
      let main_window = app.get_webview_window("main").unwrap();
      let menu = create_app_menu(&app.handle())?;
      main_window.set_menu(menu)?;

      // Handle menu events
      main_window.on_menu_event(move |window, event| {
        let webview_window = window.get_webview_window("main").unwrap();
        handle_menu_event(&webview_window, event.id.as_ref());
      });

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn create_app_menu(app: &tauri::AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, Box<dyn std::error::Error>> {
  use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};

  // File menu items
  let new_file = MenuItemBuilder::with_id("new_file", "New File")
    .accelerator("CmdOrCtrl+N")
    .build(app)?;
  let new_window = MenuItemBuilder::with_id("new_window", "New Window")
    .accelerator("CmdOrCtrl+Shift+N")
    .build(app)?;
  let open_file = MenuItemBuilder::with_id("open_file", "Open...")
    .accelerator("CmdOrCtrl+O")
    .build(app)?;
  let save = MenuItemBuilder::with_id("save", "Save")
    .accelerator("CmdOrCtrl+S")
    .build(app)?;
  let save_as = MenuItemBuilder::with_id("save_as", "Save As...")
    .accelerator("CmdOrCtrl+Shift+S")
    .build(app)?;
  let quit = MenuItemBuilder::with_id("quit", "Quit")
    .accelerator("CmdOrCtrl+Q")
    .build(app)?;

  let file_menu = SubmenuBuilder::new(app, "File")
    .item(&new_file)
    .item(&new_window)
    .separator()
    .item(&open_file)
    .separator()
    .item(&save)
    .item(&save_as)
    .separator()
    .item(&quit)
    .build()?;

  // Edit menu items
  let undo = MenuItemBuilder::with_id("undo", "Undo")
    .accelerator("CmdOrCtrl+Z")
    .build(app)?;
  let redo = MenuItemBuilder::with_id("redo", "Redo")
    .accelerator("CmdOrCtrl+Shift+Z")
    .build(app)?;
  let cut = MenuItemBuilder::with_id("cut", "Cut")
    .accelerator("CmdOrCtrl+X")
    .build(app)?;
  let copy = MenuItemBuilder::with_id("copy", "Copy")
    .accelerator("CmdOrCtrl+C")
    .build(app)?;
  let paste = MenuItemBuilder::with_id("paste", "Paste")
    .accelerator("CmdOrCtrl+V")
    .build(app)?;
  let select_all = MenuItemBuilder::with_id("select_all", "Select All")
    .accelerator("CmdOrCtrl+A")
    .build(app)?;
  let find = MenuItemBuilder::with_id("find", "Find")
    .accelerator("CmdOrCtrl+F")
    .build(app)?;
  let replace = MenuItemBuilder::with_id("replace", "Replace")
    .accelerator("CmdOrCtrl+Shift+F")
    .build(app)?;

  let edit_menu = SubmenuBuilder::new(app, "Edit")
    .item(&undo)
    .item(&redo)
    .separator()
    .item(&cut)
    .item(&copy)
    .item(&paste)
    .item(&select_all)
    .separator()
    .item(&find)
    .item(&replace)
    .build()?;

  // View menu items
  let reload = MenuItemBuilder::with_id("reload", "Reload")
    .accelerator("CmdOrCtrl+R")
    .build(app)?;
  let force_reload = MenuItemBuilder::with_id("force_reload", "Force Reload")
    .accelerator("CmdOrCtrl+Shift+R")
    .build(app)?;
  let zoom_in = MenuItemBuilder::with_id("zoom_in", "Zoom In")
    .accelerator("CmdOrCtrl+Plus")
    .build(app)?;
  let zoom_out = MenuItemBuilder::with_id("zoom_out", "Zoom Out")
    .accelerator("CmdOrCtrl+Minus")
    .build(app)?;
  let reset_zoom = MenuItemBuilder::with_id("reset_zoom", "Reset Zoom")
    .accelerator("CmdOrCtrl+0")
    .build(app)?;
  let toggle_fullscreen = MenuItemBuilder::with_id("toggle_fullscreen", "Toggle Fullscreen")
    .accelerator("F11")
    .build(app)?;
  let toggle_devtools = MenuItemBuilder::with_id("toggle_devtools", "Developer Tools")
    .accelerator("CmdOrCtrl+Shift+I")
    .build(app)?;

  let view_menu = SubmenuBuilder::new(app, "View")
    .item(&reload)
    .item(&force_reload)
    .separator()
    .item(&zoom_in)
    .item(&zoom_out)
    .item(&reset_zoom)
    .separator()
    .item(&toggle_fullscreen)
    .separator()
    .item(&toggle_devtools)
    .build()?;

  // Chat menu items
  let new_chat = MenuItemBuilder::with_id("new_chat", "New Chat")
    .accelerator("CmdOrCtrl+T")
    .build(app)?;
  let chat_history = MenuItemBuilder::with_id("chat_history", "Chat History")
    .accelerator("CmdOrCtrl+H")
    .build(app)?;
  let voice_chat = MenuItemBuilder::with_id("voice_chat", "Voice Chat")
    .accelerator("CmdOrCtrl+Shift+V")
    .build(app)?;
  let send_message = MenuItemBuilder::with_id("send_message", "Send Message")
    .accelerator("CmdOrCtrl+Enter")
    .build(app)?;

  let chat_menu = SubmenuBuilder::new(app, "Chat")
    .item(&new_chat)
    .item(&chat_history)
    .separator()
    .item(&voice_chat)
    .separator()
    .item(&send_message)
    .build()?;

  // Tools menu items
  let settings = MenuItemBuilder::with_id("settings", "Settings")
    .accelerator("CmdOrCtrl+Comma")
    .build(app)?;
  let api_explorer = MenuItemBuilder::with_id("api_explorer", "API Explorer")
    .build(app)?;
  let database_manager = MenuItemBuilder::with_id("database_manager", "Database Manager")
    .build(app)?;
  let extensions = MenuItemBuilder::with_id("extensions", "Extensions")
    .build(app)?;

  let tools_menu = SubmenuBuilder::new(app, "Tools")
    .item(&settings)
    .separator()
    .item(&api_explorer)
    .item(&database_manager)
    .separator()
    .item(&extensions)
    .build()?;

  // Window menu items
  let minimize = MenuItemBuilder::with_id("minimize", "Minimize")
    .accelerator("CmdOrCtrl+M")
    .build(app)?;
  let close_window = MenuItemBuilder::with_id("close_window", "Close Window")
    .accelerator("CmdOrCtrl+W")
    .build(app)?;

  let window_menu = SubmenuBuilder::new(app, "Window")
    .item(&minimize)
    .item(&close_window)
    .build()?;

  // Help menu items
  let documentation = MenuItemBuilder::with_id("documentation", "Documentation")
    .build(app)?;
  let keyboard_shortcuts = MenuItemBuilder::with_id("keyboard_shortcuts", "Keyboard Shortcuts")
    .accelerator("CmdOrCtrl+/")
    .build(app)?;
  let report_issue = MenuItemBuilder::with_id("report_issue", "Report Issue")
    .build(app)?;
  let about = MenuItemBuilder::with_id("about", "About SYMLog")
    .build(app)?;

  let help_menu = SubmenuBuilder::new(app, "Help")
    .item(&documentation)
    .item(&keyboard_shortcuts)
    .separator()
    .item(&report_issue)
    .separator()
    .item(&about)
    .build()?;

  // Build the menu bar
  let menu = MenuBuilder::new(app)
    .item(&file_menu)
    .item(&edit_menu)
    .item(&view_menu)
    .item(&chat_menu)
    .item(&tools_menu)
    .item(&window_menu)
    .item(&help_menu)
    .build()?;

  Ok(menu)
}

fn handle_menu_event(window: &tauri::WebviewWindow, menu_id: &str) {
  match menu_id {
    // File menu handlers
    "new_file" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'new_file' } }))");
    }
    "new_window" => {
      let app_handle = window.app_handle();
      let _ = tauri::WebviewWindowBuilder::new(app_handle, "new_window", tauri::WebviewUrl::App("index.html".into()))
        .build();
    }
    "open_file" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'open_file' } }))");
    }
    "save" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'save' } }))");
    }
    "save_as" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'save_as' } }))");
    }
    "quit" => {
      std::process::exit(0);
    }
    
    // Edit menu handlers
    "undo" => {
      let _ = window.eval("document.execCommand('undo')");
    }
    "redo" => {
      let _ = window.eval("document.execCommand('redo')");
    }
    "cut" => {
      let _ = window.eval("document.execCommand('cut')");
    }
    "copy" => {
      let _ = window.eval("document.execCommand('copy')");
    }
    "paste" => {
      let _ = window.eval("document.execCommand('paste')");
    }
    "select_all" => {
      let _ = window.eval("document.execCommand('selectAll')");
    }
    "find" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'find' } }))");
    }
    "replace" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'replace' } }))");
    }
    
    // View menu handlers
    "reload" => {
      let _ = window.eval("window.location.reload()");
    }
    "force_reload" => {
      let _ = window.eval("window.location.reload(true)");
    }
    "zoom_in" => {
      let _ = window.eval("document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) * 1.1).toString()");
    }
    "zoom_out" => {
      let _ = window.eval("document.body.style.zoom = (parseFloat(document.body.style.zoom || 1) * 0.9).toString()");
    }
    "reset_zoom" => {
      let _ = window.eval("document.body.style.zoom = '1'");
    }
    "toggle_fullscreen" => {
      let _ = window.set_fullscreen(!window.is_fullscreen().unwrap_or(false));
    }
    "toggle_devtools" => {
      #[cfg(debug_assertions)]
      {
        window.open_devtools();
      }
    }
    
    // Chat menu handlers
    "new_chat" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'new_chat' } }))");
    }
    "chat_history" => {
      let _ = window.eval("window.location.href = '/chat/history'");
    }
    "voice_chat" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'voice_chat' } }))");
    }
    "send_message" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'send_message' } }))");
    }
    
    // Tools menu handlers
    "settings" => {
      let _ = window.eval("window.location.href = '/settings'");
    }
    "api_explorer" => {
      let _ = window.eval("window.location.href = '/api-explorer'");
    }
    "database_manager" => {
      let _ = window.eval("window.location.href = '/database'");
    }
    "extensions" => {
      let _ = window.eval("window.location.href = '/extensions'");
    }
    
    // Window menu handlers
    "minimize" => {
      let _ = window.minimize();
    }
    "close_window" => {
      let _ = window.close();
    }
    
    // Help menu handlers
    "documentation" => {
      let _ = window.eval("window.open('/docs', '_blank')");
    }
    "keyboard_shortcuts" => {
      let _ = window.eval("window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'show_shortcuts' } }))");
    }
    "report_issue" => {
      let _ = window.eval("window.open('https://github.com/symlog/issues', '_blank')");
    }
    "about" => {
      let _ = window.eval("window.location.href = '/about'");
    }
    
    _ => {}
  }
}