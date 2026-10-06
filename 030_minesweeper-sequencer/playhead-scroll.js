(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.MinesweeperPlayheadScroll = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function isStepVisible(options) {
    const scrollLeft = Number(options.scrollLeft) || 0;
    const clientWidth = Math.max(0, Number(options.clientWidth) || 0);
    const stepLeft = Number(options.stepLeft) || 0;
    const stepWidth = Math.max(0, Number(options.stepWidth) || 0);
    const leadingInset = Math.max(0, Number(options.leadingInset) || 0);
    const margin = Math.max(0, Number(options.margin) || 0);
    const visibleLeft = scrollLeft + leadingInset + margin;
    const visibleRight = scrollLeft + clientWidth - margin;
    return stepLeft >= visibleLeft && stepLeft + stepWidth <= visibleRight;
  }

  function getFollowScrollLeft(options) {
    if (!options.followEnabled || options.followSuspended) return null;
    const maximum = Math.max(0, (Number(options.scrollWidth) || 0) - (Number(options.clientWidth) || 0));
    const current = clamp(Number(options.scrollLeft) || 0, 0, maximum);
    if (isStepVisible({ ...options, scrollLeft: current })) return null;

    const clientWidth = Math.max(0, Number(options.clientWidth) || 0);
    const stepLeft = Number(options.stepLeft) || 0;
    const stepWidth = Math.max(0, Number(options.stepWidth) || 0);
    const leadingInset = Math.max(0, Number(options.leadingInset) || 0);
    const margin = Math.max(0, Number(options.margin) || 0);
    const visibleLeft = current + leadingInset + margin;
    const stepRight = stepLeft + stepWidth;
    let requested = current;

    if (stepLeft < visibleLeft) {
      requested = stepLeft - leadingInset - margin;
    } else {
      requested = stepRight - clientWidth + margin;
    }

    const target = clamp(requested, 0, maximum);
    return Math.abs(target - current) < 0.5 ? null : target;
  }

  return { clamp, isStepVisible, getFollowScrollLeft };
});
