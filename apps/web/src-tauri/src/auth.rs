use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use tauri::{command, AppHandle, Manager, State};
use tauri_plugin_store::{Store, StoreExt};
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use argon2::password_hash::{rand_core::OsRng, SaltString};
use base64::{engine::general_purpose, Engine as _};
use sha2::{Digest, Sha256};
use chrono::{DateTime, Utc};
use uuid::Uuid;
use url::Url;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Invalid authentication code")]
    InvalidCode,
    #[error("Authentication code expired")]
    ExpiredCode,
    #[error("PKCE verification failed")]
    PKCEFailed,
    #[error("Token storage error: {0}")]
    StorageError(String),
    #[error("Crypto error: {0}")]
    CryptoError(String),
    #[error("Invalid URL: {0}")]
    InvalidUrl(String),
    #[error("Deep link registration failed: {0}")]
    DeepLinkError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthToken {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
    pub token_type: String,
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PKCEChallenge {
    pub verifier: String,
    pub challenge: String,
    pub method: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub id: String,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub wallet_address: Option<String>,
    pub tokens: Option<AuthToken>,
    pub pkce: Option<PKCEChallenge>,
    pub state: String,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub device_info: DeviceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub platform: String,
    pub user_agent: Option<String>,
}

pub struct AuthManager {
    store: Store<tauri::Wry>,
    key_derivation_salt: String,
}

impl AuthManager {
    pub fn new(app: &AppHandle) -> Result<Self, AuthError> {
        let store = app
            .store("auth.json")
            .map_err(|e| AuthError::StorageError(e.to_string()))?;
        
        // Generate or retrieve a persistent salt for key derivation
        let key_derivation_salt = Self::get_or_create_salt(&store)?;
        
        Ok(Self {
            store,
            key_derivation_salt,
        })
    }

    fn get_or_create_salt(store: &Store<tauri::Wry>) -> Result<String, AuthError> {
        if let Some(salt) = store.get("key_derivation_salt") {
            Ok(salt.as_str().unwrap_or_default().to_string())
        } else {
            let salt = SaltString::generate(&mut OsRng);
            let salt_str = salt.to_string();
            store
                .set("key_derivation_salt", serde_json::Value::String(salt_str.clone()))
                .map_err(|e| AuthError::StorageError(e.to_string()))?;
            store.save().map_err(|e| AuthError::StorageError(e.to_string()))?;
            Ok(salt_str)
        }
    }

    fn derive_key(&self, password: &str) -> Result<Vec<u8>, AuthError> {
        let argon2 = Argon2::default();
        let salt = SaltString::from_b64(&self.key_derivation_salt)
            .map_err(|e| AuthError::CryptoError(e.to_string()))?;
        
        let password_hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| AuthError::CryptoError(e.to_string()))?;
        
        Ok(password_hash.hash.unwrap().as_bytes().to_vec())
    }

    pub fn store_session_encrypted(&self, session: &AuthSession, passphrase: &str) -> Result<(), AuthError> {
        let key = self.derive_key(passphrase)?;
        let session_json = serde_json::to_string(session)
            .map_err(|e| AuthError::StorageError(e.to_string()))?;
        
        // Simple XOR encryption (in production, use AES-GCM or similar)
        let encrypted = self.xor_encrypt(session_json.as_bytes(), &key);
        let encoded = general_purpose::STANDARD.encode(&encrypted);
        
        self.store
            .set(&format!("session_{}", session.id), serde_json::Value::String(encoded))
            .map_err(|e| AuthError::StorageError(e.to_string()))?;
        
        self.store.save().map_err(|e| AuthError::StorageError(e.to_string()))?;
        Ok(())
    }

    pub fn retrieve_session_encrypted(&self, session_id: &str, passphrase: &str) -> Result<Option<AuthSession>, AuthError> {
        let key = self.derive_key(passphrase)?;
        
        if let Some(encrypted_data) = self.store.get(&format!("session_{}", session_id)) {
            let encoded = encrypted_data.as_str().ok_or_else(|| {
                AuthError::StorageError("Invalid session data format".to_string())
            })?;
            
            let encrypted = general_purpose::STANDARD
                .decode(encoded)
                .map_err(|e| AuthError::StorageError(e.to_string()))?;
            
            let decrypted = self.xor_encrypt(&encrypted, &key);
            let session_json = String::from_utf8(decrypted)
                .map_err(|e| AuthError::StorageError(e.to_string()))?;
            
            let session: AuthSession = serde_json::from_str(&session_json)
                .map_err(|e| AuthError::StorageError(e.to_string()))?;
            
            Ok(Some(session))
        } else {
            Ok(None)
        }
    }

    fn xor_encrypt(&self, data: &[u8], key: &[u8]) -> Vec<u8> {
        data.iter()
            .zip(key.iter().cycle())
            .map(|(d, k)| d ^ k)
            .collect()
    }

    pub fn clear_session(&self, session_id: &str) -> Result<(), AuthError> {
        self.store.delete(&format!("session_{}", session_id));
        self.store.save().map_err(|e| AuthError::StorageError(e.to_string()))?;
        Ok(())
    }

    pub fn clear_all_sessions(&self) -> Result<(), AuthError> {
        self.store.clear();
        self.store.save().map_err(|e| AuthError::StorageError(e.to_string()))?;
        Ok(())
    }
}

// PKCE utilities with proper security
pub fn generate_pkce_challenge() -> Result<PKCEChallenge, AuthError> {
    // Generate cryptographically secure verifier (43-128 characters)
    let verifier = generate_secure_random_string(64);
    
    // Generate challenge using SHA-256
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    
    // Base64 URL encode (no padding)
    let challenge = general_purpose::URL_SAFE_NO_PAD.encode(result);
    
    Ok(PKCEChallenge {
        verifier,
        challenge,
        method: "S256".to_string(),
        expires_at: Utc::now() + chrono::Duration::minutes(10),
    })
}

pub fn verify_pkce_challenge(verifier: &str, challenge: &str) -> Result<bool, AuthError> {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let result = hasher.finalize();
    
    let computed_challenge = general_purpose::URL_SAFE_NO_PAD.encode(result);
    
    // Constant-time comparison to prevent timing attacks
    Ok(constant_time_eq(&computed_challenge, challenge))
}

fn generate_secure_random_string(length: usize) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let mut rng = OsRng;
    (0..length)
        .map(|_| {
            let idx = (rng.next_u32() as usize) % CHARSET.len();
            CHARSET[idx] as char
        })
        .collect()
}

fn constant_time_eq(a: &str, b: &str) -> bool {
    if a.len() != b.len() {
        return false;
    }
    
    let mut result = 0u8;
    for (byte_a, byte_b) in a.bytes().zip(b.bytes()) {
        result |= byte_a ^ byte_b;
    }
    
    result == 0
}

// Tauri commands
#[command]
pub async fn generate_auth_session(
    device_info: DeviceInfo,
    app: AppHandle,
    auth_manager: State<'_, AuthManager>,
) -> Result<AuthSession, AuthError> {
    let session_id = Uuid::new_v4().to_string();
    let state = generate_secure_random_string(32);
    let pkce = generate_pkce_challenge()?;
    
    let session = AuthSession {
        id: session_id,
        user_id: None,
        email: None,
        wallet_address: None,
        tokens: None,
        pkce: Some(pkce),
        state,
        created_at: Utc::now(),
        expires_at: Utc::now() + chrono::Duration::minutes(10),
        device_info,
    };
    
    // Store session with device-specific encryption
    let passphrase = format!("{}-{}", session.device_info.device_id, session.state);
    auth_manager.store_session_encrypted(&session, &passphrase)?;
    
    Ok(session)
}

#[command]
pub async fn handle_auth_callback(
    url: String,
    auth_manager: State<'_, AuthManager>,
) -> Result<AuthSession, AuthError> {
    let parsed_url = Url::parse(&url).map_err(|e| AuthError::InvalidUrl(e.to_string()))?;
    
    // Extract parameters from callback URL
    let mut params = HashMap::new();
    for (key, value) in parsed_url.query_pairs() {
        params.insert(key.to_string(), value.to_string());
    }
    
    let auth_code = params.get("code").ok_or(AuthError::InvalidCode)?;
    let state = params.get("state").ok_or(AuthError::InvalidCode)?;
    
    // TODO: Validate state and exchange code for tokens with Convex backend
    // This would involve calling your Convex auth endpoints
    
    // For now, return a placeholder session
    let session = AuthSession {
        id: Uuid::new_v4().to_string(),
        user_id: Some("user_123".to_string()),
        email: Some("user@example.com".to_string()),
        wallet_address: None,
        tokens: None,
        pkce: None,
        state: state.clone(),
        created_at: Utc::now(),
        expires_at: Utc::now() + chrono::Duration::hours(24),
        device_info: DeviceInfo {
            device_id: "desktop".to_string(),
            device_name: "Desktop App".to_string(),
            platform: std::env::consts::OS.to_string(),
            user_agent: None,
        },
    };
    
    Ok(session)
}

#[command]
pub async fn clear_auth_session(
    session_id: String,
    auth_manager: State<'_, AuthManager>,
) -> Result<(), AuthError> {
    auth_manager.clear_session(&session_id)
}

#[command]
pub async fn clear_all_auth_sessions(
    auth_manager: State<'_, AuthManager>,
) -> Result<(), AuthError> {
    auth_manager.clear_all_sessions()
}

#[command]
pub async fn get_auth_session(
    session_id: String,
    device_id: String,
    state: String,
    auth_manager: State<'_, AuthManager>,
) -> Result<Option<AuthSession>, AuthError> {
    let passphrase = format!("{}-{}", device_id, state);
    auth_manager.retrieve_session_encrypted(&session_id, &passphrase)
}