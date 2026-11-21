// Always read the current CSS rect: rotation never changes the internal grid.
export function canvasPoint(event, canvas, engine) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * engine.width,
    y: (event.clientY - rect.top) / rect.height * engine.height, time: event.timeStamp };
}

// Presentation only: height can limit canvas width without narrowing the app.
export function canvasDisplaySize(stageWidth, stageHeight, gridWidth, gridHeight) {
  const scale = Math.max(0, Math.min((stageWidth - 12) / gridWidth, (stageHeight - 12) / gridHeight));
  return { width: gridWidth * scale, height: gridHeight * scale };
}
