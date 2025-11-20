export const mockConnect = jest.fn().mockResolvedValue(undefined);
export const mockExecuteJs = jest.fn().mockResolvedValue({
  success: true,
  response: JSON.stringify({ data: 'credential-string' }),
});

const litNodeClientMock = {
  connect: mockConnect,
  executeJs: mockExecuteJs,
};

export const LitNodeClient = jest.fn(() => litNodeClientMock);
