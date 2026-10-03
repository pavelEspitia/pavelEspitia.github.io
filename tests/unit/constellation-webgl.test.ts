import { describe, expect, it, vi } from 'vitest';

import { createFrameStabilityMonitor } from '../../src/scripts/constellation-webgl';
import { downgradeCapability } from '../../src/scripts/capability-profile';

describe('WebGL recovery', () => {
  it('downgrades only toward a safer tier', () => {
    expect(downgradeCapability('tier-a', 'renderer')).toBe('tier-b');
    expect(downgradeCapability('tier-b', 'renderer')).toBe('tier-c');
    expect(downgradeCapability('tier-c', 'renderer')).toBe('tier-c');
  });

  it('reports one sustained low-frame event after warm-up and three windows', () => {
    const unstable = vi.fn();
    const monitor = createFrameStabilityMonitor(unstable, { warmupMs: 2_000, windowMs: 2_000, minimumFps: 45, failedWindows: 3 });
    for (let time = 0; time <= 9_000; time += 50) monitor.frame(time);
    expect(unstable).toHaveBeenCalledOnce();
    monitor.frame(12_000);
    expect(unstable).toHaveBeenCalledOnce();
  });

  it('does not downgrade when frame windows are healthy', () => {
    const unstable = vi.fn();
    const monitor = createFrameStabilityMonitor(unstable, { warmupMs: 2_000, windowMs: 2_000, minimumFps: 45, failedWindows: 3 });
    for (let time = 0; time <= 10_000; time += 16) monitor.frame(time);
    expect(unstable).not.toHaveBeenCalled();
  });
});
