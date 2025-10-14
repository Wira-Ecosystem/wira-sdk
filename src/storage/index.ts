import { Share } from 'react-native';
import NativeWiraProvider from '../provider/NativeWiraSdk';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';

/**
 * Mock function to simulate fetching app names from an API.
 */
export function getAppsNames() {
  return ['com.wirawallet', 'com.appelectoral'];
}

/**
 * Get the content URI for a specific app.
 * @param appName - The package name of the app (e.g., 'com.wirawallet').
 * @returns The content URI for the app's user data.
 */
export function getUri(appName: string) {
  const modifiedAppName = appName.replace(/^com\./, '');
  return `content://com.wira.${modifiedAppName}.provider/user`;
}

/**
 * Get user data from external apps.
 * @param ownAppName - The package name of the current app (e.g., 'com.wirawallet').
 * @returns found user data or null if not found.
 */
export function getDataFromExternalApps(ownAppName: string) {
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

/**
 * Get Wira data from a specific app.
 * @param appName - The package name of the app (e.g., 'com.wirawallet').
 * @returns found user data or null if not found.
 */
export function getWiraDataFrom(appName: string) {
  const uri = getUri(appName);
  console.log('Checking Wira data in:', uri);

  try {
    const response = NativeWiraProvider.queryUser(uri);
    return Object.keys(response).length > 0 ? response : null;
  } catch (error: any) {
    console.log(error);
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

async function shareData(appName: string) {
  const data = getWiraDataFrom(appName);
  if (!data) {
    throw new Error('No data to share');
  }
  const jsonData = jsonStringifyWithBigInt(data);

  try {
    const result = await Share.share({
      message: jsonData,
      title: 'Compartir datos de Wira',
    });

    if (result.action === Share.dismissedAction) {
      console.log('Share dismissed');
    }
  } catch (error) {
    console.error('Error sharing:', error);
  }
}

export const Storage = {
  shareData,
};
