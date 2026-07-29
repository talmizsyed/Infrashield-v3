/**
 * Severity for architecture validation rules.
 */
export type ArchitectureRuleSeverity = 'error' | 'warning' | 'info';

/**
 * Architecture rule metadata used to document platform guardrails.
 */
export interface IArchitectureValidationRule {
  readonly ruleId: string;
  readonly name: string;
  readonly description: string;
  readonly severity: ArchitectureRuleSeverity;
}

/**
 * Architecture validation violation contract.
 */
export interface IArchitectureValidationViolation {
  readonly ruleId: string;
  readonly subject: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, string>>;
}

/**
 * Architecture validation report contract.
 */
export interface IArchitectureValidationReport {
  readonly passed: boolean;
  readonly evaluatedAt: string;
  readonly rules: readonly IArchitectureValidationRule[];
  readonly violations: readonly IArchitectureValidationViolation[];
}

/**
 * Canonical architecture guardrail set for the SDK and platform packages.
 */
export interface IArchitectureValidationRuleSet {
  readonly noCircularDependencies: IArchitectureValidationRule;
  readonly sdkCannotDependOnApplications: IArchitectureValidationRule;
  readonly applicationsCannotReferenceRuntimeInternals: IArchitectureValidationRule;
  readonly providersImplementInterfaces: IArchitectureValidationRule;
  readonly runtimeDependsOnlyOnContracts: IArchitectureValidationRule;
}
