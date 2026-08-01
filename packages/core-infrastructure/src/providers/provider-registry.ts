import type { IProvider, IProviderRegistry } from './provider-types';

export class ProviderRegistry implements IProviderRegistry {
  private readonly providers = new Map<string, IProvider>();

  public async register(provider: IProvider): Promise<void> {
    this.providers.set(provider.metadata.id, provider);
  }

  public async unregister(providerId: string): Promise<void> {
    this.providers.delete(providerId);
  }

  public get(providerId: string): IProvider | undefined {
    return this.providers.get(providerId);
  }

  public list(): readonly IProvider[] {
    return [...this.providers.values()];
  }
}
