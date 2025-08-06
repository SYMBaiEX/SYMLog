use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Emitter, Manager};
use tauri_plugin_deep_link;
use tauri_plugin_opener;
use url::Url;
use std::collections::HashMap;
use crate::auth::AuthError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepLinkEvent {
    pub url: String,
    pub parsed_params: HashMap<String, String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthCallbackData {
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

pub async fn setup_deep_linking(app: &AppHandle) -> Result<(), AuthError> {
    // Listen for deep link events
    let app_handle = app.clone();
    tauri_plugin_deep_link::onOpenUrl(app, move |urls| {
        for url in urls {
            if let Err(e) = handle_deep_link_url(&app_handle, &url) {
                log::error!("Failed to handle deep link: {}", e);
            }
        }
    });

    Ok(())
}

fn handle_deep_link_url(app: &AppHandle, url: &str) -> Result<(), AuthError> {
    log::info!("Received deep link: {}", url);
    
    let parsed_url = Url::parse(url).map_err(|e| AuthError::InvalidUrl(e.to_string()))?;
    
    // Extract query parameters
    let mut params = HashMap::new();
    for (key, value) in parsed_url.query_pairs() {
        params.insert(key.to_string(), value.to_string());
    }
    
    let deep_link_event = DeepLinkEvent {
        url: url.to_string(),
        parsed_params: params.clone(),
        timestamp: chrono::Utc::now(),
    };
    
    // Check if this is an auth callback
    if parsed_url.path().contains("/auth/callback") || params.contains_key("code") {
        let callback_data = AuthCallbackData {
            code: params.get("code").cloned(),
            state: params.get("state").cloned(),
            error: params.get("error").cloned(),
            error_description: params.get("error_description").cloned(),
        };
        
        // Emit auth callback event to frontend
        app.emit("auth_callback", &callback_data)
            .map_err(|e| AuthError::DeepLinkError(e.to_string()))?;
    }
    
    // Emit general deep link event
    app.emit("deep_link", &deep_link_event)
        .map_err(|e| AuthError::DeepLinkError(e.to_string()))?;
    
    Ok(())
}

#[command]
pub async fn open_auth_url(url: String) -> Result<(), AuthError> {
    log::info!("Opening auth URL: {}", url);
    
    // Validate URL before opening
    let parsed_url = Url::parse(&url).map_err(|e| AuthError::InvalidUrl(e.to_string()))?;
    
    // Security check: only allow HTTPS URLs and specific localhost ports for development
    match parsed_url.scheme() {
        "https" => {},
        "http" => {
            if let Some(host) = parsed_url.host_str() {
                if host != "localhost" && host != "127.0.0.1" {
                    return Err(AuthError::InvalidUrl("HTTP only allowed for localhost".to_string()));
                }
            } else {
                return Err(AuthError::InvalidUrl("Invalid host".to_string()));
            }
        },
        _ => return Err(AuthError::InvalidUrl("Only HTTP(S) URLs allowed".to_string())),
    }
    
    // Open URL in default browser
    tauri_plugin_opener::open_url(&url, None::<&str>)
        .map_err(|e| AuthError::DeepLinkError(format!("Failed to open URL: {}", e)))?;
    
    Ok(())
}

#[command]
pub async fn register_auth_protocol() -> Result<(), AuthError> {
    // Register custom protocol for auth callbacks
    // This is handled by the deep-link plugin configuration in tauri.conf.json
    Ok(())
}

#[command] 
pub async fn get_current_deep_link() -> Result<Option<String>, AuthError> {
    // Get the current deep link that started the app
    match tauri_plugin_deep_link::get_current().await {
        Ok(urls) => Ok(urls.first().cloned()),
        Err(e) => {
            log::warn!("Failed to get current deep link: {}", e);
            Ok(None)
        }
    }
}