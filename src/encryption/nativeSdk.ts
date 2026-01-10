import WiraSdk from '../NativeWiraSdk';

/**
 * Authenticate a user with a message, user DID, and user private key.
 * @param message - The authentication message.
 * @param userDid - The decentralized identifier of the user.
 * @param userPk - The private key of the user.
 * @returns The authentication response.
 */
async function authenticate(
  message: string,
  userDid: string,
  userPk: `0x${string}`
) {
  const authResponse = JSON.parse(
    await WiraSdk.authenticate(message, userDid, userPk.replace('0x', ''))
  );
  if (!authResponse.success) {
    throw new Error(
      'Authentication failed: ' + (authResponse.error || 'unknown error')
    );
  }

  return authResponse.response;
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
  backupIdentity,
  restoreIdentity,
};
