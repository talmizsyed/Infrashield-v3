import { describe, expect, it } from 'vitest';
import { getDashboardViewModel, getModulePageModel } from './dashboard-service';

describe('dashboard service layer', () => {
  it('returns a dashboard view model with reusable widgets', async () => {
    const result = await getDashboardViewModel();

    expect(result.summary.status).toBeDefined();
    expect(result.widgets.length).toBeGreaterThan(0);
    expect(result.widgets[0].id).toBeDefined();
  });

  it('returns module page scaffolding for each sidebar module', async () => {
    const result = await getModulePageModel('infrastructure');

    expect(result.title).toContain('Infrastructure');
    expect(result.sections.length).toBeGreaterThan(0);
  });
});
