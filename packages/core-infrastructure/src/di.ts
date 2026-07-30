/**
 * Nominal dependency injection token.
 */
export type InjectionToken<TService> = symbol & {
  readonly __service?: TService;
};

/**
 * Service lifetime constants supported by the container.
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
 * Constructor type used for constructor-injected services.
 */
export interface ServiceType<TService> {
  new (...args: readonly unknown[]): TService;
  readonly inject?: readonly InjectionToken<unknown>[];
}

/**
 * Factory for creating a service instance.
 */
export type ServiceFactory<TService> = (provider: IServiceProvider) => TService;

/**
 * Supported service implementation source.
 */
export type ServiceImplementation<TService> =
  ServiceFactory<TService> | ServiceType<TService> | TService;

/**
 * Service descriptor contract.
 */
export interface IServiceDescriptor<TService> {
  readonly token: InjectionToken<TService>;
  readonly lifetime: ServiceLifetime;
  readonly implementationFactory: ServiceFactory<TService>;
}

/**
 * Internal descriptor model with full implementation metadata.
 */
interface DescriptorEntry<TService> extends IServiceDescriptor<TService> {
  readonly implementationType?: ServiceType<TService>;
  readonly implementationInstance?: TService;
  readonly order: number;
}

/**
 * Diagnostic issue raised during registration validation.
 */
export interface ValidationIssue {
  readonly code:
    | 'di.duplicate_registration'
    | 'di.missing_dependency'
    | 'di.circular_dependency'
    | 'di.constructor_injection_missing'
    | 'di.constructor_parameter_mismatch';
  readonly message: string;
  readonly token: symbol;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Validation report for container registrations.
 */
export interface ValidationReport {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/**
 * Options for building a provider.
 */
export interface BuildServiceProviderOptions {
  readonly validateOnBuild?: boolean;
  readonly throwOnDuplicateRegistrations?: boolean;
}

/**
 * Scope factory contract.
 */
export interface IServiceScopeFactory {
  createScope(): IServiceScope;
}

/**
 * Resolver contract for service lookup.
 */
export interface IServiceResolver {
  resolve<TService>(token: InjectionToken<TService>): TService;
  tryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
}

/**
 * Mutable service registration contract.
 */
export interface IServiceCollection {
  register<TService>(descriptor: IServiceDescriptor<TService>): void;
  AddSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void;
  AddScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void;
  AddTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void;
  AddInstance<TService>(token: InjectionToken<TService>, instance: TService): void;
  TryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean;
  Replace<TService>(descriptor: IServiceDescriptor<TService>): void;
  Remove(token: symbol): boolean;
  Clear(): void;
  addSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void;
  addScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void;
  addTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void;
  addInstance<TService>(token: InjectionToken<TService>, instance: TService): void;
  tryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean;
  replace<TService>(descriptor: IServiceDescriptor<TService>): void;
  remove(token: symbol): boolean;
  clear(): void;
  buildServiceProvider(options?: BuildServiceProviderOptions): IServiceProvider;
  getDuplicateRegistrations(): readonly symbol[];
  validate(options?: { readonly throwOnDuplicateRegistrations?: boolean }): ValidationReport;
  registerSingleton<TService>(
    token: InjectionToken<TService>,
    factory: ServiceFactory<TService>,
  ): void;
  registerScoped<TService>(
    token: InjectionToken<TService>,
    factory: ServiceFactory<TService>,
  ): void;
  registerTransient<TService>(
    token: InjectionToken<TService>,
    factory: ServiceFactory<TService>,
  ): void;
}

/**
 * Scope contract for scoped service lifetimes.
 */
export interface IServiceScope extends IServiceResolver {
  readonly provider: IServiceProvider;
  dispose(): Promise<void>;
}

/**
 * Provider contract that resolves services and creates scopes.
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
 * Descriptor implementation used by ServiceCollection.
 */
export class ServiceDescriptor<TService> implements IServiceDescriptor<TService> {
  public readonly token: InjectionToken<TService>;
  public readonly lifetime: ServiceLifetime;
  public readonly implementationFactory: ServiceFactory<TService>;

  private constructor(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementationFactory: ServiceFactory<TService>,
  ) {
    this.token = token;
    this.lifetime = lifetime;
    this.implementationFactory = implementationFactory;
  }

  /**
   * Creates a descriptor from a factory.
   */
  public static fromFactory<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementationFactory: ServiceFactory<TService>,
  ): ServiceDescriptor<TService> {
    return new ServiceDescriptor(token, lifetime, implementationFactory);
  }

  /**
   * Creates a descriptor from a constructor type with constructor injection.
   */
  public static fromType<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementationType: ServiceType<TService>,
  ): ServiceDescriptor<TService> {
    return new ServiceDescriptor(token, lifetime, (provider) =>
      instantiateFromType(implementationType, provider),
    );
  }

  /**
   * Creates a singleton descriptor from a pre-built instance.
   */
  public static fromInstance<TService>(
    token: InjectionToken<TService>,
    instance: TService,
  ): ServiceDescriptor<TService> {
    return new ServiceDescriptor(token, ServiceLifetime.Singleton, () => instance);
  }
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
 * Exception raised when resolution fails.
 */
export class DependencyResolutionError extends DependencyInjectionError {
  public constructor(message: string) {
    super('di.resolution_failed', message);
    this.name = 'DependencyResolutionError';
  }
}

/**
 * Exception raised when registration data is invalid.
 */
export class DependencyRegistrationError extends DependencyInjectionError {
  public constructor(message: string) {
    super('di.registration_invalid', message);
    this.name = 'DependencyRegistrationError';
  }
}

/**
 * In-memory service collection used during startup registration.
 */
export class ServiceCollection implements IServiceCollection {
  private readonly descriptors = new Map<symbol, DescriptorEntry<unknown>[]>();
  private orderCounter = 0;

  public register<TService>(descriptor: IServiceDescriptor<TService>): void {
    const entry: DescriptorEntry<TService> = {
      ...descriptor,
      order: this.nextOrder(),
    };
    this.addEntry(entry);
  }

  public addSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.add(token, ServiceLifetime.Singleton, implementation);
  }

  public addScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.add(token, ServiceLifetime.Scoped, implementation);
  }

  public addTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.add(token, ServiceLifetime.Transient, implementation);
  }

  public addInstance<TService>(token: InjectionToken<TService>, instance: TService): void {
    const descriptor = this.createDescriptor(token, ServiceLifetime.Singleton, instance);
    this.addEntry(descriptor);
  }

  public tryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean {
    if (this.descriptors.has(descriptor.token)) {
      return false;
    }

    this.register(descriptor);
    return true;
  }

  public replace<TService>(descriptor: IServiceDescriptor<TService>): void {
    this.descriptors.set(descriptor.token, []);
    this.register(descriptor);
  }

  public remove(token: symbol): boolean {
    return this.descriptors.delete(token);
  }

  public clear(): void {
    this.descriptors.clear();
  }

  public AddSingleton<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.addSingleton(token, implementation);
  }

  public AddScoped<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.addScoped(token, implementation);
  }

  public AddTransient<TService>(
    token: InjectionToken<TService>,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.addTransient(token, implementation);
  }

  public AddInstance<TService>(token: InjectionToken<TService>, instance: TService): void {
    this.addInstance(token, instance);
  }

  public TryAdd<TService>(descriptor: IServiceDescriptor<TService>): boolean {
    return this.tryAdd(descriptor);
  }

  public Replace<TService>(descriptor: IServiceDescriptor<TService>): void {
    this.replace(descriptor);
  }

  public Remove(token: symbol): boolean {
    return this.remove(token);
  }

  public Clear(): void {
    this.clear();
  }

  public getDuplicateRegistrations(): readonly symbol[] {
    const duplicates: symbol[] = [];
    for (const [token, entries] of this.descriptors.entries()) {
      if (entries.length > 1) {
        duplicates.push(token);
      }
    }

    return duplicates;
  }

  public buildServiceProvider(options: BuildServiceProviderOptions = {}): IServiceProvider {
    const validateOnBuild = options.validateOnBuild ?? true;
    if (validateOnBuild) {
      const report = this.validate({
        throwOnDuplicateRegistrations: options.throwOnDuplicateRegistrations ?? false,
      });
      if (!report.valid) {
        throw new DependencyRegistrationError(
          report.issues.map((issue) => issue.message).join('\n'),
        );
      }
    }

    return new ServiceProvider(this.cloneDescriptors());
  }

  public validate(
    options: { readonly throwOnDuplicateRegistrations?: boolean } = {},
  ): ValidationReport {
    const issues: ValidationIssue[] = [];
    const tokenEntries = this.cloneDescriptors();
    const throwOnDuplicate = options.throwOnDuplicateRegistrations ?? false;

    for (const [token, entries] of tokenEntries.entries()) {
      if (entries.length > 1 && throwOnDuplicate) {
        issues.push({
          code: 'di.duplicate_registration',
          token,
          message: `Duplicate registrations detected for ${describeToken(token)}.`,
          details: { count: entries.length },
        });
      }

      for (const entry of entries) {
        if (!entry.implementationType) {
          continue;
        }

        const inject = entry.implementationType.inject;
        const ctorLength = entry.implementationType.length;

        if (ctorLength > 0 && (!inject || inject.length === 0)) {
          issues.push({
            code: 'di.constructor_injection_missing',
            token,
            message:
              `Type registration for ${describeToken(token)} requires dependencies, ` +
              `but no static inject tokens were provided.`,
          });
        }

        if (inject && inject.length < ctorLength) {
          issues.push({
            code: 'di.constructor_parameter_mismatch',
            token,
            message:
              `Type registration for ${describeToken(token)} defines ${inject.length} ` +
              `inject tokens but constructor expects ${ctorLength} parameter(s).`,
          });
        }

        for (const dependencyToken of inject ?? []) {
          if (!tokenEntries.has(dependencyToken)) {
            issues.push({
              code: 'di.missing_dependency',
              token,
              message:
                `Type registration for ${describeToken(token)} depends on ` +
                `${describeToken(dependencyToken)}, but no registration exists.`,
              details: {
                dependency: describeToken(dependencyToken),
              },
            });
          }
        }
      }
    }

    const cycles = detectCircularDependencies(tokenEntries);
    for (const cycle of cycles) {
      const token = cycle[0] ?? Symbol('unknown-cycle-token');
      issues.push({
        code: 'di.circular_dependency',
        token,
        message: `Circular dependency detected: ${cycle.map(describeToken).join(' -> ')}.`,
      });
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  public registerSingleton<TService>(
    token: InjectionToken<TService>,
    factory: ServiceFactory<TService>,
  ): void {
    this.addSingleton(token, factory);
  }

  public registerScoped<TService>(
    token: InjectionToken<TService>,
    factory: ServiceFactory<TService>,
  ): void {
    this.addScoped(token, factory);
  }

  public registerTransient<TService>(
    token: InjectionToken<TService>,
    factory: ServiceFactory<TService>,
  ): void {
    this.addTransient(token, factory);
  }

  private add<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementation: ServiceFactory<TService> | ServiceType<TService>,
  ): void {
    this.addEntry(this.createDescriptor(token, lifetime, implementation));
  }

  private createDescriptor<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementation: ServiceImplementation<TService>,
  ): DescriptorEntry<TService> {
    const order = this.nextOrder();

    if (isServiceType(implementation)) {
      return {
        token,
        lifetime,
        implementationType: implementation,
        implementationFactory: (provider) => instantiateFromType(implementation, provider),
        order,
      };
    }

    if (typeof implementation === 'function') {
      const implementationFactory = implementation as ServiceFactory<TService>;
      return {
        token,
        lifetime,
        implementationFactory,
        order,
      };
    }

    return {
      token,
      lifetime: ServiceLifetime.Singleton,
      implementationFactory: () => implementation,
      implementationInstance: implementation,
      order,
    };
  }

  private addEntry<TService>(entry: DescriptorEntry<TService>): void {
    const current = this.descriptors.get(entry.token) ?? [];
    this.descriptors.set(entry.token, [...current, entry as DescriptorEntry<unknown>]);
  }

  private cloneDescriptors(): ReadonlyMap<symbol, readonly DescriptorEntry<unknown>[]> {
    const clone = new Map<symbol, readonly DescriptorEntry<unknown>[]>();
    for (const [token, entries] of this.descriptors.entries()) {
      clone.set(token, [...entries]);
    }

    return clone;
  }

  private nextOrder(): number {
    this.orderCounter += 1;
    return this.orderCounter;
  }
}

class ServiceScopeImpl implements IServiceScope {
  public readonly provider: IServiceProvider;
  private readonly scopedInstances = new Map<DescriptorEntry<unknown>, unknown>();
  private readonly disposalOrder: unknown[] = [];
  private disposed = false;

  public constructor(private readonly rootProvider: ServiceProvider) {
    this.provider = rootProvider.createScopedProvider(this);
  }

  public resolve<TService>(token: InjectionToken<TService>): TService {
    return this.provider.resolve(token);
  }

  public tryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    return this.provider.tryResolve(token);
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    await disposeInReverseOrder(this.disposalOrder);
    this.scopedInstances.clear();
    this.rootProvider.detachScope(this);
  }

  public getOrCreateScopedInstance<TService>(
    descriptor: DescriptorEntry<TService>,
    creator: () => TService,
  ): TService {
    if (this.scopedInstances.has(descriptor)) {
      return this.scopedInstances.get(descriptor) as TService;
    }

    const created = creator();
    this.scopedInstances.set(descriptor, created);
    this.disposalOrder.push(created);
    return created;
  }
}

class ScopedProvider implements IServiceProvider {
  public constructor(
    private readonly rootProvider: ServiceProvider,
    private readonly scope: ServiceScopeImpl,
  ) {}

  public resolve<TService>(token: InjectionToken<TService>): TService {
    const resolved = this.rootProvider.resolveFromScope(token, this.scope, false);
    if (typeof resolved === 'undefined') {
      throw new DependencyResolutionError(
        `No service registration found for ${describeToken(token)}.`,
      );
    }

    return resolved;
  }

  public tryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    return this.rootProvider.resolveFromScope(token, this.scope, true);
  }

  public resolveRequired<TService>(token: InjectionToken<TService>): TService {
    const resolved = this.rootProvider.resolveFromScope(token, this.scope, false);
    if (typeof resolved === 'undefined') {
      throw new DependencyResolutionError(
        `No service registration found for ${describeToken(token)}.`,
      );
    }

    return resolved;
  }

  public resolveAll<TService>(token: InjectionToken<TService>): readonly TService[] {
    return this.rootProvider.resolveAllFromScope(token, this.scope);
  }

  public createScope(): IServiceScope {
    return this.rootProvider.createScope();
  }

  public dispose(): Promise<void> {
    return this.rootProvider.dispose();
  }

  public Resolve<TService>(token: InjectionToken<TService>): TService {
    return this.resolve(token);
  }

  public ResolveRequired<TService>(token: InjectionToken<TService>): TService {
    return this.resolveRequired(token);
  }

  public ResolveAll<TService>(token: InjectionToken<TService>): readonly TService[] {
    return this.resolveAll(token);
  }
}

/**
 * Service provider implementation with scoped and singleton lifetimes.
 */
export class ServiceProvider implements IServiceProvider {
  private readonly singletonInstances = new Map<DescriptorEntry<unknown>, unknown>();
  private readonly singletonDisposalOrder: unknown[] = [];
  private readonly activeScopes = new Set<ServiceScopeImpl>();
  private readonly rootScope: ServiceScopeImpl;
  private disposed = false;

  public constructor(
    private readonly descriptors: ReadonlyMap<symbol, readonly DescriptorEntry<unknown>[]>,
  ) {
    this.rootScope = new ServiceScopeImpl(this);
  }

  public resolve<TService>(token: InjectionToken<TService>): TService {
    const resolved = this.resolveFromScope(token, this.rootScope, false);
    if (typeof resolved === 'undefined') {
      throw new DependencyResolutionError(
        `No service registration found for ${describeToken(token)}.`,
      );
    }

    return resolved;
  }

  public tryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    return this.resolveFromScope(token, this.rootScope, true);
  }

  public resolveRequired<TService>(token: InjectionToken<TService>): TService {
    return this.resolve(token);
  }

  public resolveAll<TService>(token: InjectionToken<TService>): readonly TService[] {
    return this.resolveAllFromScope(token, this.rootScope);
  }

  public createScope(): IServiceScope {
    this.assertNotDisposed();
    const scope = new ServiceScopeImpl(this);
    this.activeScopes.add(scope);
    return scope;
  }

  public async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const scope of [...this.activeScopes]) {
      await scope.dispose();
    }

    await this.rootScope.dispose();
    await disposeInReverseOrder(this.singletonDisposalOrder);
    this.singletonInstances.clear();
  }

  public createScopedProvider(scope: ServiceScopeImpl): IServiceProvider {
    return new ScopedProvider(this, scope);
  }

  public detachScope(scope: ServiceScopeImpl): void {
    this.activeScopes.delete(scope);
  }

  public resolveFromScope<TService>(
    token: InjectionToken<TService>,
    scope: ServiceScopeImpl,
    optional: boolean,
  ): TService | undefined {
    this.assertNotDisposed();

    const stack: symbol[] = [];
    const value = this.resolveCore(token, scope, optional, stack);
    return value;
  }

  public resolveAllFromScope<TService>(
    token: InjectionToken<TService>,
    scope: ServiceScopeImpl,
  ): readonly TService[] {
    this.assertNotDisposed();

    const entries = this.descriptors.get(token) ?? [];
    return entries.map((entry) => this.activate(entry as DescriptorEntry<TService>, scope, []));
  }

  private resolveCore<TService>(
    token: InjectionToken<TService>,
    scope: ServiceScopeImpl,
    optional: boolean,
    stack: symbol[],
  ): TService | undefined {
    const entries = this.descriptors.get(token);
    if (!entries || entries.length === 0) {
      if (optional) {
        return undefined;
      }

      throw new DependencyResolutionError(
        `No service registration found for ${describeToken(token)}.`,
      );
    }

    const descriptor = entries[entries.length - 1] as DescriptorEntry<TService>;
    return this.activate(descriptor, scope, stack);
  }

  private activate<TService>(
    descriptor: DescriptorEntry<TService>,
    scope: ServiceScopeImpl,
    stack: symbol[],
  ): TService {
    if (stack.includes(descriptor.token)) {
      const path = [...stack, descriptor.token].map(describeToken).join(' -> ');
      throw new DependencyResolutionError(
        `Circular dependency detected during resolution: ${path}.`,
      );
    }

    const nextStack = [...stack, descriptor.token];

    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      if (this.singletonInstances.has(descriptor)) {
        return this.singletonInstances.get(descriptor) as TService;
      }

      const created = this.createInstance(descriptor, scope, nextStack);
      this.singletonInstances.set(descriptor, created);
      this.singletonDisposalOrder.push(created);
      return created;
    }

    if (descriptor.lifetime === ServiceLifetime.Scoped) {
      return scope.getOrCreateScopedInstance(descriptor, () =>
        this.createInstance(descriptor, scope, nextStack),
      );
    }

    return this.createInstance(descriptor, scope, nextStack);
  }

  private createInstance<TService>(
    descriptor: DescriptorEntry<TService>,
    scope: ServiceScopeImpl,
    stack: symbol[],
  ): TService {
    if (descriptor.implementationInstance) {
      return descriptor.implementationInstance;
    }

    if (!descriptor.implementationType) {
      return descriptor.implementationFactory(scope.provider);
    }

    return instantiateFromType(descriptor.implementationType, {
      resolve: <TDependency>(token: InjectionToken<TDependency>): TDependency => {
        const dependency = this.resolveCore(token, scope, false, stack);
        if (typeof dependency === 'undefined') {
          throw new DependencyResolutionError(
            `Required dependency ${describeToken(token)} for ` +
              `${describeToken(descriptor.token)} was not found.`,
          );
        }

        return dependency;
      },
      tryResolve: <TDependency>(token: InjectionToken<TDependency>): TDependency | undefined =>
        this.resolveCore(token, scope, true, stack),
      resolveRequired: <TDependency>(token: InjectionToken<TDependency>): TDependency => {
        const dependency = this.resolveCore(token, scope, false, stack);
        if (typeof dependency === 'undefined') {
          throw new DependencyResolutionError(
            `Required dependency ${describeToken(token)} for ` +
              `${describeToken(descriptor.token)} was not found.`,
          );
        }
        return dependency;
      },
      resolveAll: <TDependency>(token: InjectionToken<TDependency>): readonly TDependency[] =>
        this.resolveAllFromScope(token, scope),
      createScope: (): IServiceScope => this.createScope(),
      dispose: async (): Promise<void> => this.dispose(),
      Resolve: <TDependency>(token: InjectionToken<TDependency>): TDependency => {
        const dependency = this.resolveCore(token, scope, false, stack);
        if (typeof dependency === 'undefined') {
          throw new DependencyResolutionError(
            `Required dependency ${describeToken(token)} for ` +
              `${describeToken(descriptor.token)} was not found.`,
          );
        }
        return dependency;
      },
      ResolveRequired: <TDependency>(token: InjectionToken<TDependency>): TDependency => {
        const dependency = this.resolveCore(token, scope, false, stack);
        if (typeof dependency === 'undefined') {
          throw new DependencyResolutionError(
            `Required dependency ${describeToken(token)} for ` +
              `${describeToken(descriptor.token)} was not found.`,
          );
        }
        return dependency;
      },
      ResolveAll: <TDependency>(token: InjectionToken<TDependency>): readonly TDependency[] =>
        this.resolveAllFromScope(token, scope),
    });
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new DependencyResolutionError('Service provider has been disposed.');
    }
  }

  public Resolve<TService>(token: InjectionToken<TService>): TService {
    return this.resolve(token);
  }

  public ResolveRequired<TService>(token: InjectionToken<TService>): TService {
    return this.resolveRequired(token);
  }

  public ResolveAll<TService>(token: InjectionToken<TService>): readonly TService[] {
    return this.resolveAll(token);
  }
}

/**
 * Creates a typed injection token from a string key.
 */
export function createInjectionToken<TService>(key: string): InjectionToken<TService> {
  return Symbol(key) as InjectionToken<TService>;
}

function detectCircularDependencies(
  descriptorMap: ReadonlyMap<symbol, readonly DescriptorEntry<unknown>[]>,
): readonly symbol[][] {
  const cycles: symbol[][] = [];
  const visiting = new Set<symbol>();
  const visited = new Set<symbol>();

  const visit = (token: symbol, path: symbol[]): void => {
    if (visiting.has(token)) {
      const startIndex = path.indexOf(token);
      if (startIndex >= 0) {
        cycles.push([...path.slice(startIndex), token]);
      }
      return;
    }

    if (visited.has(token)) {
      return;
    }

    visiting.add(token);
    const descriptors = descriptorMap.get(token) ?? [];
    for (const descriptor of descriptors) {
      if (!descriptor.implementationType?.inject) {
        continue;
      }

      for (const dependency of descriptor.implementationType.inject) {
        visit(dependency, [...path, token]);
      }
    }

    visiting.delete(token);
    visited.add(token);
  };

  for (const token of descriptorMap.keys()) {
    visit(token, []);
  }

  return cycles;
}

function instantiateFromType<TService>(
  implementationType: ServiceType<TService>,
  provider: IServiceProvider,
): TService {
  const injectTokens = implementationType.inject ?? [];
  if (implementationType.length > 0 && injectTokens.length === 0) {
    throw new DependencyResolutionError(
      `Cannot construct ${implementationType.name || 'anonymous type'} without static inject tokens.`,
    );
  }

  if (injectTokens.length < implementationType.length) {
    throw new DependencyResolutionError(
      `Inject token count (${injectTokens.length}) is smaller than constructor parameter count ` +
        `(${implementationType.length}) for ${implementationType.name || 'anonymous type'}.`,
    );
  }

  const dependencies = injectTokens.map((token) => provider.resolveRequired(token));
  return new implementationType(...dependencies);
}

function isServiceType<TService>(
  implementation: ServiceImplementation<TService>,
): implementation is ServiceType<TService> {
  if (typeof implementation !== 'function') {
    return false;
  }

  const withInject = implementation as ServiceType<TService>;
  if (Array.isArray(withInject.inject)) {
    return true;
  }

  const source = Function.prototype.toString.call(implementation);
  return source.startsWith('class ');
}

function describeToken(token: symbol): string {
  return token.description ? `Symbol(${token.description})` : token.toString();
}

async function disposeInReverseOrder(values: readonly unknown[]): Promise<void> {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    await disposeOne(values[index]);
  }
}

async function disposeOne(value: unknown): Promise<void> {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return;
  }

  const maybeSyncDispose = value as {
    dispose?: () => void | Promise<void>;
    asyncDispose?: () => Promise<void>;
    [key: symbol]: unknown;
  };

  if (typeof maybeSyncDispose.asyncDispose === 'function') {
    await maybeSyncDispose.asyncDispose();
    return;
  }

  if (typeof maybeSyncDispose.dispose === 'function') {
    await maybeSyncDispose.dispose();
    return;
  }

  const symbolWithAsyncDispose = (Symbol as unknown as { asyncDispose?: symbol }).asyncDispose;
  if (symbolWithAsyncDispose) {
    const asyncDisposeMember = maybeSyncDispose[symbolWithAsyncDispose];
    if (typeof asyncDisposeMember === 'function') {
      const asyncDisposable = asyncDisposeMember as () => Promise<void>;
      await asyncDisposable.call(value);
      return;
    }
  }

  const symbolWithDispose = (Symbol as unknown as { dispose?: symbol }).dispose;
  if (symbolWithDispose) {
    const disposeMember = maybeSyncDispose[symbolWithDispose];
    if (typeof disposeMember === 'function') {
      const disposable = disposeMember as () => void | Promise<void>;
      await disposable.call(value);
    }
  }
}
