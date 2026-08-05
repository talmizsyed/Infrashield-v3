import type { PlatformConfiguration } from './types';

export interface ConfigurationRepository {
  get(): PlatformConfiguration;
  save(configuration: PlatformConfiguration): void;
}

export class InMemoryConfigurationRepository implements ConfigurationRepository {
  private configuration: PlatformConfiguration;

  public constructor(initialConfiguration: PlatformConfiguration) {
    this.configuration = initialConfiguration;
  }

  public get(): PlatformConfiguration {
    return this.configuration;
  }

  public save(configuration: PlatformConfiguration): void {
    this.configuration = configuration;
  }
}
