import type {
  CorrelationId as KernelCorrelationId,
  Identifier,
  SerializableValueObject,
} from '@infrashield/contracts';

export * from './knowledge';
export * from './retrieval';
export * from './infrastructure';

/**
 * Execution trace context used for distributed correlation.
 */
export interface TraceContext {
  readonly traceId: Identifier;
  readonly spanId: Identifier;
  readonly parentSpanId?: Identifier;
  readonly correlationId?: CorrelationId;
}

/**
 * Tenant isolation context for multi-tenant systems.
 */
export interface TenantContext {
  readonly tenantId: Identifier;
  readonly tenantName?: string;
  readonly tenantMetadata?: SerializableValueObject;
}

/**
 * End user context for request authentication and authorization.
 */
export interface UserContext {
  readonly userId: Identifier;
  readonly userName?: string;
  readonly roles?: readonly string[];
  readonly claims?: SerializableValueObject;
}

/**
 * Correlation identifier for request or message tracing.
 */
export type CorrelationId = KernelCorrelationId;

/**
 * Request-level context carrying identity and trace metadata.
 */
export interface RequestContext {
  readonly requestId: Identifier;
  readonly correlationId: CorrelationId;
  readonly trace?: TraceContext;
  readonly tenant?: TenantContext;
  readonly user?: UserContext;
  readonly metadata?: SerializableValueObject;
}

/**
 * Runtime execution metadata for a kernel action.
 */
export interface ExecutionMetadata {
  readonly executionId: Identifier;
  readonly triggeredBy?: string;
  readonly context?: RequestContext;
  readonly timestamp: string;
}

/**
 * Context object representing execution request properties.
 */
export interface Context {
  readonly request: RequestContext;
  readonly execution: ExecutionMetadata;
}
