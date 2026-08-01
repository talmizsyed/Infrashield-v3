import type { IProvider, IProviderFactory, ProviderMetadata } from './provider-types';

export class ProviderFactory implements IProviderFactory {
  private readonly registeredProviders = new Map<string, IProvider>();

  public async create<TProvider extends IProvider>(
    descriptor: ProviderMetadata,
  ): Promise<TProvider> {
    const existing = this.registeredProviders.get(descriptor.id);
    if (existing) {
      return existing as TProvider;
    }

    throw new Error(`Provider ${descriptor.id} is not registered.`);
  }

  public async registerProvider(provider: IProvider): Promise<void> {
    this.registeredProviders.set(provider.metadata.id, provider);
  }
}
