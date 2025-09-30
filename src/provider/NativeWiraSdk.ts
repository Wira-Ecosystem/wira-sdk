import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Represents a set of key/value pairs, similar to Android's ContentValues.
 * Used for inserting or updating data in a ContentProvider.
 * Keys are strings, and values can be primitive types or null.
 */
type NativeContentValues = Object;

/**
 * Represents the result of a query operation on a ContentProvider.
 */
type NativeCursor = Object;

/**
 * Interface defining the methods available in the NativeWiraProviderModule ContentProvider.
 */
export interface Spec extends TurboModule {
  deleteUser(uri: string): number;

  insertUser(uri: string, values: NativeContentValues): string;

  queryUser(uri: string): NativeCursor;

  updateUser(uri: string, values: NativeContentValues): number;

  requestAccessDataPermission(): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('WiraSdk');
