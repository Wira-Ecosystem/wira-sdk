import NativeWiraProvider from './provider/NativeWiraSdk';
import * as provision from './common/provisionClient';
import { RegistryApi } from './register/registry';
import idCardAnalyzer from './id-analyzer/idCardAnalyzer';
import { Registerer, type UserData } from './register';
import { decryptVCWithPin, encryptVCWithPin } from './vcCrypto';
import { EncryptionService } from './encryption';
import { RecoveryService } from './recovery';
import { GuardiansApi } from './api/guardians';
import ViewShot from 'react-native-view-shot';
import { DeviceId } from './deviceId';
import { Biometric } from './biometry';
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';

/**
 * Mock function to simulate fetching app names from an API.
 */
function getAppsNames() {
  return ['com.wirawallet', 'com.appelectoral'];
}

/**
 * Get Wira user data from local storage or external apps.
 * @param ownAppName - The package name of the current app (e.g., 'com.wirawallet').
 * @returns found user data or null if not found.
 */
function getWiraData(ownAppName: string) {
  //check local storage first
  let userData = getWiraDataFrom(ownAppName);
  if (userData) {
    return userData;
  }

  //check data on external apps
  userData = getDataFromExternalApps(ownAppName);
  if (userData) {
    return userData;
  } else {
    console.log('No Wira data found in external apps. Registering needed...');
    return null;
  }
}

/**
 * Sign in a user with their credential and PIN.
 * @param param0 - The user's credential.
 * @param pin - The user's PIN.
 * @returns The decrypted user data.
 */
async function signIn({ credential }: { credential: string }, pin: string) {
  try {
    return decryptVCWithPin(credential, pin);
  } catch (error) {
    console.error('Error decrypting VC with PIN:', error);
    throw new Error('Invalid PIN');
  }
}

/**
 * Check if the provided PIN is valid for the given app. This is done by attempting to decrypt the stored credential.
 * @param ownAppName - The package name of the current app (e.g., 'com.wirawallet').
 * @param pin - The user's PIN.
 * @returns True if the PIN is valid, false otherwise.
 */
async function checkPin(ownAppName: string, pin: string) {
  const data = getWiraData(ownAppName);
  if (!data) {
    throw new Error('No user data found');
  }
  try {
    await decryptVCWithPin((data as any).credential, pin);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the content URI for a specific app.
 * @param appName - The package name of the app (e.g., 'com.wirawallet').
 * @returns The content URI for the app's user data.
 */
function getUri(appName: string) {
  const modifiedAppName = appName.replace(/^com\./, '');
  return `content://com.wira.${modifiedAppName}.provider/user`;
}

/**
 * Get user data from external apps.
 * @param ownAppName - The package name of the current app (e.g., 'com.wirawallet').
 * @returns found user data or null if not found.
 */
function getDataFromExternalApps(ownAppName: string) {
  const apps = getAppsNames().filter((app) => app !== ownAppName);
  let userData = null;

  for (const appName of apps) {
    const data = getWiraDataFrom(appName);
    if (data) {
      userData = data;
      break;
    }
  }

  return userData;
}

/**
 * Get Wira data from a specific app.
 * @param appName - The package name of the app (e.g., 'com.wirawallet').
 * @returns found user data or null if not found.
 */
function getWiraDataFrom(appName: string) {
  const uri = getUri(appName);
  console.log('Checking Wira data in:', uri);

  try {
    const response = NativeWiraProvider.queryUser(uri);
    return Object.keys(response).length > 0 ? response : null;
  } catch (error: any) {
    console.log(error);
    if (
      error.message.includes(
        "The query result was empty, but expected a single row to return a NON-NULL object of type 'com.nativewiraprovider.User'"
      )
    ) {
      return null; // No data found on own app, return null
    }
    console.error('Error checking Wira data:', error);
    return null;
  }
}

/**
 * Toggle biometric authentication for the user.
 * @param userData - The user's data.
 * @param enabled - Whether to enable or disable biometric authentication.
 */
async function toggleBiometricAuth(userData: UserData, enabled: boolean) {
  try {
    if (enabled) {
      const { available } = await Biometric.biometryAvailability();
      if (!available) {
        throw new Error('Biometric authentication is not available');
      }

      if (!userData) {
        throw new Error(
          'User data is required to enable biometric authentication'
        );
      }

      await Keychain.setGenericPassword(
        'bundle',
        JSON.stringify({ stored: userData }),
        {
          service: 'walletBundle',
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          accessControl:
            Platform.OS === 'ios'
              ? Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET
              : Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
          securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
        }
      );
    } else {
      await Keychain.resetGenericPassword({ service: 'walletBundle' });
    }
  } catch (err) {
    if (Biometric.isUserCancellation(err)) {
      throw new Error('User cancelled biometric change');
    }
    throw err;
  }
}

/**
 * Check biometric authentication status and prompt for authentication if enabled.
 * @returns Result of biometric authentication check, with userData if successful or error if failed.
 */
async function checkBiometricAuth() {
  const enabled = await Biometric.getBioFlag();
  if (!enabled) {
    return { ok: false, error: 'Biometric authentication is disabled' };
  }

  const { available, biometryType } = await Biometric.biometryAvailability();

  if (!available || !biometryType)
    return { ok: false, error: 'Biometric authentication is not available' };

  const ok = await Biometric.biometricLogin(
    biometryType === 'FaceID'
      ? 'Escanea tu rostro'
      : 'Escanea tu huella dactilar'
  );

  if (!ok) {
    return { ok: false, error: 'Biometric login failed' };
  }

  const creds = await Keychain.getGenericPassword({
    service: 'walletBundle',
  });

  if (!creds) {
    return { ok: false, error: 'No credentials stored' };
  }

  return { ok: true, userData: JSON.parse(creds.password).stored };
}

async function updatePin(
  ownAppName: string,
  registryUrl: string,
  oldPin: string,
  newPin: string
) {
  const userData = getWiraData(ownAppName);
  if (!userData) {
    throw new Error('No user data found');
  }

  const decryptedData = await signIn(userData as any, oldPin);
  const encryptedWithNewPin = await encryptVCWithPin(decryptedData, newPin);

  NativeWiraProvider.updateUser(getUri(ownAppName), {
    credential: encryptedWithNewPin,
  });

  const encryptService = new EncryptionService();
  const registryApi = new RegistryApi(registryUrl);

  await encryptService.connect();
  const encryptedData = await encryptService.encryptData({
    hashedData: encryptedWithNewPin,
    rawData: decryptedData,
  });
  encryptService.litNodeClient.disconnect();

  const registerResponse = await registryApi.updateRecoveryData(
    decryptedData.dni,
    encryptedData.ciphertext,
    encryptedData.dataToEncryptHash
  );

  if (!registerResponse.ok) {
    throw new Error('Failed to update data on server');
  }
}

const wira = {
  getWiraData,
  signIn,
  toggleBiometricAuth,
  checkBiometricAuth,
  checkPin,
  updatePin,
  NativeWiraProvider,
  provision,
  RegistryApi,
  GuardiansApi,
  idCardAnalyzer,
  Registerer,
  EncryptionService,
  RecoveryService,
  ViewShot,
  DeviceId,
  Biometric,
};
export default wira;
