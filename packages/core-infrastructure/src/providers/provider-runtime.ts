import type { IProvider, IProviderHost, ProviderDeploymentOptions } from './provider-types';

export class ProviderRuntime {
  public constructor(private readonly host: IProviderHost) {}

  public async deploy(provider: IProvider, _options: ProviderDeploymentOptions): Promise<void> {
    await this.host.register(provider);
    await provider.initialize();
    await provider.start();
  }

  public async destroy(providerId: string): Promise<void> {
    await this.host.unregister(providerId);
  }
}
