# wira-sdk

Wira self-sovereign identity and smart wallet library for react-native.

Note: this is an development example repository with minimal funcionality

## Installation


```sh
npm install wira-sdk
```


## Usage


```js
import { multiply } from 'wira-sdk';

// require Access to Wira data saved
const granted = await NativeWiraProvider.requestAccessDataPermission();
// Sign-in using wira
const userData = signInWithWira('<com.app.name>')
```

Complete login-register example on example/src/App.tsx

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
