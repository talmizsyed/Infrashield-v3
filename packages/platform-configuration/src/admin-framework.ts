import type {
  FeatureFlagConfiguration,
  NavigationConfiguration,
  PlatformConfiguration,
  RbacRoleConfiguration,
} from './types';

export interface AdminMetadata {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  category?: string;
  tags?: readonly string[];
  featureFlag?: string;
  order?: number;
}

export interface AdminSection {
  id: string;
  title: string;
  href: string;
  description?: string;
  badge?: string;
  enabled: boolean;
  order: number;
  metadata?: AdminMetadata;
  requiredPermissions?: readonly string[];
  requiredRoles?: readonly string[];
  featureFlag?: string;
}

export interface AdminModule {
  id: string;
  metadata: AdminMetadata;
  sections: readonly AdminSection[];
  enabled?: boolean;
}

export interface AdminPermissionContext {
  roleIds?: readonly string[];
  permissions?: readonly string[];
  featureFlags?: Readonly<Record<string, boolean>>;
}

export class AdminRegistry {
  private readonly modules = new Map<string, AdminModule>();

  public register(module: AdminModule): void {
    this.modules.set(module.id, module);
  }

  public unregister(moduleId: string): boolean {
    return this.modules.delete(moduleId);
  }

  public get(moduleId: string): AdminModule | undefined {
    return this.modules.get(moduleId);
  }

  public list(): readonly AdminModule[] {
    return Object.freeze([...this.modules.values()]);
  }
}

export class AdminPermissions {
  public canViewModule(
    module: AdminModule,
    context: AdminPermissionContext,
    configuration: PlatformConfiguration,
  ): boolean {
    if (module.enabled === false) {
      return false;
    }

    if (
      module.metadata.featureFlag &&
      !this.isFeatureEnabled(module.metadata.featureFlag, context, configuration.featureFlags)
    ) {
      return false;
    }

    return module.sections.some((section) => this.canViewSection(section, context, configuration));
  }

  public canViewSection(
    section: AdminSection,
    context: AdminPermissionContext,
    configuration: PlatformConfiguration,
  ): boolean {
    if (!section.enabled) {
      return false;
    }

    if (
      section.featureFlag &&
      !this.isFeatureEnabled(section.featureFlag, context, configuration.featureFlags)
    ) {
      return false;
    }

    const roleIds = new Set(context.roleIds ?? []);
    if (section.requiredRoles && section.requiredRoles.length > 0) {
      const hasRequiredRole = section.requiredRoles.some((roleId) => roleIds.has(roleId));
      if (!hasRequiredRole) {
        return false;
      }
    }

    const grantedPermissions = this.resolvePermissions(configuration.rbac, context);
    if (section.requiredPermissions && section.requiredPermissions.length > 0) {
      return section.requiredPermissions.every((permission) => grantedPermissions.has(permission));
    }

    return true;
  }

  private resolvePermissions(
    rbac: readonly RbacRoleConfiguration[],
    context: AdminPermissionContext,
  ): ReadonlySet<string> {
    const granted = new Set(context.permissions ?? []);
    const roles = new Set(context.roleIds ?? []);

    for (const role of rbac) {
      if (!roles.has(role.id)) {
        continue;
      }

      for (const permission of role.permissions) {
        granted.add(permission);
      }
    }

    return granted;
  }

  private isFeatureEnabled(
    featureFlagId: string,
    context: AdminPermissionContext,
    featureFlags: readonly FeatureFlagConfiguration[],
  ): boolean {
    if (context.featureFlags && featureFlagId in context.featureFlags) {
      return context.featureFlags[featureFlagId] === true;
    }

    return featureFlags.some((flag) => flag.id === featureFlagId && flag.enabled);
  }
}

export class AdminNavigation {
  public constructor(
    private readonly registry: AdminRegistry,
    private readonly permissions: AdminPermissions = new AdminPermissions(),
  ) {}

  public build(
    configuration: PlatformConfiguration,
    context: AdminPermissionContext = {},
  ): readonly AdminSection[] {
    const configurationSections = this.createConfigurationSections(configuration.navigation);

    const moduleSections = this.registry
      .list()
      .filter((module) => this.permissions.canViewModule(module, context, configuration))
      .flatMap((module) =>
        module.sections.filter((section) =>
          this.permissions.canViewSection(section, context, configuration),
        ),
      );

    const allSections = [...configurationSections, ...moduleSections]
      .filter((section) => this.permissions.canViewSection(section, context, configuration))
      .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title));

    const deduped = new Map<string, AdminSection>();
    for (const section of allSections) {
      deduped.set(`${section.id}:${section.href}`, section);
    }

    return Object.freeze([...deduped.values()]);
  }

  private createConfigurationSections(
    navigation: readonly NavigationConfiguration[],
  ): readonly AdminSection[] {
    return Object.freeze(
      navigation.map((item) => ({
        id: item.id,
        title: item.title,
        href: item.href,
        description: item.description,
        badge: item.badge,
        enabled: item.enabled,
        order: item.order,
        metadata: {
          id: item.id,
          title: item.title,
          description: item.description,
          category: 'configuration',
          order: item.order,
        },
      })),
    );
  }
}
