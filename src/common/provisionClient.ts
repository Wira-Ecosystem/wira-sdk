import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import { STORAGE_KEY } from './constants';

export type Provision = {
  mock?: boolean;
  gatewayBase: string;
};

export async function fetchProvision({ mock = true, gatewayBase }: Provision) {
  const body =
    Platform.OS === 'android'
      ? {
          platform: 'android',
          // En producción: integrityToken + nonce reales de Play Integrity
          // En mock: usa el mismo nonce en ambos
          integrityToken: mock ? `MOCK_OK:bm9uY2VfZGVtby` : '<JWS>',
          nonce: mock ? 'bm9uY2VfZGVtby' : '<nonce_base64url>',
        }
      : {
          platform: 'ios',
          attestationObject: mock ? `MOCK_OK:bm9uY2VfZGVtby` : '<base64>',
          keyId: mock ? 'bW9ja19rZXk=' : '<base64>',
          challenge: mock ? 'bm9uY2VfZGVtby' : '<base64>',
        };

  const { data } = await axios.post(`${gatewayBase}/provision`, body, {
    timeout: 20000,
  });
  // data = { issuer: { adminBase, agentBase, createCredentialPath, ... }, gemini: {...} }
  await AsyncStorage.setItem(STORAGE_KEY, jsonStringifyWithBigInt(data));
  return data;
}

export async function getProvision() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function ensureProvisioned({
  mock = true,
  gatewayBase,
}: Provision) {
  try {
    return await fetchProvision({ mock, gatewayBase });
  } catch (error: any) {
    const savedData = await getProvision();
    if (!savedData) {
      throw new Error(
        'Provisioning failed and no saved provision data found: ' +
          error.message
      );
    }

    return savedData;
  }
}
