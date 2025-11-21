# wira-sdk

Wira self-sovereign identity and smart wallet library for react-native.

Warning: this repository is still in development and may have breaking changes.

## Installation


```sh
npm install wira-sdk
```
Support for Expo projects will be available soon.

## Setup
To let signing in with Wira from another apps, add these filter intent inside your main activity tag
```xml
<activity>
    <intent-filter android:label="Wira Shared Session">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.BROWSABLE" />
        <category android:name="android.intent.category.DEFAULT" />
        <data android:scheme="<your-scheme-name>"
            android:host="shared.request" />
        <data android:scheme="<your-scheme-name>"
            android:host="shared.response" />
    </intent-filter>
</activity>
```

## Usage

To register a new user
```js
import wira from 'wira-sdk';

//Recommended to save these variables con .env file
const BACKEND_IDENTITY = 'https://ssi.wirawallet.com';
const CRED_TYPE = 'PersonCredential';
const CRED_EXP_DAYS = 365;

//Your Pimlico or Base RPC api
const bundler = 'https://api.pimlico.io/v2/42161/rpc?apikey=<api-key>'
//https://api.developer.coinbase.com/rpc/v1/base/<api-ley>

//Pimlico paymaster policy ID
const sponsorshipPolicyId = 'example-id';

//Currently supported: arbitrum, arbitrum-sepolia, base, base-sepolia
const CHAIN = 'arbitrum-sepolia';

//Your scheme name provided on manifest
const SCHEME_NAME = '<your-scheme-name>'

//Create the registerer class
const registerer = new wira.Registerer(
    BACKEND_IDENTITY,
    SCHEME_NAME,
    bundler,
    sponsorshipPolicyId
);

//Step 1: Create the user verifiable credential (VC)
const userData = {
    fullName: '',
    governmentIdentifier: '',
    dateOfBirth: 21873
}
await registerer.createVC(
    CHAIN,
    userData,
    CRED_TYPE,
    CRED_EXP_DAYS
);

//step 2: Create user Smart Wallet
const dni = '326528374' //user DNI number
await registerer.createWallet(dni)

//step 3: Store user data on device
const pin = '3242' //User PIN to login
const useBiometry = true //To login with fingerprint (android), Touch ID or FaceID (IOS)
await registerer.storeOnDevice(pin, useBiometry);

//step 4: Save data on our servers for recovery and session sharing functions
const response = await registerer.storeDataOnServer();
if (!response.ok) {
    throw new Error(response.error);
}
```
The user data is saved on device Keystore/Keychain, and saved on our servers ecrypted using [LIT protocol](https://www.litprotocol.com/) for recovery purpouses.

Additionaly, our servers store an in-app generated ID with the provided scheme name to handle shared sessions.

After registry, the user can sign in with the data encrypted in their device using their pin.
```js
//Check if user has stored data
const hasUserData = await wira.Storage.checkUserData();
//If data exists, try to sign in using their PIN
if (hasUserData) {
    const userData = await wira.signIn(pin.trim());
    console.log(userData) //decrypted user Data
}
```

## Enable/Disable biometry
User can choose to login using Fingerprint (android) or TouchID/FaceID (first available on IOS). Use this to enable/disable biometry:
```js
const enableBiometrics = true;
await wira.toggleBiometricAuth(userData, enableBiometrics);
```

On login, add the biometric auth, this automatically will return the user data if biometric check is successful:
```js
//to check if biometry login is enabled
const enabled = await Biometric.getBioFlag();
if(enabled) {
    const {error, userData} = await wira.checkBiometricAuth();
}
```

## Update user PIN
To update user PIN, ask the user for old and new PIN, and the SDK will encrypt the user data with the new PIN.
```js
await wira.updatePin(BACKEND_IDENTITY, oldPin, newPin);
```

## Recovery account
wira-sdk provides three recovery methods

### By QR
User can generate a QR to save in a secure place, and recovery their account scanning this QR. To generate the QR follow these steps.

- Step 1: prepare the userData to be represented in QR, this function will compress and encode it using base64

```js
//instance the recovery service
const recoveryService = new wira.RecoveryService();

//you can also save if using biometry login
const bioEnabled = await getBioFlag();
const prepared = recoveryService.prepareQrData({...userData, bioEnabled});
```

- Step 2: Use any QR generator to show the QR to user, in this example we'll use react-native-qrcode-svg to generate the QR and react-native-view-shot to capture the image.
```js
function QRView() {
    const viewShotRef = useRef(null);
    //...code to prepare qr data

    return (
        <ViewShot
            ref={viewShotRef}
            options={{
                format: 'png',
                quality: 1.0,
                width: 1500,
                height: 1500,
                result: 'base64',
            }}
        >
            <QRCodeSVG
                value={prepared}
                backgroundColor="#fff"
                color="#000"
                quietZone={10}
            />
        </ViewShot>
    );
}
```

- Step 3: To save the QR, request to user gallery permission and call the save function
```js
const hasPermission = await recoveryService.requestGalleryPermission();

//Capture the QR image with View Shot
const uri = await viewShotRef.current.capture();

const {savedOn, path, fileName} = await recoveryService.saveQrOnDevice(uri);
//savedOn will return 'gallery' if QR can be saved on gallery, else it will save on 'downloads' and return this.
```

To recovery user account follow these steps.

- Step 1: Read the QR file and call the recovery function
```js
const dataFromQr = await recoveryService.recoveryFromQr(file.uri);
```

- Step 2: Save the recovered data with a new PIN, after this the user can login with their account.
```js
await recoveryService.saveQrData(dataFromQr, newPIN, SCHEME_NAME, BACKEND_IDENTITY);
```

### By CI + PIN
User can recovery therir account providing the Document and PIN they used to register. To achieve this ask the user for their Document Number, back/front photos of their Document and a Selfie

```js
const recoveryService = new wira.RecoveryService();
await recoveryService.recoveryAndSave(
    frontImage,
    backImage,
    selfie,
    docNumber,
);
```

This function automatically request LIT to verify provided Document and save on user device the PIN encrypted data if verification is successfully. It will take a white, so is recommended to show a loader. After this, the user can login with their PIN.

Note: the PIN for recovery will update if:
- User updates their PIN
- User recovery account using QR or Guardians


### By Guardians
User can Invite another people as their guardians, if the user looses their account, can request to guardians a recovery process. These will be success if at least N of S guardians approve the request.

First, call this function to let send and receive guardian notifications.
```js
const guardianApi = new wira.GuardiansApi(BACKEND_IDENTITY);

await guardianApi.deviceToken({
    token: await wira.DeviceId.getDeviceId(),
    platform: Platform.OS.toUpperCase(),
    userDid: userData.did,
});
```

Use these functions to manage user guardians:
```js
const registryApi = new wira.RegistryApi(BACKEND_IDENTITY);
const guardianApi = new wira.GuardiansApi(BACKEND_IDENTITY);

//Search a possible guardian through Document Number
const {ok, ...guardianData} = await registryApi.registryResolveByDni(guardianDocNumber);

//Invite to be guardian
const { ok } = await guardianApi.invite({
    inviterDid: did, //the user DID
    guardianDid: guardianData.did,
    nickname: 'A nickname set by user',
});

//Get guardian invitations by user DID
const { ok, invitations } = await guardianApi.listInvitations(userData.did);

//Accept/reject a guardian invitation by ID
const { ok } = await guardianApi.respondInvitation(
    invitations[0].id, //invitation ID
    did, //the user DID
    'accept' // or 'reject'
);

//Get users that accepted invitations and are now user's guardians
const { ok, guardians } = await guardianApi.listInvitations(did)

//User can update their guardian's nickname
const { ok } = await guardianApi.updateGuardianNickname(
    invId, //the guardian invitation ID
    {
        ownerDid: did, //the user DID
        nickname: 'new-nickname',
    }
);

//User can remove a guardian
const { ok } = await guardianApi.removeGuardian(
    invId, //the guardian invitation ID
    ownerDid: did, //the user DID
);
```

To send a guardian recovery request call the following:
```js
//Get the user data by their Document Number
const { ok, ...userData } = registryApi.registryResolveByDni(docNumber);

//Send the recovery request
const { ok } = await guardianApi.requestRecovery({
    targetDid: userData.did
    deviceId
});
```

Guardians can see the received recovery request with:
```js
const { ok, requests } = await guardianApi.listRecoveries(
    did, //guardian DID
    'PENDING' // | 'APPROVED' | 'REJECTED'
);
```

And respond to a pending recovery request:
```js
const { ok } = await guardianApi.respondRecovery(
    request[0].id, //Any pending request ID
    'approve', // | 'reject'
    {
      guardianDid: did //the guardian DID
    }
);
```

User can see their recovery status and votes:
```js
const deviceId = await wira.DeviceId.getDeviceId();
const { ok, { status, votes } } = await guardianApi.recoveryDetail(deviceId);
```

If status is 'APPROVED', user can request to LIT init their account recovery. LIT will check if actually request is approved:
```js
const recoveryService = new wira.RecoveryService()

const userData = await recoveryService.recoveryFromGuardians(recoveryDni);
```

This will take a white, so is recommended to show a loader to user. Once ended, save the user data with a new PIN
```js
const data = JSON.parse(userData);
await recoveryService.saveRecoveryDataFromGuardians(data, newPin, BACKEND_IDENTITY, SCHEME_NAME);
```

## Show public name
For guardians identification and futher funcionalities, user can decide to show their full name to another users, by defauld is hidden:
```js
await registryApi.registryUpdateDisplayName(
    userData.did, //the user DID
    userData.vc.credentialSubject.fullName //the user VC full name, send null to hide
);
```

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
