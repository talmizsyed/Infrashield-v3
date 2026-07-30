import { createError, ErrorSeverity, type InfrastructureError } from './errors';
import type { SerializableValue } from './primitives';
import { fail, ok, type Result } from './result';

/**
 * Configuration value shape.
 */
export type ConfigurationValue = SerializableValue;

/**
 * Configuration map shape.
 */
export type ConfigurationMap = Readonly<Record<string, ConfigurationValue>>;

/**
 * Generic configuration provider contract.
 */
export interface IConfigurationProvider {
  has(key: string): boolean;
  get<TValue extends ConfigurationValue>(key: string): TValue | undefined;
  getRequired<TValue extends ConfigurationValue>(key: string): Result<TValue, InfrastructureError>;
  snapshot(): ConfigurationMap;
}

/**
 * Configuration provider backed by an immutable in-memory map.
 */
export class StaticConfigurationProvider implements IConfigurationProvider {
  private readonly values: ConfigurationMap;

  public constructor(values: Record<string, ConfigurationValue>) {
    this.values = Object.freeze({ ...values });
  }

  public has(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.values, key);
  }

  public get<TValue extends ConfigurationValue>(key: string): TValue | undefined {
    const value = this.values[key];
    return value as TValue | undefined;
  }

  public getRequired<TValue extends ConfigurationValue>(
    key: string,
  ): Result<TValue, InfrastructureError> {
    const value = this.get<TValue>(key);
    if (typeof value === 'undefined') {
      return fail(
        createError({
          code: 'configuration.missing',
          message: `Missing required configuration value: ${key}`,
          severity: ErrorSeverity.Error,
          details: { key },
        }),
      );
    }

    return ok(value);
  }

  public snapshot(): ConfigurationMap {
    return this.values;
  }
}

/**
 * Factory function for static configuration providers.
 */
export function createConfigurationProvider(
  values: Record<string, ConfigurationValue>,
): IConfigurationProvider {
  return new StaticConfigurationProvider(values);
}
