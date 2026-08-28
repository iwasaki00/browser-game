(function defineInput(global) {
  "use strict";
  const P = global.PythagoraLab;

  class InputController {
    constructor(canvas, renderer, game) {
      this.canvas = canvas;
      this.renderer = renderer;
      this.game = game;
      this.pointers = new Map();
      this.drag = null;
      this.pinch = null;
      this.listeners = [];
      this.bind();
    }

    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      this.listeners.push(() => target.removeEventListener(type, handler, options));
    }

    bind() {
      this.listen(this.canvas, "pointerdown", (event) => this.onPointerDown(event), { passive: false });
      this.listen(this.canvas, "pointermove", (event) => this.onPointerMove(event), { passive: false });
      this.listen(this.canvas, "pointerup", (event) => this.onPointerUp(event), { passive: false });
      this.listen(this.canvas, "pointercancel", (event) => this.onPointerCancel(event), { passive: false });
      this.listen(global, "keydown", (event) => this.onKeyDown(event));
    }

    onPointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { this.canvas.setPointerCapture(event.pointerId); } catch {}

      if (this.pointers.size >= 2) {
        if (this.drag?.moved) this.game.restoreDesign(this.drag.before);
        this.drag = null;
        this.startPinch();
        return;
      }

      if (this.game.mode !== "edit") return;
      const point = this.renderer.screenToWorld(event.clientX, event.clientY);
      const part = this.game.partAt(point, this.renderer.scale);
      this.game.selectPart(part);
      if (!part) return;
      this.drag = {
        pointerId: event.pointerId,
        part,
        before: this.game.serializeDesign(),
        startX: event.clientX,
        startY: event.clientY,
        offsetX: part.x - point.x,
        offsetY: part.y - point.y,
        moved: false
      };
    }

    onPointerMove(event) {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) return;
      event.preventDefault();
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (this.pinch && this.pointers.size >= 2) {
        this.updatePinch();
        return;
      }
      if (!this.drag || this.drag.pointerId !== event.pointerId || this.game.mode !== "edit") return;
      const distance = Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY);
      if (distance < 4 && !this.drag.moved) return;
      this.drag.moved = true;
      const point = this.renderer.screenToWorld(event.clientX, event.clientY);
      this.game.movePart(this.drag.part, { x: point.x + this.drag.offsetX, y: point.y + this.drag.offsetY });
    }

    onPointerUp(event) {
      if (!this.pointers.has(event.pointerId)) return;
      event.preventDefault();
      this.pointers.delete(event.pointerId);
      if (this.drag?.pointerId === event.pointerId) {
        if (this.drag.moved) this.game.commitDrag(this.drag.before);
        this.drag = null;
      }
      if (this.pointers.size < 2) this.pinch = null;
      try { this.canvas.releasePointerCapture(event.pointerId); } catch {}
    }

    onPointerCancel(event) {
      if (!this.pointers.has(event.pointerId)) return;
      event.preventDefault();
      this.pointers.delete(event.pointerId);
      if (this.drag?.pointerId === event.pointerId) {
        if (this.drag.moved) this.game.restoreDesign(this.drag.before);
        this.drag = null;
      }
      if (this.pointers.size < 2) this.pinch = null;
    }

    startPinch() {
      const points = Array.from(this.pointers.values()).slice(0, 2);
      const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      this.pinch = {
        distance: Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)),
        zoom: this.renderer.camera.zoom,
        world: this.renderer.screenToWorld(midpoint.x, midpoint.y)
      };
    }

    updatePinch() {
      const points = Array.from(this.pointers.values()).slice(0, 2);
      const midpointClient = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      const rect = this.canvas.getBoundingClientRect();
      const midpoint = { x: midpointClient.x - rect.left, y: midpointClient.y - rect.top };
      const distance = Math.max(1, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y));
      const zoom = P.util.clamp(this.pinch.zoom * distance / this.pinch.distance, P.CONFIG.camera.minZoom, P.CONFIG.camera.maxZoom);
      const scale = this.renderer.baseScale * zoom;
      this.renderer.setCamera({
        zoom,
        x: this.pinch.world.x - (midpoint.x - this.renderer.cssWidth / 2) / scale,
        y: this.pinch.world.y - (midpoint.y - this.renderer.cssHeight / 2) / scale
      });
    }

    onKeyDown(event) {
      const tag = event.target?.tagName?.toLowerCase();
      if (["input", "textarea", "select", "button"].includes(tag)) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        this.game.deleteSelected();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? this.game.redo() : this.game.undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        this.game.redo();
      } else if (event.key === "ArrowLeft" && this.game.selectedPart) {
        event.preventDefault();
        this.game.rotateSelected(-1);
      } else if (event.key === "ArrowRight" && this.game.selectedPart) {
        event.preventDefault();
        this.game.rotateSelected(1);
      }
    }

    destroy() {
      for (const remove of this.listeners.splice(0)) remove();
      this.pointers.clear();
      this.drag = null;
      this.pinch = null;
    }
  }

  P.InputController = InputController;
})(window);
