import * as provision from './common/provisionClient';
import { RegistryApi } from './register/registry';
import idCardAnalyzer from './id-analyzer/idCardAnalyzer';
import { Registerer } from './register';
import { decryptVCWithPin, encryptVCWithPin } from './vcCrypto';
import { RecoveryService } from './recovery';
import { GuardiansApi } from './api/guardians';
import { DeviceId } from './deviceId';
import { Biometric } from './biometry';
import { Storage } from './storage';
import { SharedSession } from './shared-session';
import { getWiraConfig, initDownloadCircuits, initWiraSdk } from './config';
import { Wallet } from './wallet';
import { WalletCalls } from './wallet/calls';
import { CircuitDownloadStatus } from './common/enums';
import WiraSdk from './NativeWiraSdk';
import type { UserData } from './common/types';
import { WiraSdkInterface } from './encryption/nativeSdk';
import { jsonStringifyWithBigInt } from './vcCrypto/json';

type SignInOptions = {
  registryUrl: string;
  sharedSessionSchema: string;
};

/**
 * Sign in a user with their credential and PIN.
 * @param pin - The user's PIN.
 * @param afterCiRecovery - Flag indicating if the sign-in is after a CI+PIN recovery.
 * @param registerDevice - Optional parameters for registering the device for shared sessions.
 * @returns The decrypted user data.
 */
async function signIn(
  pin: string,
  afterCiRecovery: boolean = false,
  registerDevice?: SignInOptions
) {
  try {
    const userData = await Storage.getUserData();
    if (!userData) {
      throw new Error('No user data found');
    }
    const data = await decryptVCWithPin(userData.credentials, pin);
    if (afterCiRecovery) {
      if (!data.identity) {
        throw new Error('Identity information for recovery is missing');
      }

      await WiraSdkInterface.restoreIdentity(
        data.identity,
        data.did,
        data.privKey
      );
    }

    const credentials = JSON.parse(
      await WiraSdk.getCredentials(data.did, data.privKey.replace('0x', ''))
    );
    if (credentials?.credentials && credentials.credentials.length === 0) {
      throw new Error('No credentials found for the user');
    }

    data.vc = credentials.credentials[0].info;

    if (registerDevice) {
      const sharedSession = new SharedSession(
        registerDevice.registryUrl,
        registerDevice.sharedSessionSchema
      );
      await sharedSession.registerSharedSessionDevice(data.dni, pin, data);
    }
    return data;
  } catch (error: any) {
    if (error.message === 'No user data found') {
      throw error;
    }
    throw new Error('Decryption failed: ' + error.message);
  }
}
/**
 * Check if the provided PIN is valid for the given app. This is done by attempting to decrypt the stored credential.
 * @param pin - The user's PIN.
 * @returns True if the PIN is valid, false otherwise.
 */
async function checkPin(pin: string) {
  const data = await Storage.getUserData();
  if (!data) {
    throw new Error('No user data found');
  }
  try {
    await decryptVCWithPin(data.credentials, pin);
    return true;
  } catch {
    return false;
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
      await Storage.saveUserDataWithBiometric(userData);
      await Biometric.setBioFlag(true);
    } else {
      await Storage.deleteBiometricData();
      await Biometric.setBioFlag(false);
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
  const creds = await Storage.getBiometricUserData();
  if (!creds?.credentials) {
    return { ok: false, error: 'No credentials stored' };
  }

  const fullCreds = JSON.parse(
    await WiraSdk.getCredentials(
      creds.credentials.did,
      creds.credentials.privKey.replace('0x', '')
    )
  );
  if (fullCreds?.credentials && fullCreds.credentials.length === 0) {
    return { ok: false, error: 'No credentials found for the user' };
  }

  return {
    ok: true,
    userData: {
      ...creds.credentials,
      vc: fullCreds.credentials[0].info,
    },
  };
}

async function updatePin(registryUrl: string, oldPin: string, newPin: string) {
  const userData = await Storage.getUserData();
  if (!userData) {
    throw new Error('No user data found');
  }
  const decryptedData = await decryptVCWithPin(userData.credentials, oldPin);
  const backup = await WiraSdkInterface.backupIdentity(
    decryptedData.did,
    decryptedData.privKey
  );

  const decryptedDataWithIdentity = {
    ...decryptedData,
    identity: backup,
  };

  const encryptedWithNewPin = await encryptVCWithPin(decryptedData, newPin);
  const encryptedWithIdentityWithNewPin = await encryptVCWithPin(
    decryptedDataWithIdentity,
    newPin
  );
  await Storage.saveUserData(encryptedWithNewPin);

  const registryApi = new RegistryApi(registryUrl);
  const registerResponse = await registryApi.updateRecoveryData(
    decryptedData.dni,
    encryptedWithIdentityWithNewPin,
    jsonStringifyWithBigInt(decryptedDataWithIdentity)
  );
  if (!registerResponse.ok) {
    throw new Error('Failed to update data on server');
  }
}

const wira = {
  initWiraSdk,
  getWiraConfig,
  signIn,
  toggleBiometricAuth,
  checkBiometricAuth,
  checkPin,
  updatePin,
  authenticateWithVerifier: WiraSdkInterface.authenticate,
  provision,
  RegistryApi,
  GuardiansApi,
  idCardAnalyzer,
  Registerer,
  RecoveryService,
  DeviceId,
  Biometric,
  Storage,
  SharedSession,
  Wallet,
  WalletCalls,
};
export default wira;

export const config = {
  initDownloadCircuits,
  CircuitDownloadStatus,
};
