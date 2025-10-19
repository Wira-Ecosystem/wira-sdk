import { discoverableHashFromDni } from './idHash';
import axios, { type AxiosInstance } from 'axios';

export type RegistryInput = {
  did: string;
  accountAddress: `0x${string}`;
  guardianContractAddress?: `0x${string}` | null;
  displayNamePublic: boolean | null;
  discoverableHashOptIn: boolean; // opt-in
  dni: string;
  ciphertext: string; //for recovery purposes
  dataToEncryptHash: string; //for recovery purposes
};

export class RegistryApi {
  private API: AxiosInstance;

  constructor(registryUrl: string) {
    this.API = axios.create({
      baseURL: registryUrl,
      timeout: 50000,
    });

    this.API.interceptors.response.use(
      (r) => r,
      (e) => {
        const msg = e?.response?.data?.message || e.message || 'Network error';
        return Promise.reject(new Error(msg));
      }
    );
  }

  async registryCheckByDni(dni: string) {
    const discoverableHash = discoverableHashFromDni(dni);
    const { data } = await this.API.post('/registry/check', {
      discoverableHash,
    });

    return { ...data, discoverableHash };
  }

  async registryResolveByDni(dni: string) {
    const discoverableHash = discoverableHashFromDni(dni);
    const { data } = await this.API.get('/registry/resolve', {
      params: { discoverableHash },
    });
    return { ...data, discoverableHash };
  }

  async resolveByDid(did: string) {
    const { data } = await this.API.get('/registry/by-did', {
      params: { did },
    });
    return data;
  }

  async registryRegister(input: RegistryInput) {
    const payload: Omit<RegistryInput, 'discoverableHashOptIn' | 'dni'> & {
      discoverableHash?: string;
    } = {
      did: input.did,
      accountAddress: input.accountAddress,
      guardianContractAddress: input.guardianContractAddress ?? null,
      displayNamePublic: input.displayNamePublic ?? null,
      ciphertext: input.ciphertext,
      dataToEncryptHash: input.dataToEncryptHash,
    };
    if (input.discoverableHashOptIn && input.dni) {
      payload.discoverableHash = discoverableHashFromDni(input.dni);
    }
    const { data } = await this.API.post('/registry/register', payload);
    // { ok:true, id: <streamId> }
    return data;
  }

  async registryUpdateDisplayName(did: string, displayNamePublic: any) {
    const { data } = await this.API.patch('/registry/name', {
      did,
      displayNamePublic,
    });
    return data;
  }

  async updateRecoveryData(
    dni: string,
    ciphertext: string,
    dataToEncryptHash: string
  ) {
    const { data } = await this.API.patch('/registry/recovery', {
      discoverableHash: discoverableHashFromDni(dni),
      ciphertext,
      dataToEncryptHash,
    });
    return data;
  }
}
