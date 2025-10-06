import { getUri } from '../common/utils';
import { EncryptionService } from '../encryption';
import NativeWiraProvider from '../provider/NativeWiraSdk';

export class RecoveryService {
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

    const encryptedData = await encryptionService.decryptData(
      frontBase,
      backBase,
      selfieBase,
      dni
    );
    encryptionService.litNodeClient.disconnect();

    if (!encryptedData.success) {
      throw new Error('Decryption failed');
    }

    const data = JSON.parse(encryptedData.response as string);
    NativeWiraProvider.insertUser(getUri(appName), data);

    return encryptedData;
  }
}
