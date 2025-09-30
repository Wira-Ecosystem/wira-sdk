import { keccak_256 } from '@noble/hashes/sha3.js';
import { utf8ToBytes, bytesToHex } from '@noble/hashes/utils.js';

export function normalizeDni(dni: string) {
  return (dni || '').toString().trim().toLowerCase().replace(/\s+/g, '');
}

export function discoverableHashFromDni(dni: string) {
  const norm = normalizeDni(dni);
  const hash = keccak_256(utf8ToBytes(norm));
  return '0x' + bytesToHex(hash);
}
