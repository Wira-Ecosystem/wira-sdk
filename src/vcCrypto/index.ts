import {
  utf8ToBytes,
  bytesToHex as hex,
  hexToBytes as buf,
  randomBytes,
} from '@noble/hashes/utils.js';
import { aesGcmEncrypt, aesGcmDecrypt } from './aesGcm';
import { scryptAsync } from '@noble/hashes/scrypt.js';

// For higher security (slower):
const highSecurityParams = {
  N: 32768,
  r: 8,
  p: 1,
  dkLen: 32,
};

export async function encryptVCWithPin(vcObj: Object, pin: string) {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(
    new TextEncoder().encode(pin),
    salt,
    highSecurityParams
  );

  const plain = utf8ToBytes(JSON.stringify(vcObj));
  const cipher = aesGcmEncrypt(plain, derivedKey);
  const payload = new Uint8Array(derivedKey.length + cipher.length);
  payload.set(derivedKey, 0);
  payload.set(cipher, derivedKey.length);
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
  return JSON.parse(new TextDecoder().decode(plain));
}
