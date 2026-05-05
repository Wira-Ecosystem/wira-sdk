import wira from '../index';
import Keychain from 'react-native-keychain';
import { encryptVCWithPin } from '../vcCrypto';

jest.mock('../recovery', () => ({
  RecoveryService: jest.fn(),
}));

describe('wira.signIn function', () => {
  test('should throw error with no credentials found', async () => {
    //mock Keychain to return no credentials
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);

    //call signIn and expect error
    try {
      await wira.signIn('1234');
    } catch (error: any) {
      expect(error.message).toBe('No user data found');
    }
  });

  test('should throw error with invalid credentials', async () => {
    //mock Keychain to return some credentials
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
      username: 'user',
      password: '{"credentials":"invalid-encrypted-data"}',
    });

    try {
      await wira.signIn('1234');
    } catch (error: any) {
      expect(error.message).toMatch('Decryption failed:');
    }
  });

  test('should throw error with invalid PIN', async () => {
    const encryptedData = await encryptVCWithPin(
      {
        dni: '12345678A',
        name: 'John Doe',
        did: 'did:example:123',
        privKey: '0x123abc',
      },
      '1234'
    );

    //mock Keychain to return some credentials
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
      username: 'user',
      password: `{"credentials":"${encryptedData}"}`,
    });

    try {
      await wira.signIn('1111'); //wrong PIN
      throw new Error('Test failed, expected invalid PIN error not thrown');
    } catch (error: any) {
      expect(error.message).toMatch('Decryption failed:');
    }
  });

  test('should sign in successfully with valid credentials and PIN', async () => {
    const credentials = {
      dni: '12345678A',
      name: 'John Doe',
      did: 'did:example:123',
      privKey: '0x123abc',
    };
    const encryptedData = await encryptVCWithPin(credentials, '1234');

    //mock Keychain to return some credentials
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({
      username: 'user',
      password: `{"credentials":"${encryptedData}"}`,
    });

    const userData = await wira.signIn('1234');
    expect(userData).toEqual(
      expect.objectContaining({
        ...credentials,
        vc: { mock: true },
      })
    );
  });
});
