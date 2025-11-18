import type { AxiosInstance } from 'axios';
import axios from 'axios';
import { discoverableHashFromDni } from '../register/idHash';
import { getWiraConfig } from '../config';

export type UpdateInput = {
  ownerDid: string;
  nickname: string;
};

export type InviteInput = {
  inviterDid: string;
  guardianDid: string;
  nickname?: string;
};

export type RecoveryRequestInput = {
  targetDid: string;
  deviceId: string;
};

export type RecoveryInput = {
  guardianDid: string;
  proposedGuardianAddress?: string;
};

export type TokenInput = {
  token: string;
  platform: 'WEB' | 'ANDROID' | 'IOS';
  userDid?: string;
};

export class GuardiansApi {
  API: AxiosInstance;

  constructor(guardiansUrl: string) {
    this.API = axios.create({
      baseURL: guardiansUrl,
      timeout: 50000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async myGuardians(did: string) {
    const response = await this.API.get(`/guardians/my-guardians`, {
      params: { ownerDid: did },
    });
    return response.data;
  }

  async hasGuardians(dni: string) {
    const discoverableHash = discoverableHashFromDni(dni);
    const { data } = await this.API.get('/registry/resolve', {
      params: { discoverableHash },
    });

    if (!data?.ok) {
      return {
        ok: false,
        error: 'Failed to resolve discoverable hash. ' + data?.error,
      };
    }

    const guardiansData = await this.myGuardians(data.did);

    if (!guardiansData?.ok) {
      return {
        ok: false,
        error: 'Failed to fetch guardians. ' + guardiansData?.error,
      };
    }

    return { ok: true, has: guardiansData.guardians.length > 0 };
  }

  inviteUrl = '/guardians/invite';
  async invite(inviteInput: InviteInput) {
    const { appId } = getWiraConfig();
    const response = await this.API.post(this.inviteUrl, {
      ...inviteInput,
      appId,
    });
    return response.data;
  }

  async listInvitations(guardianDid: string) {
    const response = await this.API.get(`/guardians/invitations`, {
      params: { guardianDid },
    });
    return response.data;
  }

  async respondInvitation(
    invitationId: string,
    guardianDid: string,
    accept: 'accept' | 'reject'
  ) {
    const { appId } = getWiraConfig();
    const response = await this.API.patch(
      `/guardians/invitation/${invitationId}/${accept}`,
      { guardianDid, appId }
    );
    return response.data;
  }

  async updateGuardianNickname(invId: string, data: UpdateInput) {
    const response = await this.API.patch(
      `/guardians/invitation/${invId}/nickname`,
      data
    );
    return response.data;
  }

  async removeGuardian(invId: string, ownerDid: string) {
    const response = await this.API.delete(`/guardians/${invId}`, {
      params: { ownerDid },
    });
    return response.data;
  }

  requestRecoveryUrl = '/recovery/request';
  async requestRecovery(recoveryRequest: RecoveryRequestInput) {
    const { appId } = getWiraConfig();
    const response = await this.API.post(this.requestRecoveryUrl, {
      ...recoveryRequest,
      appId,
    });
    return response.data;
  }

  async listRecoveries(
    guardianDid: string,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  ) {
    const response = await this.API.get(`/recovery/for-guardian`, {
      params: { guardianDid, status },
    });
    return response.data;
  }

  async respondRecovery(
    requestId: string,
    accept: 'approve' | 'reject',
    input: RecoveryInput
  ) {
    const { appId } = getWiraConfig();
    const response = await this.API.patch(`/recovery/${requestId}/${accept}`, {
      ...input,
      appId,
    });
    return response.data;
  }

  async recoveryStatus(deviceId: string) {
    const response = await this.API.get(`/recovery/status`, {
      params: { deviceId },
    });
    return response.data;
  }

  async recoveryDetail(deviceId: string) {
    const response = await this.API.get(`/recovery/detail`, {
      params: { deviceId },
    });
    return response.data;
  }

  deviceTokenUrl = '/device-token';
  async deviceToken(tokenInput: TokenInput) {
    const { appId } = getWiraConfig();
    const response = await this.API.post(this.deviceTokenUrl, {
      ...tokenInput,
      appId,
    });
    return response.data;
  }

  async getThreshold(userDid: string) {
    const response = await this.API.get(`/guardians/threshold/${userDid}`);
    return response.data;
  }

  async updateThreshold(userDid: string, threshold: number) {
    const response = await this.API.patch(`/guardians/threshold/${userDid}`, {
      threshold,
    });
    return response.data;
  }
}
