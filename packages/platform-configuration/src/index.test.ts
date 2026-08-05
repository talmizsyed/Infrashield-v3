import { describe, expect, it } from 'vitest';
import {
  createDefaultPlatformConfiguration,
  createPlatformConfigurationService,
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
});
