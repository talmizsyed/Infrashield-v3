import { describe, expect, it } from 'vitest';
import {
  createDefaultPlatformConfiguration,
  createPlatformConfigurationService,
  InMemoryConfigurationRepository,
  PlatformConfigurationService,
  validatePlatformConfiguration,
} from './index';

describe('platform configuration', () => {
  it('provides enabled navigation, widgets, providers, themes, and features', () => {
    const service = createPlatformConfigurationService();

    expect(service.getNavigation()).toHaveLength(12);
    expect(service.getWidgets().map((widget) => widget.id)).toContain('InfrastructureHealth');
    expect(service.getProviders().map((provider) => provider.id)).toEqual(
      expect.arrayContaining(['vmware', 'aws']),
    );
    expect(service.getThemes().map((theme) => theme.id)).toContain('corporate');
    expect(service.getFeatures()).toHaveLength(1);
  });

  it('rejects duplicate navigation paths', () => {
    const configuration = createDefaultPlatformConfiguration();
    configuration.navigation.push({ ...configuration.navigation[0]!, id: 'duplicate' });

    expect(() => validatePlatformConfiguration(configuration)).toThrow('duplicated');
  });

  it('bootstraps and persists default configuration when storage is empty', () => {
    const repository = new InMemoryConfigurationRepository();
    const service = new PlatformConfigurationService(repository);

    expect(service.getConfiguration()).toBeDefined();
    expect(repository.get()).toBeDefined();
    expect(service.getDashboard().widgets).not.toHaveLength(0);
    expect(service.getWidgets().map((widget) => widget.id)).toEqual(
      expect.arrayContaining(['InfrastructureHealth', 'KnowledgeGraph']),
    );
  });
});
