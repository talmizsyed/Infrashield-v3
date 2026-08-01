import type { SerializableObject } from '../primitives';

export class ProviderContext {
  public constructor(
    public readonly providerId: string,
    public readonly metadata: SerializableObject = {},
  ) {}
}
