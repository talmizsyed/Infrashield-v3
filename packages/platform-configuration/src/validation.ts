import type { PlatformConfiguration } from './types';

export function validatePlatformConfiguration(configuration: PlatformConfiguration): void {
  const navigationIds = new Set<string>();
  const navigationHrefs = new Set<string>();

  for (const item of configuration.navigation) {
    if (!item.href.startsWith('/')) {
      throw new Error(`Navigation item ${item.id} must have an absolute application path.`);
    }
    if (navigationIds.has(item.id) || navigationHrefs.has(item.href)) {
      throw new Error(`Navigation item ${item.id} is duplicated.`);
    }
    navigationIds.add(item.id);
    navigationHrefs.add(item.href);
  }

  const widgetIds = new Set<string>();
  for (const widget of configuration.widgets) {
    if (widgetIds.has(widget.id)) {
      throw new Error(`Widget ${widget.id} is duplicated.`);
    }
    widgetIds.add(widget.id);
  }

  if (configuration.dashboard.widgets.length === 0) {
    throw new Error('Dashboard configuration must include at least one widget.');
  }
}
