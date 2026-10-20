/** The callback owns stopping simulation and releasing pointers; never resume on visibility. */
export function bindVisibilityPause(target: { readonly hidden: boolean; addEventListener(type: 'visibilitychange', listener: () => void): void }, pause: () => void): void {
  target.addEventListener('visibilitychange', () => { if (target.hidden) pause(); });
}
