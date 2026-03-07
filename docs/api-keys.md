# API Key Management Routes

This document explains the new API key management system with encryption.

## Features

- **Secure Storage**: API keys are encrypted using AES-256-GCM before storage
- **Multiple Providers**: Support for OpenAI, Gemini, Anthropic, OpenRouter, and custom providers
- **Key Hints**: Masked API keys for display (e.g., "sk-...xyz")
- **Model Selection**: Associate preferred models with each provider
- **CRUD Operations**: Full create, read, update, delete support

## Files Created

### 1. Encryption Library

**Location:** [`server/lib/encryption.js`](file:///c:/Users/bojan/OneDrive/Documenten/GitHub/NightCompanion/server/lib/encryption.js)

Implements AES-256-GCM encryption/decryption:

- `encrypt(text)` - Returns `{encrypted, iv, authTag}`
- `decrypt(encrypted, iv, authTag)` - Returns plain text

### 2. API Routes

**Location:** [`server/routes/api-keys.js`](file:///c:/Users/bojan/OneDrive/Documenten/GitHub/NightCompanion/server/routes/api-keys.js)

Endpoints:

- `GET /api/api-keys` - List all API keys (masked)
- `POST /api/api-keys` - Add or update an API key
- `GET /api/api-keys/:provider/decrypt` - Retrieve decrypted key (internal use)
- `DELETE /api/api-keys/:provider` - Delete an API key

### 3. Database Migration

**Location:** `server/migrations/`

The app now uses local PostgreSQL migrations managed by the server migration runner.
Encryption-related schema changes are part of the current local schema.

Added columns to `user_api_keys`:

- `iv` (text) - Initialization vector for encryption
- `auth_tag` (text) - Authentication tag for GCM mode

## Setup

### 1. Environment Configuration

Add to `.env`:

```bash
ENCRYPTION_KEY=your_64_character_hex_key_here
```

The encryption key is automatically added to your `.env` file. **Keep this secure!** Losing this key means losing access to stored API keys.

### 2. Database Schema

Run the migration to add encryption fields:

```bash
node server/db-init.js
```

## API Usage

### Add/Update an API Key

```javascript
POST /api/api-keys
Content-Type: application/json

{
  "provider": "openai",
  "api_key": "sk-proj-abc123...",
  "model_name": "gpt-4"
}
```

Response:

```json
{
  "id": "uuid",
  "provider": "openai",
  "key_hint": "sk-p...123",
  "is_active": true,
  "model_name": "gpt-4",
  "updated_at": "2026-02-08T..."
}
```

### List All Keys (Masked)

```javascript
GET /api/api-keys
```

Response:

```json
[
  {
    "id": "uuid",
    "provider": "openai",
    "key_hint": "sk-p...123",
    "is_active": true,
    "model_name": "gpt-4",
    "updated_at": "2026-02-08T..."
  }
]
```

### Get Decrypted Key (Internal)

```javascript
GET /api/api-keys/openai/decrypt
```

Response:

```json
{
  "api_key": "sk-proj-abc123..."
}
```

### Delete API Key

```javascript
DELETE /api/api-keys/openai
```

Response:

```json
{
  "status": "deleted"
}
```

## Security Notes

1. **Encryption Key**: Stored in `.env` file. Never commit to version control.
2. **Decrypt Endpoint**: Should only be used server-side. Consider adding authentication for production use.
3. **HTTPS**: Use HTTPS in production to protect keys in transit.
4. **Key Rotation**: If encryption key is compromised, all API keys must be re-entered.

## Testing

Test the encryption library:

```bash
node server/scripts/test-encryption.js
```

Check the database schema:

```bash
node server/scripts/check-api-keys-schema.js
```
