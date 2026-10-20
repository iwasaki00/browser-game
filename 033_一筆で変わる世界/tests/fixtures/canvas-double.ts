import { vi } from 'vitest';

export interface PaintCall { op: string; args: unknown[]; fill: unknown; stroke: unknown; alpha: unknown }
export function canvasDouble() {
  const calls: PaintCall[] = [];
  const target: Record<string, unknown> = { canvas: { width: 640, height: 640 }, globalAlpha: 1 };
  const context = new Proxy(target, { get(object, key: string) {
    if (key in object) return object[key];
    return (...args: unknown[]) => {
      calls.push({ op: key, args, fill: object.fillStyle, stroke: object.strokeStyle, alpha: object.globalAlpha });
      if (key === 'measureText') return { width: String(args[0]).length * .25 };
    };
  } }) as unknown as CanvasRenderingContext2D;
  return { context, calls };
}
/** Minimal DOM contract used by the real ComparisonView; no simulation is replaced. */
export function comparisonDom() {
  const elements = new Map<string, ReturnType<typeof makeElement>>();
  const paints = [canvasDouble(), canvasDouble()];
  let width = 300;
  function makeElement(id = '') {
    const events = new Map<string, (event?: unknown) => void>();
    return { id, value: id === 'comparison-view' ? 'combined' : 'auto', textContent: '', className: '', disabled: false, hidden: false,
      dataset: { layout: 'auto', world: 'B' }, attrs: new Map<string, string>(), children: [] as unknown[],
      onclick: (() => {}) as () => void, onchange: (() => {}) as () => void,
      addEventListener: (name: string, fn: (event?: unknown) => void) => events.set(name, fn),
      setAttribute(name: string, value: string) { this.attrs.set(name, value); },
      replaceChildren(...children: unknown[]) { this.children = children; },
      getBoundingClientRect() {
        const panel = elements.get('comparison-panel');
        const hide = panel?.dataset.layout === 'switch' && ((id === 'comparison-a' && panel.dataset.world === 'B') || (id === 'comparison-b' && panel.dataset.world === 'A'));
        return { width: hide ? 0 : width, height: hide ? 0 : width, left: 0, top: 0 };
      },
      getContext: () => paints[id === 'comparison-a' ? 0 : 1].context,
      hasPointerCapture: () => false, releasePointerCapture: () => {},
    };
  }
  const get = (id: string) => { if (!elements.has(id)) elements.set(id, makeElement(id)); return elements.get(id)!; };
  vi.stubGlobal('document', { getElementById: get, createElement: () => makeElement() });
  const observers: (() => void)[] = [];
  vi.stubGlobal('ResizeObserver', class { constructor(fn: () => void) { observers.push(fn); } observe() {} });
  return { get, paints, click: (id: string) => get(id).onclick(), resize: (next: number) => { width = next; observers.forEach(fn => fn()); } };
}
