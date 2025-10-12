import { base, baseSepolia } from 'viem/chains';

export const FACTORY_ADDRESS = '0xf1A486Eaf648bC26d10eC60E8C4665BFB0d8947e';

export const availableNetworks = {
  'base-sepolia': {
    chain: baseSepolia,
    explorer: 'https://sepolia.basescan.org/',
  },
  'base': {
    chain: base,
    explorer: 'https://basescan.org/',
  },
};
