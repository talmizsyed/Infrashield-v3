import type {
  Identifier,
  SerializableValue,
  SerializableValueObject,
} from '@infrashield/contracts';

export enum ReflectionCategory {
  Execution = 'execution',
  Goal = 'goal',
  Workflow = 'workflow',
  Tool = 'tool',
  Agent = 'agent',
  Collaboration = 'collaboration',
  Planning = 'planning',
  Security = 'security',
}

export enum ReflectionDecision {
  Retry = 'retry',
  Continue = 'continue',
  Escalate = 'escalate',
  Delegate = 'delegate',
  Terminate = 'terminate',
  Replan = 'replan',
  RequestHumanApproval = 'request-human-approval',
  Archive = 'archive',
}

export interface IReflectionEngine {
  reflect(context: ReflectionContext): ReflectionResult;
}

export interface IReflectionStrategy {
  evaluate(context: ReflectionContext): readonly ReflectionEvaluation[];
}

export interface IReflectionEvaluator {
  evaluate(context: ReflectionContext): ReflectionEvaluation;
}

export interface IReflectionPolicy {
  readonly id: Identifier;
  readonly name: string;
  readonly maxRetries: number;
  readonly escalationThreshold: number;
  readonly confidenceThreshold: number;
  readonly riskThreshold: number;
  readonly allowAutoRetry: boolean;
  readonly requireHumanApproval: boolean;
}

export interface IReflectionHistory {
  append(report: ReflectionReport): void;
  list(): readonly ReflectionReport[];
  snapshot(): ReflectionSnapshot;
}

export interface IReflectionRegistry {
  register(report: ReflectionReport): void;
  get(reportId: Identifier): ReflectionReport | undefined;
  list(): readonly ReflectionReport[];
}

export class ReflectionPolicy implements IReflectionPolicy {
  public constructor(
    options: {
      readonly id?: Identifier;
      readonly name?: string;
      readonly maxRetries?: number;
      readonly escalationThreshold?: number;
      readonly confidenceThreshold?: number;
      readonly riskThreshold?: number;
      readonly allowAutoRetry?: boolean;
      readonly requireHumanApproval?: boolean;
    } = {},
  ) {
    this.id = options.id ?? 'policy-default';
    this.name = options.name ?? 'default';
    this.maxRetries = options.maxRetries ?? 2;
    this.escalationThreshold = options.escalationThreshold ?? 0.7;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.55;
    this.riskThreshold = options.riskThreshold ?? 0.6;
    this.allowAutoRetry = options.allowAutoRetry ?? true;
    this.requireHumanApproval = options.requireHumanApproval ?? false;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly maxRetries: number;
  public readonly escalationThreshold: number;
  public readonly confidenceThreshold: number;
  public readonly riskThreshold: number;
  public readonly allowAutoRetry: boolean;
  public readonly requireHumanApproval: boolean;
}

export class ReflectionObservation {
  public constructor(options: {
    readonly category: ReflectionCategory;
    readonly summary: string;
    readonly detail?: string;
    readonly severity?: 'info' | 'warning' | 'critical';
    readonly metadata?: SerializableValueObject;
  }) {
    this.category = options.category;
    this.summary = options.summary;
    this.detail = options.detail;
    this.severity = options.severity ?? 'info';
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly category: ReflectionCategory;
  public readonly summary: string;
  public readonly detail?: string;
  public readonly severity: 'info' | 'warning' | 'critical';
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ReflectionEvidence {
  public constructor(options: {
    readonly id: Identifier;
    readonly label: string;
    readonly score: number;
    readonly explanation: string;
  }) {
    this.id = options.id;
    this.label = options.label;
    this.score = Math.max(0, Math.min(1, options.score));
    this.explanation = options.explanation;
  }

  public readonly id: Identifier;
  public readonly label: string;
  public readonly score: number;
  public readonly explanation: string;
}

export class ReflectionScore {
  public constructor(options: {
    readonly confidence: number;
    readonly evidence: number;
    readonly consistency: number;
    readonly risk: number;
    readonly recommendation: number;
  }) {
    this.confidence = Math.max(0, Math.min(1, options.confidence));
    this.evidence = Math.max(0, Math.min(1, options.evidence));
    this.consistency = Math.max(0, Math.min(1, options.consistency));
    this.risk = Math.max(0, Math.min(1, options.risk));
    this.recommendation = Math.max(0, Math.min(1, options.recommendation));
  }

  public readonly confidence: number;
  public readonly evidence: number;
  public readonly consistency: number;
  public readonly risk: number;
  public readonly recommendation: number;
}

export class ReflectionEvaluation {
  public constructor(options: {
    readonly category: ReflectionCategory;
    readonly score: number;
    readonly confidence: number;
    readonly explanation: string;
    readonly evidence?: readonly ReflectionEvidence[];
  }) {
    this.category = options.category;
    this.score = Math.max(0, Math.min(1, options.score));
    this.confidence = Math.max(0, Math.min(1, options.confidence));
    this.explanation = options.explanation;
    this.evidence = options.evidence ? [...options.evidence] : [];
  }

  public readonly category: ReflectionCategory;
  public readonly score: number;
  public readonly confidence: number;
  public readonly explanation: string;
  public readonly evidence: readonly ReflectionEvidence[];
}

export class ReflectionFinding {
  public constructor(options: {
    readonly category: ReflectionCategory;
    readonly summary: string;
    readonly severity: 'info' | 'warning' | 'critical';
    readonly evidence: readonly ReflectionEvidence[];
  }) {
    this.category = options.category;
    this.summary = options.summary;
    this.severity = options.severity;
    this.evidence = [...options.evidence];
  }

  public readonly category: ReflectionCategory;
  public readonly summary: string;
  public readonly severity: 'info' | 'warning' | 'critical';
  public readonly evidence: readonly ReflectionEvidence[];
}

export class ReflectionRecommendation {
  public constructor(options: {
    readonly id: Identifier;
    readonly decision: ReflectionDecision;
    readonly rationale: string;
    readonly score: number;
    readonly explanation: string;
    readonly category: ReflectionCategory;
  }) {
    this.id = options.id;
    this.decision = options.decision;
    this.rationale = options.rationale;
    this.score = Math.max(0, Math.min(1, options.score));
    this.explanation = options.explanation;
    this.category = options.category;
  }

  public readonly id: Identifier;
  public readonly decision: ReflectionDecision;
  public readonly rationale: string;
  public readonly score: number;
  public readonly explanation: string;
  public readonly category: ReflectionCategory;
}

export class ReflectionDecisionRecord {
  public constructor(options: {
    readonly decision: ReflectionDecision;
    readonly rationale: string;
    readonly score: number;
  }) {
    this.decision = options.decision;
    this.rationale = options.rationale;
    this.score = Math.max(0, Math.min(1, options.score));
  }

  public readonly decision: ReflectionDecision;
  public readonly rationale: string;
  public readonly score: number;
}

export class ReflectionContext {
  public constructor(options: {
    readonly id: Identifier;
    readonly name: string;
    readonly category: ReflectionCategory;
    readonly artifacts: Readonly<Record<string, SerializableValue>>;
    readonly observations?: readonly ReflectionObservation[];
    readonly policy?: ReflectionPolicy;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.name = options.name;
    this.category = options.category;
    this.artifacts = Object.freeze({ ...options.artifacts });
    this.observations = options.observations ? [...options.observations] : [];
    this.policy = options.policy ?? new ReflectionPolicy();
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly name: string;
  public readonly category: ReflectionCategory;
  public readonly artifacts: Readonly<Record<string, SerializableValue>>;
  public readonly observations: readonly ReflectionObservation[];
  public readonly policy: ReflectionPolicy;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class ReflectionMetrics {
  public constructor(options: {
    readonly durationMs: number;
    readonly evaluationLatencyMs: number;
    readonly confidenceDistribution: readonly number[];
    readonly retryFrequency: number;
    readonly escalationFrequency: number;
    readonly learningStatistics: Readonly<Record<string, number>>;
  }) {
    this.durationMs = options.durationMs;
    this.evaluationLatencyMs = options.evaluationLatencyMs;
    this.confidenceDistribution = [...options.confidenceDistribution];
    this.retryFrequency = options.retryFrequency;
    this.escalationFrequency = options.escalationFrequency;
    this.learningStatistics = Object.freeze({ ...options.learningStatistics });
  }

  public readonly durationMs: number;
  public readonly evaluationLatencyMs: number;
  public readonly confidenceDistribution: readonly number[];
  public readonly retryFrequency: number;
  public readonly escalationFrequency: number;
  public readonly learningStatistics: Readonly<Record<string, number>>;
}

export class ReflectionSummary {
  public constructor(options: {
    readonly overallScore: number;
    readonly confidenceScore: number;
    readonly evidenceScore: number;
    readonly consistencyScore: number;
    readonly riskScore: number;
    readonly recommendationScore: number;
    readonly findingCount: number;
    readonly recommendationCount: number;
  }) {
    this.overallScore = Math.max(0, Math.min(1, options.overallScore));
    this.confidenceScore = Math.max(0, Math.min(1, options.confidenceScore));
    this.evidenceScore = Math.max(0, Math.min(1, options.evidenceScore));
    this.consistencyScore = Math.max(0, Math.min(1, options.consistencyScore));
    this.riskScore = Math.max(0, Math.min(1, options.riskScore));
    this.recommendationScore = Math.max(0, Math.min(1, options.recommendationScore));
    this.findingCount = options.findingCount;
    this.recommendationCount = options.recommendationCount;
  }

  public readonly overallScore: number;
  public readonly confidenceScore: number;
  public readonly evidenceScore: number;
  public readonly consistencyScore: number;
  public readonly riskScore: number;
  public readonly recommendationScore: number;
  public readonly findingCount: number;
  public readonly recommendationCount: number;
}

export class ReflectionResult {
  public constructor(options: {
    readonly report: ReflectionReport;
    readonly success: boolean;
    readonly message?: string;
  }) {
    this.report = options.report;
    this.success = options.success;
    this.message = options.message;
  }

  public readonly report: ReflectionReport;
  public readonly success: boolean;
  public readonly message?: string;
}

export class ReflectionReport {
  public constructor(options: {
    readonly id: Identifier;
    readonly sessionId: Identifier;
    readonly context: ReflectionContext;
    readonly summary: ReflectionSummary;
    readonly scores: ReflectionScore;
    readonly findings: readonly ReflectionFinding[];
    readonly recommendations: readonly ReflectionRecommendation[];
    readonly metrics: ReflectionMetrics;
    readonly createdAt: string;
    readonly decision?: ReflectionDecisionRecord;
  }) {
    this.id = options.id;
    this.sessionId = options.sessionId;
    this.context = options.context;
    this.summary = options.summary;
    this.scores = options.scores;
    this.findings = [...options.findings];
    this.recommendations = [...options.recommendations];
    this.metrics = options.metrics;
    this.createdAt = options.createdAt;
    this.decision = options.decision;
    Object.freeze(this);
  }

  public readonly id: Identifier;
  public readonly sessionId: Identifier;
  public readonly context: ReflectionContext;
  public readonly summary: ReflectionSummary;
  public readonly scores: ReflectionScore;
  public readonly findings: readonly ReflectionFinding[];
  public readonly recommendations: readonly ReflectionRecommendation[];
  public readonly metrics: ReflectionMetrics;
  public readonly createdAt: string;
  public readonly decision?: ReflectionDecisionRecord;

  public createSnapshot(): ReflectionSnapshot {
    return new ReflectionSnapshot({
      id: this.id,
      sessionId: this.sessionId,
      summary: this.summary,
      scores: this.scores,
      findings: this.findings,
      recommendations: this.recommendations,
      createdAt: this.createdAt,
    });
  }
}

export class ReflectionSnapshot {
  public constructor(options: {
    readonly id: Identifier;
    readonly sessionId: Identifier;
    readonly summary: ReflectionSummary;
    readonly scores: ReflectionScore;
    readonly findings: readonly ReflectionFinding[];
    readonly recommendations: readonly ReflectionRecommendation[];
    readonly createdAt: string;
  }) {
    this.id = options.id;
    this.sessionId = options.sessionId;
    this.summary = options.summary;
    this.scores = options.scores;
    this.findings = [...options.findings];
    this.recommendations = [...options.recommendations];
    this.createdAt = options.createdAt;
    Object.freeze(this);
  }

  public readonly id: Identifier;
  public readonly sessionId: Identifier;
  public readonly summary: ReflectionSummary;
  public readonly scores: ReflectionScore;
  public readonly findings: readonly ReflectionFinding[];
  public readonly recommendations: readonly ReflectionRecommendation[];
  public readonly createdAt: string;
}

export class ReflectionSession {
  private readonly reports: ReflectionReport[] = [];

  public constructor(readonly id: Identifier = `reflection-session-${Date.now()}`) {}

  public addReport(report: ReflectionReport): void {
    this.reports.push(report);
  }

  public getReports(): readonly ReflectionReport[] {
    return [...this.reports];
  }
}

export class ReflectionStrategy implements IReflectionStrategy {
  public constructor(private readonly rules: readonly ReflectionRule[]) {}

  public evaluate(context: ReflectionContext): readonly ReflectionEvaluation[] {
    return this.rules.map((rule) => rule.evaluate(context));
  }
}

export class ReflectionRule {
  public constructor(options: {
    readonly id: Identifier;
    readonly category: ReflectionCategory;
    readonly description: string;
    readonly evaluator: (context: ReflectionContext) => ReflectionEvaluation;
  }) {
    this.id = options.id;
    this.category = options.category;
    this.description = options.description;
    this.evaluator = options.evaluator;
  }

  public readonly id: Identifier;
  public readonly category: ReflectionCategory;
  public readonly description: string;
  public readonly evaluator: (context: ReflectionContext) => ReflectionEvaluation;

  public evaluate(context: ReflectionContext): ReflectionEvaluation {
    return this.evaluator(context);
  }
}

export class ReflectionHistory implements IReflectionHistory {
  private readonly reports: ReflectionReport[] = [];

  public append(report: ReflectionReport): void {
    this.reports.push(report);
  }

  public list(): readonly ReflectionReport[] {
    return [...this.reports];
  }

  public snapshot(): ReflectionSnapshot {
    const latest = this.reports[this.reports.length - 1];
    return (
      latest?.createSnapshot() ??
      new ReflectionSnapshot({
        id: 'empty',
        sessionId: 'empty',
        summary: new ReflectionSummary({
          overallScore: 0,
          confidenceScore: 0,
          evidenceScore: 0,
          consistencyScore: 0,
          riskScore: 0,
          recommendationScore: 0,
          findingCount: 0,
          recommendationCount: 0,
        }),
        scores: new ReflectionScore({
          confidence: 0,
          evidence: 0,
          consistency: 0,
          risk: 0,
          recommendation: 0,
        }),
        findings: [],
        recommendations: [],
        createdAt: new Date().toISOString(),
      })
    );
  }
}

export class ReflectionRegistry implements IReflectionRegistry {
  private readonly reports = new Map<Identifier, ReflectionReport>();

  public register(report: ReflectionReport): void {
    this.reports.set(report.id, report);
  }

  public get(reportId: Identifier): ReflectionReport | undefined {
    return this.reports.get(reportId);
  }

  public list(): readonly ReflectionReport[] {
    return [...this.reports.values()];
  }
}

export class ReflectionEngine implements IReflectionEngine {
  public constructor(
    private readonly policy: ReflectionPolicy = new ReflectionPolicy(),
    private readonly strategy: IReflectionStrategy = new ReflectionStrategy([
      new ReflectionRule({
        id: 'default-goal',
        category: ReflectionCategory.Goal,
        description: 'Evaluates goal completion and quality',
        evaluator: (context) => {
          const completion = Number(context.artifacts.goalCompletion ?? 0.5);
          const quality = Number(context.artifacts.executionQuality ?? 0.5);
          const score = (completion + quality) / 2;
          const evidenceScore = score;
          return new ReflectionEvaluation({
            category: ReflectionCategory.Goal,
            score,
            confidence: evidenceScore,
            explanation: 'Evaluated goal completion and execution quality.',
            evidence: [
              new ReflectionEvidence({
                id: 'goal-completion',
                label: 'Goal completion',
                score: completion,
                explanation: 'Measures how close the objective is to completion.',
              }),
            ],
          });
        },
      }),
      new ReflectionRule({
        id: 'default-security',
        category: ReflectionCategory.Security,
        description: 'Evaluates policy and security posture',
        evaluator: (context) => {
          const policyCompliance = Number(context.artifacts.policyCompliance ?? 1);
          const securityCompliance = Number(context.artifacts.securityCompliance ?? 1);
          const score = (policyCompliance + securityCompliance) / 2;
          return new ReflectionEvaluation({
            category: ReflectionCategory.Security,
            score,
            confidence: score,
            explanation: 'Evaluated policy and security compliance.',
          });
        },
      }),
    ]),
  ) {}

  public reflect(context: ReflectionContext): ReflectionResult {
    const evaluations = this.strategy.evaluate(context);
    const averageScore =
      evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0) / evaluations.length;
    const worstScore = evaluations.reduce(
      (lowest, evaluation) => Math.min(lowest, evaluation.score),
      1,
    );
    const averageConfidence =
      evaluations.reduce((sum, evaluation) => sum + evaluation.confidence, 0) / evaluations.length;
    const evidenceScore =
      evaluations.reduce(
        (sum, evaluation) =>
          sum +
          evaluation.evidence.reduce((innerSum, evidence) => innerSum + evidence.score, 0) /
            Math.max(1, evaluation.evidence.length),
        0,
      ) / evaluations.length;
    const riskScore = Math.max(0, 1 - averageScore);
    const consistencyScore = 1 - Math.abs(averageScore - averageConfidence);
    const recommendationScore = 1 - riskScore;
    const findingCount = evaluations.length;

    const findings = evaluations.map(
      (evaluation) =>
        new ReflectionFinding({
          category: evaluation.category,
          summary: evaluation.explanation,
          severity:
            evaluation.score < 0.4 ? 'critical' : evaluation.score < 0.7 ? 'warning' : 'info',
          evidence: evaluation.evidence,
        }),
    );

    const recommendations = this.createRecommendations(
      context,
      worstScore,
      averageConfidence,
      riskScore,
    );
    const summary = new ReflectionSummary({
      overallScore: averageScore,
      confidenceScore: averageConfidence,
      evidenceScore,
      consistencyScore,
      riskScore,
      recommendationScore,
      findingCount,
      recommendationCount: recommendations.length,
    });
    const metrics = new ReflectionMetrics({
      durationMs: 12,
      evaluationLatencyMs: 8,
      confidenceDistribution: [averageConfidence],
      retryFrequency: recommendations.filter((item) => item.decision === ReflectionDecision.Retry)
        .length,
      escalationFrequency: recommendations.filter(
        (item) => item.decision === ReflectionDecision.Escalate,
      ).length,
      learningStatistics: {
        evaluations: evaluations.length,
        findings: findings.length,
      },
    });
    const decision = this.createDecision(
      context,
      worstScore,
      averageConfidence,
      riskScore,
      recommendations,
    );
    const report = new ReflectionReport({
      id: `${context.id}-report`,
      sessionId: `${context.id}-session`,
      context,
      summary,
      scores: new ReflectionScore({
        confidence: averageConfidence,
        evidence: evidenceScore,
        consistency: consistencyScore,
        risk: riskScore,
        recommendation: recommendationScore,
      }),
      findings,
      recommendations,
      metrics,
      createdAt: new Date().toISOString(),
      decision,
    });
    return new ReflectionResult({ report, success: true, message: 'Reflection completed.' });
  }

  private createRecommendations(
    context: ReflectionContext,
    score: number,
    confidence: number,
    risk: number,
  ): ReflectionRecommendation[] {
    const recommendations: ReflectionRecommendation[] = [];
    const failureCauses = Number(context.artifacts.failureCauses ?? 0);
    const retries = Number(context.artifacts.retryCount ?? 0);

    if (score < this.policy.confidenceThreshold) {
      recommendations.push(
        new ReflectionRecommendation({
          id: `${context.id}-retry`,
          decision: ReflectionDecision.Retry,
          rationale: 'The execution quality was below threshold and merits a retry.',
          score: Math.max(0, 1 - score),
          explanation:
            'A retry is recommended when the observed outcome was weak and may improve with a second pass.',
          category: context.category,
        }),
      );
    }

    if (risk >= this.policy.riskThreshold || failureCauses > 0) {
      recommendations.push(
        new ReflectionRecommendation({
          id: `${context.id}-escalate`,
          decision: ReflectionDecision.Escalate,
          rationale: 'The execution surfaced significant risk or failure evidence.',
          score: risk,
          explanation:
            'Escalation is recommended when the evidence indicates substantial risk or repeated failures.',
          category: context.category,
        }),
      );
    }

    if (confidence < this.policy.confidenceThreshold) {
      recommendations.push(
        new ReflectionRecommendation({
          id: `${context.id}-human-approval`,
          decision: ReflectionDecision.RequestHumanApproval,
          rationale: 'Confidence was below the acceptable threshold.',
          score: 1 - confidence,
          explanation: 'Human approval is recommended when confidence is weak.',
          category: context.category,
        }),
      );
    }

    if (retries >= this.policy.maxRetries) {
      recommendations.push(
        new ReflectionRecommendation({
          id: `${context.id}-replan`,
          decision: ReflectionDecision.Replan,
          rationale: 'Repeated retries suggest the plan should be revised.',
          score: 0.9,
          explanation: 'A replan is appropriate after repeated retries fail to improve the result.',
          category: context.category,
        }),
      );
    }

    return recommendations;
  }

  private createDecision(
    context: ReflectionContext,
    score: number,
    confidence: number,
    risk: number,
    recommendations: readonly ReflectionRecommendation[],
  ): ReflectionDecisionRecord | undefined {
    if (
      recommendations.some(
        (recommendation) => recommendation.decision === ReflectionDecision.Escalate,
      )
    ) {
      return new ReflectionDecisionRecord({
        decision: ReflectionDecision.Escalate,
        rationale: 'The reflection found unacceptable risk.',
        score: risk,
      });
    }
    if (
      recommendations.some((recommendation) => recommendation.decision === ReflectionDecision.Retry)
    ) {
      return new ReflectionDecisionRecord({
        decision: ReflectionDecision.Retry,
        rationale: 'The reflection found a recoverable execution defect.',
        score: Math.max(0, 1 - score),
      });
    }
    if (confidence < this.policy.confidenceThreshold) {
      return new ReflectionDecisionRecord({
        decision: ReflectionDecision.Continue,
        rationale: 'The execution appears acceptable but confidence is moderate.',
        score: confidence,
      });
    }
    return new ReflectionDecisionRecord({
      decision: ReflectionDecision.Continue,
      rationale: 'The execution is within the expected bounds.',
      score: confidence,
    });
  }
}

export class LessonLearned {
  public constructor(options: {
    readonly id: Identifier;
    readonly summary: string;
    readonly recommendation: string;
    readonly category: ReflectionCategory;
    readonly metadata?: SerializableValueObject;
  }) {
    this.id = options.id;
    this.summary = options.summary;
    this.recommendation = options.recommendation;
    this.category = options.category;
    this.metadata = options.metadata ? Object.freeze({ ...options.metadata }) : undefined;
  }

  public readonly id: Identifier;
  public readonly summary: string;
  public readonly recommendation: string;
  public readonly category: ReflectionCategory;
  public readonly metadata?: Readonly<SerializableValueObject>;
}

export class KnowledgeCandidate {
  public constructor(options: {
    readonly id: Identifier;
    readonly title: string;
    readonly summary: string;
    readonly evidence: readonly ReflectionEvidence[];
  }) {
    this.id = options.id;
    this.title = options.title;
    this.summary = options.summary;
    this.evidence = [...options.evidence];
  }

  public readonly id: Identifier;
  public readonly title: string;
  public readonly summary: string;
  public readonly evidence: readonly ReflectionEvidence[];
}

export class AdaptiveRecommendation {
  public constructor(options: {
    readonly id: Identifier;
    readonly decision: ReflectionDecision;
    readonly rationale: string;
    readonly score: number;
  }) {
    this.id = options.id;
    this.decision = options.decision;
    this.rationale = options.rationale;
    this.score = Math.max(0, Math.min(1, options.score));
  }

  public readonly id: Identifier;
  public readonly decision: ReflectionDecision;
  public readonly rationale: string;
  public readonly score: number;
}

export class RetryRecommendation extends AdaptiveRecommendation {}
export class EscalationRecommendation extends AdaptiveRecommendation {}
