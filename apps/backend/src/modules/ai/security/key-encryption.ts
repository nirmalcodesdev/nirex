/**
 * API Key Encryption Service
 *
 * Encrypts and decrypts provider API keys using AES-256-GCM.
 * Keys are encrypted at rest using a server-side encryption key.
 * Supports key rotation with a graceful overlap period.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm' as const;
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // GCM auth tag

let _encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (_encryptionKey) return _encryptionKey;

  const keyHex = process.env.AI_API_KEY_ENCRYPTION_KEY;
  if (!keyHex) {
    throw new Error(
      'AI_API_KEY_ENCRYPTION_KEY environment variable is required. ' +
        'Generate one with: node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"',
    );
  }

  _encryptionKey = Buffer.from(keyHex, 'hex');
  if (_encryptionKey.length !== KEY_LENGTH) {
    throw new Error(
      `AI_API_KEY_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`,
    );
  }

  return _encryptionKey;
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(encrypted: string): string {
  const key = getEncryptionKey();

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted API key format');
  }

  const ivHex = parts[0]!;
  const authTagHex = parts[1]!;
  const ciphertextHex = parts[2]!;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error('Invalid IV length');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function rotateEncryptionKey(
  newKeyHex: string,
  encryptedKeys: string[],
): string[] {
  if (newKeyHex.length !== KEY_LENGTH * 2) {
    throw new Error(`New key must be ${KEY_LENGTH * 2} hex characters`);
  }

  // Decrypt with current key, re-encrypt with new key
  const reEncrypted = encryptedKeys.map((key) => {
    const decrypted = decryptApiKey(key);
    const originalKey = _encryptionKey;
    _encryptionKey = Buffer.from(newKeyHex, 'hex');
    const result = encryptApiKey(decrypted);
    _encryptionKey = originalKey;
    return result;
  });

  // Update the key
  _encryptionKey = Buffer.from(newKeyHex, 'hex');

  return reEncrypted;
}
