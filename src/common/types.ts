export type WiraSdkConfig = {
  appId: string;
  guardiansUrl: string;
};

export type WiraSdkEnviroment = {
  pushUrl: string;
  ipfsUrl: string;
  ipfsGatewayUrl: string;
  chainConfigs: {
    [chainId: string]: ChainConfigEntity;
  };
  didMethods: DidMethodEntity[];
};

export type ChainConfigEntity = {
  blockchain: string;
  network: string;
  rpcUrl: string;
  stateContractAddr: string;
};

export type DidMethodEntity = {
  name: string;
  blockchain: string;
  network: string;
  networkFlag: string;
  methodByte: string;
  chainID: string;
};

export type CircuitsToDownloadParam = {
  zipFileName: string;
  bucketUrl: string;
  circuitsWithChecksum: CircuitModel[];
};

export type CircuitModel = {
  fileName: string;
  circuitId: string;
  checksum: string | null;
};
