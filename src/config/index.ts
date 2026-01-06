import type {
  CircuitsToDownloadParam,
  WiraSdkConfig,
  WiraSdkEnviroment,
} from '../common/types';
import WiraSdk from '../NativeWiraSdk';

let configuration: WiraSdkConfig | null = null;

export async function initWiraSdk(cfg: WiraSdkConfig, env?: WiraSdkEnviroment) {
  configuration = cfg;
  let response;
  if (env) {
    response = JSON.parse(await WiraSdk.initialize(JSON.stringify(env)));
  } else {
    response = JSON.parse(await WiraSdk.initialize(''));
  }

  if (!response.success) {
    throw new Error(
      'Failed to initialize Wira SDK with provided environment: ' +
        response.error
    );
  }
}

export async function initDownloadCircuits(
  circuitsToDownload?: CircuitsToDownloadParam
): Promise<any> {
  let response;
  if (circuitsToDownload) {
    response = JSON.parse(
      await WiraSdk.downloadCircuits(JSON.stringify(circuitsToDownload))
    );
  } else {
    response = JSON.parse(await WiraSdk.downloadCircuits(''));
  }

  if (!response.success) {
    throw new Error('Failed to init download circuits: ' + response.error);
  }
}

export function getWiraConfig(): WiraSdkConfig {
  if (!configuration) {
    throw new Error('Wira SDK not initialized. Call initWiraSdk(...) first.');
  }
  return configuration;
}
