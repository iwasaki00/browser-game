import { TerrainType } from './core/world';
import { type DeepReadonly, type WorldView } from './core/world-view';
import { type FlowTransfer } from './core/simulation';
import { type CellEdit, type Segment, type StrokePreview } from './core/stroke';
import { worldToScreen, type Camera, type Viewport } from './input/camera';
import { type TownDefinition } from './challenge/stage';
import { type TownProgress } from './challenge/goals';
import { MAP_THEME as theme, terrainTiles, waterOpacity, flowGlyphs, townAppearance, TOWN_LABELS,
  canvasSize, markerKind, type TerrainTile } from './living-map';

export interface RenderOptions {
  camera: Camera; viewport: Viewport; preview: StrokePreview | null; edits: readonly CellEdit[];
  towns?: readonly TownDefinition[]; townProgress?: readonly DeepReadonly<TownProgress>[];
  heightScale?: number; flows?: readonly FlowTransfer[]; showFlow?: boolean; animationPhase?: number;
  devicePixelRatio?: number;
}
// Cache the last terrain colors/relief per canvas. Compare values because comparison snapshots
// are independent arrays each step. Water, goals and animations never invalidate static terrain.
const terrainCache = new WeakMap<CanvasRenderingContext2D, { key: string; heights: number[]; tiles: readonly TerrainTile[] }>();
function cachedTerrain(context: CanvasRenderingContext2D, world: WorldView, view: string, options: RenderOptions): readonly TerrainTile[] {
  const key = `${world.width}/${world.height}/${view}/${options.heightScale}/${options.edits.map(e => `${e.index}:${e.after}`).join(',')}`;
  const cached = terrainCache.get(context);
  if (cached?.key === key && cached.heights.length === world.heights.length && cached.heights.every((h, i) => h === world.heights[i])) return cached.tiles;
  const tiles = terrainTiles(world, view, options.edits, options.heightScale);
  terrainCache.set(context, { key, heights: Array.from(world.heights), tiles });
  return tiles;
}
export function drawWorld(context: CanvasRenderingContext2D, world: WorldView, view: string,
  selected: number | null, options: RenderOptions): void {
  const { camera, viewport, preview, edits } = options;
  if (viewport.width <= 0 || viewport.height <= 0) return;
  const size = canvasSize(viewport.width, viewport.height, options.devicePixelRatio ?? (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1));
  if (context.canvas.width !== size.width) context.canvas.width = size.width;
  if (context.canvas.height !== size.height) context.canvas.height = size.height;
  const unit = worldToScreen({ x: 1, y: 0 }, camera, viewport).x - camera.offsetX;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  context.save();
  context.scale(context.canvas.width / viewport.width, context.canvas.height / viewport.height);
  context.translate(camera.offsetX, camera.offsetY); context.scale(unit, unit);
  const tiles = cachedTerrain(context, world, view, options);
  for (const tile of tiles) {
    const x = tile.index % world.width, y = Math.floor(tile.index / world.width);
    context.fillStyle = view === 'water' ? theme.paper : tile.color;
    context.fillRect(x, y, 1.005, 1.005);
  }
  // Height boundaries, rather than a grid, reveal the actual terrain without moving any cell.
  context.strokeStyle = theme.ink; context.globalAlpha = view === 'height' ? .48 : .15;
  context.lineWidth = view === 'height' ? .045 : .025; context.beginPath();
  for (const tile of tiles) {
    const x = tile.index % world.width, y = Math.floor(tile.index / world.width);
    if (tile.eastBoundary) { context.moveTo(x + 1, y); context.lineTo(x + 1, y + 1); }
    if (tile.southBoundary) { context.moveTo(x, y + 1); context.lineTo(x + 1, y + 1); }
  }
  context.stroke(); context.globalAlpha = 1;
  if (view !== 'height') {
    for (let i = 0; i < world.water.length; i++) {
      const opacity = waterOpacity(world.water[i]);
      if (!opacity) continue;
      const x = i % world.width, y = Math.floor(i / world.width);
      context.fillStyle = theme.water; context.globalAlpha = opacity; context.fillRect(x, y, 1, 1);
      context.globalAlpha = .6; context.strokeStyle = theme.light; context.lineWidth = .055; context.beginPath();
      if (x === 0 || !world.water[i - 1]) { context.moveTo(x + .04, y); context.lineTo(x + .04, y + 1); }
      if (x === world.width - 1 || !world.water[i + 1]) { context.moveTo(x + .96, y); context.lineTo(x + .96, y + 1); }
      if (y === 0 || !world.water[i - world.width]) { context.moveTo(x, y + .04); context.lineTo(x + 1, y + .04); }
      if (y === world.height - 1 || !world.water[i + world.width]) { context.moveTo(x, y + .96); context.lineTo(x + 1, y + .96); }
      context.stroke(); context.globalAlpha = 1;
    }
    // Every arrow describes a positive, actually recorded transfer in the last logical step.
    context.strokeStyle = theme.ink; context.lineWidth = .06; context.lineCap = 'round'; context.globalAlpha = .65;
    for (const arrow of flowGlyphs(world, options.flows ?? [], options.showFlow ?? false)) {
      const travel = ((options.animationPhase ?? 0) - .5) * .18;
      const x = arrow.x + arrow.dx * travel, y = arrow.y + arrow.dy * travel;
      context.beginPath(); context.moveTo(x - arrow.dx * .28, y - arrow.dy * .28); context.lineTo(x + arrow.dx * .28, y + arrow.dy * .28);
      context.moveTo(x + arrow.dx * .1 - arrow.dy * .13, y + arrow.dy * .1 + arrow.dx * .13);
      context.lineTo(x + arrow.dx * .28, y + arrow.dy * .28);
      context.lineTo(x + arrow.dx * .1 + arrow.dy * .13, y + arrow.dy * .1 - arrow.dx * .13); context.stroke();
    }
    context.globalAlpha = 1;
  }
  // Restrained hatch corners distinguish protected cells without obscuring the elevation.
  context.strokeStyle = theme.protection; context.lineWidth = .035; context.globalAlpha = .38; context.beginPath();
  for (let i = 0; i < world.protected.length; i++) if (world.protected[i] || world.terrainType[i] !== TerrainType.Normal) {
    const x = i % world.width, y = Math.floor(i / world.width);
    context.moveTo(x + .08, y + .32); context.lineTo(x + .32, y + .08);
    context.moveTo(x + .08, y + .52); context.lineTo(x + .52, y + .08);
  }
  context.stroke(); context.globalAlpha = 1;
  if (preview) {
    const color = preview.stroke.mode === 'RAISE' ? theme.raise : theme.lower;
    context.fillStyle = color; context.strokeStyle = color; context.lineWidth = .06;
    // Consume the exact CellEdit list from the existing stroke engine.
    for (const edit of edits) {
      const x = edit.index % world.width, y = Math.floor(edit.index / world.width);
      context.globalAlpha = .3; context.fillRect(x, y, 1, 1); context.globalAlpha = 1;
      context.strokeRect(x + .04, y + .04, .92, .92);
    }
    const path = (segments: readonly Segment[], dashed: boolean) => {
      context.strokeStyle = dashed ? theme.danger : theme.stroke;
      context.lineWidth = .16; context.lineCap = 'round'; context.setLineDash(dashed ? [.35, .24] : []); context.beginPath();
      for (const segment of segments) { context.moveTo(segment.from.x, segment.from.y); context.lineTo(segment.to.x, segment.to.y); }
      context.stroke(); context.setLineDash([]);
    };
    path(preview.stroke.segments, false); path(preview.overflow, true);
    const first = preview.stroke.points[0];
    if (first) { context.fillStyle = theme.stroke; context.beginPath(); context.arc(first.x, first.y, .17, 0, Math.PI * 2); context.fill(); }
  }
  for (let i = 0; i < world.terrainType.length; i++) {
    const type = world.terrainType[i], kind = markerKind(type, !!world.protected[i]);
    if (kind === 'LAND' || kind === 'PROTECTED_HATCH') continue;
    const x = i % world.width + .5, y = Math.floor(i / world.width) + .5;
    context.fillStyle = theme.cream; context.strokeStyle = theme.ink; context.lineWidth = .07;
    context.beginPath();
    if (kind === 'SOURCE_DROP') context.arc(x, y, .43, 0, Math.PI * 2);
    else if (kind === 'INTAKE_DIAMOND') { context.moveTo(x, y - .5); context.lineTo(x + .5, y); context.lineTo(x, y + .5); context.lineTo(x - .5, y); context.closePath(); }
    else context.rect(x - .43, y - .43, .86, .86);
    context.fill(); context.stroke();
    context.fillStyle = type === TerrainType.Source ? theme.source : type === TerrainType.Intake ? theme.intake : theme.outlet;
    if (type === TerrainType.Source) { context.beginPath(); context.moveTo(x, y - .29); context.quadraticCurveTo(x + .36, y + .18, x, y + .29); context.quadraticCurveTo(x - .36, y + .18, x, y - .29); context.fill(); }
    else if (type === TerrainType.Intake) { context.fillRect(x - .23, y - .18, .46, .2); context.fillRect(x - .08, y, .16, .26); }
    else { context.font = 'bold .6px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText('↓', x, y); }
  }
  for (const town of options.towns ?? []) {
    const x = town.centerCell % world.width + .5, y = Math.floor(town.centerCell / world.width) + .5;
    const progress = options.townProgress?.find(p => p.id === town.id);
    const state = townAppearance(world.water[town.centerCell], town.floodThreshold, progress);
    const warning = state === 'FLOODED' || state === 'DANGER';
    context.fillStyle = theme.cream; context.strokeStyle = theme.ink; context.lineWidth = .055;
    context.fillRect(x - .39, y - .05, .78, .52); context.strokeRect(x - .39, y - .05, .78, .52);
    context.fillStyle = warning ? theme.danger : state === 'DELIVERED' ? theme.success : theme.stroke;
    context.beginPath(); context.moveTo(x - .51, y - .05); context.lineTo(x, y - .51); context.lineTo(x + .51, y - .05); context.closePath(); context.fill(); context.stroke();
    context.fillStyle = theme.ink; context.fillRect(x - .07, y + .18, .14, .29);
    context.fillStyle = theme.water; context.fillRect(x - .28, y + .12, .12, .12); context.fillRect(x + .16, y + .12, .12, .12);
    context.font = '.28px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle';
    const label = `${town.name} · ${TOWN_LABELS[state]}`, labelWidth = context.measureText(label).width + .28;
    context.fillStyle = theme.cream; context.globalAlpha = .95; context.fillRect(x - labelWidth / 2, y - 1.05, labelWidth, .42); context.globalAlpha = 1;
    context.fillStyle = warning ? theme.danger : theme.ink; context.fillText(label, x, y - .83);
    if (warning) {
      context.strokeStyle = theme.danger; context.lineWidth = .07; context.setLineDash([.1, .1]); context.strokeRect(x - .6, y - .58, 1.2, 1.16); context.setLineDash([]);
      context.font = 'bold .4px system-ui'; context.fillText('!', x + .64, y - .25);
    }
  }
  if (selected !== null) {
    context.strokeStyle = theme.ink; context.lineWidth = .08;
    context.strokeRect(selected % world.width + .03, Math.floor(selected / world.width) + .03, .94, .94);
  }
  context.restore();
  if (preview) {
    // Keep the budget visible while drawing, including when the mobile editor is below the map.
    const left = Math.max(0, preview.stroke.maxLength - preview.stroke.effectiveLength);
    context.save(); context.scale(context.canvas.width / viewport.width, context.canvas.height / viewport.height);
    const label = `${preview.stroke.mode === 'RAISE' ? '盛る ＋' : '削る −'}${preview.stroke.heightDelta} · 残り ${left.toFixed(2)}セル`;
    context.font = '600 11px system-ui'; const width = context.measureText(label).width + 22;
    context.fillStyle = theme.cream; context.globalAlpha = .95; context.fillRect(10, 10, width, 30);
    context.globalAlpha = 1; context.fillStyle = preview.stroke.mode === 'RAISE' ? theme.raise : theme.lower;
    context.textAlign = 'left'; context.textBaseline = 'middle'; context.fillText(label, 21, 25); context.restore();
  }
}
