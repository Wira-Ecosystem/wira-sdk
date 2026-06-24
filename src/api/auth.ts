import type { AxiosInstance } from 'axios';
import axios from 'axios';

export type RegisterAppInput = {
  discoverableHash: string;
  packageName: string;
  userHash: string;
  sessionToken: string;
};

export class AuthApi {
  API: AxiosInstance;

  constructor(guardiansUrl: string, guardiansApiKey: string) {
    this.API = axios.create({
      baseURL: guardiansUrl,
      timeout: 50000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': guardiansApiKey,
      },
    });
  }

  async getRegisteredApps(discoverableHash: string) {
    const response = await this.API.get(
      `/auth/registered-apps/${discoverableHash}`
    );
    return response.data;
  }

  async getSession(userHash: string) {
    const response = await this.API.get(`/auth/session/${userHash}`);
    return response.data;
  }

  async registerApp(input: RegisterAppInput) {
    const response = await this.API.post(`/auth/register-app`, input);
    return response.data;
  }
}
