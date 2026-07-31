import { EventEnvelope, EventMetadata, type IEvent } from '@infrashield/core-infrastructure';
import type { AIRoutingDecision } from './decision';

/** Published whenever the router finalizes a routing decision. */
export class RoutingDecisionCreatedEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly requestId: string; readonly decision: AIRoutingDecision };
  public readonly metadata: EventMetadata;

  public constructor(requestId: string, decision: AIRoutingDecision, correlationId?: string) {
    this.eventId = `routing-decision-created-${requestId}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-routing';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'routing', 'decision'];
    this.eventType = 'RoutingDecisionCreated';
    this.payload = { requestId, decision };
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

/** Published when a provider is chosen for a request. */
export class ProviderSelectedEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly requestId: string; readonly providerId: string };
  public readonly metadata: EventMetadata;

  public constructor(requestId: string, providerId: string, correlationId?: string) {
    this.eventId = `provider-selected-${requestId}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-routing';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'routing', 'provider'];
    this.eventType = 'ProviderSelected';
    this.payload = { requestId, providerId };
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

/** Published when a model is chosen for a request. */
export class ModelSelectedEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: {
    readonly requestId: string;
    readonly providerId: string;
    readonly modelId: string;
  };
  public readonly metadata: EventMetadata;

  public constructor(
    requestId: string,
    providerId: string,
    modelId: string,
    correlationId?: string,
  ) {
    this.eventId = `model-selected-${requestId}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-routing';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'routing', 'model'];
    this.eventType = 'ModelSelected';
    this.payload = { requestId, providerId, modelId };
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

/** Published when the router selects a fallback provider instead of the primary/preferred one. */
export class FallbackTriggeredEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: {
    readonly requestId: string;
    readonly fromProviderId: string;
    readonly toProviderId: string;
  };
  public readonly metadata: EventMetadata;

  public constructor(
    requestId: string,
    fromProviderId: string,
    toProviderId: string,
    correlationId?: string,
  ) {
    this.eventId = `fallback-triggered-${requestId}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-routing';
    this.category = 'domain';
    this.priority = 'high';
    this.version = 1;
    this.tags = ['ai', 'routing', 'fallback'];
    this.eventType = 'FallbackTriggered';
    this.payload = { requestId, fromProviderId, toProviderId };
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}

/** Published when one or more routing policy rules matched the request context. */
export class RoutingPolicyAppliedEvent implements IEvent {
  public readonly eventId: string;
  public readonly correlationId?: string;
  public readonly timestamp: string;
  public readonly source: string;
  public readonly category: 'domain' | 'integration' | 'application' | 'system';
  public readonly priority: 'low' | 'normal' | 'high' | 'critical';
  public readonly version: number;
  public readonly tags: readonly string[];
  public readonly eventType: string;
  public readonly payload: { readonly requestId: string; readonly ruleIds: readonly string[] };
  public readonly metadata: EventMetadata;

  public constructor(requestId: string, ruleIds: readonly string[], correlationId?: string) {
    this.eventId = `routing-policy-applied-${requestId}`;
    this.correlationId = correlationId;
    this.timestamp = new Date().toISOString();
    this.source = 'ai-routing';
    this.category = 'domain';
    this.priority = 'normal';
    this.version = 1;
    this.tags = ['ai', 'routing', 'policy'];
    this.eventType = 'RoutingPolicyApplied';
    this.payload = { requestId, ruleIds };
    this.metadata = EventMetadata.create({
      correlationId,
      source: this.source,
      category: this.category,
      priority: this.priority,
      tags: this.tags,
    });
  }

  public toEnvelope(): EventEnvelope {
    return new EventEnvelope(this, this.metadata);
  }
}
