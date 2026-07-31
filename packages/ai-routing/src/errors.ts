/**
 * Error hierarchy for the AI routing engine.
 *
 * All routing failures extend {@link AIRoutingException} so callers can
 * catch a single base type while still discriminating on the concrete
 * failure mode when useful.
 */
export class AIRoutingException extends Error {
  public readonly cause?: unknown;

  public constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AIRoutingException';
    this.cause = cause;
  }
}

/** Thrown when no provider/model combination could be selected for a request. */
export class AISelectionException extends AIRoutingException {
  public constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AISelectionException';
  }
}

/** Thrown when no provider satisfies the routing context or policy. */
export class AIProviderSelectionException extends AIRoutingException {
  public constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AIProviderSelectionException';
  }
}

/** Thrown when no model satisfies the routing context or policy. */
export class AIModelSelectionException extends AIRoutingException {
  public constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AIModelSelectionException';
  }
}

/** Thrown when a routing policy is internally inconsistent (e.g. conflicting allow/deny lists). */
export class AIRoutingPolicyException extends AIRoutingException {
  public constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AIRoutingPolicyException';
  }
}
