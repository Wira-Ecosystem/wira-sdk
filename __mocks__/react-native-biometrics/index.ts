export const ReactNativeBiometricsMock = {
  isSensorAvailable: jest.fn().mockResolvedValue({
    available: true,
    biometryType: 'TouchID',
  }),
  simplePrompt: jest.fn().mockResolvedValue({ success: true }),
};

export default jest.fn(() => ReactNativeBiometricsMock);
