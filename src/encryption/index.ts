import { LIT_ABILITY, LIT_NETWORK } from '@lit-protocol/constants';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { encryptString } from '@lit-protocol/encryption';
import { Wallet } from 'ethers';
import RNFS from 'react-native-fs';
import {
  createSiweMessage,
  generateAuthSig,
  LitActionResource,
} from '@lit-protocol/auth-helpers';
import { discoverableHashFromDni } from '../register/idHash';
import { getProvision } from '../common/provisionClient';

// Polyfill for global document and Event in React Native
if (typeof global.document === 'undefined') {
  global.document = {
    createElement: () => {
      return {} as HTMLElement;
    },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [] as any as NodeListOf<Element>,
    dispatchEvent: () => true,
  } as unknown as Document;
}

if (!window.location) {
  (window as any).location = {
    href: '',
    protocol: '',
    host: '',
    hostname: '',
    port: '',
    pathname: '',
    search: '',
    hash: '',
    origin: '',
    assign: () => {},
    reload: () => {},
    replace: () => '',
  };
}

if (typeof global.Event === 'undefined') {
  (global as any).Event = class Event {
    type: any;
    bubbles: any;
    cancelable: any;

    constructor(type: any, options: any = {}) {
      this.type = type;
      this.bubbles = options.bubbles || false;
      this.cancelable = options.cancelable || false;
    }
  };
}

export class EncryptionService {
  litNodeClient;
  ethersWallet;
  ciAction = 'Qmcit12qGdPbbmAdXYQW7QwTv1zpx98JMeGqrxE9os6TGt';
  guardianAction = 'QmaEnk58S7jfTrhJ46TAD77ebqEsAsukb1KhHMhKzmoxPi';

  // Example access control condition: only allow decryption if the user has signed a message with a specific IPFS ID
  accessControlConditions = [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':currentActionIpfsId'],
      returnValueTest: {
        comparator: '=',
        value: this.ciAction,
      },
    },
    { operator: 'or' },
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':currentActionIpfsId'],
      returnValueTest: {
        comparator: '=',
        value: this.guardianAction,
      },
    },
  ];

  constructor() {
    // Initialize LitNodeClient and ethers wallet
    this.litNodeClient = new LitNodeClient({
      litNetwork: LIT_NETWORK.DatilDev,
      debug: true,
      connectTimeout: 60000,
    });
    this.ethersWallet = Wallet.createRandom();
  }

  // Connect to the Lit network
  async connect() {
    await this.litNodeClient.connect();
  }

  // Convert image file to base64 string, this will be used for convert CI images
  async imageToBase64(imagePath: string) {
    try {
      const base64 = await RNFS.readFile(imagePath, 'base64');
      return base64;
    } catch (error: any) {
      throw new Error('Failed to convert image to base64: ' + error.message);
    }
  }

  // Encrypt data with an Access Control Condition
  async encryptData(object: Object) {
    return encryptString(
      {
        dataToEncrypt: JSON.stringify(object),
        accessControlConditions: this.accessControlConditions,
      },
      this.litNodeClient
    );
  }

  // Decrypt data using CI images and CI number
  async decryptDataWithCI(
    frontImg: string,
    backImg: string,
    selfieImg: string,
    CI: string
  ) {
    const prov = await getProvision();
    const apiKey = prov?.gemini?.apiKey;

    if (!apiKey) {
      throw new Error('API key for Gemini is not configured.');
    }

    // Get session signatures from Lit nodes to let wallet use the Lit network
    const sessionSigs = await this.getSessionSigns();

    // Execute the decryption on the Lit network
    // The IPFS ID here should match the one in the access control condition
    // In a real-world scenario, jsParams must include CI images, selfie, CI, and apiKey for validation
    // Here we use a placeholder 'isValid' param for simplicity
    const response = await this.litNodeClient.executeJs({
      ipfsId: this.ciAction,
      sessionSigs,
      jsParams: {
        accessControlConditions: this.accessControlConditions,
        apiKey,
        CI: discoverableHashFromDni(CI),
        frontImg,
        backImg,
        selfieImg,
      },
    });

    return response;
  }

  // Decrypt data using Guardian (not implemented yet)
  async decryptDataWithGuardian() {}

  async getSessionSigns() {
    return this.litNodeClient.getSessionSigs({
      chain: 'ethereum',
      expiration: new Date(Date.now() + 1000 * 60 * 5).toISOString(), // 5 minutes
      resourceAbilityRequests: [
        {
          resource: new LitActionResource('*'),
          ability: LIT_ABILITY.LitActionExecution,
        },
      ],
      authNeededCallback: async ({
        uri,
        expiration,
        resourceAbilityRequests,
      }) => {
        const toSign = await createSiweMessage({
          uri,
          expiration,
          resources: resourceAbilityRequests,
          walletAddress: this.ethersWallet.address,
          nonce: await this.litNodeClient.getLatestBlockhash(),
          litNodeClient: this.litNodeClient,
        });

        return await generateAuthSig({
          signer: this.ethersWallet,
          toSign,
        });
      },
    });
  }
}
