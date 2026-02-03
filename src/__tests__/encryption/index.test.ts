import { mockConnect } from '../../../__mocks__/@lit-protocol/lit-node-client';
import { EncryptionService } from '../../encryption';
import { createLitClient } from '@lit-protocol/lit-client';

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

    (createLitClient as jest.Mock).mockResolvedValueOnce({
      encrypt: jest.fn().mockResolvedValueOnce(mockedResponse),
    });
    const encryptionService = new EncryptionService();

    const encryptionResult = await encryptionService.encryptData({
      value: 'any',
    });
    expect(encryptionResult).toEqual(mockedResponse);
  });
});
