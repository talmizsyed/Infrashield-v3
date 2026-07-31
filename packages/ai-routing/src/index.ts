/**
 * @infrashield/ai-routing - the Intelligent Routing Engine for the Agentic OS
 * AI Gateway.
 *
 * Applications never choose a provider or model directly. They describe
 * what they need through an {@link AIRoutingContext}, and the
 * {@link AIRouter} deterministically selects the best available provider
 * and model using the AI Gateway's provider/model registries, health data
 * and an explicit, policy-driven scoring model.
 *
 * See the package README for a full guide to the selection process,
 * policies, strategies and decision model.
 */
export * from './errors';
export * from './context';
export * from './candidate';
export * from './strategy';
export * from './policy';
export * from './capability-utils';
export * from './selectors';
export * from './engine';
export * from './decision';
export * from './events';
export * from './router';
