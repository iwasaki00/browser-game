import { type Point } from '../core/stroke';

/** All screen units here are CSS pixels, independent of canvas backing resolution. */
export interface Camera { zoom: number; offsetX: number; offsetY: number }
export interface Viewport { width: number; height: number; worldWidth: number; worldHeight: number }
export const createCamera = (): Camera => ({ zoom: 1, offsetX: 0, offsetY: 0 });
function scale(camera: Camera, viewport: Viewport): number {
  return Math.min(viewport.width / viewport.worldWidth, viewport.height / viewport.worldHeight) * camera.zoom;
}
export function worldToScreen(point: Point, camera: Camera, viewport: Viewport): Point {
  const unit = scale(camera, viewport);
  return { x: point.x * unit + camera.offsetX, y: point.y * unit + camera.offsetY };
}
export function screenToWorld(point: Point, camera: Camera, viewport: Viewport): Point {
  const unit = scale(camera, viewport);
  return { x: (point.x - camera.offsetX) / unit, y: (point.y - camera.offsetY) / unit };
}
export function constrainCamera(camera: Camera, viewport: Viewport): void {
  camera.zoom = Math.max(1, Math.min(4, Number.isFinite(camera.zoom) ? camera.zoom : 1));
  const unit = scale(camera, viewport);
  camera.offsetX = Math.max(Math.min(0, viewport.width - viewport.worldWidth * unit), Math.min(0, Number.isFinite(camera.offsetX) ? camera.offsetX : 0));
  camera.offsetY = Math.max(Math.min(0, viewport.height - viewport.worldHeight * unit), Math.min(0, Number.isFinite(camera.offsetY) ? camera.offsetY : 0));
}
export function zoomAt(camera: Camera, zoom: number, anchor: Point, viewport: Viewport): void {
  const world = screenToWorld(anchor, camera, viewport);
  camera.zoom = zoom; constrainCamera(camera, viewport);
  const current = worldToScreen(world, camera, viewport);
  camera.offsetX += anchor.x - current.x; camera.offsetY += anchor.y - current.y;
  constrainCamera(camera, viewport);
}
