/**
 * Nominal dependency injection token.
 */
export type InjectionToken<TService> = symbol & {
  readonly __service?: TService;
};

/**
 * Service lifetimes supported by DI contracts.
 */
export type ServiceLifetime = 'singleton' | 'scoped' | 'transient';

/**
 * Factory for creating a service instance.
 */
export type ServiceFactory<TService> = (provider: IServiceProvider) => TService;

/**
 * Service descriptor contract.
 */
export interface IServiceDescriptor<TService> {
  readonly token: InjectionToken<TService>;
  readonly lifetime: ServiceLifetime;
  readonly implementationFactory: ServiceFactory<TService>;
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
  dispose(): Promise<void> | void;
}

/**
 * Provider contract that resolves services and creates scopes.
 */
export interface IServiceProvider extends IServiceResolver {
  createScope(): IServiceScope;
}

/**
 * Creates a typed injection token from a string key.
 */
export function createInjectionToken<TService>(key: string): InjectionToken<TService> {
  return Symbol(key) as InjectionToken<TService>;
}
