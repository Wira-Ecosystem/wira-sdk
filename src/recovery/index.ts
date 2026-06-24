import { PermissionsAndroid, Platform } from 'react-native';
import {
  check,
  openSettings,
  request,
  RESULTS,
} from 'react-native-permissions';
import { Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { decryptVCWithPin, encryptVCWithPin } from '../vcCrypto';
import { DeviceId } from '../deviceId';
import { discoverableHashFromDni } from '../register/idHash';
import { Storage } from '../storage';
import { RegistryApi } from '../register/registry';
import { Biometric } from '../biometry';
import { SharedSession } from '../shared-session';
import { WiraSdkInterface } from '../encryption/nativeSdk';
import type { UserDataWithIdentity } from '../common/types';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  saveDocuments,
  types,
} from '@react-native-documents/picker';

export class RecoveryService {
  async saveBackupData(
    data: UserDataWithIdentity,
    pin: string,
    sharedSessionSchema: string,
    registryUrl: string,
    registryApiKey: string
  ) {
    const { identity, ...rawData } = data;

    const hashedData = await encryptVCWithPin(rawData, pin);
    const hashedDataWithIdentity = await encryptVCWithPin(
      data,
      `${rawData.dni}:${pin}`
    );

    const registryApi = new RegistryApi(registryUrl, registryApiKey);
    const sharedSession = new SharedSession(
      registryUrl,
      registryApiKey,
      sharedSessionSchema
    );

    const registerResponse = await registryApi.updateRecoveryData(
      data.dni,
      hashedDataWithIdentity
    );

    if (!registerResponse.ok) {
      throw new Error('Failed to update data on server');
    }

    await sharedSession.registerSharedSessionDevice(data.dni, pin, data);

    await WiraSdkInterface.restoreIdentity(identity, data.did, data.privKey);
    await Biometric.setBioFlag(false);
    await Storage.deleteBiometricData();
    await Storage.saveUserData(hashedData);
  }

  async recoveryAndSave(
    registryUrl: string,
    registryApiKey: string,
    frontImage: any,
    backImage: any,
    selfieImage: any,
    dni: string
  ) {
    await Storage.deleteBiometricData();

    const frontBase = await this.imageToBase64(frontImage.uri);
    const backBase = await this.imageToBase64(backImage.uri);
    const selfieBase = await this.imageToBase64(selfieImage.uri);

    const registryApi = new RegistryApi(registryUrl, registryApiKey);

    const { ok, data, details } = await registryApi.recoveryByCi(
      discoverableHashFromDni(dni),
      frontBase,
      backBase,
      selfieBase
    );

    if (!ok || !data) {
      throw new Error('Analisys failed: ' + (details ?? 'Unknown error'));
    }

    await Storage.saveUserData(data);
  }

  async requestStoragePermission() {
    if (Platform.OS !== 'android') return true;

    const androidVersion =
      typeof Platform.Version === 'number' ? Platform.Version : 0;

    // Android 13+ usa scoped storage para archivos no multimedia, por lo que no
    // expone un permiso específico para JSON/descargas. Mantener la llamada limpia
    // y confiar en las rutas soportadas (Downloads/DocumentDirectory, SAF, etc.).
    if (androidVersion >= 33) {
      return true;
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
          'Para guardar el archivo en tu dispositivo, necesitamos acceso al almacenamiento.\n\nPor favor, habilita el permiso en Configuración.',
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
      title: 'Permiso para almacenamiento',
      message:
        'Necesitamos acceso para guardar el archivo de respaldo en tu dispositivo.',
      buttonPositive: 'OK',
    });

    if (granted === RESULTS.GRANTED) return true;

    Alert.alert(
      'Permiso denegado',
      'Para guardar en el dispositivo, habilita el permiso en Configuración > Permisos',
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

  async backupDataOnDevice(pin: string) {
    const userData = await Storage.getUserData();
    if (!userData || !userData.credentials) {
      throw new Error('No user data found');
    }

    const data = await decryptVCWithPin(userData.credentials, pin);

    const backup = await WiraSdkInterface.backupIdentity(
      data.did,
      data.privKey
    );

    const dataToBackup = {
      ...data,
      identity: backup,
    };
    const now = new Date();
    const formattedDate = now
      .toISOString()
      .replace(/T/, '_')
      .replace(/:/g, '-')
      .replace(/\..+/, '');
    const fileName = `Respaldo_de_cuenta_${formattedDate}.json`;
    const encryptedPayload = await encryptVCWithPin(dataToBackup, pin);

    if (Platform.OS === 'android') {
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        throw new Error('Storage permission not granted');
      }
    }

    const tempDir = RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath;
    const tempPath = `${tempDir}/${fileName}`;

    try {
      await RNFS.writeFile(tempPath, encryptedPayload, 'utf8');
      const sourceUri = encodeURI(
        tempPath.startsWith('file://') ? tempPath : `file://${tempPath}`
      );

      const [savedFile] = await saveDocuments({
        sourceUris: [sourceUri],
        fileName,
        mimeType: 'application/json',
        copy: true,
      });

      if (!savedFile || savedFile.error) {
        throw new Error(savedFile?.error || 'Unable to export backup file');
      }

      return { savedOn: 'exported', path: savedFile.uri, fileName };
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        throw new Error('Export canceled');
      }

      throw error;
    } finally {
      try {
        const exists = await RNFS.exists(tempPath);
        if (exists) {
          await RNFS.unlink(tempPath);
        }
      } catch {}
    }
  }

  async recoveryFromBackup(pin: string) {
    if (Platform.OS === 'android') {
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        throw new Error('Storage permission not granted');
      }
    }

    let pickedPath: string;
    try {
      const [{ uri }] = await pick({
        type: types.json,
      });

      pickedPath = uri;
    } catch (err) {
      throw new Error('Select file error: ' + err);
    }

    const raw = await RNFS.readFile(pickedPath, 'utf8');
    const data = await decryptVCWithPin(raw, pin);

    const required = ['dni', 'salt', 'privKey', 'account', 'did', 'identity'];
    const missing = required.filter((f) => !data[f]);
    if (missing.length) {
      throw new Error(`Faltan campos: ${missing.join(', ')}`);
    }

    return data;
  }

  async recoveryFromGuardians(
    registryUrl: string,
    registryApiKey: string,
    dni: string
  ) {
    const deviceId = await DeviceId.getDeviceId();
    const registryApi = new RegistryApi(registryUrl, registryApiKey);

    const { ok, data } = await registryApi.recoveryByGuardians(
      discoverableHashFromDni(dni),
      deviceId
    );

    if (!ok || !data.success) {
      throw new Error('Decryption failed');
    }

    const parsedData = JSON.parse(data.response as string);
    if (!parsedData.success) {
      throw new Error('Data recovery failed: ' + parsedData.error);
    }

    return parsedData.data;
  }

  async saveRecoveryDataFromGuardians(
    data: UserDataWithIdentity,
    pin: string,
    registryUrl: string,
    registryApiKey: string,
    sharedSessionSchema: string
  ) {
    const sharedSession = new SharedSession(
      registryUrl,
      registryApiKey,
      sharedSessionSchema
    );
    const { identity, ...rawData } = data;

    await WiraSdkInterface.restoreIdentity(identity, data.did, data.privKey);

    const encryptedWithNewPin = await encryptVCWithPin(rawData, pin);
    await sharedSession.registerSharedSessionDevice(data.dni, pin, data);

    const useBiometry = await Biometric.getBioFlag();
    if (useBiometry) {
      await Storage.saveUserDataWithBiometric(data);
    }
    await Storage.saveUserData(encryptedWithNewPin);
  }

  // Convert image file to base64 string, this will be used for convert CI images
  async imageToBase64(imagePath: string) {
    try {
      const base64 = await RNFS.readFile(imagePath, 'base64');
      return base64;
    } catch (error: any) {
      throw new Error('Failed to convert image to base64: ' + error.message);
    }
  }
}
