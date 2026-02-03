import { createWalletOnChain, predictWalletAddress } from '../wallet';
import type { availableNetworks } from '../common/params';
import {
  createCredential,
  getCredential,
  mapOcrToClaims,
} from './issuerClient';
import { RegistryApi } from './registry';
import { encryptVCWithPin } from '../vcCrypto';
import { EncryptionService } from '../encryption';
import { Storage } from '../storage';
import { SharedSession } from '../shared-session';
import { Biometric } from '../biometry';
import WiraSdk from '../NativeWiraSdk';
import { WiraSdkInterface } from '../encryption/nativeSdk';
import type { UserData } from '../common/types';

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
  encryptService: EncryptionService;
  userData: UserData | null = null;
  encryptedUserData: string | null = null;
  arbitrumSponsorshipPolicyId: string | undefined = undefined;

  /**
   * Registerer constructor
   * @param registryUrl the URL of the backend-identity provided
   * @param bundler url of base paymaster url provided
   * @param arbitrumSponsorshipPolicyId optional sponsorship policy id for arbitrum networks
   */
  constructor(
    registryUrl: string,
    sharedSessionSchema: string,
    bundler: string,
    arbitrumSponsorshipPolicyId?: string
  ) {
    this.registryApi = new RegistryApi(registryUrl);
    this.sharedSession = new SharedSession(registryUrl, sharedSessionSchema);
    this.bundler = bundler;
    this.encryptService = new EncryptionService();
    this.arbitrumSponsorshipPolicyId = arbitrumSponsorshipPolicyId;
  }

  async createVC(
    chain: keyof typeof availableNetworks,
    ocrData: any,
    credType: string,
    credExpirationDays: string
  ) {
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

    this.walletData = {
      ...(await predictWalletAddress(chain, `0x${privateKey}`)),
      privateKey: `0x${privateKey}`,
    };
    this.subjectDid = did;

    const claims = mapOcrToClaims(ocrData);
    const { id: credentialId } = await createCredential(
      this.subjectDid,
      privateKey,
      claims,
      credType,
      credExpirationDays
    );

    const vc = await getCredential(credentialId, this.subjectDid, privateKey);
    if (
      vc?.credentialSubject?.id &&
      vc.credentialSubject.id !== this.subjectDid
    ) {
      throw new Error('El VC devuelto no corresponde al DID del usuario.');
    }

    this.chain = chain;
    return vc;
  }

  async createWallet(dni: string) {
    if (!this.walletData || !this.chain) {
      throw new Error(
        'Wallet data or chain is not initialized, did you call createVC?'
      );
    }
    this.dni = dni;

    const response = await createWalletOnChain(
      this.chain,
      this.walletData.salt,
      this.walletData.privateKey,
      dni,
      this.bundler,
      '',
      this.arbitrumSponsorshipPolicyId
    );

    this.guardianAddress = response.guardianAddress;
    return response;
  }

  async storeOnDevice(pin: string, useBiometry: boolean) {
    if (!this.dni) {
      throw new Error('DNI is not initialized, did you call createWallet?');
    }
    if (!this.walletData || !this.subjectDid) {
      throw new Error(
        'Wallet data or subjectDid is not initialized, did you call createVC?'
      );
    }

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
        await Storage.saveUserDataWithBiometric(this.userData);
        await Biometric.setBioFlag(true);
      }

      this.encryptedUserData = await encryptVCWithPin(this.userData, pin);
      this.pin = pin;

      await Storage.saveUserData(this.encryptedUserData);
    } catch (error) {
      throw new Error('Error saving Wira data: ' + error);
    }
  }

  async storeDataOnServer() {
    if (!this.walletData || !this.subjectDid) {
      throw new Error(
        'Wallet data or subjectDid is not initialized, did you call createVC?'
      );
    }
    if (!this.dni) {
      throw new Error('DNI is not initialized, did you call createWallet?');
    }
    if (!this.userData || !this.encryptedUserData || !this.pin) {
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
      this.pin
    );

    await this.encryptService.connect();
    const encryptedData = await this.encryptService.encryptData({
      hashedData: hashedDataWithIdentity,
      rawData: userDataWithIdentity,
    });
    this.encryptService.litNodeClient?.disconnect();

    const response = await this.registryApi.registryRegister({
      did: this.subjectDid,
      accountAddress: this.userData.account,
      guardianContractAddress: this.guardianAddress,
      displayNamePublic: null,
      discoverableHashOptIn: true, // opt-in
      dni: this.dni,
      ciphertext: encryptedData.ciphertext,
      dataToEncryptHash: encryptedData.dataToEncryptHash,
    });

    await this.sharedSession.registerSharedSessionDevice(
      this.dni,
      this.pin,
      userDataWithIdentity
    );

    return response;
  }
}
