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
  readonly __injectionTokens?: readonly unknown[];
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
  TryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
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
 * Synchronous disposal contract for services managed by the DI lifecycle.
 */
export interface IDisposable {
  dispose(): void;
}

/**
 * Asynchronous disposal contract for services managed by the DI lifecycle.
 */
export interface IAsyncDisposable {
  disposeAsync(): Promise<void>;
}

/**
 * Lifecycle context for a disposable service instance.
 */
export class DisposalContext {
  public constructor(
    public readonly lifetime: ServiceLifetime,
    public readonly owner: 'provider' | 'scope',
    public readonly token?: symbol,
    public readonly scopeId?: string,
  ) {}
}

/**
 * Tracks disposable services for deterministic disposal.
 */
export class DisposableTracker {
  private readonly entries: Array<{
    readonly context: DisposalContext;
    readonly service: unknown;
  }> = [];
  private readonly tracked = new Set<unknown>();

  public track(service: unknown, context: DisposalContext): void {
    if (!this.canDispose(service)) {
      return;
    }

    if (typeof service !== 'object' || service === null || this.tracked.has(service)) {
      return;
    }

    this.entries.push({ context, service });
    this.tracked.add(service);
  }

  public async disposeAll(): Promise<void> {
    const disposer = new ServiceDisposer();
    const failures: unknown[] = [];

    for (let index = this.entries.length - 1; index >= 0; index -= 1) {
      const entry = this.entries[index];
      if (!entry) {
        continue;
      }

      try {
        await disposer.dispose(entry.service);
      } catch (error) {
        failures.push(error);
      }
    }

    if (failures.length > 0) {
      throw new DependencyInjectionError(
        'di.disposal_failed',
        `One or more services failed to dispose during lifecycle teardown.`,
      );
    }
  }

  private canDispose(service: unknown): boolean {
    if (!service || typeof service !== 'object') {
      return false;
    }

    return (
      typeof (service as Partial<IDisposable>).dispose === 'function' ||
      typeof (service as Partial<IAsyncDisposable>).disposeAsync === 'function'
    );
  }
}

/**
 * Disposes a service instance using the appropriate sync or async contract.
 */
export class ServiceDisposer {
  public async dispose(service: unknown): Promise<void> {
    if (!service || typeof service !== 'object') {
      return;
    }

    const asyncDisposable = service as Partial<IAsyncDisposable>;
    if (typeof asyncDisposable.disposeAsync === 'function') {
      await asyncDisposable.disposeAsync();
      return;
    }

    const disposable = service as Partial<IDisposable>;
    if (typeof disposable.dispose === 'function') {
      disposable.dispose();
    }
  }
}

/**
 * A disposable collection used by lifecycle managers.
 */
export class DisposableCollection {
  private readonly tracker = new DisposableTracker();

  public track(service: unknown, context: DisposalContext): void {
    this.tracker.track(service, context);
  }

  public async disposeAll(): Promise<void> {
    await this.tracker.disposeAll();
  }
}

/**
 * Coordinates disposal for a provider or scope owner.
 */
export class LifecycleManager {
  private readonly collection = new DisposableCollection();
  private disposalPromise: Promise<void> | undefined;
  private disposed = false;
  private disposing = false;

  public track(service: unknown, context: DisposalContext): void {
    if (this.disposed || this.disposing) {
      return;
    }

    this.collection.track(service, context);
  }

  public async disposeAsync(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }

    if (this.disposed) {
      return;
    }

    this.disposing = true;
    this.disposalPromise = (async () => {
      try {
        await this.collection.disposeAll();
      } finally {
        this.disposed = true;
        this.disposing = false;
      }
    })();

    return this.disposalPromise;
  }

  public isDisposed(): boolean {
    return this.disposed;
  }

  public isDisposing(): boolean {
    return this.disposing;
  }
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
 * Exception raised when a service cannot be resolved.
 */
export class ResolutionException extends DependencyInjectionError {
  public readonly token?: symbol;

  public constructor(message: string, token?: symbol, cause?: unknown) {
    super('di.resolution_failed', message);
    this.name = 'ResolutionException';
    this.token = token;
    if (cause) {
      this.cause = cause;
    }
  }

  public readonly cause?: unknown;
}

/**
 * Resolution context passed to service factories and resolution helpers.
 */
export class ResolutionContext {
  public constructor(
    public readonly provider: IServiceProvider,
    public readonly token: symbol,
    public readonly descriptor: IServiceDescriptor<unknown>,
  ) {}
}

/**
 * Scope context passed to scoped resolution flows.
 */
export class ScopeContext {
  public constructor(
    public readonly provider: IServiceProvider,
    public readonly scopeId: string,
    public readonly parent?: ScopeContext,
    public readonly lifecycleManager?: LifecycleManager,
  ) {}
}

/**
 * Constructor dependency metadata selection helper.
 */
export class ConstructorSelection {
  public constructor(
    public readonly implementation: new (...args: readonly unknown[]) => unknown,
    public readonly parameters: readonly ParameterResolver[],
  ) {}
}

/**
 * Parameter dependency resolver for constructor injection.
 */
export class ParameterResolver {
  public constructor(
    public readonly index: number,
    public readonly token: InjectionToken<unknown>,
  ) {}
}

/**
 * Dependency graph view used by constructor injection.
 */
export class DependencyGraph {
  public constructor(
    public readonly nodes: readonly {
      token: symbol;
      descriptor: IServiceDescriptor<unknown>;
    }[],
  ) {}
}

/**
 * Resolves constructor dependencies for registered implementation types.
 */
export class ConstructorResolver {
  public resolve<TService>(
    implementationType: ServiceType<TService>,
    provider: IServiceProvider,
    token: symbol,
  ): TService {
    const selection = this.selectConstructor(implementationType, token);
    const values = selection.parameters.map((parameter) => {
      const resolvedValue = provider.Resolve(parameter.token as InjectionToken<unknown>);
      return resolvedValue;
    });

    return new (selection.implementation as new (...args: readonly unknown[]) => TService)(
      ...values,
    );
  }

  public selectConstructor<TService>(
    implementationType: ServiceType<TService>,
    token: symbol,
  ): ConstructorSelection {
    const metadataTokens = implementationType.__injectionTokens;
    if (metadataTokens && metadataTokens.length > 0) {
      const constructorArity = implementationType.length;
      if (metadataTokens.length !== constructorArity) {
        throw new ResolutionException(
          `Constructor metadata for ${describeToken(token)} must declare ${constructorArity} dependency token(s).`,
          token,
        );
      }

      const parameters = metadataTokens.map((metadataToken, index) => {
        if (typeof metadataToken !== 'symbol') {
          throw new ResolutionException(
            `Constructor metadata for ${describeToken(token)} must contain symbol tokens.`,
            token,
          );
        }

        return new ParameterResolver(index, metadataToken as InjectionToken<unknown>);
      });

      return new ConstructorSelection(implementationType, parameters);
    }

    const constructor = implementationType.prototype?.constructor;
    if (typeof constructor !== 'function') {
      throw new ResolutionException(
        `Unable to determine constructor for ${describeToken(token)}.`,
        token,
      );
    }

    const parameterTokens: ParameterResolver[] = [];
    const parameterNames = constructor
      .toString()
      .slice(constructor.toString().indexOf('(') + 1, constructor.toString().indexOf(')'))
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean);

    for (let index = 0; index < constructor.length; index += 1) {
      const name = parameterNames[index] ?? `arg${index + 1}`;
      const tokenName = `${token.description ?? 'service'}:${name}`;
      parameterTokens.push(new ParameterResolver(index, createInjectionToken(tokenName)));
    }

    return new ConstructorSelection(constructor, parameterTokens);
  }

  public createDependencyGraph<TService>(
    implementationType: ServiceType<TService>,
    provider: IServiceProvider,
    token: symbol,
  ): DependencyGraph {
    const selection = this.selectConstructor(implementationType, token);
    const nodes = selection.parameters.map((parameter) => ({
      token: parameter.token,
      descriptor: this.resolveDescriptorForToken(parameter.token, provider),
    }));

    return new DependencyGraph(nodes);
  }

  private resolveDescriptorForToken(
    token: InjectionToken<unknown>,
    provider: IServiceProvider,
  ): IServiceDescriptor<unknown> {
    const descriptors = (provider as ServiceProvider).findDescriptors(token);
    if (descriptors.length === 0) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }

    const descriptor = descriptors[0];
    if (!descriptor) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }

    return descriptor;
  }
}

/**
 * Lightweight resolver facade that delegates to a provider.
 */
export class ServiceResolver implements IServiceResolver {
  public constructor(private readonly provider: IServiceProvider) {}

  public resolve<TService>(token: InjectionToken<TService>): TService {
    return this.provider.Resolve(token);
  }

  public tryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    return this.provider.TryResolve(token);
  }

  public TryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    return this.provider.TryResolve(token);
  }
}

/**
 * In-memory implementation of the DI provider.
 */
export class ServiceProvider implements IServiceProvider {
  private readonly singletonCache = new Map<IServiceDescriptor<unknown>, unknown>();
  private readonly scopeCache = new Map<string, ScopeContext>();
  private readonly scopeInstances = new Map<string, Map<IServiceDescriptor<unknown>, unknown>>();
  private readonly disposedScopes = new Set<string>();
  private readonly lifecycleManager = new LifecycleManager();
  private readonly scopeLifecycleManagers = new Map<string, LifecycleManager>();
  private readonly childScopes = new Set<ServiceScope>();
  private disposePromise: Promise<void> | undefined;
  private scopeCounter = 0;

  public constructor(private readonly collection: IServiceCollection) {
    if (!collection || typeof collection !== 'object') {
      throw new ResolutionException('Service provider requires a service collection instance.');
    }
  }

  public Resolve<TService>(token: InjectionToken<TService>): TService {
    assertResolutionToken(token, 'Resolve');
    this.assertNotDisposed(token, 'resolve');

    const descriptors = this.findDescriptors(token);
    if (descriptors.length === 0) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }

    if (descriptors.length > 1) {
      throw new ResolutionException(
        `Multiple service registrations found for ${describeToken(token)}. ResolveAll should be used for multi-registration tokens.`,
        token,
      );
    }

    return this.resolveDescriptor<TService>(descriptors[0] as IServiceDescriptor<TService>, token);
  }

  public ResolveRequired<TService>(token: InjectionToken<TService>): TService {
    return this.Resolve(token);
  }

  public ResolveAll<TService>(token: InjectionToken<TService>): readonly TService[] {
    assertResolutionToken(token, 'ResolveAll');
    this.assertNotDisposed(token, 'resolve');

    const descriptors = this.findDescriptors(token);
    if (descriptors.length === 0) {
      return [];
    }

    return descriptors.map((descriptor) =>
      this.resolveDescriptor<TService>(descriptor as IServiceDescriptor<TService>, token),
    );
  }

  public resolve<TService>(token: InjectionToken<TService>): TService {
    return this.Resolve(token);
  }

  public resolveRequired<TService>(token: InjectionToken<TService>): TService {
    return this.ResolveRequired(token);
  }

  public resolveAll<TService>(token: InjectionToken<TService>): readonly TService[] {
    return this.ResolveAll(token);
  }

  public TryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    try {
      return this.Resolve(token);
    } catch (error) {
      if (error instanceof ResolutionException) {
        return undefined;
      }

      throw error;
    }
  }

  public tryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    return this.TryResolve(token);
  }

  public createScope(): IServiceScope {
    this.assertNotDisposed(undefined, 'create a scope');

    const scopeId = this.createScopeId();
    const lifecycleManager = new LifecycleManager();
    const context = new ScopeContext(this, scopeId, undefined, lifecycleManager);
    this.scopeCache.set(scopeId, context);
    this.scopeInstances.set(scopeId, new Map());
    this.scopeLifecycleManagers.set(scopeId, lifecycleManager);
    const scope = new ServiceScope(this, context);
    this.childScopes.add(scope);
    return scope;
  }

  public async dispose(): Promise<void> {
    if (this.disposePromise) {
      return this.disposePromise;
    }

    this.disposePromise = (async () => {
      const childScopes = Array.from(this.childScopes).reverse();
      for (const scope of childScopes) {
        await scope.disposeCore();
      }

      await this.lifecycleManager.disposeAsync();
      this.singletonCache.clear();
      this.scopeInstances.clear();
      this.scopeCache.clear();
      this.disposedScopes.clear();
      this.childScopes.clear();
    })();

    return this.disposePromise;
  }

  private resolveDescriptor<TService>(
    descriptor: IServiceDescriptor<TService>,
    token: InjectionToken<TService>,
  ): TService {
    this.assertLifetime(descriptor, token);

    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      const cached = this.singletonCache.get(descriptor as IServiceDescriptor<unknown>);
      if (cached !== undefined) {
        return cached as TService;
      }
    }

    const context = new ResolutionContext(this, token, descriptor as IServiceDescriptor<unknown>);
    const instance = this.createInstance(descriptor, context);

    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      this.singletonCache.set(descriptor as IServiceDescriptor<unknown>, instance as unknown);
    }

    this.trackDisposable(instance, descriptor.lifetime, token);
    return instance;
  }

  public resolveInScope<TService>(
    descriptor: IServiceDescriptor<TService>,
    token: InjectionToken<TService>,
    scopeContext?: ScopeContext,
  ): TService {
    this.assertLifetime(descriptor, token);

    if (descriptor.lifetime === ServiceLifetime.Singleton) {
      return this.resolveDescriptor(descriptor, token);
    }

    if (descriptor.lifetime === ServiceLifetime.Transient) {
      const context = new ResolutionContext(this, token, descriptor as IServiceDescriptor<unknown>);
      return this.createInstance(descriptor, context);
    }

    if (!scopeContext) {
      throw new ResolutionException(
        `Scoped services require a valid scope context for ${describeToken(token)}.`,
        token,
      );
    }

    if (this.lifecycleManager.isDisposed() || this.disposedScopes.has(scopeContext.scopeId)) {
      throw new ResolutionException(
        `Cannot resolve scoped service from disposed scope ${scopeContext.scopeId}.`,
        scopeContext.scopeId as unknown as symbol,
      );
    }

    const scopeMap = this.scopeInstances.get(scopeContext.scopeId);
    if (!scopeMap) {
      throw new ResolutionException(
        `Scope ${scopeContext.scopeId} has not been initialized.`,
        token,
      );
    }

    const cacheKey = descriptor as IServiceDescriptor<unknown>;
    const cached = scopeMap.get(cacheKey);
    if (cached !== undefined) {
      return cached as TService;
    }

    const context = new ResolutionContext(this, token, descriptor as IServiceDescriptor<unknown>);
    const instance = this.createInstance(descriptor, context);
    scopeMap.set(cacheKey, instance as unknown);
    this.trackDisposable(instance, descriptor.lifetime, token, scopeContext.scopeId);
    return instance;
  }

  public getScopeContext(scopeId: string): ScopeContext | undefined {
    return this.scopeCache.get(scopeId);
  }

  public disposeScope(scopeId: string): void {
    if (!this.scopeCache.has(scopeId)) {
      return;
    }

    this.disposedScopes.add(scopeId);
    this.scopeInstances.delete(scopeId);
    this.scopeCache.delete(scopeId);
    this.scopeLifecycleManagers.delete(scopeId);
  }

  public isScopeDisposed(scopeId: string): boolean {
    return this.disposedScopes.has(scopeId);
  }

  public createScopeId(): string {
    this.scopeCounter += 1;
    return `scope-${this.scopeCounter}`;
  }

  public unregisterScope(scope: ServiceScope): void {
    this.childScopes.delete(scope);
  }

  public isDisposed(): boolean {
    return this.lifecycleManager.isDisposed();
  }

  private trackDisposable<TService>(
    instance: TService,
    lifetime: ServiceLifetime,
    token: InjectionToken<TService>,
    scopeId?: string,
  ): void {
    if (this.lifecycleManager.isDisposed() || this.lifecycleManager.isDisposing()) {
      return;
    }

    const ownerManager = scopeId ? this.scopeLifecycleManagers.get(scopeId) : this.lifecycleManager;
    if (!ownerManager) {
      return;
    }

    const context = new DisposalContext(lifetime, scopeId ? 'scope' : 'provider', token, scopeId);
    ownerManager.track(instance, context);
  }

  private assertNotDisposed<TService>(
    token: InjectionToken<TService> | undefined,
    operation: string,
  ): void {
    if (this.lifecycleManager.isDisposed() || this.lifecycleManager.isDisposing()) {
      throw new ResolutionException(
        `Cannot ${operation} after the provider has been disposed.`,
        token,
      );
    }
  }

  private createInstance<TService>(
    descriptor: IServiceDescriptor<TService>,
    context: ResolutionContext,
  ): TService {
    const registration = descriptor.registration;

    switch (registration.kind) {
      case 'factory': {
        try {
          return registration.factory(this);
        } catch (error) {
          throw new ResolutionException(
            `Factory registration failed for ${describeToken(context.token)}.`,
            context.token,
            error,
          );
        }
      }
      case 'instance':
        return registration.instance as TService;
      case 'type': {
        const implementationType = registration.type as ServiceType<TService>;
        return this.resolveConstructor<TService>(implementationType, context.token);
      }
      case 'self':
        throw new ResolutionException(
          `Self registration for ${describeToken(context.token)} cannot be resolved without an explicit implementation.`,
          context.token,
        );
      default:
        throw new ResolutionException(
          `Unknown registration kind for ${describeToken(context.token)}.`,
          context.token,
        );
    }
  }

  private resolveConstructor<TService>(
    implementationType: ServiceType<TService>,
    token: InjectionToken<TService>,
  ): TService {
    const resolver = new ConstructorResolver();
    const selection = resolver.selectConstructor(implementationType, token);
    const values = selection.parameters.map((parameter) => {
      const dependencyToken = parameter.token as InjectionToken<unknown>;
      const resolved = this.Resolve(dependencyToken as InjectionToken<TService>);
      return resolved;
    });

    const constructor = selection.implementation as new (...args: readonly unknown[]) => TService;
    return new constructor(...values);
  }

  public findDescriptors(token: symbol): readonly IServiceDescriptor<unknown>[] {
    return this.collection.Enumerate().filter((descriptor) => descriptor.token === token);
  }

  private assertLifetime<TService>(descriptor: IServiceDescriptor<TService>, token: symbol): void {
    if (!Object.values(ServiceLifetime).includes(descriptor.lifetime)) {
      throw new ResolutionException(
        `Descriptor lifetime '${String(descriptor.lifetime)}' is invalid for ${describeToken(token)}.`,
        token,
      );
    }
  }
}

/**
 * Scope wrapper for provider-based resolution.
 */
export class ServiceScope implements IServiceScope {
  public constructor(
    public readonly provider: IServiceProvider,
    public readonly context: ScopeContext,
  ) {}

  public resolve<TService>(token: InjectionToken<TService>): TService {
    const descriptors = (this.provider as ServiceProvider).findDescriptors(token);
    if (descriptors.length === 0) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }

    if (descriptors.length > 1) {
      throw new ResolutionException(
        `Multiple service registrations found for ${describeToken(token)}. ResolveAll should be used for multi-registration tokens.`,
        token,
      );
    }

    const descriptor = descriptors[0] as IServiceDescriptor<TService>;
    if (!descriptor) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }

    return (this.provider as ServiceProvider).resolveInScope(descriptor, token, this.context);
  }

  public tryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    try {
      return this.resolve(token);
    } catch {
      return undefined;
    }
  }

  public TryResolve<TService>(token: InjectionToken<TService>): TService | undefined {
    return this.tryResolve(token);
  }

  public async dispose(): Promise<void> {
    await this.disposeCore();
  }

  public async disposeCore(): Promise<void> {
    if ((this.provider as ServiceProvider).isDisposed()) {
      return;
    }

    (this.provider as ServiceProvider).disposeScope(this.context.scopeId);
    (this.provider as ServiceProvider).unregisterScope(this);
    const lifecycleManager = this.context.lifecycleManager;
    if (lifecycleManager) {
      await lifecycleManager.disposeAsync();
    }
    await Promise.resolve();
  }
}

/**
 * Scope factory implementation.
 */
export class ServiceScopeFactory implements IServiceScopeFactory {
  public constructor(private readonly provider: ServiceProvider) {}

  public createScope(): IServiceScope {
    return this.provider.createScope();
  }
}

/**
 * Scoped provider implementation that resolves through a scope context.
 */
export class ScopedServiceProvider extends ServiceProvider {
  public constructor(
    collection: IServiceCollection,
    private readonly scopeContext: ScopeContext,
  ) {
    super(collection);
  }

  public override Resolve<TService>(token: InjectionToken<TService>): TService {
    const descriptors = this.findDescriptors(token);
    if (descriptors.length === 0) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }

    const descriptor = descriptors[0] as IServiceDescriptor<TService>;
    if (!descriptor) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }

    return this.resolveInScope(descriptor, token, this.scopeContext);
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

function assertResolutionToken(token: symbol, operation: string): void {
  if (typeof token !== 'symbol') {
    throw new ResolutionException(`${operation} requires a valid symbol token.`);
  }
}

function describeToken(token: symbol): string {
  return token.description ? `Symbol(${token.description})` : token.toString();
}
