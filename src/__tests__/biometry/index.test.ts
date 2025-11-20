import { Biometric } from '../../biometry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BIO_KEY } from '../../common/constants';
import { ReactNativeBiometricsMock } from '../../../__mocks__/react-native-biometrics';

describe('Biometric.setBioFlag', () => {
  it('should set biometric flag to true/false', async () => {
    await Biometric.setBioFlag(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(BIO_KEY, 'true');
    await Biometric.setBioFlag(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(BIO_KEY, 'false');
  });
});

describe('Biometric.getBioFlag', () => {
  it('should get biometric flag as true', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');
    const result = await Biometric.getBioFlag();
    expect(result).toBe(true);
  });

  it('should get biometric flag as false', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('false');
    const result = await Biometric.getBioFlag();
    expect(result).toBe(false);
  });

  it('should get biometric flag as false when not set', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const result = await Biometric.getBioFlag();
    expect(result).toBe(false);
  });
});

describe('Biometric.biometryAvailability', () => {
  it('should return available biometry with specified type', async () => {
    let mockReturn = { available: true, biometryType: 'TouchID' };

    const checkReturn = async () => {
      ReactNativeBiometricsMock.isSensorAvailable.mockResolvedValueOnce(
        mockReturn
      );
      const result = await Biometric.biometryAvailability();
      expect(result).toEqual(mockReturn);
    };

    await checkReturn();

    mockReturn.biometryType = 'FaceID';
    await checkReturn();

    mockReturn.biometryType = 'Biometrics';
    await checkReturn();
  });

  it('should return unavailable on native library returns false', async () => {
    let mockReturn = { available: false };

    ReactNativeBiometricsMock.isSensorAvailable.mockResolvedValueOnce(
      mockReturn
    );
    const result = await Biometric.biometryAvailability();
    expect(result).toStrictEqual({ available: false, biometryType: null });
  });

  it('should return unavailable on native library throws error', async () => {
    ReactNativeBiometricsMock.isSensorAvailable.mockRejectedValueOnce('error');
    const result = await Biometric.biometryAvailability();
    expect(result).toStrictEqual({ available: false, biometryType: null });
  });
});

describe('Biometric.biometricLogin', () => {
  it('should return true on success promt', async () => {
    ReactNativeBiometricsMock.simplePrompt.mockResolvedValueOnce({
      success: true,
    });
    const result = await Biometric.biometricLogin('Test Prompt');
    expect(result).toBe(true);
  });

  it('should call promt with correct message', async () => {
    ReactNativeBiometricsMock.simplePrompt.mockResolvedValue({
      success: true,
    });
    await Biometric.biometricLogin('First prompt');
    expect(ReactNativeBiometricsMock.simplePrompt).toHaveBeenLastCalledWith({
      promptMessage: 'First prompt',
      cancelButtonText: 'Cancelar',
    });

    await Biometric.biometricLogin('Second prompt');
    expect(ReactNativeBiometricsMock.simplePrompt).toHaveBeenLastCalledWith({
      promptMessage: 'Second prompt',
      cancelButtonText: 'Cancelar',
    });
  });

  it('should return false on failed prompt', async () => {
    ReactNativeBiometricsMock.simplePrompt.mockResolvedValueOnce({
      success: false,
    });
    const result = await Biometric.biometricLogin('Test Prompt');
    expect(result).toBe(false);
  });

  it('should return false on throw error', async () => {
    ReactNativeBiometricsMock.simplePrompt.mockRejectedValueOnce('error');
    const result = await Biometric.biometricLogin('Test Prompt');
    expect(result).toBe(false);
  });
});

describe('Biometric.isUserCancellation', () => {
  it('should detect cancellation messages', () => {
    const messages = [
      'Canceled by user',
      'User cancel operation',
      'LAErrorUserCancel occurred',
      'ERR_KEYCHAIN_USER_CANCELED happened',
    ];

    messages.forEach((msg) => {
      expect(Biometric.isUserCancellation(new Error(msg))).toBe(true);
      expect(Biometric.isUserCancellation(msg)).toBe(true);
    });
  });

  it('should not detect non-cancellation messages', () => {
    const messages = [
      'Some other error',
      'Operation failed',
      'User did something else',
      '',
      null,
      undefined,
    ];

    messages.forEach((msg) => {
      expect(Biometric.isUserCancellation(new Error(String(msg)))).toBe(false);
      expect(Biometric.isUserCancellation(msg)).toBe(false);
    });
  });
});
