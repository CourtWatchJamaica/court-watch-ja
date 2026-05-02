use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::api::errors::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: i32,   // user_id
    pub exp: usize, // expiry (unix timestamp)
    pub iat: usize, // issued at
}

pub fn encode_token(user_id: i32, secret: &str) -> Result<String, AppError> {
    let now = Utc::now();
    let exp = (now + Duration::days(7)).timestamp() as usize;
    let iat = now.timestamp() as usize;

    let claims = Claims { sub: user_id, exp, iat };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(format!("Token encoding failed: {e}")))
}

pub fn decode_token(token: &str, secret: &str) -> Result<Claims, AppError> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized)?;
    Ok(data.claims)
}
