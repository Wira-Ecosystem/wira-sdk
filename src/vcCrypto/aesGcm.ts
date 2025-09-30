import crypto from 'react-native-quick-crypto';

const aessize = 'aes-256-gcm';
const ivSize = 12;

export function aesGcmEncrypt(
  plainBytes: Uint8Array<ArrayBufferLike>,
  keyBytes: Uint8Array<ArrayBufferLike>
) {
  const iv = crypto.randomBytes(ivSize);
  const cipher = crypto.createCipheriv(aessize, Buffer.from(keyBytes), iv);

  const enc1 = cipher.update(Buffer.from(plainBytes));
  const enc2 = cipher.final();
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, enc1, enc2, tag]);
}

export function aesGcmDecrypt(
  cipherBytes: Uint8Array<ArrayBufferLike>,
  keyBytes: Uint8Array<ArrayBufferLike>
) {
  const buf = Buffer.from(cipherBytes);
  const iv = buf.slice(0, ivSize);
  const tag = buf.slice(buf.length - 16);
  const data = buf.slice(ivSize, buf.length - 16);

  const decipher = crypto.createDecipheriv(aessize, Buffer.from(keyBytes), iv);
  decipher.setAuthTag(tag);

  const dec1 = decipher.update(data);
  const dec2 = decipher.final();

  return Buffer.concat([dec1, dec2]);
}
