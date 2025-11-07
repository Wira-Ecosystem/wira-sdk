import { PermissionsAndroid, Platform } from 'react-native';
import { EncryptionService } from '../encryption';
import pako from 'pako';
import {
  check,
  openSettings,
  request,
  RESULTS,
} from 'react-native-permissions';
import { Alert } from 'react-native';
import RNFS from 'react-native-fs';
import RNQRGenerator from 'rn-qr-generator';
import { encryptVCWithPin } from '../vcCrypto';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import { DeviceId } from '../deviceId';
import { discoverableHashFromDni } from '../register/idHash';
import { Storage } from '../storage';
import { RegistryApi } from '../register/registry';
import { Biometric } from '../biometry';
import { SharedSession } from '../shared-session';

export class RecoveryService {
  async saveQrData(
    data: any,
    pin: string,
    sharedSessionSchema: string,
    registryUrl: string
  ) {
    const encryptedCredential = await encryptVCWithPin(data, pin);

    const encryptService = new EncryptionService();
    const registryApi = new RegistryApi(registryUrl);
    const sharedSession = new SharedSession(registryUrl, sharedSessionSchema);

    await encryptService.connect();
    const encryptedData = await encryptService.encryptData({
      hashedData: encryptedCredential,
      rawData: data,
    });
    encryptService.litNodeClient.disconnect();

    const registerResponse = await registryApi.updateRecoveryData(
      data.dni,
      encryptedData.ciphertext,
      encryptedData.dataToEncryptHash
    );

    if (!registerResponse.ok) {
      throw new Error('Failed to update data on server');
    }

    await sharedSession.registerSharedSessionDevice(data.dni, pin, data);

    const useBiometry = await Biometric.getBioFlag();
    if (useBiometry) {
      await Storage.saveUserDataWithBiometric(data);
    }
    await Storage.saveUserData(encryptedCredential);
  }

  async recoveryAndSave(
    frontImage: any,
    backImage: any,
    selfieImage: any,
    dni: string
  ) {
    await Storage.deleteBiometricData();

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

    await Storage.saveUserData(response.data);
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

    const androidVersion =
      typeof Platform.Version === 'number' ? Platform.Version : 0;

    // Android 13+ - Permisos específicos de media
    if (androidVersion >= 33) {
      const permission = PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES;
      const status = await check(permission);
      if (status === RESULTS.GRANTED) return true;

      const granted = await request(permission, {
        title: 'Permiso para galería',
        message: 'Necesitamos acceso para guardar el QR en tu galería.',
        buttonPositive: 'OK',
      });

      return granted === RESULTS.GRANTED;
    }
    // Android 10-12 (API 29-32) - Caso especial para Huawei/EMUI
    // Necesita WRITE_EXTERNAL_STORAGE y posiblemente READ también
    if (androidVersion >= 29) {
      const writePermission =
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
      const readPermission =
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      // Verificar estado actual
      const writeStatus = await check(writePermission);
      const readStatus = await check(readPermission);

      if (writeStatus === RESULTS.GRANTED && readStatus === RESULTS.GRANTED) {
        return true;
      }

      // Solicitar ambos permisos para Android 10
      const results = await PermissionsAndroid.requestMultiple([
        writePermission,
        readPermission,
      ]);

      const writeGranted =
        results[writePermission] === PermissionsAndroid.RESULTS.GRANTED;
      const readGranted =
        results[readPermission] === PermissionsAndroid.RESULTS.GRANTED;

      // Fix específico para Huawei/EMUI Android 10:
      // A veces el permiso se otorga pero no se refleja inmediatamente
      if (!writeGranted || !readGranted) {
        // Esperar un momento y re-verificar
        await new Promise((resolve) => setTimeout(resolve, 500));

        const reCheckWrite = await check(writePermission);
        const reCheckRead = await check(readPermission);

        if (
          reCheckWrite === RESULTS.GRANTED &&
          reCheckRead === RESULTS.GRANTED
        ) {
          return true;
        }

        // Si aún no están otorgados, mostrar alerta
        Alert.alert(
          'Permiso necesario',
          'Para guardar el QR en tu dispositivo, necesitamos acceso al almacenamiento.\n\nPor favor, habilita el permiso en Configuración.',
          [
            { text: 'Abrir configuración', onPress: () => openSettings() },
            { text: 'Cancelar', style: 'cancel' },
          ]
        );
        return false;
      }

      return true;
    }

    // Android < 10 - Permiso tradicional
    const permission = PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE;
    const status = await check(permission);
    if (status === RESULTS.GRANTED) return true;

    const granted = await request(permission, {
      title: 'Permiso para galería',
      message: 'Necesitamos acceso para guardar el QR en tu galería.',
      buttonPositive: 'OK',
    });

    if (granted === RESULTS.GRANTED) return true;

    Alert.alert(
      'Permiso denegado',
      'Para guardar en la galería, habilita el permiso en Configuración > Permisos',
      [
        { text: 'Abrir configuración', onPress: () => openSettings() },
        { text: 'OK' },
      ]
    );
    return false;
  }

  async saveToGallery(base64Data: string, fileName: string) {
    // Para Android 10+, usar el directorio Pictures que es más accesible
    const androidVersion =
      typeof Platform.Version === 'number' ? Platform.Version : 0;
    const picturesDir =
      androidVersion >= 29
        ? `${RNFS.PicturesDirectoryPath}`
        : `${RNFS.ExternalStorageDirectoryPath}/Pictures`;

    const path = `${picturesDir}/${fileName}`;

    try {
      // Verificar si el directorio existe, si no, crearlo
      const dirExists = await RNFS.exists(picturesDir);
      if (!dirExists) {
        await RNFS.mkdir(picturesDir);
      }

      // Escribir el archivo
      await RNFS.writeFile(path, base64Data, 'base64');

      // Notificar al escáner de medios sobre el nuevo archivo
      if (Platform.OS === 'android') {
        await RNFS.scanFile(path);
      }

      return path;
    } catch (error) {
      console.error('Error saving to gallery:', error);
      throw error;
    }
  }

  async saveQrOnDevice(b64Data: string) {
    const fileName = `QR_Recovery_${Date.now()}.png`;

    try {
      const path = await this.saveToGallery(b64Data, fileName);
      return { savedOn: 'gallery', path, fileName };
    } catch (galleryError) {
      try {
        const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        const path = await RNFS.writeFile(downloadPath, b64Data, 'base64');
        return { savedOn: 'downloads', path, fileName };
      } catch (downloadError) {
        // Último recurso: directorio interno
        const internalPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        const path = await RNFS.writeFile(internalPath, b64Data, 'base64');
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
    data: any,
    pin: string,
    registryUrl: string,
    sharedSessionSchema: string
  ) {
    const sharedSession = new SharedSession(registryUrl, sharedSessionSchema);

    const encryptedWithNewPin = await encryptVCWithPin(data, pin);
    await sharedSession.registerSharedSessionDevice(data.dni, pin, data);

    const useBiometry = await Biometric.getBioFlag();
    if (useBiometry) {
      await Storage.saveUserDataWithBiometric(data);
    }
    await Storage.saveUserData(encryptedWithNewPin);
  }
}
