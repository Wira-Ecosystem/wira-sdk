import { randomBytes } from '@noble/hashes/utils.js';
import { createWalletOnChain, predictWalletAddress } from '../wallet';
import type { availableNetworks } from '../common/params';
import { bytesToHex, type Hex } from 'viem';
import { didFromEthAddress } from './did';
import { createCredential, mapOcrToClaims, waitForVC } from './issuerClient';
import { RegistryApi } from './registry';
import NativeWiraProvider from '../provider/NativeWiraSdk';
import { encryptVCWithPin } from '../vcCrypto';
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import { EncryptionService } from '../encryption';
import { getUri } from '../common/utils';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import { getWiraDataFrom } from '../storage';
import { SharedSession } from '../shared-session';

export type WalletData = {
  address: `0x${string}`;
  salt: bigint;
  privateKey: `0x${string}`;
};

export type UserData = {
  vc: string;
  dni: string;
  salt: bigint;
  privKey: string;
  account: string;
  guardian: string | null;
  did: string;
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
  vc: any = null;
  appName: string | null = null;
  pin: string | null = null;
  registryApi: RegistryApi;
  sharedSession: SharedSession;
  bundler: string;
  encryptService: EncryptionService;
  encryptedCredential: string | null = null;
  rawCredential: UserData | null = null;
  arbitrumSponsorshipPolicyId: string | undefined = undefined;

  /**
   * Registerer constructor
   * @param registryUrl the URL of the backend-identity provided
   * @param bundler url of base paymaster url provided
   * @param arbitrumSponsorshipPolicyId optional sponsorship policy id for arbitrum networks
   */
  constructor(
    registryUrl: string,
    bundler: string,
    arbitrumSponsorshipPolicyId?: string
  ) {
    this.registryApi = new RegistryApi(registryUrl);
    this.sharedSession = new SharedSession(registryUrl, '');
    this.bundler = bundler;
    this.encryptService = new EncryptionService();
    this.arbitrumSponsorshipPolicyId = arbitrumSponsorshipPolicyId;
  }

  async createVC(
    chain: keyof typeof availableNetworks,
    ocrData: any,
    credType: string,
    credExpirationDays: string,
    ownerPk?: Hex
  ) {
    const privKey = ownerPk ?? bytesToHex(randomBytes(32));
    this.walletData = {
      ...(await predictWalletAddress(chain, privKey)),
      privateKey: privKey,
    };

    const { did } = didFromEthAddress(this.walletData.address);
    this.subjectDid = did;
    const claims = mapOcrToClaims(ocrData);
    const { id: credentialId } = await createCredential(
      this.subjectDid,
      claims,
      credType,
      credExpirationDays
    );
    const vc = await waitForVC(credentialId);
    if (
      vc?.credentialSubject?.id &&
      vc.credentialSubject.id !== this.subjectDid
    ) {
      throw new Error('El VC devuelto no corresponde al DID del usuario.');
    }

    this.chain = chain;
    this.vc = vc;
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

  async storeOnDevice(appName: string, pin: string, useBiometry: boolean) {
    if (!this.vc) {
      throw new Error('VC is not initialized, did you call createVC?');
    }
    if (!this.dni) {
      throw new Error('DNI is not initialized, did you call createWallet?');
    }
    if (!this.walletData || !this.subjectDid) {
      throw new Error(
        'Wallet data or subjectDid is not initialized, did you call createVC?'
      );
    }

    this.rawCredential = {
      vc: this.vc,
      dni: this.dni,
      salt: this.walletData.salt,
      privKey: this.walletData.privateKey,
      account: this.walletData.address,
      guardian: this.guardianAddress,
      did: this.subjectDid,
    };

    try {
      if (useBiometry) {
        await Keychain.setGenericPassword(
          'bundle',
          jsonStringifyWithBigInt({ stored: this.rawCredential }),
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
      }

      this.encryptedCredential = await encryptVCWithPin(
        this.rawCredential,
        pin
      );
      this.pin = pin;

      const userUri = getUri(appName);

      const previousData = getWiraDataFrom(appName);
      if (previousData) {
        NativeWiraProvider.deleteUser(userUri);
      }
      this.appName = appName;

      const response = NativeWiraProvider.insertUser(userUri, {
        credential: this.encryptedCredential,
      });
      return response;
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
    if (
      !this.encryptedCredential ||
      !this.rawCredential ||
      !this.appName ||
      !this.pin
    ) {
      throw new Error(
        'No credential to store on server, did you call storeOnDevice?'
      );
    }

    await this.encryptService.connect();
    const encryptedData = await this.encryptService.encryptData({
      hashedData: this.encryptedCredential,
      rawData: this.rawCredential,
    });
    this.encryptService.litNodeClient.disconnect();

    const response = await this.registryApi.registryRegister({
      did: this.subjectDid,
      accountAddress: this.walletData.address,
      guardianContractAddress: this.guardianAddress,
      displayNamePublic: null,
      discoverableHashOptIn: true, // opt-in
      dni: this.dni,
      ciphertext: encryptedData.ciphertext,
      dataToEncryptHash: encryptedData.dataToEncryptHash,
    });

    await this.sharedSession.registerSharedSessionDevice(
      this.dni,
      this.appName,
      this.pin,
      this.rawCredential
    );

    return response;
  }
}
