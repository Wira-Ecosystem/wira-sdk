import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  initialize(env: string): Promise<any>;
  downloadCircuits(circuitsToDownload: string): Promise<any>;
  addIdentity(): Promise<any>;
  authenticate(
    message: string,
    userDid: string,
    userPk: string,
    requestedCredentialIds: string[]
  ): Promise<any>;
  getProof(
    message: string,
    userDid: string,
    userPk: string,
    challenge: string,
    byField: string,
    byValue: string
  ): Promise<any>;
  claimCredential(
    offerMessage: string,
    userDid: string,
    userPk: string
  ): Promise<any>;
  backupIdentity(userDid: string, userPk: string): Promise<any>;
  restoreIdentity(
    backup: string,
    userDid: string,
    userPk: string
  ): Promise<any>;
  getCredentials(userDid: string, userPk: string): Promise<any>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('WiraSdk');
