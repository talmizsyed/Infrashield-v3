export interface ConfigurationCache<TValue> {
  get(): TValue | undefined;
  set(value: TValue): void;
  clear(): void;
}

export class InMemoryConfigurationCache<TValue> implements ConfigurationCache<TValue> {
  private value: TValue | undefined;

  public get(): TValue | undefined {
    return this.value;
  }

  public set(value: TValue): void {
    this.value = value;
  }

  public clear(): void {
    this.value = undefined;
  }
}
