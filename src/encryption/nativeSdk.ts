import WiraSdk from '../NativeWiraSdk';

/**
 * Authenticate a user with a message, user DID, and user private key.
 * @param message - The authentication message.
 * @param userDid - The decentralized identifier of the user.
 * @param userPk - The private key of the user.
 * @param requestedCredentialIds - Optional array of credential IDs to request during authentication.
 * @returns The authentication response.
 */
async function authenticate(
  message: string,
  userDid: string,
  userPk: `0x${string}`,
  requestedCredentialIds?: string[]
) {
  const authResponse = JSON.parse(
    await WiraSdk.authenticate(
      message,
      userDid,
      userPk.replace('0x', ''),
      requestedCredentialIds ?? []
    )
  );
  if (!authResponse.success) {
    throw new Error(
      'Authentication failed: ' +
        (authResponse.error
          ? authResponse.error + ' Stack: ' + authResponse.stackTrace
          : 'unknown error')
    );
  }

  return authResponse.response;
}

async function getProof(
  message: string,
  userDid: string,
  userPk: string,
  challenge: string,
  credentialId: string
) {
  const proofResponse = JSON.parse(
    await WiraSdk.getProof(
      message,
      userDid,
      userPk.replace('0x', ''),
      challenge,
      'id',
      credentialId
    )
  );

  if (!proofResponse.success) {
    throw new Error(
      'Error getting proof: ' +
        (proofResponse.error || 'unknown error') +
        ' Stack: ' +
        proofResponse.stackTrace
    );
  }

  return proofResponse.proof;
}

async function getCredentials(userDid: string, userPk: `0x${string}`) {
  const credentialsResponse = JSON.parse(
    await WiraSdk.getCredentials(userDid, userPk.replace('0x', ''))
  );

  if (!credentialsResponse.success) {
    throw new Error(
      'Error getting credentials: ' +
        (credentialsResponse.error || 'unknown error')
    );
  }

  return credentialsResponse.credentials;
}

async function backupIdentity(subjectDid: string, privateKey: `0x${string}`) {
  const backupResponse = JSON.parse(
    await WiraSdk.backupIdentity(subjectDid, privateKey.replace('0x', ''))
  );

  if (!backupResponse.success) {
    throw new Error(
      'Error backup identity: ' + (backupResponse.error || 'unknown error')
    );
  }

  return backupResponse.backup;
}

async function restoreIdentity(
  backup: string,
  subjectDid: string,
  privateKey: `0x${string}`
) {
  const restoreResponse = JSON.parse(
    await WiraSdk.restoreIdentity(
      backup,
      subjectDid,
      privateKey.replace('0x', '')
    )
  );

  if (!restoreResponse.success) {
    throw new Error(
      'Error restoring identity: ' + (restoreResponse.error || 'unknown error')
    );
  }
}

export const WiraSdkInterface = {
  authenticate,
  getCredentials,
  getProof,
  backupIdentity,
  restoreIdentity,
};
