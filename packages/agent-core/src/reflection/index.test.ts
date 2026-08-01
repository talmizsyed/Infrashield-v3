import { describe, expect, it } from 'vitest';
import {
  AdaptiveRecommendation,
  EscalationRecommendation,
  ReflectionCategory,
  ReflectionContext,
  ReflectionDecision,
  ReflectionEngine,
  ReflectionEvaluation,
  ReflectionEvidence,
  ReflectionHistory,
  ReflectionPolicy,
  ReflectionRecommendation,
  ReflectionRegistry,
  ReflectionReport,
  ReflectionRule,
  ReflectionSession,
  ReflectionStrategy,
  ReflectionSummary,
  ReflectionMetrics,
  RetryRecommendation,
} from './index';

describe('reflection framework', () => {
  it('evaluates execution and generates explainable recommendations', () => {
    const context = new ReflectionContext({
      id: 'ctx-1',
      name: 'incident-workflow',
      category: ReflectionCategory.Execution,
      artifacts: {
        goalCompletion: 0.6,
        executionQuality: 0.4,
        policyCompliance: 0.8,
        securityCompliance: 0.9,
        failureCauses: 1,
        retryCount: 1,
      },
    });

    const engine = new ReflectionEngine();
    const result = engine.reflect(context);

    expect(result.success).toBe(true);
    expect(result.report.summary.overallScore).toBeGreaterThan(0);
    expect(
      result.report.recommendations.some((item) => item.decision === ReflectionDecision.Escalate),
    ).toBe(true);
    expect(
      result.report.recommendations.some((item) => item.decision === ReflectionDecision.Retry),
    ).toBe(true);
  });

  it('supports custom strategies and history snapshots', () => {
    const customStrategy = new ReflectionStrategy([
      new ReflectionRule({
        id: 'tool-rule',
        category: ReflectionCategory.Tool,
        description: 'Scores tool usage',
        evaluator: () =>
          new ReflectionEvaluation({
            category: ReflectionCategory.Tool,
            score: 0.82,
            confidence: 0.78,
            explanation: 'Tool execution succeeded consistently.',
            evidence: [
              new ReflectionEvidence({
                id: 'tool-evidence',
                label: 'Tool success',
                score: 0.82,
                explanation: 'The tool completed without errors.',
              }),
            ],
          }),
      }),
    ]);
    const engine = new ReflectionEngine(new ReflectionPolicy({ maxRetries: 1 }), customStrategy);
    const report = engine.reflect(
      new ReflectionContext({
        id: 'ctx-2',
        name: 'tool-check',
        category: ReflectionCategory.Tool,
        artifacts: { goalCompletion: 0.95, executionQuality: 0.8 },
      }),
    ).report;

    const history = new ReflectionHistory();
    history.append(report);
    const snapshot = history.snapshot();

    expect(snapshot.recommendations).toHaveLength(report.recommendations.length);
    expect(snapshot.summary.overallScore).toBeGreaterThan(0);
  });

  it('maintains immutable snapshots and registry entries', () => {
    const report = new ReflectionReport({
      id: 'report-1',
      sessionId: 'session-1',
      context: new ReflectionContext({
        id: 'ctx-3',
        name: 'session',
        category: ReflectionCategory.Planning,
        artifacts: { goalCompletion: 0.7, executionQuality: 0.7 },
      }),
      summary: new ReflectionSummary({
        overallScore: 0.8,
        confidenceScore: 0.8,
        evidenceScore: 0.7,
        consistencyScore: 0.7,
        riskScore: 0.2,
        recommendationScore: 0.8,
        findingCount: 0,
        recommendationCount: 1,
      }),
      findings: [],
      recommendations: [
        new ReflectionRecommendation({
          id: 'rec-1',
          decision: ReflectionDecision.Continue,
          rationale: 'steady',
          score: 0.7,
          explanation: 'No changes needed.',
          category: ReflectionCategory.Planning,
        }),
      ],
      metrics: new ReflectionMetrics({
        durationMs: 12,
        evaluationLatencyMs: 8,
        confidenceDistribution: [0.8],
        retryFrequency: 0,
        escalationFrequency: 0,
        learningStatistics: { evaluations: 1, findings: 0 },
      }),
      createdAt: '2026-01-01T00:00:00.000Z',
    } as never);

    const snapshot = report.createSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true);

    const registry = new ReflectionRegistry();
    registry.register(report);
    expect(registry.get('report-1')).toBeDefined();

    const session = new ReflectionSession('session-1');
    session.addReport(report);
    expect(session.getReports()).toHaveLength(1);
  });

  it('supports adaptive recommendation helpers', () => {
    const retry = new RetryRecommendation({
      id: 'retry-1',
      decision: ReflectionDecision.Retry,
      rationale: 'Retry after transient issue',
      score: 0.95,
    });
    const escalate = new EscalationRecommendation({
      id: 'escalate-1',
      decision: ReflectionDecision.Escalate,
      rationale: 'Escalation required',
      score: 0.9,
    });
    const adaptive = new AdaptiveRecommendation({
      id: 'adaptive-1',
      decision: ReflectionDecision.Replan,
      rationale: 'Replan to improve outcomes',
      score: 0.88,
    });

    expect(retry.decision).toBe(ReflectionDecision.Retry);
    expect(escalate.decision).toBe(ReflectionDecision.Escalate);
    expect(adaptive.score).toBeGreaterThan(0.8);
  });
});
