import type { Identifier, SerializableValueObject, TimestampString } from '@infrashield/contracts';

import { ToolCategory, ToolContext, ToolMetadata, ToolRegistryException } from './tool-registry.js';

export enum ToolScope {
  Execute = 'execute',
  Read = 'read',
  Write = 'write',
  Configure = 'configure',
  Admin = 'admin',
}

export class ToolAuthorizationError extends ToolRegistryException {
  public constructor(message: string) {
    super(message);
    this.name = 'ToolAuthorizationError';
  }
}

export class ToolPolicyError extends ToolRegistryException {
  public constructor(message: string) {
    super(message);
    this.name = 'ToolPolicyError';
  }
}

export interface ToolAuditContext {
  readonly actorId?: string;
  readonly roles: readonly string[];
  readonly requestedScopes: readonly ToolScope[];
  readonly decision: 'allow' | 'deny';
  readonly reason: string;
  readonly evaluatedAt: TimestampString;
  readonly metadata?: Readonly<SerializableValueObject>;
}

export interface ToolGovernableDefinition {
  readonly id: Identifier;
  readonly name: string;
  readonly metadata: ToolMetadata;
}

export class ToolPermission {
  public readonly toolId?: Identifier;
  public readonly category?: ToolCategory;
  public readonly scopes: readonly ToolScope[];
  public readonly effect: 'allow' | 'deny';

  public constructor(options: {
    readonly toolId?: Identifier;
    readonly category?: ToolCategory;
    readonly scopes: readonly ToolScope[];
    readonly effect?: 'allow' | 'deny';
  }) {
    if (!options.toolId && !options.category) {
      throw new ToolPolicyError('Tool permission requires a tool id or category target.');
    }
    if (options.scopes.length === 0) {
      throw new ToolPolicyError('Tool permission requires at least one scope.');
    }

    this.toolId = options.toolId;
    this.category = options.category;
    this.scopes = Object.freeze([...options.scopes]);
    this.effect = options.effect ?? 'allow';
  }

  public matches(tool: ToolGovernableDefinition, scope: ToolScope): boolean {
    const toolMatches = this.toolId === undefined || this.toolId === tool.id;
    const categoryMatches =
      this.category === undefined || tool.metadata.categories.includes(this.category);

    return toolMatches && categoryMatches && this.scopes.includes(scope);
  }
}

export class ToolRole {
  public readonly name: string;
  public readonly permissions: readonly ToolPermission[];
  public readonly inheritedRoles: readonly ToolRole[];

  public constructor(options: {
    readonly name: string;
    readonly permissions?: readonly ToolPermission[];
    readonly inheritedRoles?: readonly ToolRole[];
  }) {
    if (!options.name.trim()) {
      throw new ToolRegistryException('Tool role name is required.');
    }

    this.name = options.name;
    this.permissions = Object.freeze([...(options.permissions ?? [])]);
    this.inheritedRoles = Object.freeze([...(options.inheritedRoles ?? [])]);
  }

  public listPermissions(visited: Set<string> = new Set()): readonly ToolPermission[] {
    if (visited.has(this.name)) {
      return Object.freeze([]);
    }

    visited.add(this.name);
    return Object.freeze([
      ...this.permissions,
      ...this.inheritedRoles.flatMap((role) => [...role.listPermissions(visited)]),
    ]);
  }
}

export interface ToolGovernanceContext extends ToolContext {
  readonly roles?: readonly ToolRole[];
  readonly scopes?: readonly ToolScope[];
  readonly audit?: ToolAuditContext;
}

export class ToolPolicy {
  public readonly name: string;
  public readonly rules: readonly ToolPermission[];
  public readonly defaultEffect: 'allow' | 'deny';

  public constructor(options: {
    readonly name: string;
    readonly rules?: readonly ToolPermission[];
    readonly defaultEffect?: 'allow' | 'deny';
  }) {
    if (!options.name.trim()) {
      throw new ToolPolicyError('Tool policy name is required.');
    }

    this.name = options.name;
    this.rules = Object.freeze([...(options.rules ?? [])]);
    this.defaultEffect = options.defaultEffect ?? 'deny';
  }

  public evaluate(
    tool: ToolGovernableDefinition,
    scopes: readonly ToolScope[],
    inheritedPermissions: readonly ToolPermission[] = [],
  ): ToolAuditContext {
    const effectiveRules = [...inheritedPermissions, ...this.rules];

    for (const scope of scopes) {
      const matchingRules = effectiveRules.filter((rule) => rule.matches(tool, scope));
      const denyRule = matchingRules.find((rule) => rule.effect === 'deny');
      if (denyRule) {
        return this.buildAudit({
          roles: [],
          requestedScopes: scopes,
          decision: 'deny',
          reason: `Denied by ${this.name} policy for scope ${scope}.`,
        });
      }

      const allowRule = matchingRules.find((rule) => rule.effect === 'allow');
      if (!allowRule && this.defaultEffect === 'deny') {
        return this.buildAudit({
          roles: [],
          requestedScopes: scopes,
          decision: 'deny',
          reason: `No allow rule matched in ${this.name} policy for scope ${scope}.`,
        });
      }
    }

    return this.buildAudit({
      roles: [],
      requestedScopes: scopes,
      decision: 'allow',
      reason: `Allowed by ${this.name} policy.`,
    });
  }

  private buildAudit(options: {
    readonly roles: readonly string[];
    readonly requestedScopes: readonly ToolScope[];
    readonly decision: 'allow' | 'deny';
    readonly reason: string;
  }): ToolAuditContext {
    return Object.freeze({
      actorId: undefined,
      roles: Object.freeze([...options.roles]),
      requestedScopes: Object.freeze([...options.requestedScopes]),
      decision: options.decision,
      reason: options.reason,
      evaluatedAt: new Date().toISOString(),
    });
  }
}

export class ToolAuthorization {
  public constructor(
    private readonly options: {
      readonly roles?: readonly ToolRole[];
      readonly policy?: ToolPolicy;
    } = {},
  ) {}

  public async authorize(
    tool: ToolGovernableDefinition,
    context: ToolGovernanceContext,
    requiredScopes: readonly ToolScope[],
  ): Promise<ToolAuditContext> {
    const roles = context.roles ?? this.options.roles ?? [];
    const permissions = roles.flatMap((role) => [...role.listPermissions()]);
    const policy = this.options.policy;

    for (const scope of requiredScopes) {
      const denyPermission = permissions.find(
        (permission) => permission.effect === 'deny' && permission.matches(tool, scope),
      );
      if (denyPermission) {
        throw new ToolAuthorizationError(`Role permissions denied scope ${scope} for ${tool.id}.`);
      }

      const allowPermission = permissions.find(
        (permission) => permission.effect === 'allow' && permission.matches(tool, scope),
      );
      if (!allowPermission) {
        throw new ToolAuthorizationError(`Missing permission for scope ${scope} on ${tool.id}.`);
      }
    }

    const policyAudit = policy?.evaluate(tool, requiredScopes, permissions);
    if (policyAudit?.decision === 'deny') {
      throw new ToolAuthorizationError(policyAudit.reason);
    }

    return Object.freeze({
      actorId: context.actorId,
      roles: Object.freeze(roles.map((role) => role.name)),
      requestedScopes: Object.freeze([...requiredScopes]),
      decision: 'allow',
      reason: policyAudit?.reason ?? 'Authorized by role permissions.',
      evaluatedAt: new Date().toISOString(),
      metadata: context.metadata,
    });
  }
}

export class ToolExecutionPolicy {
  public readonly requiredScopes: readonly ToolScope[];
  public readonly authorization?: ToolAuthorization;
  public readonly policy?: ToolPolicy;

  public constructor(
    options: {
      readonly requiredScopes?: readonly ToolScope[];
      readonly authorization?: ToolAuthorization;
      readonly policy?: ToolPolicy;
    } = {},
  ) {
    this.requiredScopes = Object.freeze([...(options.requiredScopes ?? [ToolScope.Execute])]);
    this.authorization = options.authorization;
    this.policy = options.policy;
  }

  public async enforce(
    tool: ToolGovernableDefinition,
    context: ToolGovernanceContext,
  ): Promise<ToolAuditContext> {
    if (this.authorization) {
      return this.authorization.authorize(tool, context, this.requiredScopes);
    }

    if (this.policy) {
      const permissions = (context.roles ?? []).flatMap((role) => [...role.listPermissions()]);
      const audit = this.policy.evaluate(tool, this.requiredScopes, permissions);
      if (audit.decision === 'deny') {
        throw new ToolAuthorizationError(audit.reason);
      }

      return Object.freeze({
        actorId: context.actorId,
        roles: Object.freeze((context.roles ?? []).map((role) => role.name)),
        requestedScopes: Object.freeze([...this.requiredScopes]),
        decision: 'allow',
        reason: audit.reason,
        evaluatedAt: audit.evaluatedAt,
        metadata: context.metadata,
      });
    }

    return Object.freeze({
      actorId: context.actorId,
      roles: Object.freeze((context.roles ?? []).map((role) => role.name)),
      requestedScopes: Object.freeze([...this.requiredScopes]),
      decision: 'allow',
      reason: 'No execution policy configured.',
      evaluatedAt: new Date().toISOString(),
      metadata: context.metadata,
    });
  }
}
