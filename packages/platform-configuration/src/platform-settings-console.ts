import { createPlatformConfigurationService, type PlatformConfigurationService } from './service';
import { type AdminFormSchema } from './admin-form-schema';
import type {
  FeatureFlagConfiguration,
  NavigationConfiguration,
  PlatformBrandingConfiguration,
  PlatformConfiguration,
  PlatformSettingsConfiguration,
  PlatformSystemSettingsConfiguration,
  ThemeMode,
} from './types';

export interface PlatformSettingsView extends PlatformSettingsConfiguration {
  activeTheme: ThemeMode;
}

export interface BrandingUpdateInput extends Partial<PlatformBrandingConfiguration> {}

export interface SystemSettingsUpdateInput extends Partial<PlatformSystemSettingsConfiguration> {}

export class PlatformSettingsConsole {
  private readonly configurationService: PlatformConfigurationService;

  public constructor(
    private readonly options: {
      configurationService?: PlatformConfigurationService;
    } = {},
  ) {
    this.configurationService =
      options.configurationService ?? createPlatformConfigurationService();
  }

  public getSettings(): PlatformSettingsView {
    const configuration = this.configuration();
    return {
      ...configuration.platformSettings,
      activeTheme: configuration.platformSettings.theme.id,
    };
  }

  public updateBranding(input: BrandingUpdateInput): PlatformSettingsView {
    const settings = this.configuration().platformSettings;
    settings.branding = {
      ...settings.branding,
      ...input,
    };
    return this.getSettings();
  }

  public setTheme(
    themeId: ThemeMode,
    overrides: { accentColor?: string; customCss?: string } = {},
  ): PlatformSettingsView {
    const settings = this.configuration().platformSettings;
    settings.theme = {
      id: themeId,
      accentColor: overrides.accentColor ?? settings.theme.accentColor,
      customCss: overrides.customCss ?? settings.theme.customCss,
    };
    return this.getSettings();
  }

  public updateNavigation(navigation: readonly NavigationConfiguration[]): PlatformSettingsView {
    const configuration = this.configuration();
    configuration.navigation = navigation.map((item) => ({ ...item }));
    configuration.platformSettings.navigation = navigation.map((item) => ({ ...item }));
    return this.getSettings();
  }

  public updateFeatureFlags(
    featureFlags: readonly FeatureFlagConfiguration[],
  ): PlatformSettingsView {
    const configuration = this.configuration();
    configuration.featureFlags = featureFlags.map((flag) => ({ ...flag }));
    configuration.platformSettings.featureFlags = featureFlags.map((flag) => ({ ...flag }));
    return this.getSettings();
  }

  public updateGlobalConfiguration(
    globalConfiguration: Readonly<Record<string, unknown>>,
  ): PlatformSettingsView {
    this.configuration().platformSettings.globalConfiguration = Object.freeze({
      ...globalConfiguration,
    });
    return this.getSettings();
  }

  public updateSystemSettings(input: SystemSettingsUpdateInput): PlatformSettingsView {
    const settings = this.configuration().platformSettings;
    settings.systemSettings = {
      ...settings.systemSettings,
      ...input,
    };
    return this.getSettings();
  }

  public describeFormSchema(): AdminFormSchema {
    return {
      id: 'platform-settings',
      title: 'Platform Settings',
      description: 'Manage branding, navigation, feature flags, and system settings.',
      sections: [
        {
          id: 'branding',
          title: 'Branding',
          fields: [
            { id: 'productName', label: 'Product Name', type: 'text', required: true },
            { id: 'applicationName', label: 'Application Name', type: 'text', required: true },
            { id: 'logoUrl', label: 'Logo URL', type: 'text' },
            { id: 'faviconUrl', label: 'Favicon URL', type: 'text' },
            { id: 'supportUrl', label: 'Support URL', type: 'text' },
          ],
        },
        {
          id: 'appearance',
          title: 'Appearance',
          fields: [
            { id: 'theme', label: 'Theme', type: 'select' },
            { id: 'accentColor', label: 'Accent Color', type: 'text' },
            { id: 'customCss', label: 'Custom CSS', type: 'textarea' },
          ],
        },
        {
          id: 'navigation',
          title: 'Navigation and Flags',
          fields: [
            { id: 'navigation', label: 'Navigation', type: 'json' },
            { id: 'featureFlags', label: 'Feature Flags', type: 'json' },
            { id: 'globalConfiguration', label: 'Global Configuration', type: 'json' },
            { id: 'systemSettings', label: 'System Settings', type: 'json' },
          ],
        },
      ],
    };
  }

  private configuration(): PlatformConfiguration {
    return this.configurationService.getConfiguration();
  }
}
