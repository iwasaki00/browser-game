import { type Point, type StrokeMode } from '../core/stroke';
import { type TrialSession } from '../core/trial';
import { constrainCamera, screenToWorld, zoomAt, type Camera, type Viewport } from './camera';

/** DOM-free gesture state, also exercised for multi-pointer cancellation. */
export class GestureController {
  readonly pointers = new Map<number, Point>();
  tool: 'DRAW' | 'PAN' = 'DRAW';
  mode: StrokeMode = 'RAISE';
  private drawingPointer: number | null = null;
  private navigation = false;
  constructor(public session: TrialSession, readonly camera: Camera, private readonly viewport: () => Viewport) {}
  down(id: number, point: Point): void {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    this.pointers.set(id, { ...point });
    if (this.pointers.size >= 2) {
      if (this.drawingPointer !== null) this.session.cancel();
      this.drawingPointer = null; this.navigation = true; return;
    }
    this.navigation = this.tool === 'PAN' || !this.session.editable;
    if (!this.navigation && this.session.begin(screenToWorld(point, this.camera, this.viewport()), this.mode)) this.drawingPointer = id;
  }
  move(id: number, point: Point): void {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const previous = this.pointers.get(id);
    if (!previous) return;
    const before = [...this.pointers.values()];
    this.pointers.set(id, { ...point });
    const after = [...this.pointers.values()];
    if (before.length >= 2) {
      const center = (points: Point[]): Point => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
      const a = center(before), b = center(after);
      const oldDistance = Math.hypot(before[1].x - before[0].x, before[1].y - before[0].y);
      const newDistance = Math.hypot(after[1].x - after[0].x, after[1].y - after[0].y);
      if (oldDistance > 1) zoomAt(this.camera, this.camera.zoom * newDistance / oldDistance, a, this.viewport());
      this.camera.offsetX += b.x - a.x; this.camera.offsetY += b.y - a.y;
      constrainCamera(this.camera, this.viewport());
    } else if (this.navigation) {
      this.camera.offsetX += point.x - previous.x; this.camera.offsetY += point.y - previous.y;
      constrainCamera(this.camera, this.viewport());
    } else if (id === this.drawingPointer) this.session.append(screenToWorld(point, this.camera, this.viewport()));
  }
  up(id: number, point?: Point): void {
    if (!this.pointers.has(id)) return;
    if (point) this.move(id, point);
    if (id === this.drawingPointer) { this.session.finish(); this.drawingPointer = null; }
    this.pointers.delete(id);
    // A remaining finger after a pinch keeps navigating; it never starts a new stroke.
    if (!this.pointers.size) this.navigation = false;
  }
  cancel(): void {
    if (this.drawingPointer !== null) this.session.cancel();
    this.drawingPointer = null; this.pointers.clear(); this.navigation = false;
  }
}
