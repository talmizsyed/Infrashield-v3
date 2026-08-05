import type { PlatformConfiguration } from './types';

export interface ConfigurationRepository {
  get(): PlatformConfiguration | undefined;
  save(configuration: PlatformConfiguration): void;
}

export class InMemoryConfigurationRepository implements ConfigurationRepository {
  private configuration: PlatformConfiguration | undefined;

  public constructor(initialConfiguration?: PlatformConfiguration) {
    this.configuration = initialConfiguration;
  }

  public get(): PlatformConfiguration | undefined {
    return this.configuration;
  }

  public save(configuration: PlatformConfiguration): void {
    this.configuration = configuration;
  }
}
