import type { RafContext } from './raf';

interface EventSource { addEventListener(type: string, listener: () => void): void; removeEventListener(type: string, listener: () => void): void }
export interface EnvironmentDocument extends EventSource { readonly visibilityState: string; hasFocus(): boolean }
export const readRafContext = (document: Pick<EnvironmentDocument, 'visibilityState' | 'hasFocus'>): RafContext =>
  ({ visibilityState: document.visibilityState, hasFocus: document.hasFocus() });

/** Environment events only observe. They do not pause, play, reset or schedule game work. */
export function bindRafEnvironment(document: EnvironmentDocument, window: EventSource,
  enabled: () => boolean, observe: (now: number, context: RafContext, reason: string) => void,
  clock: () => number = () => performance.now()): () => void {
  const bindings = [[document, 'visibilitychange'], [window, 'focus'], [window, 'blur'], [window, 'pageshow']] as const;
  const listeners = bindings.map(([target, event]) => {
    const listener = () => { if (enabled()) observe(clock(), readRafContext(document), event); };
    target.addEventListener(event, listener); return () => target.removeEventListener(event, listener);
  });
  return () => { for (const remove of listeners) remove(); };
}
