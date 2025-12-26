// ====================================
// AVENLO CORE - AES-256 ENCRYPTION
// ====================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

export interface EncryptionConfig {
  key: string; // 32-byte hex string (64 characters)
}

/**
 * AES-256-GCM Encryption utility for securing sensitive data
 */
export class EncryptionService {
  private key: Buffer;

  constructor(config: EncryptionConfig) {
    // Validate key length
    if (config.key.length !== 64) {
      throw new Error('Encryption key must be a 64-character hex string (32 bytes)');
    }
    this.key = Buffer.from(config.key, 'hex');
  }

  /**
   * Encrypt a string value
   * Returns base64 encoded string: iv:tag:encrypted
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Combine IV + Tag + Encrypted data
    const combined = Buffer.concat([
      iv,
      tag,
      Buffer.from(encrypted, 'hex'),
    ]);

    return combined.toString('base64');
  }

  /**
   * Decrypt an encrypted value
   */
  decrypt(ciphertext: string): string {
    const combined = Buffer.from(ciphertext, 'base64');

    // Extract IV, Tag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  }

  /**
   * Encrypt an object (serializes to JSON first)
   */
  encryptObject<T extends object>(obj: T): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to an object
   */
  decryptObject<T extends object>(ciphertext: string): T {
    const decrypted = this.decrypt(ciphertext);
    return JSON.parse(decrypted);
  }

  /**
   * Hash a value with salt (for passwords, tokens, etc.)
   */
  hash(value: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hash = crypto
      .pbkdf2Sync(value, actualSalt, 100000, 64, 'sha512')
      .toString('hex');

    return { hash, salt: actualSalt };
  }

  /**
   * Verify a hashed value
   */
  verifyHash(value: string, hash: string, salt: string): boolean {
    const result = this.hash(value, salt);
    return crypto.timingSafeEqual(
      Buffer.from(result.hash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  }

  /**
   * Generate a secure random token
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate a new encryption key
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

// Singleton instance
let encryptionInstance: EncryptionService | null = null;

export function getEncryption(config?: EncryptionConfig): EncryptionService {
  if (!encryptionInstance) {
    if (!config) {
      throw new Error('Encryption config required for initial setup');
    }
    encryptionInstance = new EncryptionService(config);
  }
  return encryptionInstance;
}

export function initEncryption(config: EncryptionConfig): EncryptionService {
  encryptionInstance = new EncryptionService(config);
  return encryptionInstance;
}
