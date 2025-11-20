import { encryptString } from '@lit-protocol/encryption';
import { mockConnect } from '../../../__mocks__/@lit-protocol/lit-node-client';
import { EncryptionService } from '../../encryption';

describe('EncryptionService.connect', () => {
  it('should call lit connect method', async () => {
    const encryptionService = new EncryptionService();
    await encryptionService.connect();
    expect(mockConnect).toHaveBeenCalled();
  });
});

describe('EncryptionService.encryptData', () => {
  it('should call lit encryptString method', async () => {
    const mockedResponse = {
      cyphertext: 'mockCiphertext',
      dataToEncryptHash: 'mockDataToEncryptHash',
    };

    (encryptString as jest.Mock).mockResolvedValueOnce(mockedResponse);
    const encryptionService = new EncryptionService();

    const encryptionResult = await encryptionService.encryptData({
      value: 'any',
    });
    expect(encryptionResult).toEqual(mockedResponse);
  });
});
