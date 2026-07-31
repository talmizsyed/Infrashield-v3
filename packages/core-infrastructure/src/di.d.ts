/**
 * Nominal dependency injection token.
 */
export type InjectionToken<TService> = symbol & {
  readonly __service?: TService;
};
/**
 * Service lifetime constants used by the registration model.
 */
export declare const ServiceLifetime: {
  readonly Singleton: 'singleton';
  readonly Scoped: 'scoped';
  readonly Transient: 'transient';
};
/**
 * Service lifetime value union.
 */
export type ServiceLifetime = (typeof ServiceLifetime)[keyof typeof ServiceLifetime];
/**
 * Singleton lifetime alias.
 */
export declare const Singleton: ServiceLifetime;
/**
 * Scoped lifetime alias.
 */
export declare const Scoped: ServiceLifetime;
/**
 * Transient lifetime alias.
 */
export declare const Transient: ServiceLifetime;
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
  | {
      readonly kind: 'self';
    }
  | {
      readonly kind: 'factory';
      readonly factory: ServiceFactory<TService>;
    }
  | {
      readonly kind: 'type';
      readonly type: ServiceType<TService>;
    }
  | {
      readonly kind: 'instance';
      readonly instance: TService;
    };
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
export declare class DisposalContext {
  readonly lifetime: ServiceLifetime;
  readonly owner: 'provider' | 'scope';
  readonly token?: symbol | undefined;
  readonly scopeId?: string | undefined;
  constructor(
    lifetime: ServiceLifetime,
    owner: 'provider' | 'scope',
    token?: symbol | undefined,
    scopeId?: string | undefined,
  );
}
/**
 * Tracks disposable services for deterministic disposal.
 */
export declare class DisposableTracker {
  private readonly entries;
  private readonly tracked;
  track(service: unknown, context: DisposalContext): void;
  disposeAll(): Promise<void>;
  private canDispose;
}
/**
 * Disposes a service instance using the appropriate sync or async contract.
 */
export declare class ServiceDisposer {
  dispose(service: unknown): Promise<void>;
}
/**
 * A disposable collection used by lifecycle managers.
 */
export declare class DisposableCollection {
  private readonly tracker;
  track(service: unknown, context: DisposalContext): void;
  disposeAll(): Promise<void>;
}
/**
 * Coordinates disposal for a provider or scope owner.
 */
export declare class LifecycleManager {
  private readonly collection;
  private disposalPromise;
  private disposed;
  private disposing;
  track(service: unknown, context: DisposalContext): void;
  disposeAsync(): Promise<void>;
  isDisposed(): boolean;
  isDisposing(): boolean;
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
export declare class DependencyInjectionError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}
/**
 * Exception raised for invalid registration input.
 */
export declare class DependencyRegistrationError extends DependencyInjectionError {
  constructor(message: string);
}
/**
 * Exception raised when a service cannot be resolved.
 */
export declare class ResolutionException extends DependencyInjectionError {
  readonly token?: symbol;
  constructor(message: string, token?: symbol, cause?: unknown);
  readonly cause?: unknown;
}
/**
 * Raised when dependency validation detects a circular dependency.
 */
export declare class CircularDependencyException extends ResolutionException {
  readonly path: ResolutionPath;
  constructor(message: string, path: ResolutionPath, token?: symbol);
}
/**
 * Raised when dependency validation detects invalid registration or constructor metadata.
 */
export declare class ValidationException extends DependencyInjectionError {
  readonly token?: symbol | undefined;
  constructor(message: string, token?: symbol | undefined);
}
/**
 * A single step in a dependency resolution path.
 */
export declare class ResolutionPath {
  readonly steps: readonly symbol[];
  constructor(steps: readonly symbol[]);
  append(step: symbol): ResolutionPath;
  toString(): string;
}
/**
 * Tracks the current dependency resolution stack for a single request.
 */
export declare class ResolutionStack {
  private readonly stack;
  push(token: symbol): void;
  pop(token: symbol): void;
  currentPath(): ResolutionPath;
}
/**
 * Resolution context passed to service factories and resolution helpers.
 */
export declare class ResolutionContext {
  readonly provider: IServiceProvider;
  readonly token: symbol;
  readonly descriptor: IServiceDescriptor<unknown>;
  readonly scopeContext?: ScopeContext | undefined;
  constructor(
    provider: IServiceProvider,
    token: symbol,
    descriptor: IServiceDescriptor<unknown>,
    scopeContext?: ScopeContext | undefined,
  );
}
/**
 * Scope context passed to scoped resolution flows.
 */
export declare class ScopeContext {
  readonly provider: IServiceProvider;
  readonly scopeId: string;
  readonly parent?: ScopeContext | undefined;
  readonly lifecycleManager?: LifecycleManager | undefined;
  constructor(
    provider: IServiceProvider,
    scopeId: string,
    parent?: ScopeContext | undefined,
    lifecycleManager?: LifecycleManager | undefined,
  );
}
/**
 * Constructor dependency metadata selection helper.
 */
export declare class ConstructorSelection {
  readonly implementation: new (...args: readonly unknown[]) => unknown;
  readonly parameters: readonly ParameterResolver[];
  constructor(
    implementation: new (...args: readonly unknown[]) => unknown,
    parameters: readonly ParameterResolver[],
  );
}
/**
 * Parameter dependency resolver for constructor injection.
 */
export declare class ParameterResolver {
  readonly index: number;
  readonly token: InjectionToken<unknown>;
  constructor(index: number, token: InjectionToken<unknown>);
}
/**
 * Dependency graph view used by constructor injection.
 */
export declare class DependencyGraph {
  readonly nodes: readonly {
    token: symbol;
    descriptor: IServiceDescriptor<unknown>;
  }[];
  constructor(
    nodes: readonly {
      token: symbol;
      descriptor: IServiceDescriptor<unknown>;
    }[],
  );
}
/**
 * Resolves constructor dependencies for registered implementation types.
 */
export declare class ConstructorResolver {
  resolve<TService>(
    implementationType: ServiceType<TService>,
    provider: IServiceProvider,
    token: symbol,
  ): TService;
  selectConstructor<TService>(
    implementationType: ServiceType<TService>,
    token: symbol,
  ): ConstructorSelection;
  createDependencyGraph<TService>(
    implementationType: ServiceType<TService>,
    provider: IServiceProvider,
    token: symbol,
  ): DependencyGraph;
  private resolveDescriptorForToken;
}
/**
 * Lightweight resolver facade that delegates to a provider.
 */
export declare class ServiceResolver implements IServiceResolver {
  private readonly provider;
  constructor(provider: IServiceProvider);
  resolve<TService>(token: InjectionToken<TService>): TService;
  tryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
  TryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
}
/**
 * In-memory implementation of the DI provider.
 */
export declare class ServiceProvider implements IServiceProvider {
  private readonly collection;
  private readonly singletonCache;
  private readonly scopeCache;
  private readonly scopeInstances;
  private readonly disposedScopes;
  private readonly lifecycleManager;
  private readonly scopeLifecycleManagers;
  private readonly childScopes;
  private disposePromise;
  private scopeCounter;
  constructor(collection: IServiceCollection);
  Resolve<TService>(token: InjectionToken<TService>): TService;
  ResolveRequired<TService>(token: InjectionToken<TService>): TService;
  ResolveAll<TService>(token: InjectionToken<TService>): readonly TService[];
  resolve<TService>(token: InjectionToken<TService>): TService;
  resolveRequired<TService>(token: InjectionToken<TService>): TService;
  resolveAll<TService>(token: InjectionToken<TService>): readonly TService[];
  TryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
  tryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
  createScope(): IServiceScope;
  dispose(): Promise<void>;
  private resolveWithStack;
  private resolveDescriptor;
  resolveInScope<TService>(
    descriptor: IServiceDescriptor<TService>,
    token: InjectionToken<TService>,
    scopeContext?: ScopeContext,
    stack?: ResolutionStack,
  ): TService;
  getScopeContext(scopeId: string): ScopeContext | undefined;
  disposeScope(scopeId: string): void;
  isScopeDisposed(scopeId: string): boolean;
  createScopeId(): string;
  unregisterScope(scope: ServiceScope): void;
  isDisposed(): boolean;
  private trackDisposable;
  private assertNotDisposed;
  private createInstance;
  private resolveConstructor;
  findDescriptors(token: symbol): readonly IServiceDescriptor<unknown>[];
  private assertLifetime;
}
/**
 * Validates the service collection and dependency graph for missing registrations, invalid constructors,
 * duplicate registrations, and circular dependency hazards.
 */
export declare class DependencyValidator {
  private readonly collection;
  constructor(collection: IServiceCollection);
  validateCollection(): void;
  validateGraph(token: symbol): ResolutionPath;
  private walkDependencies;
  private isValidLifetime;
}
/**
 * Scope wrapper for provider-based resolution.
 *
 * Scopes isolate scoped services while still allowing access to the root provider.
 */
export declare class ServiceScope implements IServiceScope {
  readonly provider: IServiceProvider;
  readonly context: ScopeContext;
  constructor(provider: IServiceProvider, context: ScopeContext);
  resolve<TService>(token: InjectionToken<TService>): TService;
  tryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
  TryResolve<TService>(token: InjectionToken<TService>): TService | undefined;
  dispose(): Promise<void>;
  disposeCore(): Promise<void>;
}
/**
 * Scope factory implementation.
 */
export declare class ServiceScopeFactory implements IServiceScopeFactory {
  private readonly provider;
  constructor(provider: ServiceProvider);
  createScope(): IServiceScope;
}
/**
 * Scoped provider implementation that resolves through a scope context.
 */
export declare class ScopedServiceProvider extends ServiceProvider {
  private readonly scopeContext;
  constructor(collection: IServiceCollection, scopeContext: ScopeContext);
  Resolve<TService>(token: InjectionToken<TService>): TService;
}
/**
 * Metadata representation of a service registration.
 */
export declare class ServiceDescriptor<TService> implements IServiceDescriptor<TService> {
  readonly token: InjectionToken<TService>;
  readonly lifetime: ServiceLifetime;
  readonly registration: ServiceRegistration<TService>;
  constructor(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    registration: ServiceRegistration<TService>,
  );
  /**
   * Creates a descriptor with self registration metadata.
   */
  static self<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
  ): ServiceDescriptor<TService>;
  /**
   * Creates a descriptor with factory registration metadata.
   */
  static fromFactory<TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    factory: ServiceFactory<TService>,
  ): ServiceDescriptor<TService>;
  /**
   * Creates a descriptor with constructor type metadata.
   */
  static fromType<TService, TImplementation extends TService>(
    token: InjectionToken<TService>,
    lifetime: ServiceLifetime,
    implementationType: ServiceType<TImplementation>,
  ): ServiceDescriptor<TService>;
  /**
   * Creates a descriptor with pre-built singleton instance metadata.
   */
  static fromInstance<TService>(
    token: InjectionToken<TService>,
    instance: TService,
  ): ServiceDescriptor<TService>;
}
/**
 * In-memory implementation of the DI registration collection.
 */
export declare class ServiceCollection implements IServiceCollection {
  private readonly descriptors;
  get Count(): number;
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
  private createDescriptor;
  private ensureLifetime;
  private throwIfEquivalentDescriptorExists;
  private findDuplicates;
}
/**
 * Creates a typed injection token from a string key.
 */
export declare function createInjectionToken<TService>(key: string): InjectionToken<TService>;
//# sourceMappingURL=di.d.ts.map
