export type CapabilityProfile = 'tier-a' | 'tier-b' | 'tier-c';

export interface CapabilityInput {
  reducedMotion: boolean;
  webgl: boolean;
  precisePointer: boolean;
  viewportWidth: number;
  deviceMemoryGB?: number;
  webglFailed?: boolean;
}

export function selectCapabilityProfile(input: CapabilityInput): CapabilityProfile {
  if (input.reducedMotion) return 'tier-c';

  const constrainedMemory = input.deviceMemoryGB !== undefined && input.deviceMemoryGB < 4;
  const canUseImmersiveRenderer = input.webgl
    && !input.webglFailed
    && input.precisePointer
    && input.viewportWidth >= 1024
    && !constrainedMemory;

  return canUseImmersiveRenderer ? 'tier-a' : 'tier-b';
}
