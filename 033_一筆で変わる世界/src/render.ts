import { TerrainType } from './core/world';
import { type DeepReadonly, type WorldView } from './core/world-view';
import { type CellEdit, type Segment, type StrokePreview } from './core/stroke';
import { worldToScreen, type Camera, type Viewport } from './input/camera';
import { type TownDefinition } from './challenge/stage';
import { type TownProgress } from './challenge/goals';

interface RenderOptions {
  camera: Camera; viewport: Viewport; preview: StrokePreview | null; edits: readonly CellEdit[];
  towns?: readonly TownDefinition[]; townProgress?: readonly DeepReadonly<TownProgress>[];
  heightScale?: number;
}
export function drawWorld(context: CanvasRenderingContext2D, world: WorldView, view: string,
  selected: number | null, options: RenderOptions): void {
  const { camera, viewport, preview, edits } = options;
  const heights = new Map(edits.map(edit => [edit.index, edit.after]));
  let maxHeight = 1;
  for (let i = 0; i < world.heights.length; i++) maxHeight = Math.max(maxHeight, heights.get(i) ?? world.heights[i]);
  if (options.heightScale !== undefined) maxHeight = options.heightScale;
  const unit = worldToScreen({ x: 1, y: 0 }, camera, viewport).x - camera.offsetX;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.save();
  context.scale(context.canvas.width / viewport.width, context.canvas.height / viewport.height);
  context.translate(camera.offsetX, camera.offsetY); context.scale(unit, unit);
  for (let i = 0; i < world.water.length; i++) {
    const x = i % world.width, y = Math.floor(i / world.width);
    const h = (heights.get(i) ?? world.heights[i]) / maxHeight, w = world.water[i];
    context.fillStyle = view === 'water' ? '#223039' : `rgb(${Math.round(55 + h * 120)},${Math.round(74 + h * 112)},${Math.round(63 + h * 85)})`;
    context.fillRect(x, y, 1, 1);
    if (w > 0 && view !== 'height') {
      const depth = Math.min(1, Math.log2(1 + w) / 14);
      context.fillStyle = `rgb(${Math.round(83 - depth * 59)},${Math.round(176 - depth * 63)},${Math.round(203 - depth * 31)})`;
      context.fillRect(x, y, 1, 1);
    }
    if (world.protected[i] || world.terrainType[i] !== TerrainType.Normal) {
      context.strokeStyle = '#e1d4a0'; context.lineWidth = .12;
      context.strokeRect(x + .08, y + .08, .84, .84);
      context.beginPath(); context.moveTo(x + .1, y + .9); context.lineTo(x + .9, y + .1); context.stroke();
    }
  }
  if (preview) {
    context.fillStyle = preview.stroke.mode === 'RAISE' ? '#ffca6877' : '#cc9ef477';
    context.strokeStyle = preview.stroke.mode === 'RAISE' ? '#ffe4ae' : '#e5caff'; context.lineWidth = .08;
    for (const edit of edits) {
      const x = edit.index % world.width, y = Math.floor(edit.index / world.width);
      context.fillRect(x, y, 1, 1); context.strokeRect(x + .05, y + .05, .9, .9);
    }
    const path = (segments: readonly Segment[], color: string, dashed: boolean) => {
      context.strokeStyle = color; context.lineWidth = .22; context.lineCap = 'round';
      context.setLineDash(dashed ? [.45, .35] : []); context.beginPath();
      for (const segment of segments) {
        context.moveTo(segment.from.x, segment.from.y); context.lineTo(segment.to.x, segment.to.y);
      }
      context.stroke(); context.setLineDash([]);
    };
    path(preview.stroke.segments, '#fff4ce', false); path(preview.overflow, '#ff8494', true);
    const first = preview.stroke.points[0];
    if (first) { context.fillStyle = '#fff4ce'; context.beginPath(); context.arc(first.x, first.y, .25, 0, Math.PI * 2); context.fill(); }
  }
  for (let i = 0; i < world.water.length; i++) {
    const type = world.terrainType[i];
    if (type === TerrainType.Normal) continue;
    const x = i % world.width + .5, y = Math.floor(i / world.width) + .5;
    context.fillStyle = ['#fff', '#7bf2bf', '#f7cc71', '#ec9aa0'][type];
    context.strokeStyle = '#102029'; context.lineWidth = .2; context.beginPath();
    if (type === TerrainType.Source) context.arc(x, y, .6, 0, Math.PI * 2);
    else if (type === TerrainType.Intake) { context.moveTo(x, y - .7); context.lineTo(x + .7, y); context.lineTo(x, y + .7); context.lineTo(x - .7, y); context.closePath(); }
    else context.rect(x - .6, y - .6, 1.2, 1.2);
    context.fill(); context.stroke();
  }
  for (const town of options.towns ?? []) {
    const x = town.centerCell % world.width + .5, y = Math.floor(town.centerCell / world.width) + .5;
    const progress = options.townProgress?.find(p => p.id === town.id);
    const flooding = world.water[town.centerCell] >= town.floodThreshold;
    context.fillStyle = flooding ? '#fa8d8d' : '#f0f4e4'; context.strokeStyle = '#13252c'; context.lineWidth = .08;
    context.beginPath(); context.moveTo(x - .55, y - .1); context.lineTo(x, y - .65); context.lineTo(x + .55, y - .1);
    context.lineTo(x + .45, y - .1); context.lineTo(x + .45, y + .5); context.lineTo(x - .45, y + .5);
    context.lineTo(x - .45, y - .1); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = '#2d5263'; context.fillRect(x - .12, y + .08, .24, .42);
    if (progress?.firstFloodStep !== null && progress?.firstFloodStep !== undefined) {
      context.strokeStyle = '#ff9c68'; context.lineWidth = .1; context.strokeRect(x - .7, y - .8, 1.4, 1.5);
    }
    context.font = '.36px system-ui'; context.textAlign = 'center'; context.textBaseline = 'bottom';
    const labelWidth = context.measureText(town.name).width + .3;
    context.fillStyle = '#13252cdd'; context.fillRect(x - labelWidth / 2, y - 1.26, labelWidth, .5);
    context.fillStyle = '#f0f4e4'; context.fillText(town.name, x, y - .8);
  }
  if (selected !== null) {
    context.strokeStyle = '#fff'; context.lineWidth = .16;
    context.strokeRect(selected % world.width, Math.floor(selected / world.width), 1, 1);
  }
  context.restore();
}
