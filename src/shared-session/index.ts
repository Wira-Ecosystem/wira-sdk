import { Linking } from 'react-native';
import { AuthApi } from '../api/auth';
import { discoverableHashFromDni } from '../register/idHash';
import { DeviceId } from '../deviceId';
import { decryptVCWithPin, encryptKey, encryptVCWithPin } from '../vcCrypto';
import { bytesToHex, hexToBytes, randomBytes } from '@noble/hashes/utils.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SALT } from '../common/constants';
import { getUri, getWiraDataFrom } from '../storage';
import NativeWiraProvider from '../provider/NativeWiraSdk';

export class SharedSession {
  api: AuthApi;
  appUrl: string;

  constructor(url: string, appUrl: string) {
    this.api = new AuthApi(url);
    this.appUrl = appUrl;
  }

  async checkRegisteredOnThisDevice(dni: string) {
    const discoverableHash = discoverableHashFromDni(dni);
    try {
      const response = await this.api.getRegisteredApps(discoverableHash);
      if (!response.ok) {
        throw new Error('Failed to get devices: ' + response.error);
      }
      return response.devices;
    } catch (error: any) {
      throw new Error('Error checking registered devices: ' + error.message);
    }
  }

  async registerSharedSessionDevice(
    dni: string,
    packageName: string,
    pin: string,
    data: any
  ) {
    const discoverableHash = discoverableHashFromDni(dni);
    const key = `${await DeviceId.getDeviceId()}:${pin}`;
    const sessionToken = await encryptVCWithPin(data, key);

    const salt = randomBytes(16);
    const encryptedKey = await encryptKey(key, salt);

    await this.api.registerApp({
      discoverableHash,
      packageName,
      userHash: encryptedKey,
      sessionToken,
    });

    await AsyncStorage.setItem(SALT, bytesToHex(salt));
  }

  async openFirstAppFound(targets: any[]) {
    const target = targets.find(async (t) => {
      return await Linking.canOpenURL(t.package + '://shared.request');
    });

    if (!target) {
      throw new Error('No supported app found');
    }

    const url = new URL(target.package + '://shared.request');
    url.searchParams.append('source', this.appUrl);
    const fullUrl = url.toString();

    await Linking.openURL(fullUrl);
  }

  async onShareSession(fromUrl: string, accept: boolean) {
    const url = new URL(fromUrl);
    const source = url.searchParams.get('source');
    if (!source) {
      throw new Error('Missing source parameter');
    }

    const returnUrl = new URL(source + '://shared.response');
    returnUrl.searchParams.append('accepted', accept ? 'true' : 'false');
    if (accept) {
      const saltHex = await AsyncStorage.getItem(SALT);
      if (!saltHex) {
        throw new Error('No salt found for device');
      }
      returnUrl.searchParams.append('deviceId', await DeviceId.getDeviceId());
      returnUrl.searchParams.append('salt', saltHex);
    }

    const fullUrl = returnUrl.toString();
    await Linking.openURL(fullUrl);
  }

  async handleOpenApp(onOpen: (url: string) => void) {
    const url = await Linking.getInitialURL();
    if (url) {
      onOpen(url);
    } else {
      Linking.addEventListener('url', (event) => {
        onOpen(event.url);
      });
    }
  }

  async handleShareResponse(
    onAccept: (deviceId: string, salt: string) => void,
    onReject: () => void
  ) {
    const processUrl = async (initialUrl: string) => {
      const url = new URL(initialUrl);
      const accepted = url.searchParams.get('accepted');
      if (accepted === 'true') {
        const id = url.searchParams.get('deviceId');
        const salt = url.searchParams.get('salt');
        if (id && salt) {
          onAccept(id, salt);
        }
      } else {
        onReject();
      }
    };

    const initialUrl = await Linking.getInitialURL();
    if (initialUrl) {
      processUrl(initialUrl);
    } else {
      Linking.addEventListener('url', (event) => {
        processUrl(event.url);
      });
    }
  }

  async signInWithSharedSession(
    deviceId: string,
    saltHex: string,
    pin: string
  ) {
    const salt = hexToBytes(saltHex);
    const userHash = await encryptKey(`${deviceId}:${pin}`, salt);
    const response = await this.api.getSession(userHash);
    if (!response.ok || !response.session) {
      throw new Error('Failed to get session: ' + response.error);
    }
    const data = await decryptVCWithPin(response.session, `${deviceId}:${pin}`);

    const encryptedData = await encryptVCWithPin(data, pin);
    const userUri = getUri(this.appUrl);

    const previousData = getWiraDataFrom(this.appUrl);
    if (previousData) {
      NativeWiraProvider.deleteUser(userUri);
    }

    NativeWiraProvider.insertUser(userUri, {
      credential: encryptedData,
    });
    return data;
  }
}
