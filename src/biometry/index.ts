import ReactNativeBiometrics from 'react-native-biometrics';
const rnBio = new ReactNativeBiometrics();
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BIO_KEY } from '../common/constants';

async function getBioFlag() {
  const v = await AsyncStorage.getItem(BIO_KEY);
  return v === 'true';
}
async function setBioFlag(enabled: boolean) {
  await AsyncStorage.setItem(BIO_KEY, enabled ? 'true' : 'false');
}

async function biometryAvailability() {
  try {
    const { available, biometryType } = await rnBio.isSensorAvailable();
    return { available, biometryType: biometryType || null };
  } catch {
    return { available: false, biometryType: null };
  }
}

async function biometricLogin(prompt = 'Autentícate') {
  try {
    const { success } = await rnBio.simplePrompt({
      promptMessage: prompt,
      cancelButtonText: 'Cancelar',
    });
    return !!success;
  } catch {
    return false;
  }
}

function isUserCancellation(err: any) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('Canceled') ||
    msg.includes('cancel') ||
    msg.includes('LAErrorUserCancel') ||
    msg.includes('ERR_KEYCHAIN_USER_CANCELED')
  );
}

export const Biometric = {
  getBioFlag,
  setBioFlag,
  biometryAvailability,
  biometricLogin,
  isUserCancellation,
};
