/** Shape shared by both provider and model capability descriptors. */
export interface CapabilityLike {
  readonly kind: string;
  readonly supported: boolean;
  readonly supportsStreaming?: boolean;
  readonly supportsVision?: boolean;
  readonly supportsFunctionCalling?: boolean;
  readonly supportsStructuredOutput?: boolean;
  readonly supportsReasoning?: boolean;
  readonly supportsEmbeddings?: boolean;
}

/** Whether any supported capability entry matches the given capability kind. */
export function hasCapabilityKind(capabilities: readonly CapabilityLike[], kind: string): boolean {
  const normalized = kind.toLowerCase();
  return capabilities.some(
    (capability) => capability.supported && capability.kind.toLowerCase() === normalized,
  );
}

/** Whether any supported capability entry has the given boolean feature flag enabled. */
export function hasFeatureFlag(
  capabilities: readonly CapabilityLike[],
  flag: keyof Omit<CapabilityLike, 'kind' | 'supported'>,
): boolean {
  return capabilities.some((capability) => capability.supported && capability[flag] === true);
}
