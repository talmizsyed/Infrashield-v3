# @infrashield/core-infrastructure

Generic infrastructure building blocks for the platform.

## Purpose

This package defines reusable, provider-agnostic infrastructure contracts and utilities that can be shared by every future package.

It intentionally does not include:

- runtime orchestration
- AI providers or model adapters
- memory systems or persistence engines
- application-specific policies

## Modules

- `primitives`: shared ID brands, serializable values, ID factory contracts
- `errors`: normalized error model and helpers
- `result`: result pattern helpers (`ok`, `fail`, mapping utilities)
- `logger`: generic logger contracts and sink-based implementation
- `configuration`: typed configuration provider contracts and implementation
- `clock`: system/fixed/offset clock contracts and implementations
- `serializer`: serializer contracts and JSON implementation with safe wrappers
- `di`: dependency injection contracts (token, descriptor, resolver, scope)
- `options`: options pattern contracts and generic options builder

## Design Principles

- strict TypeScript types
- SOLID-oriented abstractions
- constructor-injected dependencies
- composable interfaces
- no circular dependencies

## Example

```ts
import {
  DefaultIdFactory,
  JsonSerializer,
  OptionsBuilder,
  StructuredLogger,
  createMemoryLogSink,
  ok,
} from '@infrashield/core-infrastructure';

const ids = new DefaultIdFactory();
const logger = new StructuredLogger({
  loggerId: ids.create('logger'),
  sink: createMemoryLogSink(),
});

const serializer = new JsonSerializer();
const options = new OptionsBuilder({ retries: 3, timeoutMs: 1000 })
  .override({ timeoutMs: 2000 })
  .build();

logger.info('infrastructure initialized', {
  requestId: ids.createCorrelationId(),
});

const payload = serializer.safeSerialize({ status: 'ok' });
if (options.succeeded && payload.succeeded) {
  ok({ options: options.data, payload: payload.data });
}
```
