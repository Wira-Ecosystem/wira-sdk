import NativeWiraProvider from './provider/NativeWiraSdk';
/**
 * Mock function to simulate fetching app names from an API.
 */
function getAppsNames() {
  return ['com.firstapp', 'com.secondapp', 'com.thirdapp', 'com.fourthapp'];
}

function signInWithWira(ownAppName: string) {
  //check local storage first
  let userData = getWiraDataFrom(ownAppName);
  if (userData) {
    console.log('User data found in own app:', userData);
    return userData;
  }

  //check data on external apps
  userData = getDataFromExternalApps();
  if (userData) {
    console.log('User data found on external app:', userData);
    return userData;
  } else {
    console.log('No Wira data found in external apps. Registering needed...');
    return null;
  }
}

function getUri(appName: string) {
  const modifiedAppName = appName.replace(/^com\./, '');
  return `content://com.wira.${modifiedAppName}.provider/user/1`;
}

function getDataFromExternalApps() {
  const apps = getAppsNames();
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

function writeData(ownAppName: string, userData: Object) {
  console.log('Saving Wira data...');
  try {
    const response = NativeWiraProvider.insertUser(
      getUri(ownAppName),
      userData
    );
    console.log('Wira response:', response);
    return true;
  } catch (error) {
    console.error('Error saving Wira data:', error);
    return false;
  }
}

export { signInWithWira, writeData, NativeWiraProvider };
