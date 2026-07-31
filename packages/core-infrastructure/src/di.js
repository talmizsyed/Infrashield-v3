'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ServiceCollection =
  exports.ServiceDescriptor =
  exports.ScopedServiceProvider =
  exports.ServiceScopeFactory =
  exports.ServiceScope =
  exports.DependencyValidator =
  exports.ServiceProvider =
  exports.ServiceResolver =
  exports.ConstructorResolver =
  exports.DependencyGraph =
  exports.ParameterResolver =
  exports.ConstructorSelection =
  exports.ScopeContext =
  exports.ResolutionContext =
  exports.ResolutionStack =
  exports.ResolutionPath =
  exports.ValidationException =
  exports.CircularDependencyException =
  exports.ResolutionException =
  exports.DependencyRegistrationError =
  exports.DependencyInjectionError =
  exports.LifecycleManager =
  exports.DisposableCollection =
  exports.ServiceDisposer =
  exports.DisposableTracker =
  exports.DisposalContext =
  exports.Transient =
  exports.Scoped =
  exports.Singleton =
  exports.ServiceLifetime =
    void 0;
exports.createInjectionToken = createInjectionToken;
/**
 * Service lifetime constants used by the registration model.
 */
exports.ServiceLifetime = {
  Singleton: 'singleton',
  Scoped: 'scoped',
  Transient: 'transient',
};
/**
 * Singleton lifetime alias.
 */
exports.Singleton = exports.ServiceLifetime.Singleton;
/**
 * Scoped lifetime alias.
 */
exports.Scoped = exports.ServiceLifetime.Scoped;
/**
 * Transient lifetime alias.
 */
exports.Transient = exports.ServiceLifetime.Transient;
/**
 * Lifecycle context for a disposable service instance.
 */
class DisposalContext {
  constructor(lifetime, owner, token, scopeId) {
    this.lifetime = lifetime;
    this.owner = owner;
    this.token = token;
    this.scopeId = scopeId;
  }
}
exports.DisposalContext = DisposalContext;
/**
 * Tracks disposable services for deterministic disposal.
 */
class DisposableTracker {
  constructor() {
    this.entries = [];
    this.tracked = new Set();
  }
  track(service, context) {
    if (!this.canDispose(service)) {
      return;
    }
    if (typeof service !== 'object' || service === null || this.tracked.has(service)) {
      return;
    }
    this.entries.push({ context, service });
    this.tracked.add(service);
  }
  async disposeAll() {
    const disposer = new ServiceDisposer();
    const failures = [];
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
  canDispose(service) {
    if (!service || typeof service !== 'object') {
      return false;
    }
    return typeof service.dispose === 'function' || typeof service.disposeAsync === 'function';
  }
}
exports.DisposableTracker = DisposableTracker;
/**
 * Disposes a service instance using the appropriate sync or async contract.
 */
class ServiceDisposer {
  async dispose(service) {
    if (!service || typeof service !== 'object') {
      return;
    }
    const asyncDisposable = service;
    if (typeof asyncDisposable.disposeAsync === 'function') {
      await asyncDisposable.disposeAsync();
      return;
    }
    const disposable = service;
    if (typeof disposable.dispose === 'function') {
      disposable.dispose();
    }
  }
}
exports.ServiceDisposer = ServiceDisposer;
/**
 * A disposable collection used by lifecycle managers.
 */
class DisposableCollection {
  constructor() {
    this.tracker = new DisposableTracker();
  }
  track(service, context) {
    this.tracker.track(service, context);
  }
  async disposeAll() {
    await this.tracker.disposeAll();
  }
}
exports.DisposableCollection = DisposableCollection;
/**
 * Coordinates disposal for a provider or scope owner.
 */
class LifecycleManager {
  constructor() {
    this.collection = new DisposableCollection();
    this.disposed = false;
    this.disposing = false;
  }
  track(service, context) {
    if (this.disposed || this.disposing) {
      return;
    }
    this.collection.track(service, context);
  }
  async disposeAsync() {
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
  isDisposed() {
    return this.disposed;
  }
  isDisposing() {
    return this.disposing;
  }
}
exports.LifecycleManager = LifecycleManager;
/**
 * Base DI exception.
 */
class DependencyInjectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DependencyInjectionError';
    this.code = code;
  }
}
exports.DependencyInjectionError = DependencyInjectionError;
/**
 * Exception raised for invalid registration input.
 */
class DependencyRegistrationError extends DependencyInjectionError {
  constructor(message) {
    super('di.registration_invalid', message);
    this.name = 'DependencyRegistrationError';
  }
}
exports.DependencyRegistrationError = DependencyRegistrationError;
/**
 * Exception raised when a service cannot be resolved.
 */
class ResolutionException extends DependencyInjectionError {
  constructor(message, token, cause) {
    super('di.resolution_failed', message);
    this.name = 'ResolutionException';
    this.token = token;
    if (cause) {
      this.cause = cause;
    }
  }
}
exports.ResolutionException = ResolutionException;
/**
 * Raised when dependency validation detects a circular dependency.
 */
class CircularDependencyException extends ResolutionException {
  constructor(message, path, token) {
    super(message, token);
    this.path = path;
    this.name = 'CircularDependencyException';
  }
}
exports.CircularDependencyException = CircularDependencyException;
/**
 * Raised when dependency validation detects invalid registration or constructor metadata.
 */
class ValidationException extends DependencyInjectionError {
  constructor(message, token) {
    super('di.validation_failed', message);
    this.token = token;
    this.name = 'ValidationException';
  }
}
exports.ValidationException = ValidationException;
/**
 * A single step in a dependency resolution path.
 */
class ResolutionPath {
  constructor(steps) {
    this.steps = steps;
  }
  append(step) {
    return new ResolutionPath([...this.steps, step]);
  }
  toString() {
    return this.steps.map((step) => describeToken(step)).join(' -> ');
  }
}
exports.ResolutionPath = ResolutionPath;
/**
 * Tracks the current dependency resolution stack for a single request.
 */
class ResolutionStack {
  constructor() {
    this.stack = [];
  }
  push(token) {
    if (this.stack.includes(token)) {
      throw new CircularDependencyException(
        `Circular dependency detected while resolving ${describeToken(token)}.`,
        new ResolutionPath([...this.stack, token]),
        token,
      );
    }
    this.stack.push(token);
  }
  pop(token) {
    const index = this.stack.lastIndexOf(token);
    if (index >= 0) {
      this.stack.splice(index, 1);
    }
  }
  currentPath() {
    return new ResolutionPath([...this.stack]);
  }
}
exports.ResolutionStack = ResolutionStack;
/**
 * Resolution context passed to service factories and resolution helpers.
 */
class ResolutionContext {
  constructor(provider, token, descriptor, scopeContext) {
    this.provider = provider;
    this.token = token;
    this.descriptor = descriptor;
    this.scopeContext = scopeContext;
  }
}
exports.ResolutionContext = ResolutionContext;
/**
 * Scope context passed to scoped resolution flows.
 */
class ScopeContext {
  constructor(provider, scopeId, parent, lifecycleManager) {
    this.provider = provider;
    this.scopeId = scopeId;
    this.parent = parent;
    this.lifecycleManager = lifecycleManager;
  }
}
exports.ScopeContext = ScopeContext;
/**
 * Constructor dependency metadata selection helper.
 */
class ConstructorSelection {
  constructor(implementation, parameters) {
    this.implementation = implementation;
    this.parameters = parameters;
  }
}
exports.ConstructorSelection = ConstructorSelection;
/**
 * Parameter dependency resolver for constructor injection.
 */
class ParameterResolver {
  constructor(index, token) {
    this.index = index;
    this.token = token;
  }
}
exports.ParameterResolver = ParameterResolver;
/**
 * Dependency graph view used by constructor injection.
 */
class DependencyGraph {
  constructor(nodes) {
    this.nodes = nodes;
  }
}
exports.DependencyGraph = DependencyGraph;
/**
 * Resolves constructor dependencies for registered implementation types.
 */
class ConstructorResolver {
  resolve(implementationType, provider, token) {
    const selection = this.selectConstructor(implementationType, token);
    const values = selection.parameters.map((parameter) => {
      const resolvedValue = provider.Resolve(parameter.token);
      return resolvedValue;
    });
    return new selection.implementation(...values);
  }
  selectConstructor(implementationType, token) {
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
        return new ParameterResolver(index, metadataToken);
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
    const parameterTokens = [];
    const parameterNames = constructor
      .toString()
      .slice(constructor.toString().indexOf('(') + 1, constructor.toString().indexOf(')'))
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    for (let index = 0; index < constructor.length; index += 1) {
      const name = parameterNames[index] ?? `arg${index + 1}`;
      const tokenName = `${token.description ?? 'service'}:${name}`;
      parameterTokens.push(new ParameterResolver(index, createInjectionToken(tokenName)));
    }
    return new ConstructorSelection(constructor, parameterTokens);
  }
  createDependencyGraph(implementationType, provider, token) {
    const selection = this.selectConstructor(implementationType, token);
    const nodes = selection.parameters.map((parameter) => ({
      token: parameter.token,
      descriptor: this.resolveDescriptorForToken(parameter.token, provider),
    }));
    return new DependencyGraph(nodes);
  }
  resolveDescriptorForToken(token, provider) {
    const descriptors = provider.findDescriptors(token);
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
exports.ConstructorResolver = ConstructorResolver;
/**
 * Lightweight resolver facade that delegates to a provider.
 */
class ServiceResolver {
  constructor(provider) {
    this.provider = provider;
  }
  resolve(token) {
    return this.provider.Resolve(token);
  }
  tryResolve(token) {
    return this.provider.TryResolve(token);
  }
  TryResolve(token) {
    return this.provider.TryResolve(token);
  }
}
exports.ServiceResolver = ServiceResolver;
/**
 * In-memory implementation of the DI provider.
 */
class ServiceProvider {
  constructor(collection) {
    this.collection = collection;
    this.singletonCache = new Map();
    this.scopeCache = new Map();
    this.scopeInstances = new Map();
    this.disposedScopes = new Set();
    this.lifecycleManager = new LifecycleManager();
    this.scopeLifecycleManagers = new Map();
    this.childScopes = new Set();
    this.scopeCounter = 0;
    if (!collection || typeof collection !== 'object') {
      throw new ResolutionException('Service provider requires a service collection instance.');
    }
  }
  Resolve(token) {
    assertResolutionToken(token, 'Resolve');
    this.assertNotDisposed(token, 'resolve');
    return this.resolveWithStack(token, new ResolutionStack(), undefined);
  }
  ResolveRequired(token) {
    return this.Resolve(token);
  }
  ResolveAll(token) {
    assertResolutionToken(token, 'ResolveAll');
    this.assertNotDisposed(token, 'resolve');
    const descriptors = this.findDescriptors(token);
    if (descriptors.length === 0) {
      return [];
    }
    return descriptors.map((descriptor) =>
      this.resolveDescriptor(descriptor, token, new ResolutionStack(), undefined),
    );
  }
  resolve(token) {
    return this.Resolve(token);
  }
  resolveRequired(token) {
    return this.ResolveRequired(token);
  }
  resolveAll(token) {
    return this.ResolveAll(token);
  }
  TryResolve(token) {
    try {
      return this.Resolve(token);
    } catch (error) {
      if (error instanceof ResolutionException) {
        return undefined;
      }
      throw error;
    }
  }
  tryResolve(token) {
    return this.TryResolve(token);
  }
  createScope() {
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
  async dispose() {
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
  resolveWithStack(token, stack, scopeContext) {
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
    stack.push(token);
    try {
      return this.resolveDescriptor(descriptors[0], token, stack, scopeContext);
    } finally {
      stack.pop(token);
    }
  }
  resolveDescriptor(descriptor, token, stack, scopeContext) {
    this.assertLifetime(descriptor, token);
    if (descriptor.lifetime === exports.ServiceLifetime.Singleton) {
      const cached = this.singletonCache.get(descriptor);
      if (cached !== undefined) {
        return cached;
      }
    }
    if (descriptor.lifetime === exports.ServiceLifetime.Scoped) {
      if (!scopeContext) {
        throw new ResolutionException(
          `Scoped services require a valid scope context for ${describeToken(token)}.`,
          token,
        );
      }
      return this.resolveInScope(descriptor, token, scopeContext, stack);
    }
    const context = new ResolutionContext(this, token, descriptor, scopeContext);
    const instance = this.createInstance(descriptor, context, stack, scopeContext);
    if (descriptor.lifetime === exports.ServiceLifetime.Singleton) {
      this.singletonCache.set(descriptor, instance);
    }
    this.trackDisposable(instance, descriptor.lifetime, token);
    return instance;
  }
  resolveInScope(descriptor, token, scopeContext, stack) {
    this.assertLifetime(descriptor, token);
    if (descriptor.lifetime === exports.ServiceLifetime.Singleton) {
      return this.resolveDescriptor(
        descriptor,
        token,
        stack ?? new ResolutionStack(),
        scopeContext,
      );
    }
    if (descriptor.lifetime === exports.ServiceLifetime.Transient) {
      const context = new ResolutionContext(this, token, descriptor, scopeContext);
      return this.createInstance(descriptor, context, stack ?? new ResolutionStack(), scopeContext);
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
        scopeContext.scopeId,
      );
    }
    const scopeMap = this.scopeInstances.get(scopeContext.scopeId);
    if (!scopeMap) {
      throw new ResolutionException(
        `Scope ${scopeContext.scopeId} has not been initialized.`,
        token,
      );
    }
    const cacheKey = descriptor;
    const cached = scopeMap.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const context = new ResolutionContext(this, token, descriptor, scopeContext);
    const instance = this.createInstance(
      descriptor,
      context,
      stack ?? new ResolutionStack(),
      scopeContext,
    );
    scopeMap.set(cacheKey, instance);
    this.trackDisposable(instance, descriptor.lifetime, token, scopeContext.scopeId);
    return instance;
  }
  getScopeContext(scopeId) {
    return this.scopeCache.get(scopeId);
  }
  disposeScope(scopeId) {
    if (!this.scopeCache.has(scopeId)) {
      return;
    }
    this.disposedScopes.add(scopeId);
    this.scopeInstances.delete(scopeId);
    this.scopeCache.delete(scopeId);
    this.scopeLifecycleManagers.delete(scopeId);
  }
  isScopeDisposed(scopeId) {
    return this.disposedScopes.has(scopeId);
  }
  createScopeId() {
    this.scopeCounter += 1;
    return `scope-${this.scopeCounter}`;
  }
  unregisterScope(scope) {
    this.childScopes.delete(scope);
  }
  isDisposed() {
    return this.lifecycleManager.isDisposed();
  }
  trackDisposable(instance, lifetime, token, scopeId) {
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
  assertNotDisposed(token, operation) {
    if (this.lifecycleManager.isDisposed() || this.lifecycleManager.isDisposing()) {
      throw new ResolutionException(
        `Cannot ${operation} after the provider has been disposed.`,
        token,
      );
    }
  }
  createInstance(descriptor, context, stack, scopeContext) {
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
        return registration.instance;
      case 'type': {
        const implementationType = registration.type;
        return this.resolveConstructor(implementationType, context.token, stack, scopeContext);
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
  resolveConstructor(implementationType, token, stack, scopeContext) {
    const resolver = new ConstructorResolver();
    let selection;
    try {
      selection = resolver.selectConstructor(implementationType, token);
    } catch (error) {
      if (error instanceof ResolutionException && implementationType.length === 0) {
        throw new ValidationException(
          `Constructor metadata for ${describeToken(token)} is invalid.`,
          token,
        );
      }
      throw error;
    }
    const values = selection.parameters.map((parameter) => {
      const dependencyToken = parameter.token;
      const dependencyDescriptors = this.findDescriptors(dependencyToken);
      if (dependencyDescriptors.length === 0) {
        throw new ValidationException(
          `Missing dependency ${describeToken(dependencyToken)} required by ${describeToken(token)}.`,
          token,
        );
      }
      const resolved = this.resolveWithStack(dependencyToken, stack, scopeContext);
      return resolved;
    });
    const constructor = selection.implementation;
    return new constructor(...values);
  }
  findDescriptors(token) {
    return this.collection.Enumerate().filter((descriptor) => descriptor.token === token);
  }
  assertLifetime(descriptor, token) {
    if (!Object.values(exports.ServiceLifetime).includes(descriptor.lifetime)) {
      throw new ResolutionException(
        `Descriptor lifetime '${String(descriptor.lifetime)}' is invalid for ${describeToken(token)}.`,
        token,
      );
    }
  }
}
exports.ServiceProvider = ServiceProvider;
/**
 * Validates the service collection and dependency graph for missing registrations, invalid constructors,
 * duplicate registrations, and circular dependency hazards.
 */
class DependencyValidator {
  constructor(collection) {
    this.collection = collection;
  }
  validateCollection() {
    const descriptors = this.collection.Enumerate();
    const seen = new Set();
    for (const descriptor of descriptors) {
      if (seen.has(descriptor.token)) {
        throw new ValidationException(
          `Duplicate registration detected for ${describeToken(descriptor.token)}.`,
          descriptor.token,
        );
      }
      seen.add(descriptor.token);
      if (!this.isValidLifetime(descriptor.lifetime)) {
        throw new ValidationException(
          `Invalid lifetime '${String(descriptor.lifetime)}' for ${describeToken(descriptor.token)}.`,
          descriptor.token,
        );
      }
      if (descriptor.registration.kind === 'factory') {
        if (typeof descriptor.registration.factory !== 'function') {
          throw new ValidationException(
            `Factory registration for ${describeToken(descriptor.token)} must be a function.`,
            descriptor.token,
          );
        }
        continue;
      }
      if (descriptor.registration.kind === 'type') {
        const implementationType = descriptor.registration.type;
        const constructor = implementationType.prototype?.constructor;
        if (typeof constructor !== 'function') {
          throw new ValidationException(
            `Constructor registration for ${describeToken(descriptor.token)} is invalid.`,
            descriptor.token,
          );
        }
      }
    }
  }
  validateGraph(token) {
    const descriptors = this.collection.Enumerate();
    const descriptor = descriptors.find((candidate) => candidate.token === token);
    if (!descriptor) {
      throw new ValidationException(`Missing registration for ${describeToken(token)}.`, token);
    }
    const stack = new ResolutionStack();
    try {
      return this.walkDependencies(descriptor, stack, token);
    } catch (error) {
      if (error instanceof CircularDependencyException) {
        throw error;
      }
      if (error instanceof ValidationException) {
        throw error;
      }
      throw new ValidationException(
        `Unable to validate dependencies for ${describeToken(token)}.`,
        token,
      );
    }
  }
  walkDependencies(descriptor, stack, token) {
    stack.push(token);
    try {
      if (descriptor.registration.kind === 'type') {
        const implementationType = descriptor.registration.type;
        const selection = new ConstructorResolver().selectConstructor(implementationType, token);
        const dependencyTokens = selection.parameters.map((parameter) => parameter.token);
        const path = stack.currentPath();
        for (const dependencyToken of dependencyTokens) {
          const dependencyDescriptor = this.collection
            .Enumerate()
            .find((candidate) => candidate.token === dependencyToken);
          if (!dependencyDescriptor) {
            throw new ValidationException(
              `Missing dependency ${describeToken(dependencyToken)} required by ${describeToken(token)}.`,
              token,
            );
          }
          if (dependencyToken === token) {
            throw new CircularDependencyException(
              `Circular dependency detected while resolving ${describeToken(token)}.`,
              path.append(dependencyToken),
              token,
            );
          }
          this.walkDependencies(dependencyDescriptor, stack, dependencyToken);
        }
        return path;
      }
      return stack.currentPath();
    } finally {
      stack.pop(token);
    }
  }
  isValidLifetime(lifetime) {
    return Object.values(exports.ServiceLifetime).includes(lifetime);
  }
}
exports.DependencyValidator = DependencyValidator;
/**
 * Scope wrapper for provider-based resolution.
 *
 * Scopes isolate scoped services while still allowing access to the root provider.
 */
class ServiceScope {
  constructor(provider, context) {
    this.provider = provider;
    this.context = context;
  }
  resolve(token) {
    const descriptors = this.provider.findDescriptors(token);
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
    const descriptor = descriptors[0];
    if (!descriptor) {
      throw new ResolutionException(
        `No service registration found for ${describeToken(token)}.`,
        token,
      );
    }
    return this.provider.resolveInScope(descriptor, token, this.context);
  }
  tryResolve(token) {
    try {
      return this.resolve(token);
    } catch {
      return undefined;
    }
  }
  TryResolve(token) {
    return this.tryResolve(token);
  }
  async dispose() {
    await this.disposeCore();
  }
  async disposeCore() {
    if (this.provider.isDisposed()) {
      return;
    }
    this.provider.disposeScope(this.context.scopeId);
    this.provider.unregisterScope(this);
    const lifecycleManager = this.context.lifecycleManager;
    if (lifecycleManager) {
      await lifecycleManager.disposeAsync();
    }
    await Promise.resolve();
  }
}
exports.ServiceScope = ServiceScope;
/**
 * Scope factory implementation.
 */
class ServiceScopeFactory {
  constructor(provider) {
    this.provider = provider;
  }
  createScope() {
    return this.provider.createScope();
  }
}
exports.ServiceScopeFactory = ServiceScopeFactory;
/**
 * Scoped provider implementation that resolves through a scope context.
 */
class ScopedServiceProvider extends ServiceProvider {
  constructor(collection, scopeContext) {
    super(collection);
    this.scopeContext = scopeContext;
  }
  Resolve(token) {
    const descriptors = this.findDescriptors(token);
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
    return this.resolveInScope(descriptor, token, this.scopeContext);
  }
}
exports.ScopedServiceProvider = ScopedServiceProvider;
/**
 * Metadata representation of a service registration.
 */
class ServiceDescriptor {
  constructor(token, lifetime, registration) {
    this.token = token;
    this.lifetime = lifetime;
    this.registration = registration;
  }
  /**
   * Creates a descriptor with self registration metadata.
   */
  static self(token, lifetime) {
    return new ServiceDescriptor(token, lifetime, { kind: 'self' });
  }
  /**
   * Creates a descriptor with factory registration metadata.
   */
  static fromFactory(token, lifetime, factory) {
    return new ServiceDescriptor(token, lifetime, { kind: 'factory', factory });
  }
  /**
   * Creates a descriptor with constructor type metadata.
   */
  static fromType(token, lifetime, implementationType) {
    return new ServiceDescriptor(token, lifetime, {
      kind: 'type',
      type: implementationType,
    });
  }
  /**
   * Creates a descriptor with pre-built singleton instance metadata.
   */
  static fromInstance(token, instance) {
    return new ServiceDescriptor(token, exports.ServiceLifetime.Singleton, {
      kind: 'instance',
      instance,
    });
  }
}
exports.ServiceDescriptor = ServiceDescriptor;
/**
 * In-memory implementation of the DI registration collection.
 */
class ServiceCollection {
  constructor() {
    this.descriptors = [];
  }
  get Count() {
    return this.descriptors.length;
  }
  register(descriptor) {
    assertDescriptor(descriptor);
    this.throwIfEquivalentDescriptorExists(descriptor);
    this.descriptors.push(descriptor);
  }
  AddSingleton(tokenOrDescriptor, implementation) {
    if (isDescriptor(tokenOrDescriptor)) {
      this.ensureLifetime(tokenOrDescriptor, exports.ServiceLifetime.Singleton, 'AddSingleton');
      this.register(tokenOrDescriptor);
      return;
    }
    this.register(
      this.createDescriptor(tokenOrDescriptor, exports.ServiceLifetime.Singleton, implementation),
    );
  }
  AddScoped(tokenOrDescriptor, implementation) {
    if (isDescriptor(tokenOrDescriptor)) {
      this.ensureLifetime(tokenOrDescriptor, exports.ServiceLifetime.Scoped, 'AddScoped');
      this.register(tokenOrDescriptor);
      return;
    }
    this.register(
      this.createDescriptor(tokenOrDescriptor, exports.ServiceLifetime.Scoped, implementation),
    );
  }
  AddTransient(tokenOrDescriptor, implementation) {
    if (isDescriptor(tokenOrDescriptor)) {
      this.ensureLifetime(tokenOrDescriptor, exports.ServiceLifetime.Transient, 'AddTransient');
      this.register(tokenOrDescriptor);
      return;
    }
    this.register(
      this.createDescriptor(tokenOrDescriptor, exports.ServiceLifetime.Transient, implementation),
    );
  }
  AddInstance(token, instance) {
    assertToken(token, 'AddInstance');
    if (typeof instance === 'undefined') {
      throw new DependencyRegistrationError('AddInstance requires a defined instance value.');
    }
    this.register(ServiceDescriptor.fromInstance(token, instance));
  }
  TryAdd(descriptor) {
    assertDescriptor(descriptor);
    if (this.Contains(descriptor.token)) {
      return false;
    }
    this.register(descriptor);
    return true;
  }
  Replace(descriptor) {
    assertDescriptor(descriptor);
    this.Remove(descriptor.token);
    this.register(descriptor);
  }
  Remove(token) {
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
  Clear() {
    this.descriptors.length = 0;
  }
  Contains(token) {
    assertToken(token, 'Contains');
    return this.descriptors.some((descriptor) => descriptor.token === token);
  }
  Enumerate() {
    return [...this.descriptors];
  }
  Validate() {
    const duplicates = this.findDuplicates();
    return {
      valid: duplicates.length === 0,
      duplicates,
    };
  }
  addSingleton(token, implementation) {
    this.AddSingleton(token, implementation);
  }
  addScoped(token, implementation) {
    this.register(this.createDescriptor(token, exports.ServiceLifetime.Scoped, implementation));
  }
  addTransient(token, implementation) {
    this.register(this.createDescriptor(token, exports.ServiceLifetime.Transient, implementation));
  }
  addInstance(token, instance) {
    this.AddInstance(token, instance);
  }
  tryAdd(descriptor) {
    return this.TryAdd(descriptor);
  }
  replace(descriptor) {
    this.Replace(descriptor);
  }
  remove(token) {
    return this.Remove(token);
  }
  clear() {
    this.Clear();
  }
  contains(token) {
    return this.Contains(token);
  }
  enumerate() {
    return this.Enumerate();
  }
  validate() {
    return this.Validate();
  }
  createDescriptor(token, lifetime, implementation) {
    assertToken(token, 'register');
    if (typeof implementation === 'undefined') {
      return ServiceDescriptor.self(token, lifetime);
    }
    if (isServiceType(implementation)) {
      return ServiceDescriptor.fromType(token, lifetime, implementation);
    }
    if (typeof implementation === 'function') {
      return ServiceDescriptor.fromFactory(token, lifetime, implementation);
    }
    if (lifetime !== exports.ServiceLifetime.Singleton) {
      throw new DependencyRegistrationError(
        `Only singleton services can be registered with direct instances for ${describeToken(token)}.`,
      );
    }
    return ServiceDescriptor.fromInstance(token, implementation);
  }
  ensureLifetime(descriptor, expected, methodName) {
    if (descriptor.lifetime !== expected) {
      throw new DependencyRegistrationError(
        `${methodName} expects descriptor lifetime '${expected}' but received '${descriptor.lifetime}'.`,
      );
    }
  }
  throwIfEquivalentDescriptorExists(descriptor) {
    const exists = this.descriptors.some((existing) => descriptorsEquivalent(existing, descriptor));
    if (exists) {
      throw new DependencyRegistrationError(
        `Equivalent registration already exists for ${describeToken(descriptor.token)} ` +
          `with lifetime '${descriptor.lifetime}'.`,
      );
    }
  }
  findDuplicates() {
    const counts = new Map();
    for (const descriptor of this.descriptors) {
      counts.set(descriptor.token, (counts.get(descriptor.token) ?? 0) + 1);
    }
    const duplicates = [];
    for (const [token, count] of counts.entries()) {
      if (count > 1) {
        duplicates.push({ token, count });
      }
    }
    return duplicates;
  }
}
exports.ServiceCollection = ServiceCollection;
/**
 * Creates a typed injection token from a string key.
 */
function createInjectionToken(key) {
  if (key.trim().length === 0) {
    throw new DependencyRegistrationError('Injection token key must not be empty.');
  }
  return Symbol(key);
}
function isDescriptor(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (
    'token' in value &&
    'lifetime' in value &&
    'registration' in value &&
    typeof value.token === 'symbol'
  );
}
function isServiceType(value) {
  if (typeof value !== 'function') {
    return false;
  }
  const asString = Function.prototype.toString.call(value);
  return asString.startsWith('class ');
}
function descriptorsEquivalent(left, right) {
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
function assertDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object') {
    throw new DependencyRegistrationError('Descriptor must be a non-null object.');
  }
  assertToken(descriptor.token, 'register');
  if (!Object.values(exports.ServiceLifetime).includes(descriptor.lifetime)) {
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
function assertToken(token, operation) {
  if (typeof token !== 'symbol') {
    throw new DependencyRegistrationError(`${operation} requires a valid symbol token.`);
  }
}
function assertResolutionToken(token, operation) {
  if (typeof token !== 'symbol') {
    throw new ResolutionException(`${operation} requires a valid symbol token.`);
  }
}
function describeToken(token) {
  return token.description ? `Symbol(${token.description})` : token.toString();
}
//# sourceMappingURL=di.js.map
