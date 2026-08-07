import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

import type { Provider, ProviderContext } from './provider-core.js';
import { ToolRegistryException } from '@infrashield/ai-tools';

export type AuthenticationMethod =
  'username-password' | 'api-key' | 'token' | 'oauth2' | 'client-certificate' | 'ssh-key';

interface CredentialBase {
  readonly method: AuthenticationMethod;
  readonly principalId?: Identifier;
  readonly expiresAt?: TimestampString;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface UsernamePasswordCredential extends CredentialBase {
  readonly method: 'username-password';
  readonly username: string;
  readonly password: string;
}

export interface ApiKeyCredential extends CredentialBase {
  readonly method: 'api-key';
  readonly apiKey: string;
}

export interface TokenCredential extends CredentialBase {
  readonly method: 'token';
  readonly token: string;
  readonly tokenType?: string;
}

export interface OAuth2Credential extends CredentialBase {
  readonly method: 'oauth2';
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly clientId?: string;
  readonly scopes?: readonly string[];
  readonly tokenType?: string;
}

export interface ClientCertificateCredential extends CredentialBase {
  readonly method: 'client-certificate';
  readonly certificatePem: string;
  readonly privateKeyPem: string;
  readonly passphrase?: string;
}

export interface SshKeyCredential extends CredentialBase {
  readonly method: 'ssh-key';
  readonly privateKey: string;
  readonly publicKey?: string;
  readonly passphrase?: string;
}

export type ProviderCredential =
  | UsernamePasswordCredential
  | ApiKeyCredential
  | TokenCredential
  | OAuth2Credential
  | ClientCertificateCredential
  | SshKeyCredential;

export interface AuthenticationContext<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
> {
  readonly provider: Provider<TConfiguration>;
  readonly providerContext: ProviderContext<TConfiguration>;
  readonly actorId?: Identifier;
  readonly connectionId?: Identifier;
  readonly requestedMethod?: AuthenticationMethod;
  readonly requestedScopes?: readonly string[];
  readonly requestedAt: TimestampString;
}

export class AuthenticationResult {
  public readonly success: boolean;
  public readonly method: AuthenticationMethod;
  public readonly providerId: Identifier;
  public readonly authenticatedAt: TimestampString;
  public readonly principalId?: Identifier;
  public readonly expiresAt?: TimestampString;
  public readonly scopes?: readonly string[];
  public readonly message?: string;
  public readonly metadata?: Readonly<Record<string, string>>;

  public constructor(options: {
    readonly success: boolean;
    readonly method: AuthenticationMethod;
    readonly providerId: Identifier;
    readonly principalId?: Identifier;
    readonly expiresAt?: TimestampString;
    readonly scopes?: readonly string[];
    readonly message?: string;
    readonly metadata?: Readonly<Record<string, string>>;
    readonly authenticatedAt?: TimestampString;
  }) {
    this.success = options.success;
    this.method = options.method;
    this.providerId = options.providerId;
    this.principalId = options.principalId;
    this.expiresAt = options.expiresAt;
    this.scopes = options.scopes;
    this.message = options.message;
    this.metadata = options.metadata;
    this.authenticatedAt = options.authenticatedAt ?? new Date().toISOString();
  }
}

export class AuthenticationPolicy {
  public readonly allowedMethods: readonly AuthenticationMethod[];
  public readonly requireCredential: boolean;
  public readonly validateCredentialExpiry: boolean;
  public readonly requiredScopesByMethod: Readonly<
    Partial<Record<AuthenticationMethod, readonly string[]>>
  >;

  public constructor(
    options: {
      readonly allowedMethods?: readonly AuthenticationMethod[];
      readonly requireCredential?: boolean;
      readonly validateCredentialExpiry?: boolean;
      readonly requiredScopesByMethod?: Readonly<
        Partial<Record<AuthenticationMethod, readonly string[]>>
      >;
    } = {},
  ) {
    this.allowedMethods = options.allowedMethods ?? [
      'username-password',
      'api-key',
      'token',
      'oauth2',
      'client-certificate',
      'ssh-key',
    ];
    this.requireCredential = options.requireCredential ?? true;
    this.validateCredentialExpiry = options.validateCredentialExpiry ?? true;
    this.requiredScopesByMethod = options.requiredScopesByMethod ?? {};
  }

  public isMethodAllowed(method: AuthenticationMethod): boolean {
    return this.allowedMethods.includes(method);
  }

  public getRequiredScopes(method: AuthenticationMethod): readonly string[] {
    return this.requiredScopesByMethod[method] ?? [];
  }
}

export class AuthenticationValidator {
  public validateContext<TConfiguration extends SerializableValueObject>(
    context: AuthenticationContext<TConfiguration>,
  ): void {
    if (!context.provider.manifest.id) {
      throw new ToolRegistryException('Authentication context providerId is required.');
    }
  }

  public validateCredential(credential: ProviderCredential): void {
    this.assertNonEmpty(credential.method, 'Authentication method is required.');

    switch (credential.method) {
      case 'username-password':
        this.assertNonEmpty(credential.username, 'Username is required.');
        this.assertNonEmpty(credential.password, 'Password is required.');
        break;
      case 'api-key':
        this.assertNonEmpty(credential.apiKey, 'API key is required.');
        break;
      case 'token':
        this.assertNonEmpty(credential.token, 'Token is required.');
        break;
      case 'oauth2':
        this.assertNonEmpty(credential.accessToken, 'OAuth2 access token is required.');
        break;
      case 'client-certificate':
        this.assertNonEmpty(credential.certificatePem, 'Client certificate is required.');
        this.assertNonEmpty(credential.privateKeyPem, 'Client private key is required.');
        break;
      case 'ssh-key':
        this.assertNonEmpty(credential.privateKey, 'SSH private key is required.');
        break;
      default: {
        const neverMethod: never = credential;
        throw new ToolRegistryException(
          `Unsupported authentication method: ${(neverMethod as { method: string }).method}`,
        );
      }
    }
  }

  public validatePolicy(
    policy: AuthenticationPolicy,
    method: AuthenticationMethod,
    credential: ProviderCredential,
    requestedScopes?: readonly string[],
  ): void {
    if (!policy.isMethodAllowed(method)) {
      throw new ToolRegistryException(`Authentication method is not allowed: ${method}`);
    }

    if (policy.validateCredentialExpiry && credential.expiresAt) {
      const expiresAt = new Date(credential.expiresAt).getTime();
      if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
        throw new ToolRegistryException(`Credential has expired for method: ${method}`);
      }
    }

    const requiredScopes = policy.getRequiredScopes(method);
    if (requiredScopes.length === 0) {
      return;
    }

    const availableScopes = new Set(requestedScopes ?? this.getCredentialScopes(credential));
    for (const scope of requiredScopes) {
      if (!availableScopes.has(scope)) {
        throw new ToolRegistryException(`Missing required scope: ${scope}`);
      }
    }
  }

  private getCredentialScopes(credential: ProviderCredential): readonly string[] {
    if (credential.method === 'oauth2') {
      return credential.scopes ?? [];
    }

    return [];
  }

  private assertNonEmpty(value: string | undefined, message: string): void {
    if (!value || value.trim().length === 0) {
      throw new ToolRegistryException(message);
    }
  }
}

export interface CredentialProvider {
  getCredential<TConfiguration extends SerializableValueObject>(
    context: AuthenticationContext<TConfiguration>,
  ): Promise<ProviderCredential | undefined>;
}

export class CredentialStore implements CredentialProvider {
  private readonly credentials = new Map<string, ProviderCredential>();

  public setCredential<TConfiguration extends SerializableValueObject>(
    context: AuthenticationContext<TConfiguration>,
    credential: ProviderCredential,
  ): void {
    this.credentials.set(this.resolveKey(context, credential.method), credential);
  }

  public async getCredential<TConfiguration extends SerializableValueObject>(
    context: AuthenticationContext<TConfiguration>,
  ): Promise<ProviderCredential | undefined> {
    const method = context.requestedMethod;
    if (method) {
      return this.credentials.get(this.resolveKey(context, method));
    }

    for (const candidate of [
      'username-password',
      'api-key',
      'token',
      'oauth2',
      'client-certificate',
      'ssh-key',
    ] as const) {
      const credential = this.credentials.get(this.resolveKey(context, candidate));
      if (credential) {
        return credential;
      }
    }

    return undefined;
  }

  public removeCredential<TConfiguration extends SerializableValueObject>(
    context: AuthenticationContext<TConfiguration>,
    method: AuthenticationMethod,
  ): boolean {
    return this.credentials.delete(this.resolveKey(context, method));
  }

  public clear(): void {
    this.credentials.clear();
  }

  private resolveKey<TConfiguration extends SerializableValueObject>(
    context: AuthenticationContext<TConfiguration>,
    method: AuthenticationMethod,
  ): string {
    return [
      context.provider.manifest.id,
      context.actorId ?? 'anonymous',
      context.connectionId ?? 'default',
      method,
    ].join(':');
  }
}

export interface AuthenticationProvider<
  TConfiguration extends SerializableValueObject = SerializableValueObject,
  TCredential extends ProviderCredential = ProviderCredential,
> {
  readonly method: TCredential['method'];
  supportsContext?(context: AuthenticationContext<TConfiguration>): boolean | Promise<boolean>;
  authenticate(
    context: AuthenticationContext<TConfiguration>,
    credential: TCredential,
  ): Promise<AuthenticationResult>;
}

export class ProviderAuthentication {
  private readonly providers = new Map<AuthenticationMethod, AuthenticationProvider>();

  public constructor(
    private readonly options: {
      readonly validator?: AuthenticationValidator;
      readonly policy?: AuthenticationPolicy;
      readonly credentialProvider?: CredentialProvider;
      readonly credentialStore?: CredentialStore;
      readonly autoStoreCredentials?: boolean;
    } = {},
  ) {}

  public registerProvider(provider: AuthenticationProvider): void {
    this.providers.set(provider.method, provider);
  }

  public unregisterProvider(method: AuthenticationMethod): boolean {
    return this.providers.delete(method);
  }

  public listMethods(): readonly AuthenticationMethod[] {
    return Object.freeze([...this.providers.keys()]);
  }

  public async authenticate<TConfiguration extends SerializableValueObject>(options: {
    readonly provider: Provider<TConfiguration>;
    readonly context: ProviderContext<TConfiguration>;
    readonly actorId?: Identifier;
    readonly connectionId?: Identifier;
    readonly method?: AuthenticationMethod;
    readonly requestedScopes?: readonly string[];
    readonly credential?: ProviderCredential;
    readonly policy?: AuthenticationPolicy;
  }): Promise<AuthenticationResult> {
    const authenticationContext: AuthenticationContext<TConfiguration> = {
      provider: options.provider,
      providerContext: options.context,
      actorId: options.actorId,
      connectionId: options.connectionId,
      requestedMethod: options.method,
      requestedScopes: options.requestedScopes,
      requestedAt: new Date().toISOString(),
    };

    const validator = this.options.validator ?? new AuthenticationValidator();
    validator.validateContext(authenticationContext);

    const policy = options.policy ?? this.options.policy ?? new AuthenticationPolicy();
    const credential =
      options.credential ??
      (await this.options.credentialProvider?.getCredential(authenticationContext)) ??
      (await this.options.credentialStore?.getCredential(authenticationContext));

    if (!credential) {
      if (policy.requireCredential) {
        throw new ToolRegistryException('Provider authentication credential is required.');
      }

      throw new ToolRegistryException('No credential resolved for provider authentication.');
    }

    const method = options.method ?? credential.method;
    if (method !== credential.method) {
      throw new ToolRegistryException(
        `Requested authentication method ${method} does not match credential method ${credential.method}.`,
      );
    }

    validator.validateCredential(credential);
    validator.validatePolicy(policy, method, credential, options.requestedScopes);

    const provider = this.providers.get(method);
    if (!provider) {
      throw new ToolRegistryException(
        `No authentication provider registered for method: ${method}`,
      );
    }

    if (provider.supportsContext) {
      const isSupported = await provider.supportsContext(authenticationContext);
      if (!isSupported) {
        throw new ToolRegistryException(
          `Authentication provider does not support context for method: ${method}`,
        );
      }
    }

    const result = await provider.authenticate(authenticationContext, credential);

    if (
      result.success &&
      this.options.autoStoreCredentials !== false &&
      this.options.credentialStore
    ) {
      this.options.credentialStore.setCredential(authenticationContext, credential);
    }

    return new AuthenticationResult({
      success: result.success,
      method,
      providerId: options.provider.manifest.id,
      principalId: result.principalId,
      expiresAt: result.expiresAt,
      scopes: result.scopes,
      message: result.message,
      metadata: result.metadata,
      authenticatedAt: result.authenticatedAt,
    });
  }
}
