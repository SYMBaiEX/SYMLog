use std::env;
use tauri::{Manager, Emitter, Listener};

mod auth;
mod deep_link;

use auth::{AuthManager, generate_auth_session, handle_auth_callback, clear_auth_session, clear_all_auth_sessions, get_auth_session};
use deep_link::{setup_deep_linking, open_auth_url, register_auth_protocol, get_current_deep_link};

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
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      generate_auth_session,
      handle_auth_callback,
      clear_auth_session,
      clear_all_auth_sessions,
      get_auth_session,
      open_auth_url,
      register_auth_protocol,
      get_current_deep_link
    ])
    .setup(|app| {
      // Initialize auth manager
      let auth_manager = AuthManager::new(app.handle()).expect("Failed to initialize auth manager");
      app.manage(auth_manager);
      
      // Setup deep linking
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        if let Err(e) = setup_deep_linking(&app_handle).await {
          log::error!("Failed to setup deep linking: {}", e);
        }
      });
      
      // Create and set menu on the main window
      let main_window = app.get_webview_window("main").unwrap();
      
      // Store app handle for use in event handler
      let app_handle = app.handle().clone();
      
      // Handle deep link events (symlog:// protocol)
      app.listen("deep-link", move |event| {
        let payload = event.payload();
        println!("Received deep link: {}", payload);
        // The payload should contain the symlog:// URL
        if let Ok(url) = serde_json::from_str::<String>(payload) {
          if url.starts_with("symlog://auth") {
            // Extract auth code from URL
            if let Some(code_start) = url.find("code=") {
              let code = &url[code_start + 5..];
              // Remove any additional query parameters
              let auth_code = if let Some(amp_pos) = code.find('&') {
                &code[..amp_pos]
              } else {
                code
              };
              
              println!("Extracted auth code: {}", auth_code);
              
              // Emit event to frontend with the auth code
              if let Err(e) = app_handle.emit("auth-code-received", auth_code) {
                eprintln!("Failed to emit auth code event: {}", e);
              }
            }
          }
        }
      });
      
      // Apply window effects for a futuristic look
      #[cfg(target_os = "macos")]
      {
        use tauri::window::{Effect, EffectState};
        // macOS vibrancy effect
        let _ = main_window.set_effects(tauri::utils::config::WindowEffectsConfig {
          effects: vec![Effect::Vibrancy],
          state: Some(EffectState::Active),
          radius: Some(10.0),
          color: Some(tauri::window::Color(0, 0, 0, 0)),
        });
      }
      
      #[cfg(target_os = "windows")]
      {
        use tauri::window::{Effect, EffectState};
        // Windows acrylic/blur effect
        let _ = main_window.set_effects(tauri::utils::config::WindowEffectsConfig {
          effects: vec![Effect::Acrylic],
          state: Some(EffectState::Active),
          radius: Some(10.0),
          color: Some(tauri::window::Color(10, 10, 10, 180)),
        });
      }
      
      // Set window shadow for depth
      let _ = main_window.set_shadow(true);
      
      // Add window corners rounding
      #[cfg(any(target_os = "macos", target_os = "windows"))]
      {
        // This creates rounded corners on the window
        let _ = main_window.set_decorations(false);
      }
      
      // Enable drag region for custom title bar
      #[cfg(target_os = "linux")]
      {
        let _ = main_window.set_decorations(false);
      }

      // Add shell plugin for opening external URLs
      app.handle().plugin(tauri_plugin_shell::init())?;
      
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

