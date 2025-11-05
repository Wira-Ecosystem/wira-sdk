import {
  utf8ToBytes,
  bytesToHex as hex,
  hexToBytes as buf,
  randomBytes,
} from '@noble/hashes/utils.js';
import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { jsonStringifyWithBigInt } from './json';

// For higher security (slower):
const highSecurityParams = {
  N: 2 ** 9,
  r: 8,
  p: 1,
  dkLen: 32,
};

export async function encryptKey(key: string, salt: Uint8Array) {
  const derivedKey = await scryptAsync(
    new TextEncoder().encode(key),
    salt,
    highSecurityParams
  );
  return hex(derivedKey);
}

export async function encryptVCWithPin(vcObj: Object, pin: string) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(
    new TextEncoder().encode(pin),
    salt,
    highSecurityParams
  );

  // Custom JSON stringifier to handle BigInt values
  const jsonString = jsonStringifyWithBigInt(vcObj);

  const plain = utf8ToBytes(jsonString);
  const cipher = aesGcmEncrypt(plain, derivedKey);
  const payload = new Uint8Array(salt.length + cipher.length);
  payload.set(salt, 0);
  payload.set(cipher, salt.length);
  return hex(payload);
}

export async function decryptVCWithPin(vcHex: string, pin: string) {
  const bytes = buf(vcHex);
  const salt = bytes.slice(0, 16);
  const body = bytes.slice(16);
  const derivedKey = await scryptAsync(
    new TextEncoder().encode(pin),
    salt,
    highSecurityParams
  );
  const plain = aesGcmDecrypt(body, derivedKey);
  try {
    return JSON.parse(new TextDecoder().decode(plain));
  } catch (error: any) {
    if (error.message.includes('JSON Parse error: Unexpected character')) {
      throw new Error('Invalid PIN');
    }
    throw error;
  }
}
