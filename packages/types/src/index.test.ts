import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ApiResponse, HealthResponse, ErrorResponse, AiProviderRequest, UUID } from './index';

describe('types package', () => {
  it('exports shared type definitions', () => {
    expectTypeOf<ApiResponse<{ hello: string }>>().toBeObject();
    expectTypeOf<HealthResponse>().toBeObject();
    expectTypeOf<ErrorResponse>().toBeObject();
    expectTypeOf<AiProviderRequest>().toBeObject();
    expectTypeOf<UUID>().toBeString();
  });
});
