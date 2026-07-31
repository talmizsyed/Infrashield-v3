import { ErrorSeverity, type InfrastructureError } from './errors';
import { type Result } from './result';
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
export declare class Options<TOptions> implements IOptions<TOptions> {
  readonly value: Readonly<TOptions>;
  constructor(value: TOptions);
}
/**
 * Builder for provider-agnostic options assembly.
 */
export declare class OptionsBuilder<
  TOptions extends Record<string, unknown>,
> implements IOptionsFactory<TOptions> {
  private readonly validators;
  private readonly defaults;
  private overrides;
  constructor(defaults: TOptions);
  override(values: Partial<TOptions>): this;
  addValidator(validator: IOptionsValidator<TOptions>): this;
  build(): Result<TOptions, InfrastructureError>;
  create(): Result<IOptions<TOptions>, InfrastructureError>;
}
/**
 * Merges defaults and overrides using shallow object composition.
 */
export declare function mergeOptions<TOptions extends Record<string, unknown>>(
  defaults: TOptions,
  overrides?: Partial<TOptions>,
): TOptions;
/**
 * Creates a validator from a predicate and an error message.
 */
export declare function createOptionsValidator<TOptions>(
  predicate: (options: Readonly<TOptions>) => boolean,
  input: {
    readonly code: string;
    readonly message: string;
    readonly severity?: ErrorSeverity;
  },
): IOptionsValidator<TOptions>;
//# sourceMappingURL=options.d.ts.map
