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
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { privateKeyToAccount } from 'viem/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { createSmartAccountClient } from 'permissionless';
import { keccak_256 } from '@noble/hashes/sha3.js';

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

  const account = await toSimpleSmartAccount({
    client,
    factoryAddress: FACTORY_ADDRESS,
    owner: privateKeyToAccount(privateKey),
    entryPoint: { address: entryPoint07Address, version: '0.7' },
    index: salt ?? newSalt,
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

    const account = await toSimpleSmartAccount({
      client: publicClient,
      factoryAddress: FACTORY_ADDRESS,
      owner: privateKeyToAccount(privateKey),
      entryPoint: { address: entryPoint07Address, version: '0.7' },
      index: salt,
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
