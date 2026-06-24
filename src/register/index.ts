import { predictWalletAddress } from '../wallet';
import type { availableNetworks } from '../common/params';
import {
  createCredential,
  getCredential,
  mapOcrToClaims,
} from './issuerClient';
import { RegistryApi } from './registry';
import { encryptVCWithPin } from '../vcCrypto';
import { Storage } from '../storage';
import { SharedSession } from '../shared-session';
import { Biometric } from '../biometry';
import WiraSdk from '../NativeWiraSdk';
import { WiraSdkInterface } from '../encryption/nativeSdk';
import type { UserData } from '../common/types';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { discoverableHashFromDni } from './idHash';

const registererDataKey = 'wira-sdk-';

export type WalletData = {
  address: `0x${string}`;
  salt: bigint;
  privateKey: `0x${string}`;
};

/**
 * Class to make the wira user register
 */
export class Registerer {
  walletData: WalletData | null = null;
  chain: keyof typeof availableNetworks | null = null;
  subjectDid: string | null = null;
  guardianAddress: `0x${string}` | null = null;
  dni: string | null = null;
  appName: string | null = null;
  pin: string | null = null;
  registryApi: RegistryApi;
  sharedSession: SharedSession;
  bundler: string;
  userData: UserData | null = null;
  encryptedUserData: string | null = null;
  arbitrumSponsorshipPolicyId: string | undefined = undefined;

  /**
   * Registerer constructor
   * @param registryUrl the URL of the backend-identity provided
   * @param registryApiKey the API key for the registry
   * @param sharedSessionSchema the schema for the shared session
   * @param bundler url of base paymaster url provided
   * @param arbitrumSponsorshipPolicyId optional sponsorship policy id for arbitrum networks
   */
  constructor(
    registryUrl: string,
    registryApiKey: string,
    sharedSessionSchema: string,
    bundler: string,
    arbitrumSponsorshipPolicyId?: string
  ) {
    this.registryApi = new RegistryApi(registryUrl, registryApiKey);
    this.sharedSession = new SharedSession(
      registryUrl,
      registryApiKey,
      sharedSessionSchema
    );
    this.bundler = bundler;
    this.arbitrumSponsorshipPolicyId = arbitrumSponsorshipPolicyId;
  }

  async clear() {
    await Promise.all([
      AsyncStorage.removeItem(registererDataKey + 'walletData'),
      AsyncStorage.removeItem(registererDataKey + 'did'),
      AsyncStorage.removeItem(registererDataKey + 'dni'),
      AsyncStorage.removeItem(registererDataKey + 'guardianAddress'),
    ]);
  }

  async createVC(
    chain: keyof typeof availableNetworks,
    ocrData: any,
    credType: string,
    credExpirationDays: string
  ) {
    this.chain = chain;
    const jsonWalletData = await AsyncStorage.getItem(
      registererDataKey + 'walletData'
    );
    this.walletData = jsonWalletData ? JSON.parse(jsonWalletData) : null;
    this.subjectDid = await AsyncStorage.getItem(registererDataKey + 'did');

    if (this.walletData && this.subjectDid) {
      return;
    }

    const { success, identity, error } = JSON.parse(
      await WiraSdk.addIdentity()
    );
    if (!success) {
      throw new Error('Error creating identity: ' + error);
    }

    const { did, privateKey } = JSON.parse(identity);
    if (typeof did !== 'string' || typeof privateKey !== 'string') {
      throw new Error('Error creating identity: did or privateKey missing');
    }

    const claims = mapOcrToClaims(ocrData);
    const { id: credentialId } = await createCredential(
      did,
      privateKey,
      claims,
      credType,
      credExpirationDays
    );

    const vc = await getCredential(credentialId, did, privateKey);
    if (vc?.credentialSubject?.id && vc.credentialSubject.id !== did) {
      throw new Error('El VC devuelto no corresponde al DID del usuario.');
    }

    this.walletData = {
      ...(await predictWalletAddress(chain, `0x${privateKey}`)),
      privateKey: `0x${privateKey}`,
    };
    this.subjectDid = did;
    await AsyncStorage.setItem(
      registererDataKey + 'walletData',
      jsonStringifyWithBigInt(this.walletData)
    );
    await AsyncStorage.setItem(registererDataKey + 'did', did);

    return vc;
  }

  /*
  async createWallet(dni: string) {
    if (!this.walletData || !this.chain) {
      throw new Error(
        'Wallet data or chain is not initialized, did you call createVC?'
      );
    }

    this.dni = await AsyncStorage.getItem(registererDataKey + 'dni');
    this.guardianAddress = (await AsyncStorage.getItem(
      registererDataKey + 'guardianAddress'
    )) as `0x${string}` | null;

    if (this.dni && this.guardianAddress) {
      return {
        guardianAddress: this.guardianAddress,
      };
    }

    const response = await createWalletOnChain(
      this.chain,
      this.walletData.salt,
      this.walletData.privateKey,
      dni,
      this.bundler,
      '',
      this.arbitrumSponsorshipPolicyId
    );

    this.dni = dni;
    this.guardianAddress = response.guardianAddress;
    await AsyncStorage.setItem(
      registererDataKey + 'guardianAddress',
      response.guardianAddress
    );
    await AsyncStorage.setItem(registererDataKey + 'dni', dni);

    return response;
  }*/

  async storeOnDevice(dni: string, pin: string, useBiometry: boolean) {
    if (!this.walletData || !this.subjectDid) {
      throw new Error(
        'Wallet data or subjectDid is not initialized, did you call createVC?'
      );
    }
    this.dni = dni;

    // Deprecated, remove on next versions
    this.guardianAddress = '0x';

    this.userData = {
      dni: this.dni,
      salt: this.walletData.salt,
      privKey: this.walletData.privateKey,
      account: this.walletData.address,
      guardian: this.guardianAddress,
      did: this.subjectDid,
    };

    try {
      if (useBiometry) {
        const { available, biometryType } =
          await Biometric.biometryAvailability();
        if (!available) {
          throw new Error('Biometric authentication is not available');
        }

        const authenticated = await Biometric.biometricLogin(
          biometryType === 'FaceID'
            ? 'Escanea tu rostro para activar'
            : 'Escanea tu huella para activar'
        );
        if (!authenticated) {
          throw new Error('User cancelled biometric change');
        }

        await Storage.saveUserDataWithBiometric(this.userData);
        await Biometric.setBioFlag(true);
      }

      this.encryptedUserData = await encryptVCWithPin(this.userData, pin);
      this.pin = pin;

      await Storage.saveUserData(this.encryptedUserData);
    } catch (error) {
      if (Biometric.isUserCancellation(error)) {
        throw new Error('User cancelled biometric change');
      }
      throw new Error('Error saving Wira data: ' + error);
    }
  }

  async storeDataOnServer() {
    if (!this.walletData || !this.subjectDid) {
      throw new Error(
        'Wallet data or subjectDid is not initialized, did you call createVC?'
      );
    }
    if (!this.dni || !this.userData || !this.encryptedUserData || !this.pin) {
      throw new Error(
        'No credential to store on server, did you call storeOnDevice?'
      );
    }

    const backup = await WiraSdkInterface.backupIdentity(
      this.subjectDid,
      this.walletData.privateKey
    );

    const userDataWithIdentity = {
      ...this.userData,
      identity: backup,
    };

    const hashedDataWithIdentity = await encryptVCWithPin(
      userDataWithIdentity,
      discoverableHashFromDni(`${this.dni}:${this.pin}`)
    );

    const response = await this.registryApi.registryRegister({
      did: this.subjectDid,
      accountAddress: this.userData.account,
      guardianContractAddress: this.guardianAddress,
      displayNamePublic: null,
      dni: this.dni,
      hashedDataWithIdentity,
    });

    await this.sharedSession.registerSharedSessionDevice(
      this.dni,
      this.pin,
      userDataWithIdentity
    );

    await this.clear();

    return response;
  }
}
