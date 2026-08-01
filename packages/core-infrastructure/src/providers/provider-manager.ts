import type { IProvider, IProviderRegistry } from './provider-types';
import { ProviderRegistry } from './provider-registry';
import { ProviderSnapshot } from './provider-types';

export class ProviderManager {
  private readonly registry: IProviderRegistry;

  public constructor(_options: { readonly host?: unknown } = {}) {
    this.registry = new ProviderRegistry();
  }

  public async register(provider: IProvider): Promise<void> {
    await this.registry.register(provider);
  }

  public async unregister(providerId: string): Promise<void> {
    await this.registry.unregister(providerId);
  }

  public snapshot(providerId: string): ProviderSnapshot | undefined {
    const provider = this.registry.get(providerId);
    return provider ? provider.snapshot() : undefined;
  }
}
