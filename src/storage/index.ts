import Keychain, { hasGenericPassword } from 'react-native-keychain';
import { BIO_SERVICE, KEY_SERVICE, KEY_USERNAME } from '../common/constants';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import { Platform } from 'react-native';
import type { UserData } from '../common/types';

/**
 * Checks if user data is stored locally.
 * @returns found user data or null if not found.
 */
async function checkUserData() {
  return hasGenericPassword({ service: KEY_SERVICE });
}

/**
 * Retrieves user data from secure storage.
 * @returns found user data or null if not found.
 */
async function getUserData() {
  const userData = await Keychain.getGenericPassword({ service: KEY_SERVICE });
  if (userData) {
    return JSON.parse(userData.password);
  } else {
    return null;
  }
}

/**
 * Saves the encrypted user data to secure storage.
 * @param encryptedUserData - The encrypted user data with pin.
 */
async function saveUserData(encryptedUserData: string) {
  await Keychain.setGenericPassword(
    KEY_USERNAME,
    jsonStringifyWithBigInt({ credentials: encryptedUserData }),
    { service: KEY_SERVICE }
  );
}

/**
 * Retrieves the user data stored with biometric authentication.
 * @returns found user data or null if not found.
 */
async function getBiometricUserData() {
  const userData = await Keychain.getGenericPassword({ service: BIO_SERVICE });
  if (userData) {
    return JSON.parse(userData.password);
  } else {
    return null;
  }
}

/**
 * Saves the user data with biometric authentication.
 * @param userData - The user data to save (not encrypted).
 */
async function saveUserDataWithBiometric(userData: UserData) {
  await Keychain.setGenericPassword(
    KEY_USERNAME,
    jsonStringifyWithBigInt({ credentials: userData }),
    {
      service: BIO_SERVICE,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      accessControl:
        Platform.OS === 'ios'
          ? Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET
          : Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
      securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
    }
  );
}

/**
 * Deletes the user data stored with biometric authentication.
 * This does not delete the main user data.
 */
async function deleteBiometricData() {
  await Keychain.resetGenericPassword({ service: BIO_SERVICE });
}

export const Storage = {
  checkUserData,
  getUserData,
  saveUserData,
  getBiometricUserData,
  saveUserDataWithBiometric,
  deleteBiometricData,
};
