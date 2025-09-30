import axios from 'axios';
import { Buffer } from 'buffer';
import { getProvision } from '../common/provisionClient';
import { CRED_TYPE, CRED_EXP_DAYS } from '@env';

export type Claims = {
  fullName: string;
  nationalIdNumber: string;
  birthDate: number;
};

function stripTrailingSlash(s = '') {
  return String(s || '').replace(/\/+$/, '');
}
function joinPath(a = '', b = '') {
  return `${stripTrailingSlash(a)}/${String(b).replace(/^\/+/, '')}`;
}

async function buildAuthHeader() {
  const prov = await getProvision();
  const ba = prov?.issuer?.basicAuth;
  if (ba?.user && ba?.pass) {
    return 'Basic ' + Buffer.from(`${ba.user}:${ba.pass}`).toString('base64');
  }
  throw new Error('Issuer basic auth no entregado');
}

async function getIssuerApi() {
  const prov = await getProvision();
  const baseURL = stripTrailingSlash(prov?.issuer?.adminBase || '');
  if (!baseURL) throw new Error('Issuer adminBase no entregado');
  const auth = await buildAuthHeader();
  return axios.create({
    baseURL,
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    timeout: 60000,
  });
}

async function getCreatePath() {
  const prov = await getProvision();

  const p = prov?.issuer?.createCredentialPath;
  if (!p) throw new Error('createCredentialPath no entregado');
  return p;
}

async function getGetPath(credentialId: string) {
  const prov = await getProvision();
  const tmpl = prov?.issuer?.getUniversalLinkPath;
  if (tmpl && tmpl.includes('{id}') && !/qrcode/i.test(tmpl)) {
    return tmpl.replace('{id}', encodeURIComponent(credentialId));
  }
  const base = await getCreatePath();
  return joinPath(base, encodeURIComponent(credentialId));
}

export async function createCredential(subjectDid: string, claims: Claims) {
  const expiration =
    Math.floor(Date.now() / 1000) +
    parseInt(CRED_EXP_DAYS || '365', 10) * 86400;
  const body = {
    credentialSchema:
      'https://ipfs.io/ipfs/QmeQhwtwP6XNG155M49yV6TFmm6s8er13WfeU7tcuM8eat',
    type: CRED_TYPE,
    credentialSubject: { id: subjectDid, ...claims },
    expiration,
  };

  const api = await getIssuerApi();

  const path = await getCreatePath();

  const { data } = await api.post(path, body);

  return data;
}

export async function getCredential(credentialId: string) {
  const api = await getIssuerApi();
  const path = await getGetPath(credentialId);
  const { data } = await api.get(path);
  return data;
}

export async function waitForVC(
  id: string,
  { tries = 20, delayMs = 1500 }: { tries?: number; delayMs?: number } = {}
) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const vc = await getCredential(id);
      if (vc?.id) return vc;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw lastErr || new Error('Timeout esperando VC');
}

export function mapOcrToClaims(ocr: any = {}): Claims {
  console.log(ocr);

  const fullName =
    ocr.fullName?.trim?.() ||
    ocr.full_name?.trim?.() ||
    ocr.name?.trim?.() ||
    '';

  const nationalIdNumber = (
    ocr.governmentIdentifier ??
    ocr.numeroDoc ??
    ocr.nationalIdNumber ??
    ''
  )
    .toString()
    .replace(/\D/g, '');

  let birthDate = ocr.dateOfBirth;
  if (!(typeof birthDate === 'number' && Number.isFinite(birthDate))) {
    const iso =
      ocr.fechaNacimiento || ocr.birthDateISO || ocr.dateOfBirthISO || null;
    const t = iso ? Date.parse(iso) : NaN;
    birthDate = Number.isFinite(t) ? Math.floor(t / 1000) : null;
  }

  if (!fullName || !nationalIdNumber || !birthDate) {
    throw new Error(
      'Faltan claims requeridos para emitir el VC (fullName / nationalIdNumber / birthDate).'
    );
  }

  return { fullName, nationalIdNumber, birthDate };
}

export function normalizeOcrForUI(src: any = {}) {
  const fullName =
    src.fullName?.trim?.() ||
    src.full_name?.trim?.() ||
    src.name?.trim?.() ||
    '';

  const governmentIdentifier = (
    src.governmentIdentifier ??
    src.numeroDoc ??
    src.nationalIdNumber ??
    ''
  )
    .toString()
    .replace(/\D/g, '');

  let dateOfBirth = src.dateOfBirth;
  if (!(typeof dateOfBirth === 'number' && Number.isFinite(dateOfBirth))) {
    const iso =
      src.fechaNacimiento || src.birthDateISO || src.dateOfBirthISO || null;
    const t = iso ? Date.parse(iso) : NaN;
    dateOfBirth = Number.isFinite(t) ? Math.floor(t / 1000) : null;
  }

  return { fullName, governmentIdentifier, dateOfBirth };
}
