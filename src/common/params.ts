import { arbitrum, arbitrumSepolia } from 'viem/chains';

export const FACTORY_ADDRESS = '0x74b3151e1df8f7bAdf2e0D32617C68B9C50a357E';

export const availableNetworks = {
  'arbitrum-sepolia': {
    chain: arbitrumSepolia,
    explorer: 'https://sepolia.arbiscan.io/',
  },
  'arbitrum': {
    chain: arbitrum,
    explorer: 'https://arbiscan.io/',
  },
};
