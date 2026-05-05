jest.mock('./src/NativeWiraSdk', () => ({
  __esModule: true,
  default: {
    getCredentials: jest.fn().mockResolvedValue(
      JSON.stringify({
        credentials: [{ info: { mock: true } }],
      })
    ),
    initialize: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
    downloadCircuits: jest
      .fn()
      .mockResolvedValue(JSON.stringify({ success: true })),
    addIdentity: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
    authenticate: jest
      .fn()
      .mockResolvedValue(JSON.stringify({ success: true })),
    claimCredential: jest
      .fn()
      .mockResolvedValue(JSON.stringify({ success: true })),
    backupIdentity: jest
      .fn()
      .mockResolvedValue(JSON.stringify({ success: true })),
    restoreIdentity: jest
      .fn()
      .mockResolvedValue(JSON.stringify({ success: true })),
  },
}));
