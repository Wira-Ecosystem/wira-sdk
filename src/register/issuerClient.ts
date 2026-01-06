import axios from 'axios';
import { Buffer } from 'buffer';
import { getProvision } from '../common/provisionClient';
import WiraSdk from '../NativeWiraSdk';

export type Claims = {
  fullName: string;
  nationalIdNumber: string;
  birthDate: number;
};

function stripTrailingSlash(s = '') {
  return String(s || '').replace(/\/+$/, '');
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

async function getIssuerDid() {
  const prov = await getProvision();
  const did = prov?.issuer?.issuerDid;
  if (!did) throw new Error('Issuer DID no entregado');
  return did;
}

export async function createCredential(
  subjectDid: string,
  privateKey: string,
  claims: Claims,
  credType: string,
  credExpirationDays: string
) {
  const api = await getIssuerApi();
  const issuerDid = await getIssuerDid();
  await authenticate(subjectDid, privateKey);

  const expiration =
    Math.floor(Date.now() / 1000) +
    parseInt(credExpirationDays || '365', 10) * 86400;
  const body = {
    credentialSchema:
      'https://ipfs.io/ipfs/QmeQhwtwP6XNG155M49yV6TFmm6s8er13WfeU7tcuM8eat',
    type: credType,
    credentialSubject: { id: subjectDid, ...claims },
    expiration,
  };

  const issuerCredResponse = await api.post(
    `/v2/identities/${issuerDid}/credentials`,
    body
  );
  const credentialData = await issuerCredResponse.data;
  if (!credentialData) {
    throw new Error('Invalid credential response: no data');
  }

  return credentialData;
}

export async function authenticate(userDid: string, userPk: string) {
  const api = await getIssuerApi();
  const issuerDid = await getIssuerDid();

  const issuerResponse = await api.post(
    `/v2/${issuerDid}/authentication?type=raw`
  );

  const authData = await issuerResponse.data;
  if (!authData.message) {
    throw new Error('Invalid authentication response: missing message');
  }

  const authResponse = JSON.parse(
    await WiraSdk.authenticate(authData.message, userDid, userPk)
  );
  if (!authResponse.success) {
    throw new Error(
      'Authentication failed: ' + (authResponse.error || 'unknown error')
    );
  }
}

export async function getCredential(
  credentialId: string,
  userDid: string,
  userPk: string
) {
  const api = await getIssuerApi();
  const issuerDid = await getIssuerDid();

  const offerResponse = await api.get(
    `/v2/identities/${issuerDid}/credentials/${credentialId}/offer?type=raw`
  );

  const offerData = await offerResponse.data;
  if (!offerData.universalLink) {
    throw new Error('Invalid credential offer response: missing universalLink');
  }

  const claimResponse = JSON.parse(
    await WiraSdk.claimCredential(offerData.universalLink, userDid, userPk)
  );
  if (!claimResponse.success) {
    throw new Error(
      'Claiming credential failed: ' + (claimResponse.error || 'unknown error')
    );
  }

  const vc = claimResponse.credentials[0].info;
  if (!vc) {
    throw new Error('Claimed credential is missing info');
  }

  return vc;
}

export function mapOcrToClaims(ocr: any = {}): Claims {
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
