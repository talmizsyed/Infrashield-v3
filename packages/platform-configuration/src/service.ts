import { InMemoryConfigurationCache, type ConfigurationCache } from './cache';
import { createDefaultPlatformConfiguration } from './default-configuration';
import { ProviderRegistry, WidgetRegistry } from './registry';
import { InMemoryConfigurationRepository, type ConfigurationRepository } from './repository';
import type {
  DashboardConfiguration,
  DashboardWidgetConfiguration,
  FeatureFlagConfiguration,
  NavigationConfiguration,
  PlatformConfiguration,
  ProviderConfiguration,
  ThemeConfiguration,
} from './types';
import { validatePlatformConfiguration } from './validation';

export class PlatformConfigurationService {
  public readonly widgetRegistry: WidgetRegistry;
  public readonly providerRegistry: ProviderRegistry;

  public constructor(
    private readonly repository: ConfigurationRepository,
    private readonly cache: ConfigurationCache<PlatformConfiguration> = new InMemoryConfigurationCache<PlatformConfiguration>(),
  ) {
    const configuration = this.getOrBootstrapConfiguration();
    this.cache.set(configuration);
    this.widgetRegistry = new WidgetRegistry();
    this.providerRegistry = new ProviderRegistry();
    for (const widget of createDefaultPlatformConfiguration().widgets) {
      this.widgetRegistry.register(widget);
    }
    for (const widget of configuration.widgets) this.widgetRegistry.register(widget);
    for (const provider of configuration.providers) this.providerRegistry.register(provider);
  }

  public getConfiguration(): PlatformConfiguration {
    const cached = this.cache.get();
    if (cached) return cached;
    const configuration = this.getOrBootstrapConfiguration();
    this.cache.set(configuration);
    return configuration;
  }

  public getDashboard(): DashboardConfiguration {
    return this.getConfiguration().dashboard;
  }

  public getNavigation(): NavigationConfiguration[] {
    return this.getConfiguration()
      .navigation.filter((item) => item.enabled)
      .sort((left, right) => left.order - right.order);
  }

  public getWidgets(): DashboardWidgetConfiguration[] {
    return this.widgetRegistry.list().filter((widget) => widget.enabled);
  }

  public getProviders(): ProviderConfiguration[] {
    return this.providerRegistry.list().filter((provider) => provider.enabled);
  }

  public getThemes(): ThemeConfiguration[] {
    return this.getConfiguration().themes.filter((theme) => theme.enabled);
  }

  public getFeatures(): FeatureFlagConfiguration[] {
    return this.getConfiguration().featureFlags;
  }

  private getOrBootstrapConfiguration(): PlatformConfiguration {
    const storedConfiguration = this.repository.get();
    if (!storedConfiguration) {
      const defaultConfiguration = createDefaultPlatformConfiguration();
      this.repository.save(defaultConfiguration);
      return defaultConfiguration;
    }

    const defaultWidgets = createDefaultPlatformConfiguration().widgets;
    const widgets =
      storedConfiguration.widgets.length > 0 ? storedConfiguration.widgets : defaultWidgets;
    const dashboardWidgets =
      storedConfiguration.dashboard.widgets.length > 0
        ? storedConfiguration.dashboard.widgets
        : widgets;
    const configuration =
      widgets === storedConfiguration.widgets &&
      dashboardWidgets === storedConfiguration.dashboard.widgets
        ? storedConfiguration
        : {
            ...storedConfiguration,
            dashboard: { ...storedConfiguration.dashboard, widgets: dashboardWidgets },
            widgets,
          };

    validatePlatformConfiguration(configuration);
    if (configuration !== storedConfiguration) this.repository.save(configuration);
    return configuration;
  }
}

export function createPlatformConfigurationService(): PlatformConfigurationService {
  return new PlatformConfigurationService(
    new InMemoryConfigurationRepository(createDefaultPlatformConfiguration()),
  );
}
