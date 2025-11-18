import { encodeFunctionData, erc20Abi, parseUnits, type Hex } from 'viem';

function sendErc20To(
  to: Hex,
  amount: string,
  tokenAddress: Hex,
  decimals: number
) {
  return {
    to: tokenAddress,
    value: BigInt(0),
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [to, parseUnits(amount, decimals)],
    }),
  };
}

export const WalletCalls = {
  sendErc20To,
};
