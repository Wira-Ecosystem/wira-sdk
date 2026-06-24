import type { DniExtractedData } from '../common/types';
import { discoverableHashFromDni } from './idHash';
import axios, { type AxiosInstance } from 'axios';

export type RegistryInput = {
  did: string;
  accountAddress: `0x${string}`;
  guardianContractAddress?: `0x${string}` | null;
  displayNamePublic: boolean | null;
  dni: string;
  hashedDataWithIdentity: string; //for recovery purposes
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
    const payload: Omit<RegistryInput, 'dni'> & {
      discoverableHash?: string;
    } = {
      did: input.did,
      accountAddress: input.accountAddress,
      guardianContractAddress: input.guardianContractAddress ?? null,
      discoverableHash: discoverableHashFromDni(input.dni),
      displayNamePublic: input.displayNamePublic ?? null,
      hashedDataWithIdentity: input.hashedDataWithIdentity,
    };
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

  async updateRecoveryData(dni: string, hashedDataWithIdentity: string) {
    const { data } = await this.API.patch('/registry/recovery', {
      discoverableHash: discoverableHashFromDni(dni),
      hashedDataWithIdentity,
    });
    return data;
  }

  async recoveryByCi(
    discoverableHash: string,
    frontImg: string,
    backImg: string,
    selfieImg: string
  ) {
    const { data } = await this.API.post('/registry/recovery-ci', {
      discoverableHash,
      frontImg,
      backImg,
      selfieImg,
    });
    return data;
  }

  async recoveryByGuardians(dniHash: string, deviceId: string) {
    const { data } = await this.API.post('/registry/recovery-guardian', {
      discoverableHash: dniHash,
      deviceId,
    });
    return data;
  }

  async analyzeFromRegistry(front: string, back: string, selfie: string) {
    const { data } = await this.API.post<{
      ok: boolean;
      error?: string;
      details?: string;
      data?: DniExtractedData;
    }>('/registry/analyze', {
      frontImg: front,
      backImg: back,
      selfieImg: selfie,
    });
    return data;
  }

  async canMigrate(did: string) {
    const { data } = await this.API.get('/registry/can-migrate', {
      params: { did },
    });
    return data;
  }
}
