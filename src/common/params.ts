import {
  arbitrum,
  arbitrumSepolia,
  baseSepolia,
  optimismSepolia,
} from 'viem/chains';
import { SPONSORSHIP_POLICY, FACTORY, BUNDLER, BUNDLER_MAIN } from '@env';

export const sponsorshipPolicyId = SPONSORSHIP_POLICY;
export const FACTORY_ADDRESS = FACTORY;

export const availableNetworks = {
  'opt-sepolia': {
    chain: optimismSepolia,
    bundler:
      'https://opt-sepolia.g.alchemy.com/v2/1HZ0spY7inRe8hCdLeLCqvUh6itMQA18',
    explorer: 'https://sepolia-optimism.etherscan.io',
    wormholeBridge: '0x99737Ec4B815d816c49A385943baf0380e75c0Ac',
    wormholeChainId: 10005,
    tokenPaymaster: '0xf00E8cC403585603066D46c43EDD873D036b367c', //'0x22fe92bDD7f8d1aC72a2EF10a2fFF49CD9f6BEAd', //'0x4Ea8B3aCF1019a8Cd1B726E67Eac9e2c43161376',
    crossChainReveiver: null,
  },
  'base-sepolia': {
    chain: baseSepolia,
    bundler:
      'https://base-sepolia.g.alchemy.com/v2/1HZ0spY7inRe8hCdLeLCqvUh6itMQA18',
    explorer: 'https://sepolia.basescan.org',
    wormholeBridge: '0x86F55A04690fd7815A3D802bD587e83eA888B239',
    wormholeChainId: 10004,
    tokenPaymaster: null,
    crossChainReveiver: '0x74934a887162BB8B2ffe2acB9D73afC241620Ed2', //'0xC92eFfEc6732410b147Dea6e5562Ce59F0AAeAeC',
  },
  'arbitrum-sepolia': {
    chain: arbitrumSepolia,
    bundler: BUNDLER,
    explorer: 'https://sepolia.arbiscan.io/',
    wormholeChainId: null,
    tokenPaymaster: null,
    crossChainReveiver: null,
  },
  'arbitrum': {
    chain: arbitrum,
    bundler: BUNDLER_MAIN,
    explorer: 'https://arbiscan.io/',
    wormholeChainId: null,
    tokenPaymaster: null,
    crossChainReveiver: null,
  },
};
