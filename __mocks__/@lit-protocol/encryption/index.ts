export const encryptString = jest.fn().mockResolvedValue({
  cyphertext: 'mockCiphertext',
  dataToEncryptHash: 'mockDataToEncryptHash',
});
