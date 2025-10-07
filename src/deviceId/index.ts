/* eslint-disable no-bitwise */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEVICE_ID_KEY } from '../common/constants';
import crypto from 'react-native-quick-crypto';

export class DeviceId {
  static bytesToUuid(buf: any) {
    const hex = Array.from(buf)
      .map((b: any) => b.toString(16).padStart(2, '0'))
      .join('');

    return (
      hex.substr(0, 8) +
      '-' +
      hex.substr(8, 4) +
      '-' +
      hex.substr(12, 4) +
      '-' +
      hex.substr(16, 4) +
      '-' +
      hex.substr(20, 12)
    ).toLowerCase();
  }

  static async getDeviceId() {
    try {
      let id = await AsyncStorage.getItem(DEVICE_ID_KEY);

      if (!id) {
        // Genera 16 bytes aleatorios y pásalos a UUID v4
        const buf = crypto.randomBytes(16);
        // Ajusta los bits para que sea un UUID v4 válido
        buf[6] = (buf[6]! & 0x0f) | 0x40; // versión 4
        buf[8] = (buf[8]! & 0x3f) | 0x80; // variante RFC4122

        id = DeviceId.bytesToUuid(buf);

        await AsyncStorage.setItem(DEVICE_ID_KEY, id);

        await AsyncStorage.getItem(DEVICE_ID_KEY);
      }

      return id;
    } catch (e) {
      throw e;
    }
  }
}
