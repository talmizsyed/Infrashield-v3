import { describe, expect, it } from 'vitest';
import {
  ProviderCertificationRunner,
  ProviderCertificationSuite,
  type ProviderCertificationTarget,
} from './certification';
import { PROVIDER_CERTIFICATION_TARGETS } from './provider-targets';

describe('provider certification suite', () => {
  it('certifies all required provider targets', async () => {
    const suite = new ProviderCertificationSuite();

    const results = await Promise.all(
      PROVIDER_CERTIFICATION_TARGETS.map((target) => suite.certifyTarget(target)),
    );

    expect(results).toHaveLength(12);
    expect(results.every((result) => result.passed)).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-mock')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-vmware')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-openshift')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-oracle')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-linux')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-windows')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-kubernetes')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-network')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-storage')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-cloud')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-monitoring')).toBe(true);
    expect(results.some((result) => result.providerId === 'provider-itsm')).toBe(true);
  });

  it('produces compliance report with capability matrix and summary', async () => {
    const runner = new ProviderCertificationRunner();
    const report = await runner.run(PROVIDER_CERTIFICATION_TARGETS);

    expect(report.providerCount).toBe(12);
    expect(report.passCount).toBe(12);
    expect(report.failCount).toBe(0);
    expect(report.results).toHaveLength(12);
    expect(report.capabilityMatrix).toHaveLength(12);
    expect(report.certificationSummary).toContain('12/12');
    expect(report.results.every((result) => result.passed)).toBe(true);
  });

  it('marks target non-compliant when probes fail', async () => {
    const failingTarget: ProviderCertificationTarget = {
      ...PROVIDER_CERTIFICATION_TARGETS[0],
      id: 'provider-failing-test-double',
      displayName: 'Failing Test Double Provider',
      probes: {
        ...PROVIDER_CERTIFICATION_TARGETS[0].probes,
        invokeInventoryDiscovery: async () => {
          throw new Error('forced inventory failure');
        },
      },
    };

    const suite = new ProviderCertificationSuite();
    const result = await suite.certifyTarget(failingTarget);

    expect(result.passed).toBe(false);
    expect(result.moduleResults.quality).toBe(false);
    expect(result.checks.some((check) => check.passed === false)).toBe(true);
  });
});
