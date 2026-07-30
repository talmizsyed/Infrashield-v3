/**
 * Nominal dependency injection token.
 */
export type InjectionToken<TService> = symbol & {
  readonly __service?: TService;
};

/**
 * Service lifetime constants used by the registration model.
 */
export const ServiceLifetime = {
  Singleton: 'singleton',
  Scoped: 'scoped',
  Transient: 'transient',
} as const;

/**
 * Service lifetime value union.
 */
export type ServiceLifetime = (typeof ServiceLifetime)[keyof typeof ServiceLifetime];

/**
 * Singleton lifetime alias.
 */
export const Singleton: ServiceLifetime = ServiceLifetime.Singleton;

/**
 * Scoped lifetime alias.
 */
export const Scoped: ServiceLifetime = ServiceLifetime.Scoped;

/**
 * Transient lifetime alias.
 */
export const Transient: ServiceLifetime = ServiceLifetime.Transient;

/**
 * Constructor type captured as metadata only.
 */
export interface ServiceType<TService> {
  new (...args: readonly unknown[]): TService;
}

/**
 * Service factory metadata type.
 *
 * The collection stores this factory but never invokes it.
 */
export type ServiceFactory<TService> = (provider: IServiceProvider) => TService;

/**
 * Metadata describing how a service will be provided.
 */
export type ServiceRegistration<TService> =
  | { readonly kind: 'self' }
  | { readonly kind: 'factory'; readonly factory: ServiceFactory<TService> }
  | { readonly kind: 'type'; readonly type: ServiceType<TService> }
  | { readonly kind: 'instance'; readonly instance: TService };

/**
 * Service descriptor contract.
 */
export interface IServiceDescriptor<TService> {
  readonly token: InjectionToken<TService>;
  readonly lifetime: ServiceLifetime;
  readonly registration: ServiceRegistration<TService>;
}

/**
 * Scope factory contract used by provider abstractions.
 */
export interface IServiceScopeFactory {
  createScope(): IServiceScope;
}

/**
 * Resolver contract used by provider abstractions.
 */
export interface IServiceResolver {
  resolve<TService>(token: InjectionToken<TService>): TService;
  tryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
}

/**
 * Scope contract used by provider abstractions.
 */
export interface IServiceScope extends IServiceResolver {
  readonly provider: IServiceProvider;
  dispose(): Promise<void>;
}

/**
 * Provider contract used by service factories.
 */
export interface IServiceProvider extends IServiceResolver, IServiceScopeFactory {
  Resolve<TService>(token: InjectionToken<TService>): TService;
  ResolveRequired<TService>(token: InjectionToken<TService>): TService;
  ResolveAll<TService>(token: InjectionToken<TService>): readonly TService[];
  resolveRequired<TService>(token: InjectionToken<TService>): TService;
  resolveAll<TService>(token: InjectionToken<TService>): readonly TService[];
  dispose(): Promise<void>;
}

/**
 * Duplicate registration diagnostic.
 */
export interface DuplicateRegistration {
  readonly token: symbol;
  readonly count: number;
}

/**
 * Validation report for service collection metadata.
 */
export interface ServiceCollectionValidationReport {
  readonly valid: boolean;
  readonly duplicates: readonly DuplicateRegistration[];
}

/**
 * Mutable registration collection contract.
 *
 * This collection stores metadata only and does not resolve or instantiate services.
 */
export interface IServiceCollection {
  readonly Count: number;

  register<TService>(descriptor: IServiceDescriptor<TService>): void;

  AddSingleton<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  AddSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  AddSingleton<TService>(token: InjectionToken<TService>, instance: TService): void;
  AddSingleton<TService>(token: InjectionToken<TService>): void;
  AddSingleton<TService>(descriptor: IServiceDescriptor<TService>): void;

  AddScoped<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  AddScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  AddScoped<TService>(token: InjectionToken<TService>): void;
  AddScoped<TService>(descriptor: IServiceDescriptor<TService>): void;

  AddTransient<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  AddTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  AddTransient<TService>(token: InjectionToken<TService>): void;
  AddTransient<TService>(descriptor: IServiceDescriptor<TService>): void;

  AddInstance<TService>(token: InjectionToken<TService>, instance: TService): void;

  TryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean;
  Replace<TService>(descriptor: IServiceDescriptor<TService>): void;
  Remove(token: symbol): boolean;
  Clear(): void;
  Contains(token: symbol): boolean;
  Enumerate(): readonly IServiceDescriptor<unknown>[];
  Validate(): ServiceCollectionValidationReport;

  addSingleton<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  addSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  addSingleton<TService>(token: InjectionToken<TService>, instance: TService): void;
  addSingleton<TService>(token: InjectionToken<TService>): void;

  addScoped<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  addScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  addScoped<TService>(token: InjectionToken<TService>): void;

  addTransient<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  addTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  addTransient<TService>(token: InjectionToken<TService>): void;

  addInstance<TService>(token: InjectionToken<TService>, instance: TService): void;
  tryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean;
  replace<TService>(descriptor: IServiceDescriptor<TService>): void;
  remove(token: symbol): boolean;
  clear(): void;
  contains(token: symbol): boolean;
  enumerate(): readonly IServiceDescriptor<unknown>[];
  validate(): ServiceCollectionValidationReport;
}

/**
 * Base DI exception.
 */
export class DependencyInjectionError extends Error {
  public readonly code: string;

  public constructor(code: string, message: string) {
    super(message);
    this.name = 'DependencyInjectionError';
    this.code = code;
  }
}

/**
 * Exception raised for invalid registration input.
 */
export class DependencyRegistrationError extends DependencyInjectionError {
  public constructor(message: string) {
    super('di.registration_invalid', message);
    this.name = 'DependencyRegistrationError';
  }
}

/**
 * Metadata representation of a service registration.
 */
export class ServiceDescriptor<TService> implements IServiceDescriptor<TService> {
  public readonly token: InjectionToken<TService>;
  public readonly lifetime: ServiceLifetime;
  public readonly registration: ServiceRegistration<TService>;

  public constructor(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    registration: ServiceRegistration<TService>,
  ) {
    this.token = token;
    this.lifetime = lifetime;
    this.registration = registration;
  }

  /**
   * Creates a descriptor with self registration metadata.
   */
  public static self<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
  ): ServiceDescriptor<TService> {
    return new ServiceDescriptor(token, lifetime, { kind: 'self' });
  }

  /**
   * Creates a descriptor with factory registration metadata.
   */
  public static fromFactory<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    factory: ServiceFactory<TService>,
  ): ServiceDescriptor<TService> {
    return new ServiceDescriptor(token, lifetime, { kind: 'factory', factory });
  }

  /**
   * Creates a descriptor with constructor type metadata.
   */
  public static fromType<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementationType: ServiceType<TImplementation>,
  ): ServiceDescriptor<TService> {
    return new ServiceDescriptor(token, lifetime, {
      kind: 'type',
      type: implementationType as ServiceType<TService>,
    });
  }

  /**
   * Creates a descriptor with pre-built singleton instance metadata.
   */
  public static fromInstance<TService>(
    token: InjectionToken<TService>,
    instance: TService,
  ): ServiceDescriptor<TService> {
    return new ServiceDescriptor(token, ServiceLifetime.Singleton, {
      kind: 'instance',
      instance,
    });
  }
}

/**
 * In-memory implementation of the DI registration collection.
 */
export class ServiceCollection implements IServiceCollection {
  private readonly descriptors: IServiceDescriptor<unknown>[] = [];

  public get Count(): number {
    return this.descriptors.length;
  }

  public register<TService>(descriptor: IServiceDescriptor<TService>): void {
    assertDescriptor(descriptor);
    this.throwIfEquivalentDescriptorExists(descriptor);
    this.descriptors.push(descriptor as IServiceDescriptor<unknown>);
  }

  public AddSingleton<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  public AddSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  public AddSingleton<TService>(token: InjectionToken<TService>, instance: TService): void;
  public AddSingleton<TService>(token: InjectionToken<TService>): void;
  public AddSingleton<TService>(descriptor: IServiceDescriptor<TService>): void;
  public AddSingleton<TService>(
    tokenOrDescriptor: InjectionToken<TService> | IServiceDescriptor<TService>,
    implementation?: ServiceFactory<TService> | ServiceType<TService> | TService,
  ): void {
    if (isDescriptor(tokenOrDescriptor)) {
      this.ensureLifetime(tokenOrDescriptor, ServiceLifetime.Singleton, 'AddSingleton');
      this.register(tokenOrDescriptor);
      return;
    }

    this.register(
      this.createDescriptor(tokenOrDescriptor, ServiceLifetime.Singleton, implementation),
    );
  }

  public AddScoped<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  public AddScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  public AddScoped<TService>(token: InjectionToken<TService>): void;
  public AddScoped<TService>(descriptor: IServiceDescriptor<TService>): void;
  public AddScoped<TService>(
    tokenOrDescriptor: InjectionToken<TService> | IServiceDescriptor<TService>,
    implementation?: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    if (isDescriptor(tokenOrDescriptor)) {
      this.ensureLifetime(tokenOrDescriptor, ServiceLifetime.Scoped, 'AddScoped');
      this.register(tokenOrDescriptor);
      return;
    }

    this.register(this.createDescriptor(tokenOrDescriptor, ServiceLifetime.Scoped, implementation));
  }

  public AddTransient<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  public AddTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  public AddTransient<TService>(token: InjectionToken<TService>): void;
  public AddTransient<TService>(descriptor: IServiceDescriptor<TService>): void;
  public AddTransient<TService>(
    tokenOrDescriptor: InjectionToken<TService> | IServiceDescriptor<TService>,
    implementation?: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    if (isDescriptor(tokenOrDescriptor)) {
      this.ensureLifetime(tokenOrDescriptor, ServiceLifetime.Transient, 'AddTransient');
      this.register(tokenOrDescriptor);
      return;
    }

    this.register(
      this.createDescriptor(tokenOrDescriptor, ServiceLifetime.Transient, implementation),
    );
  }

  public AddInstance<TService>(token: InjectionToken<TService>, instance: TService): void {
    assertToken(token, 'AddInstance');
    if (typeof instance === 'undefined') {
      throw new DependencyRegistrationError('AddInstance requires a defined instance value.');
    }

    this.register(ServiceDescriptor.fromInstance(token, instance));
  }

  public TryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean {
    assertDescriptor(descriptor);
    if (this.Contains(descriptor.token)) {
      return false;
    }

    this.register(descriptor);
    return true;
  }

  public Replace<TService>(descriptor: IServiceDescriptor<TService>): void {
    assertDescriptor(descriptor);
    this.Remove(descriptor.token);
    this.register(descriptor);
  }

  public Remove(token: symbol): boolean {
    assertToken(token, 'Remove');
    const before = this.descriptors.length;
    const filtered = this.descriptors.filter((descriptor) => descriptor.token !== token);
    if (filtered.length === before) {
      return false;
    }

    this.descriptors.length = 0;
    this.descriptors.push(...filtered);
    return true;
  }

  public Clear(): void {
    this.descriptors.length = 0;
  }

  public Contains(token: symbol): boolean {
    assertToken(token, 'Contains');
    return this.descriptors.some((descriptor) => descriptor.token === token);
  }

  public Enumerate(): readonly IServiceDescriptor<unknown>[] {
    return [...this.descriptors];
  }

  public Validate(): ServiceCollectionValidationReport {
    const duplicates = this.findDuplicates();
    return {
      valid: duplicates.length === 0,
      duplicates,
    };
  }

  public addSingleton<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  public addSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  public addSingleton<TService>(token: InjectionToken<TService>, instance: TService): void;
  public addSingleton<TService>(token: InjectionToken<TService>): void;
  public addSingleton<TService>(
    token: InjectionToken<TService>,
    implementation?: ServiceFactory<TService> | ServiceType<TService> | TService,
  ): void {
    this.AddSingleton(
      token,
      implementation as ServiceFactory<TService> | ServiceType<TService> | TService,
    );
  }

  public addScoped<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  public addScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  public addScoped<TService>(token: InjectionToken<TService>): void;
  public addScoped<TService>(
    token: InjectionToken<TService>,
    implementation?: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.register(this.createDescriptor(token, ServiceLifetime.Scoped, implementation));
  }

  public addTransient<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    implementation: ServiceType<TImplementation>,
  ): void;
  public addTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService>,
  ): void;
  public addTransient<TService>(token: InjectionToken<TService>): void;
  public addTransient<TService>(
    token: InjectionToken<TService>,
    implementation?: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.register(this.createDescriptor(token, ServiceLifetime.Transient, implementation));
  }

  public addInstance<TService>(token: InjectionToken<TService>, instance: TService): void {
    this.AddInstance(token, instance);
  }

  public tryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean {
    return this.TryAdd(descriptor);
  }

  public replace<TService>(descriptor: IServiceDescriptor<TService>): void {
    this.Replace(descriptor);
  }

  public remove(token: symbol): boolean {
    return this.Remove(token);
  }

  public clear(): void {
    this.Clear();
  }

  public contains(token: symbol): boolean {
    return this.Contains(token);
  }

  public enumerate(): readonly IServiceDescriptor<unknown>[] {
    return this.Enumerate();
  }

  public validate(): ServiceCollectionValidationReport {
    return this.Validate();
  }

  private createDescriptor<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementation?: ServiceFactory<TService> | ServiceType<TService> | TService,
  ): IServiceDescriptor<TService> {
    assertToken(token, 'register');

    if (typeof implementation === 'undefined') {
      return ServiceDescriptor.self(token, lifetime);
    }

    if (isServiceType(implementation)) {
      return ServiceDescriptor.fromType(token, lifetime, implementation);
    }

    if (typeof implementation === 'function') {
      return ServiceDescriptor.fromFactory(
        token,
        lifetime,
        implementation as ServiceFactory<TService>,
      );
    }

    if (lifetime !== ServiceLifetime.Singleton) {
      throw new DependencyRegistrationError(
        `Only singleton services can be registered with direct instances for ${describeToken(token)}.`,
      );
    }

    return ServiceDescriptor.fromInstance(token, implementation);
  }

  private ensureLifetime<TService>(
    descriptor: IServiceDescriptor<TService>,
    expected: ServiceLifetime,
    methodName: string,
  ): void {
    if (descriptor.lifetime !== expected) {
      throw new DependencyRegistrationError(
        `${methodName} expects descriptor lifetime '${expected}' but received '${descriptor.lifetime}'.`,
      );
    }
  }

  private throwIfEquivalentDescriptorExists<TService>(
    descriptor: IServiceDescriptor<TService>,
  ): void {
    const exists = this.descriptors.some((existing) => descriptorsEquivalent(existing, descriptor));
    if (exists) {
      throw new DependencyRegistrationError(
        `Equivalent registration already exists for ${describeToken(descriptor.token)} ` +
          `with lifetime '${descriptor.lifetime}'.`,
      );
    }
  }

  private findDuplicates(): readonly DuplicateRegistration[] {
    const counts = new Map<symbol, number>();

    for (const descriptor of this.descriptors) {
      counts.set(descriptor.token, (counts.get(descriptor.token) ?? 0) + 1);
    }

    const duplicates: DuplicateRegistration[] = [];
    for (const [token, count] of counts.entries()) {
      if (count > 1) {
        duplicates.push({ token, count });
      }
    }

    return duplicates;
  }
}

/**
 * Creates a typed injection token from a string key.
 */
export function createInjectionToken<TService>(key: string): InjectionToken<TService> {
  if (key.trim().length === 0) {
    throw new DependencyRegistrationError('Injection token key must not be empty.');
  }

  return Symbol(key) as InjectionToken<TService>;
}

function isDescriptor<TService>(value: unknown): value is IServiceDescriptor<TService> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'token' in value &&
    'lifetime' in value &&
    'registration' in value &&
    typeof (value as { token?: unknown }).token === 'symbol'
  );
}

function isServiceType<TService>(value: unknown): value is ServiceType<TService> {
  if (typeof value !== 'function') {
    return false;
  }

  const asString = Function.prototype.toString.call(value);
  return asString.startsWith('class ');
}

function descriptorsEquivalent(
  left: IServiceDescriptor<unknown>,
  right: IServiceDescriptor<unknown>,
): boolean {
  if (left.token !== right.token || left.lifetime !== right.lifetime) {
    return false;
  }

  const leftRegistration = left.registration;
  const rightRegistration = right.registration;
  if (leftRegistration.kind !== rightRegistration.kind) {
    return false;
  }

  if (leftRegistration.kind === 'self') {
    return true;
  }

  if (leftRegistration.kind === 'factory' && rightRegistration.kind === 'factory') {
    return leftRegistration.factory === rightRegistration.factory;
  }

  if (leftRegistration.kind === 'type' && rightRegistration.kind === 'type') {
    return leftRegistration.type === rightRegistration.type;
  }

  if (leftRegistration.kind === 'instance' && rightRegistration.kind === 'instance') {
    return leftRegistration.instance === rightRegistration.instance;
  }

  return false;
}

function assertDescriptor<TService>(descriptor: IServiceDescriptor<TService>): void {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new DependencyRegistrationError('Descriptor must be a non-null object.');
  }

  assertToken(descriptor.token, 'register');

  if (!Object.values(ServiceLifetime).includes(descriptor.lifetime)) {
    throw new DependencyRegistrationError(
      `Descriptor lifetime '${String(descriptor.lifetime)}' is invalid.`,
    );
  }

  if (!descriptor.registration || typeof descriptor.registration !== 'object') {
    throw new DependencyRegistrationError('Descriptor registration metadata is required.');
  }

  switch (descriptor.registration.kind) {
    case 'self':
      return;
    case 'factory':
      if (typeof descriptor.registration.factory !== 'function') {
        throw new DependencyRegistrationError('Factory registration requires a function value.');
      }
      return;
    case 'type':
      if (!isServiceType(descriptor.registration.type)) {
        throw new DependencyRegistrationError('Type registration requires a class constructor.');
      }
      return;
    case 'instance':
      if (typeof descriptor.registration.instance === 'undefined') {
        throw new DependencyRegistrationError('Instance registration requires a defined value.');
      }
      return;
    default:
      throw new DependencyRegistrationError('Unknown registration kind.');
  }
}

function assertToken(token: symbol, operation: string): void {
  if (typeof token !== 'symbol') {
    throw new DependencyRegistrationError(`${operation} requires a valid symbol token.`);
  }
}

function describeToken(token: symbol): string {
  return token.description ? `Symbol(${token.description})` : token.toString();
}
