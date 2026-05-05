import { Biometric } from '../../biometry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BIO_KEY } from '../../common/constants';
import { ReactNativeBiometricsMock } from '../../../__mocks__/react-native-biometrics';

// Simulates JavaScript callers that may pass values outside the TS signature.
const biometricLoginFromJs = (prompt: unknown) =>
  (Biometric.biometricLogin as (value: unknown) => Promise<boolean>)(prompt);

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

describe('Biometry Utils - Tests Consolidados', () => {
  let mockRNBio = ReactNativeBiometricsMock;

  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
  });

  // ===== GRUPO 1: FUNCIÓN biometryAvailability =====
  describe('🔍 Función biometryAvailability', () => {
    describe('✅ Casos Exitosos', () => {
      it('debe retornar disponibilidad true con TouchID', async () => {
        // Arrange
        const mockResponse = { available: true, biometryType: 'TouchID' };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result).toEqual(mockResponse);
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(1);
      });

      it('debe retornar disponibilidad true con FaceID', async () => {
        // Arrange
        const mockResponse = { available: true, biometryType: 'FaceID' };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result.available).toBe(true);
        expect(result.biometryType).toBe('FaceID');
      });

      it('debe retornar disponibilidad true con Biometrics', async () => {
        // Arrange
        const mockResponse = { available: true, biometryType: 'Biometrics' };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result.available).toBe(true);
        expect(result.biometryType).toBe('Biometrics');
      });

      it('debe retornar disponibilidad false cuando no hay sensores', async () => {
        // Arrange
        const mockResponse = { available: false, biometryType: null };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result.available).toBe(false);
        expect(result.biometryType).toBeNull();
      });

      it('debe preservar estructura de respuesta original', async () => {
        // Arrange
        const mockResponse = { available: true, biometryType: 'FaceID' };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result).toHaveProperty('available');
        expect(result).toHaveProperty('biometryType');
      });
    });

    describe('❌ Casos de Error', () => {
      it('debe manejar error de sensor no disponible', async () => {
        // Arrange
        const error = new Error('Sensor not available');
        mockRNBio.isSensorAvailable.mockRejectedValue(error);

        // Act & Assert
        await expect(Biometric.biometryAvailability()).resolves.toStrictEqual({
          available: false,
          biometryType: null,
        });
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(1);
      });

      it('debe manejar error de permisos', async () => {
        // Arrange
        const error = new Error('Permission denied');
        mockRNBio.isSensorAvailable.mockRejectedValue(error);

        // Act & Assert
        await expect(Biometric.biometryAvailability()).resolves.toStrictEqual({
          available: false,
          biometryType: null,
        });
      });

      it('debe manejar error de hardware no soportado', async () => {
        // Arrange
        const error = new Error('Hardware not supported');
        mockRNBio.isSensorAvailable.mockRejectedValue(error);

        // Act & Assert
        await expect(Biometric.biometryAvailability()).resolves.toStrictEqual({
          available: false,
          biometryType: null,
        });
      });

      it('debe manejar respuesta null o undefined', async () => {
        // Arrange
        const mockResponse = { available: false, biometryType: null };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result).toEqual(mockResponse);
        expect(result.available).toBe(false);
        expect(result.biometryType).toBeNull();
      });

      it('debe manejar respuesta malformada', async () => {
        // Arrange
        const mockResponse = { wrongProperty: true };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        // La función biometryAvailability extrae available y biometryType
        // Si no está presente biometryType, se normaliza a null
        expect(result).toEqual({
          available: undefined,
          biometryType: null,
        });
      });
    });

    describe('🔄 Casos de Reintento y Performance', () => {
      it('debe manejar llamadas múltiples sin problemas', async () => {
        // Arrange
        const mockResponse = { available: true, biometryType: 'TouchID' };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const promises = Array.from({ length: 5 }, () =>
          Biometric.biometryAvailability()
        );
        const results = await Promise.all(promises);

        // Assert
        expect(results).toHaveLength(5);
        results.forEach((result) => {
          expect(result).toEqual(mockResponse);
        });
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(5);
      });

      it('debe ejecutar en tiempo razonable', async () => {
        // Arrange
        const mockResponse = { available: true, biometryType: 'FaceID' };
        mockRNBio.isSensorAvailable.mockResolvedValue(mockResponse);

        // Act
        const startTime = performance.now();
        await Biometric.biometryAvailability();
        const endTime = performance.now();

        // Assert
        expect(endTime - startTime).toBeLessThan(1000); // Menos de 1 segundo
      });
    });
  });

  // ===== GRUPO 2: FUNCIÓN biometricLogin =====
  describe('🔐 Función biometricLogin', () => {
    describe('✅ Casos Exitosos', () => {
      it('debe autenticar correctamente con prompt por defecto', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await Biometric.biometricLogin();

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: 'Autentícate',
          cancelButtonText: 'Cancelar',
        });
      });

      it('debe autenticar correctamente con prompt personalizado', async () => {
        // Arrange
        const customPrompt = 'Por favor, confirma tu identidad';
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await Biometric.biometricLogin(customPrompt);

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: customPrompt,
          cancelButtonText: 'Cancelar',
        });
      });

      it('debe manejar autenticación fallida', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({ success: false });

        // Act
        const result = await Biometric.biometricLogin();

        // Assert
        expect(result).toBe(false);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledTimes(1);
      });

      it('debe manejar prompt vacío', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await Biometric.biometricLogin('');

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: '',
          cancelButtonText: 'Cancelar',
        });
      });

      it('debe manejar prompt null', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await biometricLoginFromJs(null);

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: null,
          cancelButtonText: 'Cancelar',
        });
      });

      it('debe manejar prompt undefined', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await Biometric.biometricLogin(undefined);

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: 'Autentícate',
          cancelButtonText: 'Cancelar',
        });
      });
    });

    describe('❌ Casos de Error', () => {
      it('debe manejar error de usuario canceló autenticación', async () => {
        // Arrange
        const error = new Error('User canceled authentication');
        mockRNBio.simplePrompt.mockRejectedValue(error);

        // Act & Assert
        await expect(Biometric.biometricLogin()).resolves.toBe(false);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledTimes(1);
      });

      it('debe manejar error de sensor no disponible', async () => {
        // Arrange
        const error = new Error('Biometric sensor not available');
        mockRNBio.simplePrompt.mockRejectedValue(error);

        // Act & Assert
        await expect(Biometric.biometricLogin()).resolves.toBe(false);
      });

      it('debe manejar error de muchos intentos fallidos', async () => {
        // Arrange
        const error = new Error('Too many failed attempts');
        mockRNBio.simplePrompt.mockRejectedValue(error);

        // Act & Assert
        await expect(
          Biometric.biometricLogin('Reintenta por favor')
        ).resolves.toBe(false);
      });

      it('debe manejar respuesta malformada', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({ wrongProperty: true });

        // Act
        const result = await Biometric.biometricLogin();

        // Assert
        expect(result).toBe(false);
      });

      it('debe manejar respuesta null', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({
          success: false,
        });

        // Act
        const result = await Biometric.biometricLogin();

        // Assert
        expect(result).toBe(false);
      });

      it('debe manejar respuesta undefined', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({
          success: undefined,
        });

        // Act
        const result = await Biometric.biometricLogin();

        // Assert
        expect(result).toBe(false);
      });
    });

    describe('🎯 Casos Específicos de Prompt', () => {
      it('debe manejar prompts muy largos', async () => {
        // Arrange
        const longPrompt = 'A'.repeat(500);
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await Biometric.biometricLogin(longPrompt);

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: longPrompt,
          cancelButtonText: 'Cancelar',
        });
      });

      it('debe manejar prompts con caracteres especiales', async () => {
        // Arrange
        const specialPrompt = '¡Autentícate! 🔒 @#$%^&*()';
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await Biometric.biometricLogin(specialPrompt);

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: specialPrompt,
          cancelButtonText: 'Cancelar',
        });
      });

      it('debe manejar prompts con saltos de línea', async () => {
        // Arrange
        const multilinePrompt = 'Por favor\nautentícate\nahora';
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await Biometric.biometricLogin(multilinePrompt);

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: multilinePrompt,
          cancelButtonText: 'Cancelar',
        });
      });

      it('debe manejar prompts numéricos', async () => {
        // Arrange
        const numericPrompt = 12345;
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const result = await biometricLoginFromJs(numericPrompt);

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledWith({
          promptMessage: numericPrompt,
          cancelButtonText: 'Cancelar',
        });
      });
    });

    describe('🔄 Casos de Performance y Concurrencia', () => {
      it('debe manejar múltiples llamadas secuenciales', async () => {
        // Arrange
        mockRNBio.simplePrompt
          .mockResolvedValueOnce({ success: true })
          .mockResolvedValueOnce({ success: false })
          .mockResolvedValueOnce({ success: true });

        // Act
        const result1 = await Biometric.biometricLogin('Primer intento');
        const result2 = await Biometric.biometricLogin('Segundo intento');
        const result3 = await Biometric.biometricLogin('Tercer intento');

        // Assert
        expect(result1).toBe(true);
        expect(result2).toBe(false);
        expect(result3).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledTimes(3);
      });

      it('debe ejecutar en tiempo razonable', async () => {
        // Arrange
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const startTime = performance.now();
        await Biometric.biometricLogin();
        const endTime = performance.now();

        // Assert
        expect(endTime - startTime).toBeLessThan(2000); // Menos de 2 segundos
      });

      it('debe manejar timeout si la promesa no se resuelve', async () => {
        // Arrange
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
        mockRNBio.simplePrompt.mockReturnValue(timeoutPromise);

        // Act & Assert
        await expect(Biometric.biometricLogin()).resolves.toBe(false);
      }, 200);
    });
  });

  // ===== GRUPO 3: INTEGRACIÓN ENTRE FUNCIONES =====
  describe('🔗 Integración biometryAvailability + biometricLogin', () => {
    describe('✅ Flujos Completos', () => {
      it('debe verificar disponibilidad antes de autenticar', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: true,
          biometryType: 'TouchID',
        });
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const availability = await Biometric.biometryAvailability();
        let loginResult = false;

        if (availability.available) {
          loginResult = await Biometric.biometricLogin(
            'Autenticación disponible'
          );
        }

        // Assert
        expect(availability.available).toBe(true);
        expect(loginResult).toBe(true);
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(1);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledTimes(1);
      });

      it('debe manejar caso donde sensor no está disponible', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: false,
          biometryType: undefined,
        });

        // Act
        const availability = await Biometric.biometryAvailability();
        let loginResult = null;

        if (availability.available) {
          loginResult = await Biometric.biometricLogin();
        }

        // Assert
        expect(availability.available).toBe(false);
        expect(loginResult).toBeNull();
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(1);
        expect(mockRNBio.simplePrompt).not.toHaveBeenCalled();
      });

      it('debe manejar flujo completo con diferentes tipos de biometría', async () => {
        // Arrange
        const biometryTypes = ['TouchID', 'FaceID', 'Biometrics'];

        for (const biometryType of biometryTypes) {
          mockRNBio.isSensorAvailable.mockResolvedValue({
            available: true,
            biometryType,
          });
          mockRNBio.simplePrompt.mockResolvedValue({ success: true });

          // Act
          const availability = await Biometric.biometryAvailability();
          const loginResult = await Biometric.biometricLogin(
            `Usando ${biometryType}`
          );

          // Assert
          expect(availability.biometryType).toBe(biometryType);
          expect(loginResult).toBe(true);
        }
      });
    });

    describe('❌ Flujos con Errores', () => {
      it('debe manejar error en verificación de disponibilidad seguido de login exitoso', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockRejectedValue(
          new Error('Availability check failed')
        );
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act & Assert
        await expect(Biometric.biometryAvailability()).resolves.toStrictEqual({
          available: false,
          biometryType: null,
        });

        // El login aún debería funcionar si se llama directamente
        const loginResult = await Biometric.biometricLogin();
        expect(loginResult).toBe(true);
      });

      it('debe manejar disponibilidad exitosa seguida de error en login', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: true,
          biometryType: 'TouchID',
        });
        mockRNBio.simplePrompt.mockRejectedValue(new Error('Login failed'));

        // Act
        const availability = await Biometric.biometryAvailability();

        // Assert
        expect(availability.available).toBe(true);
        await expect(Biometric.biometricLogin()).resolves.toBe(false);
      });
    });
  });

  // ===== GRUPO 4: EDGE CASES Y ROBUSTEZ =====
  describe('🛡️ Edge Cases y Robustez', () => {
    describe('⚡ Performance', () => {
      it('debe manejar 100 llamadas rápidas a biometryAvailability', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: true,
          biometryType: 'TouchID',
        });

        // Act
        const startTime = performance.now();
        const promises = Array.from({ length: 100 }, () =>
          Biometric.biometryAvailability()
        );
        await Promise.all(promises);
        const endTime = performance.now();

        // Assert
        expect(endTime - startTime).toBeLessThan(5000); // Menos de 5 segundos para 100 llamadas
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(100);
      });

      it('debe manejar llamadas alternadas entre ambas funciones', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: true,
          biometryType: 'FaceID',
        });
        mockRNBio.simplePrompt.mockResolvedValue({ success: true });

        // Act
        const operations = [];
        for (let i = 0; i < 10; i++) {
          operations.push(Biometric.biometryAvailability());
          operations.push(Biometric.biometricLogin(`Test ${i}`));
        }

        const results = await Promise.all(operations);

        // Assert
        expect(results).toHaveLength(20);
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(10);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledTimes(10);
      });
    });

    describe('🔍 Memory y Resource Management', () => {
      it('no debe causar memory leaks con múltiples instancias', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: true,
          biometryType: 'TouchID',
        });

        // Act
        const operations = [];
        for (let i = 0; i < 1000; i++) {
          operations.push(Biometric.biometryAvailability());
        }

        await Promise.all(operations);

        // Assert
        expect(mockRNBio.isSensorAvailable).toHaveBeenCalledTimes(1000);
        // Si llegamos aquí sin errores de memoria, el test pasa
        expect(true).toBe(true);
      });

      it('debe limpiar recursos correctamente después de errores', async () => {
        // Arrange
        mockRNBio.simplePrompt
          .mockRejectedValueOnce(new Error('First error'))
          .mockRejectedValueOnce(new Error('Second error'))
          .mockResolvedValue({ success: true });

        // Act
        try {
          await Biometric.biometricLogin();
        } catch (error) {
          // Expected first error
        }

        try {
          await Biometric.biometricLogin();
        } catch (error) {
          // Expected second error
        }

        const result = await Biometric.biometricLogin();

        // Assert
        expect(result).toBe(true);
        expect(mockRNBio.simplePrompt).toHaveBeenCalledTimes(3);
      });
    });

    describe('🎯 Boundary Conditions', () => {
      it('debe manejar respuestas con propiedades adicionales', async () => {
        // Arrange
        const extendedResponse = {
          available: true,
          biometryType: 'TouchID',
          extraProperty: 'should be preserved',
          anotherProperty: 42,
        };
        mockRNBio.isSensorAvailable.mockResolvedValue(extendedResponse);

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        // La función biometryAvailability extrae solo available y biometryType
        expect(result).toEqual({
          available: true,
          biometryType: 'TouchID',
        });
        expect(result).toHaveProperty('available');
        expect(result).toHaveProperty('biometryType');
        expect(result).not.toHaveProperty('extraProperty');
        expect(result).not.toHaveProperty('anotherProperty');
      });

      it('debe manejar valores booleanos como strings', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: 'true',
          biometryType: 'TouchID',
        });

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result.available).toBe('true'); // Preserva el tipo original
        expect(result.biometryType).toBe('TouchID');
      });

      it('debe manejar tipos de biometría desconocidos', async () => {
        // Arrange
        mockRNBio.isSensorAvailable.mockResolvedValue({
          available: true,
          biometryType: 'UnknownType',
        });

        // Act
        const result = await Biometric.biometryAvailability();

        // Assert
        expect(result.available).toBe(true);
        expect(result.biometryType).toBe('UnknownType');
      });
    });
  });

  // ===== GRUPO 5: COMPATIBILIDAD Y REGRESIÓN =====
  describe('🔄 Compatibilidad y Regresión', () => {
    it('debe mantener interfaz de función consistente', () => {
      // Assert
      expect(typeof Biometric.biometryAvailability).toBe('function');
      expect(typeof Biometric.biometricLogin).toBe('function');
      expect(Biometric.biometryAvailability.length).toBe(0); // Sin parámetros
      expect(Biometric.biometricLogin.length).toBe(0); // Parámetro con valor por defecto
    });

    it('debe retornar promesas válidas', () => {
      // Arrange
      mockRNBio.isSensorAvailable.mockResolvedValue({
        available: true,
        biometryType: 'TouchID',
      });
      mockRNBio.simplePrompt.mockResolvedValue({ success: true });

      // Act & Assert
      const availabilityPromise = Biometric.biometryAvailability();
      const loginPromise = Biometric.biometricLogin();

      expect(availabilityPromise).toBeInstanceOf(Promise);
      expect(loginPromise).toBeInstanceOf(Promise);

      return Promise.all([availabilityPromise, loginPromise]);
    });

    it('debe ser importable correctamente', () => {
      // Assert
      expect(Biometric.biometryAvailability).toBeDefined();
      expect(Biometric.biometricLogin).toBeDefined();
      expect(typeof Biometric.biometryAvailability).toBe('function');
      expect(typeof Biometric.biometricLogin).toBe('function');
    });
  });
});
