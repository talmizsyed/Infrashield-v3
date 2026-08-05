import type { DashboardWidgetConfiguration, ProviderConfiguration } from './types';

export class WidgetRegistry {
  private readonly widgets = new Map<string, DashboardWidgetConfiguration>();

  public register(widget: DashboardWidgetConfiguration): void {
    this.widgets.set(widget.id, widget);
  }

  public get(widgetId: string): DashboardWidgetConfiguration | undefined {
    return this.widgets.get(widgetId);
  }

  public list(): DashboardWidgetConfiguration[] {
    return [...this.widgets.values()].sort((left, right) => left.order - right.order);
  }
}

export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderConfiguration>();

  public register(provider: ProviderConfiguration): void {
    this.providers.set(provider.id, provider);
  }

  public get(providerId: string): ProviderConfiguration | undefined {
    return this.providers.get(providerId);
  }

  public list(): ProviderConfiguration[] {
    return [...this.providers.values()];
  }
}
