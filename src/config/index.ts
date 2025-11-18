export type WiraSdkConfig = {
  appId: string;
  guardiansUrl: string;
};

let configuration: WiraSdkConfig | null = null;

export function initWiraSdk(cfg: WiraSdkConfig) {
  configuration = cfg;
}

export function getWiraConfig(): WiraSdkConfig {
  if (!configuration) {
    throw new Error('Wira SDK not initialized. Call initWiraSdk(...) first.');
  }
  return configuration;
}
