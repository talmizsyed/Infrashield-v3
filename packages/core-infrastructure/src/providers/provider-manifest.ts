import type { ProviderVersion } from './provider-types';

export class ProviderManifest {
  public constructor(options: {
    readonly id: string;
    readonly name: string;
    readonly version: ProviderVersion;
    readonly capabilities: readonly string[];
    readonly dependencies?: readonly { readonly name: string; readonly version?: string }[];
  }) {
    this.id = options.id;
    this.name = options.name;
    this.version = options.version;
    this.capabilities = Object.freeze([...options.capabilities]);
    this.dependencies = Object.freeze([
      ...(options.dependencies ?? []).map((dependency) => ({ ...dependency })),
    ]) as readonly { readonly name: string; readonly version?: string }[];
  }

  public readonly id: string;
  public readonly name: string;
  public readonly version: ProviderVersion;
  public readonly capabilities: readonly string[];
  public readonly dependencies: readonly { readonly name: string; readonly version?: string }[];
}
