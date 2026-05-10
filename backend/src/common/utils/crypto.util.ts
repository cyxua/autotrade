import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

export function encrypt(plainText: string, keyHex: string): EncryptedData {
  if (!keyHex || keyHex.length !== 64) throw new Error('ENCRYPTION_KEY must be 32-byte hex (64 chars)');
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted: encrypted.toString('hex'), iv: iv.toString('hex'), tag: tag.toString('hex') };
}

export function decrypt(data: EncryptedData, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(data.iv, 'hex');
  const tag = Buffer.from(data.tag, 'hex');
  const encryptedBuf = Buffer.from(data.encrypted, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString('utf8');
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) return '****';
  return apiKey.substring(0, 8) + '****';
}
