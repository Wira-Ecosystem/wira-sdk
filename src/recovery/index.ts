import { PermissionsAndroid, Platform } from 'react-native';
import { EncryptionService } from '../encryption';
import {
  check,
  openSettings,
  request,
  RESULTS,
} from 'react-native-permissions';
import { Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { encryptVCWithPin } from '../vcCrypto';
import { jsonStringifyWithBigInt } from '../vcCrypto/json';
import { DeviceId } from '../deviceId';
import { discoverableHashFromDni } from '../register/idHash';
import { Storage } from '../storage';
import { RegistryApi } from '../register/registry';
import { Biometric } from '../biometry';
import { SharedSession } from '../shared-session';
import { WiraSdkInterface } from '../encryption/nativeSdk';
import type { UserData, UserDataWithIdentity } from '../common/types';
import { pick, types } from '@react-native-documents/picker';

export class RecoveryService {
  async saveBackupData(
    data: UserDataWithIdentity,
    pin: string,
    sharedSessionSchema: string,
    registryUrl: string
  ) {
    const { identity, ...rawData } = data;
    const rawDataWithIdentity = { ...rawData, identity };

    const hashedData = await encryptVCWithPin(rawData, pin);
    const hashedDataWithIdentity = await encryptVCWithPin(
      rawDataWithIdentity,
      pin
    );

    const registryApi = new RegistryApi(registryUrl);
    const sharedSession = new SharedSession(registryUrl, sharedSessionSchema);

    const registerResponse = await registryApi.updateRecoveryData(
      data.dni,
      hashedDataWithIdentity,
      jsonStringifyWithBigInt(rawDataWithIdentity)
    );

    if (!registerResponse.ok) {
      throw new Error('Failed to update data on server');
    }

    await sharedSession.registerSharedSessionDevice(
      data.dni,
      pin,
      rawDataWithIdentity
    );

    await WiraSdkInterface.restoreIdentity(identity, data.did, data.privKey);
    await Biometric.setBioFlag(false);
    await Storage.deleteBiometricData();
    await Storage.saveUserData(hashedData);
  }

  async recoveryAndSave(
    registryUrl: string,
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

    const registryApi = new RegistryApi(registryUrl);

    const { ok, data } = await registryApi.recoveryByCi(
      discoverableHashFromDni(dni),
      frontBase,
      backBase,
      selfieBase
    );

    if (!ok || !data.success) {
      throw new Error('LIT Decryption failed: ' + data.details);
    }

    const response = JSON.parse(data.response as string);
    if (!response.success) {
      throw new Error('Data recovery failed: ' + response.error);
    }

    await Storage.saveUserData(response.data);
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

  async backupDataOnDevice(data: UserData) {
    const backup = await WiraSdkInterface.backupIdentity(
      data.did,
      data.privKey
    );

    const dataToBackup = {
      ...data,
      identity: backup,
    };
    const fileName = `Backup_${Date.now()}.json`;
    const jsonPayload = jsonStringifyWithBigInt(dataToBackup);

    if (Platform.OS === 'android') {
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        throw new Error('Storage permission not granted');
      }
    }

    try {
      const downloadPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
      await RNFS.writeFile(downloadPath, jsonPayload, 'utf8');
      return { savedOn: 'downloads', path: downloadPath, fileName };
    } catch (downloadError) {
      // Último recurso: directorio interno
      const internalPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.writeFile(internalPath, jsonPayload, 'utf8');
      return { savedOn: 'internal', path: internalPath, fileName };
    }
  }

  async recoveryFromBackup() {
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
    const data = JSON.parse(raw);

    const required = ['dni', 'salt', 'privKey', 'account', 'did', 'identity'];
    const missing = required.filter((f) => !data[f]);
    if (missing.length) {
      throw new Error(`Faltan campos: ${missing.join(', ')}`);
    }

    return data;
  }

  async recoveryFromGuardians(registryUrl: string, dni: string) {
    const deviceId = await DeviceId.getDeviceId();
    const registryApi = new RegistryApi(registryUrl);

    const { ok, data } = await registryApi.recoveryByGuardians(
      discoverableHashFromDni(dni),
      deviceId
    );
    console.log('Decryption attempt finished: ', data);

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
    sharedSessionSchema: string
  ) {
    const sharedSession = new SharedSession(registryUrl, sharedSessionSchema);
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
}
