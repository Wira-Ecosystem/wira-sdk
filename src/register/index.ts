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

export type WalletData = {
  address: `0x${string}`;
  salt: bigint;
  privateKey: `0x${string}`;
};

export class Registerer {
  walletData: WalletData | null = null;
  chain: keyof typeof availableNetworks | null = null;
  subjectDid: string | null = null;
  guardianAddress: `0x${string}` | null = null;
  dni: string | null = null;
  vc: any = null;
  registryApi: RegistryApi;
  bundler: string;
  sponsorshipPolicyId: string;
  encryptService: EncryptionService;
  encryptedCredential: string | null = null;

  constructor(
    registryUrl: string,
    bundler: string,
    sponsorshipPolicyId: string
  ) {
    this.registryApi = new RegistryApi(registryUrl);
    this.bundler = bundler;
    this.sponsorshipPolicyId = sponsorshipPolicyId;
    this.encryptService = new EncryptionService();
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
      this.sponsorshipPolicyId
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

    const dataToEncrypt = {
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
          JSON.stringify({ stored: dataToEncrypt }),
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

      const encryptedCredential = await encryptVCWithPin(dataToEncrypt, pin);
      const response = NativeWiraProvider.insertUser(getUri(appName), {
        credential: encryptedCredential,
      });
      this.encryptedCredential = encryptedCredential;
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
    if (!this.encryptedCredential) {
      throw new Error(
        'No encrypted credential to store on server, did you call storeOnDevice?'
      );
    }

    await this.encryptService.connect();
    const encryptedData = await this.encryptService.encryptData({
      credential: this.encryptedCredential,
    });
    this.encryptService.litNodeClient.disconnect();
    console.log('Encrypted data to store on server:');
    console.log(encryptedData);

    return this.registryApi.registryRegister({
      did: this.subjectDid,
      accountAddress: this.walletData.address,
      guardianContractAddress: this.guardianAddress,
      displayNamePublic: null,
      discoverableHashOptIn: true, // opt-in
      dni: this.dni,
      ciphertext: encryptedData.ciphertext,
      dataToEncryptHash: encryptedData.dataToEncryptHash,
    });
  }
}
