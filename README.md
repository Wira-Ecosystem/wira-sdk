# wira-sdk

Wira self-sovereign identity and smart wallet library for react-native.

Note: this is an development example repository with minimal funcionality

## Installation


```sh
npm install wira-sdk
```
The expo library will be available soon.

## Setup
In your project manifest add a content provider as following
```xml
<provider
    android:authorities="com.wira.<your.app.name>.provider"
    android:name="com.nativewiraprovider.WiraContentProvider"
/>
```

## Usage

To register a new user
```js
import wira from 'wira-sdk';

//Our team provide these data
const ssiUrl = 'https://ssi.wirawallet.com';
const CRED_TYPE = '';
const CRED_EXP_DAYS = 0;

//Your Pimlico RPC api
const bundler = 'https://api.pimlico.io/v2/42161/rpc?apikey='

//Pimlico paymaster policy ID
const sponsorshipPolicyId = 'example-id';

//Currently supported: arbitrum, arbitrum-sepolia
const CHAIN = 'arbitrum-sepolia';

//Your app name, must match the app name of provider authorities
const PROVIDER_NAME = 'com.<your.app.name>'

//Create the registerer class
const registerer = new wira.Registerer(
    ssiUrl, 
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
const useBiometry = true //To login with fingerprint
await registerer.storeOnDevice(PROVIDER_NAME, pin, useBiometry);

//step 4: Save data on our servers for recovery functions
const response = await registerer.storeDataOnServer();
if (!response.ok) {
    throw new Error(response.error);
}
```

After registry, the user can sign in with the data encrypted in their device using their pin.
```js
//Get the eencrypted data from device
const encryptedData = wira.getWiraData(PROVIDER_NAME);
//If data exists, try to sign in using their PIN
if (response) {
    const userData = await wira.signIn(response, pin.trim());
    console.log(userData) //decrypted user Data
}
```

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
