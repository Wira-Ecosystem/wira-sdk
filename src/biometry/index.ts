import ReactNativeBiometrics from 'react-native-biometrics';
const rnBio = new ReactNativeBiometrics();

export async function biometryAvailability() {
  try {
    const { available, biometryType } = await rnBio.isSensorAvailable();
    return { available: !!available, biometryType: biometryType || null };
  } catch {
    return { available: false, biometryType: null };
  }
}

export async function biometricLogin(prompt = 'Autentícate') {
  try {
    const { success } = await rnBio.simplePrompt({
      promptMessage: prompt,
      cancelButtonText: 'Cancelar',
    });
    return !!success;
  } catch {
    return false;
  }
}
