import {
  bytesToBigInt,
  bytesToHex,
  createPublicClient,
  encodeFunctionData,
  http,
  toHex,
  type Hex,
} from 'viem';
import { availableNetworks, FACTORY_ADDRESS } from '../common/params';
import { randomBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import {
  toSimpleSmartAccount,
  type SimpleSmartAccountImplementation,
} from 'permissionless/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import {
  entryPoint07Address,
  toCoinbaseSmartAccount,
  type SmartAccount,
} from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { createSmartAccountClient } from 'permissionless';
import { keccak_256 } from '@noble/hashes/sha3.js';

export class Wallet {
  constructor(
    private privateKey: Hex,
    private salt: string,
    private address: Hex,
    private chainId: keyof typeof availableNetworks,
    private bundler: string,
    private arbitrumSponsorshipPolicyId?: string
  ) {}

  async getAccount(): Promise<{
    account: SmartAccount<SimpleSmartAccountImplementation>;
    publicClient: any;
  }> {
    const owner = privateKeyToAccount(this.privateKey);

    const publicClient = createPublicClient({
      chain: availableNetworks[this.chainId].chain,
      transport: http(),
    });

    const account = await toSimpleSmartAccount({
      client: publicClient,
      index: BigInt(this.salt),
      address: this.address,
      factoryAddress: FACTORY_ADDRESS,
      owner,
      entryPoint: { address: entryPoint07Address, version: '0.7' },
    });

    return { account, publicClient };
  }

  async executeOperation(
    callData: any,
    waitEvent: (
      chain: string,
      eventName: string,
      txBlock: bigint,
      attempts?: number
    ) => Promise<any>,
    eventName: string
  ) {
    const { account, publicClient } = await this.getAccount();
    const { chain } = availableNetworks[this.chainId];

    const pimlicoClient = createPimlicoClient({
      chain,
      transport: http(this.bundler),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    const arbitrumParams = this.chainId.startsWith('arbitrum')
      ? {
          paymasterContext: {
            sponsorshipPolicyId: this.arbitrumSponsorshipPolicyId,
          },
          userOperation: {
            estimateFeesPerGas: async () => {
              return (await pimlicoClient.getUserOperationGasPrice()).standard;
            },
          },
        }
      : {};

    const smartAccountClient = createSmartAccountClient({
      account,
      chain,
      bundlerTransport: http(this.bundler),
      paymaster: pimlicoClient,
      ...arbitrumParams,
    });

    const txHash = await smartAccountClient.sendTransaction(callData);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    let returnData;
    if (waitEvent && eventName) {
      returnData = await waitEvent(
        this.chainId,
        eventName,
        receipt.blockNumber
      );
    }

    const block = await publicClient.getBlock({
      blockNumber: receipt.blockNumber,
    });
    const date = new Date(Number(block.timestamp) * 1000);
    return { returnData, receipt, date: date.toLocaleString() };
  }
}

export async function predictWalletAddress(
  chain: keyof typeof availableNetworks,
  privateKey: Hex,
  salt?: bigint
) {
  const newSalt = salt ?? bytesToBigInt(randomBytes(32));

  const client = createPublicClient({
    chain: availableNetworks[chain].chain,
    transport: http(),
  });

  const account = await toCoinbaseSmartAccount({
    client,
    owners: [privateKeyToAccount(privateKey)],
    nonce: salt ?? newSalt,
    version: '1',
  });

  return { address: account.address, salt: newSalt };
}

export function hashIdentifier(dni: string, salt = '') {
  return keccak_256(utf8ToBytes(dni + salt));
}

export async function createWalletOnChain(
  chainId: keyof typeof availableNetworks,
  salt: bigint,
  privateKey: Hex,
  dni: string,
  bundler: string,
  streamId = '',
  sponsorshipPolicyId?: string
) {
  try {
    if (!availableNetworks[chainId]) {
      throw new Error(`Configuración no encontrada para chain: ${chainId}`);
    }

    const { chain } = availableNetworks[chainId];

    const publicClient = createPublicClient({
      chain,
      transport: http(),
    });

    const account = await toCoinbaseSmartAccount({
      client: publicClient,
      owners: [privateKeyToAccount(privateKey)],
      nonce: salt,
      version: '1',
    });

    const pimlicoClient = createPimlicoClient({
      chain,
      transport: http(bundler),
      entryPoint: {
        address: entryPoint07Address,
        version: '0.7',
      },
    });

    const arbitrumParams = chainId.startsWith('arbitrum')
      ? {
          paymasterContext: { sponsorshipPolicyId },
          userOperation: {
            estimateFeesPerGas: async () => {
              return (await pimlicoClient.getUserOperationGasPrice()).standard;
            },
          },
        }
      : {};

    const smartAccountClient = createSmartAccountClient({
      account,
      chain,
      bundlerTransport: http(bundler),
      paymaster: pimlicoClient,
      ...arbitrumParams,
    });

    const idHash = bytesToHex(hashIdentifier(dni, salt.toString()));

    const data = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'registerStream',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'idHash', type: 'bytes32' },
            { name: 'streamId', type: 'string' },
          ],
        },
      ],
      functionName: 'registerStream',
      args: [idHash, streamId],
    });

    const hash = await smartAccountClient.sendTransaction({
      calls: [
        {
          to: account.address,
          value: BigInt(0),
          data,
        },
      ],
    });
    const guardianReceipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    return { guardianReceipt, guardianAddress: toHex('0x0') };
  } catch (error: any) {
    if (error.message.includes('instanceof')) {
      throw new Error(
        'Error de tipo en registerStreamOnChain - verifica las importaciones de viem'
      );
    } else {
      throw new Error(`registerStreamOnChain failed: ${error.message}`);
    }
  }
}
