import { createPublicClient, http, type Hex } from 'viem';
import factoryAbi from '../common/abi/SimpleAccountFactory.json' with { type: 'json' };
import { availableNetworks, FACTORY_ADDRESS } from '../common/params';

export async function getPredictedGuardian(
  chainKey: keyof typeof availableNetworks,
  account: string,
  salt: bigint
) {
  const client = createPublicClient({
    chain: availableNetworks[chainKey].chain,
    transport: http(),
  });

  try {
    const guardian = await client.readContract({
      address: FACTORY_ADDRESS,
      abi: factoryAbi,
      functionName: 'getGuardianAddress',
      args: [account, salt],
    });
    return guardian as Hex;
  } catch (err) {
    return null;
  }
}
