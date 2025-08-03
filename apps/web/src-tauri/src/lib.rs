use std::env;

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
