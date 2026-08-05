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
    const configuration = repository.get();
    validatePlatformConfiguration(configuration);
    this.widgetRegistry = new WidgetRegistry();
    this.providerRegistry = new ProviderRegistry();
    for (const widget of configuration.widgets) this.widgetRegistry.register(widget);
    for (const provider of configuration.providers) this.providerRegistry.register(provider);
  }

  public getConfiguration(): PlatformConfiguration {
    const cached = this.cache.get();
    if (cached) return cached;
    const configuration = this.repository.get();
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
}

export function createPlatformConfigurationService(): PlatformConfigurationService {
  return new PlatformConfigurationService(
    new InMemoryConfigurationRepository(createDefaultPlatformConfiguration()),
  );
}
