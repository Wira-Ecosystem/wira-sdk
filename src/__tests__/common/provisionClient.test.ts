import { fetchProvision, getProvision } from '../../common/provisionClient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEY } from '../../common/constants';
import { Platform } from 'react-native';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('fetchProvision', () => {
  it('should fetch and store development data', async () => {
    const data = {
      url: 'https://dev.example.com/provision',
    };

    mockedAxios.post.mockResolvedValueOnce({ data });
    Platform.OS = 'android';

    const response = await fetchProvision({
      mock: true,
      gatewayBase: 'https://dev.example.com',
    });

    expect(response).toStrictEqual(data);
    expect(mockedAsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://dev.example.com/provision',
      expect.objectContaining({ platform: 'android' }),
      expect.any(Object)
    );
  });
});

describe('getProvision', () => {
  it('should retrieve stored provision data', async () => {
    const data = {
      url: 'https://dev.example.com/provision',
    };

    mockedAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(data));

    const retrievedData = await getProvision();

    expect(retrievedData).toStrictEqual(data);
    expect(mockedAsyncStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('should return null if no data is stored', async () => {
    mockedAsyncStorage.getItem.mockResolvedValueOnce(null);
    const retrievedData = await getProvision();

    expect(retrievedData).toBeNull();
  });
});
