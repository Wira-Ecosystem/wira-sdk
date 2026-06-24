import { RegistryApi } from './registry';
import { WiraSdkInterface } from '../encryption/nativeSdk';
import { decryptVCWithPin, encryptVCWithPin } from '../vcCrypto';
import { discoverableHashFromDni } from './idHash';
import { Storage } from '../storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MIGRATED_KEY } from '../common/constants';

export class MigrationService {
  private api: RegistryApi;

  constructor(registryUrl: string) {
    this.api = new RegistryApi(registryUrl);
  }

  async checkMigration(did: string) {
    try {
      const hasMigrated = await AsyncStorage.getItem(MIGRATED_KEY);
      if (hasMigrated === 'true') {
        return false;
      }

      const response = await this.api.canMigrate(did);
      if (!response.ok) {
        throw new Error(response.error);
      }
      if (!response.canMigrate) {
        await AsyncStorage.setItem(MIGRATED_KEY, 'true');
      }
      return response.canMigrate as boolean;
    } catch (error) {
      throw new Error(`Error checking migration status: ${error}`);
    }
  }

  async startMigration(pin: string) {
    try {
      const data = await Storage.getUserData();
      if (!data || !data.credentials) {
        throw new Error('No user data found for migration');
      }

      const userData = await decryptVCWithPin(data.credentials, pin);

      const backup = await WiraSdkInterface.backupIdentity(
        userData.did,
        userData.privKey
      );

      const userDataWithIdentity = {
        ...userData,
        identity: backup,
      };

      const hashedDataWithIdentity = await encryptVCWithPin(
        userDataWithIdentity,
        discoverableHashFromDni(`${userData.dni}:${pin}`)
      );

      const registerResponse = await this.api.updateRecoveryData(
        userData.dni,
        hashedDataWithIdentity
      );

      if (!registerResponse.ok) {
        throw new Error(
          'Failed to update data on server:' + registerResponse.error
        );
      }

      await AsyncStorage.setItem(MIGRATED_KEY, 'true');
    } catch (error) {
      throw new Error(`Error during migration: ${error}`);
    }
  }
}
