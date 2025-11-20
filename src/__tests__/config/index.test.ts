import { getWiraConfig, initWiraSdk } from '../../config';

describe('initWiraSdk and getWiraConfig', () => {
  it('should set initial configuration', () => {
    const cfg = { appId: '123', guardiansUrl: 'https://example.com' };
    initWiraSdk(cfg);
    expect(getWiraConfig()).toStrictEqual(cfg);
  });

  it('should throw error if configuration is not set', () => {
    initWiraSdk(null as unknown as any);
    expect(() => getWiraConfig()).toThrow(
      'Wira SDK not initialized. Call initWiraSdk(...) first.'
    );
  });
});
