import RNFS from 'react-native-fs';
import '../polyfills/customEvent';
import { discoverableHashFromDni } from '../register/idHash';
import { getProvision } from '../common/provisionClient';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import { createLitClient, type NagaLitClient } from '@lit-protocol/lit-client';
import { nagaDev } from '@lit-protocol/networks';
import { type UnifiedAccessControlCondition } from '@lit-protocol/access-control-conditions-schemas';
import { createAuthManager } from '@lit-protocol/auth';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Polyfill for global document in React Native
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

class InMemoryStorage {
  private storage: Map<string, any>;

  constructor() {
    this.storage = new Map();
  }

  config() {}

  async write({ address, authData }: { address: string; authData: any }) {
    this.storage.set(`lit-auth:${address}`, authData);
  }
  async read({ address }: { address: string }) {
    return this.storage.get(`lit-auth:${address}`);
  }
  async writeInnerDelegationAuthSig({
    publicKey,
    authSig,
  }: {
    publicKey: string;
    authSig: string;
  }) {
    this.storage.set(`lit-delegation:${publicKey}`, authSig);
  }
  async readInnerDelegationAuthSig({ publicKey }: { publicKey: string }) {
    return this.storage.get(`lit-delegation:${publicKey}`);
  }
  async writePKPTokens(params: {
    authMethodType: number | bigint;
    authMethodId: string;
    tokenIds: string[];
  }) {
    const key = `lit-pkp-tokens:${params.authMethodType}:${params.authMethodId}`;
    this.storage.set(key, JSON.stringify(params.tokenIds));
  }
  async readPKPTokens(params: {
    authMethodType: number | bigint;
    authMethodId: string;
  }) {
    const key = `lit-pkp-tokens:${params.authMethodType}:${params.authMethodId}`;
    const data = this.storage.get(key);
    return data ? (JSON.parse(data) as string[]) : null;
  }
}

export class EncryptionService {
  litNodeClient?: NagaLitClient;
  authManager: ReturnType<typeof createAuthManager>;
  ethersWallet;
  ciAction = 'QmQJMa2V5ozRD13LdaRiDdFdJQnjvbC4tmG16r3Y5UXzPy'; // Dev: 'QmdSG44iLviHEdSCsdtyaZfPsddbd5HgP67NNLQ2buvyVn';
  guardianAction = 'QmbfDNUvNzPVi8HvL3xSWHrJCb4BMGFi8wMPaU48PuXdiv'; // Dev: 'QmSR48uxLVngB6qSXu4AJKjbiQ3c3vfR9pDGypfgZFX93d';

  // Example access control condition: only allow decryption if the user has signed a message with a specific IPFS ID
  accessControlConditions: UnifiedAccessControlCondition[] = [
    {
      conditionType: 'evmBasic',
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
      conditionType: 'evmBasic',
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
    this.ethersWallet = privateKeyToAccount(generatePrivateKey());
    this.authManager = createAuthManager({
      storage: new InMemoryStorage(),
    });
  }

  // Connect to the Lit network
  async connect() {
    this.litNodeClient = await createLitClient({
      network: nagaDev,
    });
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
    if (!this.litNodeClient) {
      throw new Error('Lit Node Client is not connected.');
    }

    return this.litNodeClient.encrypt({
      dataToEncrypt: jsonStringifyWithBigInt(object),
      unifiedAccessControlConditions: this.accessControlConditions,
    });
  }

  // Decrypt data using CI images and CI number
  async decryptDataWithCI(
    frontImg: string,
    backImg: string,
    selfieImg: string,
    CI: string
  ): Promise<any> {
    if (!this.litNodeClient) {
      throw new Error('Lit Node Client is not connected.');
    }

    const prov = await getProvision();
    const apiKey = prov?.gemini?.apiKey;

    if (!apiKey) {
      throw new Error('API key for Gemini is not configured.');
    }

    // Get session signatures from Lit nodes to let wallet use the Lit network
    const sessionSigs = await this.getSessionSigns();

    const response = await this.litNodeClient.executeJs({
      ipfsId: this.ciAction,
      authContext: sessionSigs,
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
  async decryptDataWithGuardian(
    dniHash: string,
    deviceId: string
  ): Promise<any> {
    if (!this.litNodeClient) {
      throw new Error('Lit Node Client is not connected.');
    }

    // Get session signatures from Lit nodes to let wallet use the Lit network
    const sessionSigs = await this.getSessionSigns();

    const response = await this.litNodeClient.executeJs({
      ipfsId: this.guardianAction,
      authContext: sessionSigs,
      jsParams: {
        accessControlConditions: this.accessControlConditions,
        dniHash,
        deviceId,
      },
    });

    return response;
  }

  async getSessionSigns(): Promise<any> {
    if (!this.litNodeClient) {
      throw new Error('Lit Node Client is not connected.');
    }

    return this.authManager.createEoaAuthContext({
      config: { account: this.ethersWallet },
      authConfig: {
        expiration: new Date(Date.now() + 1000 * 60 * 5).toISOString(), // 5 minutes
        domain: 'wira.com',
        statement: 'Authenticate to Wira SDK',
        resources: [['lit-action-execution', '*']],
      },
      litClient: this.litNodeClient,
    });
  }
}
