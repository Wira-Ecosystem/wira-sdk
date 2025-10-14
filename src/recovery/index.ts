import { PermissionsAndroid, Platform } from 'react-native';
import { getUri } from '../common/utils';
import { EncryptionService } from '../encryption';
import NativeWiraProvider from '../provider/NativeWiraSdk';
import pako from 'pako';
import {
  check,
  openSettings,
  request,
  RESULTS,
} from 'react-native-permissions';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import RNFS from 'react-native-fs';
import RNQRGenerator from 'rn-qr-generator';
import { encryptVCWithPin } from '../vcCrypto';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import { DeviceId } from '../deviceId';
import { discoverableHashFromDni } from '../register/idHash';
import { getWiraDataFrom } from '../storage';

export class RecoveryService {
  async saveData(data: object, pin: string, appName: string) {
    const encryptedCredential = await encryptVCWithPin(data, pin);

    const userUri = getUri(appName);
    const previousData = getWiraDataFrom(appName);
    if (previousData) {
      NativeWiraProvider.deleteUser(userUri);
    }
    const response = NativeWiraProvider.insertUser(userUri, {
      credential: encryptedCredential,
    });
    return response;
  }

  async recoveryAndSave(
    frontImage: any,
    backImage: any,
    selfieImage: any,
    dni: string,
    appName: string
  ) {
    const encryptionService = new EncryptionService();

    const frontBase = await encryptionService.imageToBase64(frontImage.uri);
    const backBase = await encryptionService.imageToBase64(backImage.uri);
    const selfieBase = await encryptionService.imageToBase64(selfieImage.uri);

    await encryptionService.connect();

    const encryptedData = await encryptionService.decryptDataWithCI(
      frontBase,
      backBase,
      selfieBase,
      dni
    );
    encryptionService.litNodeClient.disconnect();

    if (!encryptedData.success) {
      throw new Error('LIT Decryption failed');
    }

    const response = JSON.parse(encryptedData.response as string);
    if (!response.success) {
      throw new Error('Data recovery failed: ' + response.error);
    }

    const userUri = getUri(appName);
    const previousData = getWiraDataFrom(appName);
    if (previousData) {
      NativeWiraProvider.deleteUser(userUri);
    }

    NativeWiraProvider.insertUser(userUri, {
      credential: response.data,
    });

    return response;
  }

  prepareQrData(data: object) {
    return Buffer.from(pako.deflate(jsonStringifyWithBigInt(data))).toString(
      'base64'
    );
  }

  decompressQrData(data: string) {
    return JSON.parse(
      pako.inflate(Buffer.from(data, 'base64'), { to: 'string' })
    );
  }

  async requestGalleryPermission() {
    if (Platform.OS !== 'android') return true;

    let permission;

    if (Platform.Version >= 33) {
      // Android 13+ - Permisos específicos de media
      permission = PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;
    } else {
      // Android < 13 - Permiso tradicional
      permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    }

    const status = await check(permission);
    if (status === RESULTS.GRANTED) return true;

    const granted = await request(permission, {
      title: 'Permiso para galería',
      message: 'Necesitamos acceso para guardar el QR en tu galería.',
      buttonPositive: 'OK',
    });

    if (granted === RESULTS.GRANTED) return true;

    if (granted === RESULTS.DENIED || granted === RESULTS.BLOCKED) {
      Alert.alert(
        'Permiso denegado',
        'Para guardar en la galería, habilita el permiso en Configuración > Permisos',
        [
          { text: 'Abrir configuración', onPress: () => openSettings() },
          { text: 'OK' },
        ]
      );
    }
    return false;
  }

  async saveToGallery(base64Data: string, fileName: string) {
    const picturesDir = `${RNFS.ExternalStorageDirectoryPath}/Pictures`;
    const path = `${picturesDir}/${fileName}`;

    if (!(await RNFS.exists(picturesDir))) {
      await RNFS.mkdir(picturesDir);
    }
    await RNFS.writeFile(path, base64Data, 'base64');
    return path; // devuelve la ruta por si la necesitas
  }

  async saveQr(viewShotRef: React.RefObject<any>) {
    const b64 = await captureRef(viewShotRef, {
      format: 'png',
      quality: 1,
      result: 'base64',
    });
    const fileName = `QR_Recovery_${Date.now()}.png`;

    try {
      const path = await this.saveToGallery(b64, fileName);
      return { savedOn: 'gallery', path, fileName };
    } catch (galleryError) {
      try {
        const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        const path = await RNFS.writeFile(downloadPath, b64, 'base64');
        return { savedOn: 'downloads', path, fileName };
      } catch (downloadError) {
        // Último recurso: directorio interno
        const internalPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        const path = await RNFS.writeFile(internalPath, b64, 'base64');
        return { savedOn: 'internal', path, fileName };
      }
    }
  }

  async recoveryFromQr(imageUri: string) {
    const { values } = await RNQRGenerator.detect({ uri: imageUri });

    if (!values?.length || !values[0]) {
      throw new Error('No pude leer un QR válido');
    }

    const data = this.decompressQrData(values[0]);

    const required = ['dni', 'salt', 'privKey', 'account', 'did'];

    const missing = required.filter((f) => !data[f]);
    if (missing.length) {
      throw new Error(`Faltan campos: ${missing.join(', ')}`);
    }

    return data;
  }

  async recoveryFromGuardians(dni: string) {
    const encryptionService = new EncryptionService();
    await encryptionService.connect();

    const deviceId = await DeviceId.getDeviceId();
    const data = await encryptionService.decryptDataWithGuardian(
      discoverableHashFromDni(dni),
      deviceId
    );
    encryptionService.litNodeClient.disconnect();

    if (!data.success) {
      throw new Error('Decryption failed');
    }

    const parsedData = JSON.parse(data.response as string);
    if (!parsedData.success) {
      throw new Error('Data recovery failed: ' + parsedData.error);
    }

    return parsedData.data;
  }

  async saveRecoveryDataFromGuardians(
    data: object,
    pin: string,
    appName: string
  ) {
    const encryptedWithNewPin = await encryptVCWithPin(data, pin);
    const userUri = getUri(appName);
    const previousData = getWiraDataFrom(appName);
    if (previousData) {
      NativeWiraProvider.deleteUser(userUri);
    }
    const response = NativeWiraProvider.insertUser(appName, {
      credential: encryptedWithNewPin,
    });
    return response;
  }
}
