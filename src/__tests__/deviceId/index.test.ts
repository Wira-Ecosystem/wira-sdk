import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceId } from '../../deviceId';
import { DEVICE_ID_KEY } from '../../common/constants';

const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('DeviceId.getDeviceId', () => {
  it('should generate and store a new device ID if none exists', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);

    const deviceId = await DeviceId.getDeviceId();
    expect(deviceId).not.toBeNull();
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      DEVICE_ID_KEY,
      deviceId
    );
  });

  it('should retrieve the existing device ID if it exists', async () => {
    const existingId = '123e4567-e89b-12d3-a456-426614174000';
    mockedAsyncStorage.getItem.mockResolvedValueOnce(existingId);
    mockedAsyncStorage.setItem.mockClear();

    const deviceId = await DeviceId.getDeviceId();
    expect(deviceId).toBe(existingId);
    expect(mockedAsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
