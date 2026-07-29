import type { Identifier, SerializableValue } from '@infrashield/contracts';

/**
 * Configuration provider contract for environment, policy, and feature resolution.
 */
export interface IConfigurationProvider {
  readonly providerId: Identifier;
  readonly name: string;
  readonly version: string;

  load(): Promise<SerializableValue>;
  snapshot(): Promise<SerializableValue>;
  get(key: string): Promise<SerializableValue | undefined>;
  set(key: string, value: SerializableValue): Promise<void>;
  delete(key: string): Promise<void>;
}
