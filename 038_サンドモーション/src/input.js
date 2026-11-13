// Always read the current CSS rect: rotation never changes the internal grid.
export function canvasPoint(event, canvas, engine) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) / rect.width * engine.width,
    y: (event.clientY - rect.top) / rect.height * engine.height, time: event.timeStamp };
}
