import NativeWiraProvider from './provider/NativeWiraSdk';
import * as provision from './common/provisionClient';
import { RegistryApi } from './register/registry';
import idCardAnalyzer from './id-analyzer/idCardAnalyzer';
import { Registerer } from './register';
import { decryptVCWithPin } from './vcCrypto';
import { EncryptionService } from './encryption';
import { RecoveryService } from './recovery';

/**
 * Mock function to simulate fetching app names from an API.
 */
function getAppsNames() {
  return ['com.wirawallet', 'com.appelectoral'];
}

function getWiraData(ownAppName: string) {
  //check local storage first
  let userData = getWiraDataFrom(ownAppName);
  if (userData) {
    console.log('User data found in own app:', userData);
    return userData;
  }

  //check data on external apps
  userData = getDataFromExternalApps(ownAppName);
  if (userData) {
    console.log('User data found on external app:');
    return userData;
  } else {
    console.log('No Wira data found in external apps. Registering needed...');
    return null;
  }
}

async function signIn({ credential }: { credential: string }, pin: string) {
  try {
    return decryptVCWithPin(credential, pin);
  } catch (error) {
    console.error('Error decrypting VC with PIN:', error);
    throw new Error('Invalid PIN');
  }
}

function getUri(appName: string) {
  const modifiedAppName = appName.replace(/^com\./, '');
  return `content://com.wira.${modifiedAppName}.provider/user/1`;
}

function getDataFromExternalApps(ownAppName: string) {
  const apps = getAppsNames().filter((app) => app !== ownAppName);
  let userData = null;

  for (const appName of apps) {
    const data = getWiraDataFrom(appName);
    if (data) {
      userData = data;
      break;
    }
  }

  return userData;
}

function getWiraDataFrom(appName: string) {
  console.log('Checking Wira data from app:', appName);

  const uri = getUri(appName);

  try {
    const response = NativeWiraProvider.queryUser(uri);
    return Object.keys(response).length > 0 ? response : null;
  } catch (error: any) {
    if (
      error.message.includes(
        "The query result was empty, but expected a single row to return a NON-NULL object of type 'com.nativewiraprovider.User'"
      )
    ) {
      return null; // No data found on own app, return null
    }
    console.error('Error checking Wira data:', error);
    return null;
  }
}

const wira = {
  getWiraData,
  signIn,
  NativeWiraProvider,
  provision,
  RegistryApi,
  idCardAnalyzer,
  Registerer,
  EncryptionService,
  RecoveryService,
};
export default wira;
