import { createError, ErrorSeverity, type InfrastructureError } from './errors';
import { fail, ok, type Result } from './result';

/**
 * Read-only options wrapper contract.
 */
export interface IOptions<TOptions> {
  readonly value: Readonly<TOptions>;
}

/**
 * Validator contract for options values.
 */
export interface IOptionsValidator<TOptions> {
  validate(options: Readonly<TOptions>): Result<void, InfrastructureError>;
}

/**
 * Factory contract for typed options instances.
 */
export interface IOptionsFactory<TOptions> {
  create(): Result<IOptions<TOptions>, InfrastructureError>;
}

/**
 * Options wrapper implementation.
 */
export class Options<TOptions> implements IOptions<TOptions> {
  public readonly value: Readonly<TOptions>;

  public constructor(value: TOptions) {
    this.value = Object.freeze({ ...value });
  }
}

/**
 * Builder for provider-agnostic options assembly.
 */
export class OptionsBuilder<
  TOptions extends Record<string, unknown>,
> implements IOptionsFactory<TOptions> {
  private readonly validators: IOptionsValidator<TOptions>[] = [];
  private readonly defaults: TOptions;
  private overrides: Partial<TOptions> = {};

  public constructor(defaults: TOptions) {
    this.defaults = { ...defaults };
  }

  public override(values: Partial<TOptions>): this {
    this.overrides = {
      ...this.overrides,
      ...values,
    };
    return this;
  }

  public addValidator(validator: IOptionsValidator<TOptions>): this {
    this.validators.push(validator);
    return this;
  }

  public build(): Result<TOptions, InfrastructureError> {
    const merged = mergeOptions(this.defaults, this.overrides);

    for (const validator of this.validators) {
      const validation = validator.validate(merged);
      if (!validation.succeeded) {
        return validation;
      }
    }

    return ok(merged);
  }

  public create(): Result<IOptions<TOptions>, InfrastructureError> {
    const result = this.build();
    if (!result.succeeded) {
      return result;
    }

    return ok(new Options(result.data));
  }
}

/**
 * Merges defaults and overrides using shallow object composition.
 */
export function mergeOptions<TOptions extends Record<string, unknown>>(
  defaults: TOptions,
  overrides?: Partial<TOptions>,
): TOptions {
  return {
    ...defaults,
    ...(overrides ?? {}),
  };
}

/**
 * Creates a validator from a predicate and an error message.
 */
export function createOptionsValidator<TOptions>(
  predicate: (options: Readonly<TOptions>) => boolean,
  input: {
    readonly code: string;
    readonly message: string;
    readonly severity?: ErrorSeverity;
  },
): IOptionsValidator<TOptions> {
  return {
    validate(options: Readonly<TOptions>): Result<void, InfrastructureError> {
      if (predicate(options)) {
        return ok(undefined);
      }

      return fail(
        createError({
          code: input.code,
          message: input.message,
          severity: input.severity ?? ErrorSeverity.Error,
        }),
      );
    },
  };
}
