/* stream-ui-studio — общий помощник перетаскивания.
   Используется панелью редактора, меню инспектора и оверлеем чата. */
(function () {
  'use strict';

  var SUI_FILE = 'lib/drag.js';
  var SUI_FILES = (window.__SUI_FILES__ = window.__SUI_FILES__ || {});
  if (window.__SUI_LOADED__ || SUI_FILES[SUI_FILE] === 'done') return;
  window.__SUI_LOADING__ = SUI_FILE;

  var SUI = window.SUI;

  function clampNumber(value, min, max) {
    var number = Number(value);
    if (!isFinite(number)) return min;
    if (max < min) return min;
    return Math.min(max, Math.max(min, number));
  }

  /* Ограничение прямоугольника внутри viewport. */
  function clampToViewport(position, rect, margin) {
    var gap = Number(margin) || 0;
    var width = rect && rect.width ? rect.width : 0;
    var height = rect && rect.height ? rect.height : 0;
    var maxX = Math.max(gap, window.innerWidth - width - gap);
    var maxY = Math.max(gap, window.innerHeight - height - gap);
    return {
      x: clampNumber(position && position.x, gap, maxX),
      y: clampNumber(position && position.y, gap, maxY)
    };
  }

  function validPosition(value) {
    if (!value || typeof value !== 'object') return null;
    var x = Number(value.x);
    var y = Number(value.y);
    if (!isFinite(x) || !isFinite(y)) return null;
    if (Math.abs(x) > 10000 || Math.abs(y) > 10000) return null;
    return { x: x, y: y };
  }

  /* attach({
       handle,             // элемент, за который тянут (может быть в Shadow DOM)
       element,            // элемент, положение которого меняем (для измерений)
       getPosition,        // () => {x, y}
       setPosition,        // ({x, y}) => void
       clamp,              // optional ({x, y}, rect) => {x, y}
       onEnd               // optional ({x, y}) => void — сохранить позицию
     }) => detach() */
  function attach(options) {
    if (!options || !options.handle || !options.getPosition || !options.setPosition) {
      return function () {};
    }

    var handle = options.handle;
    var dragging = false;
    var pointerId = null;
    var startPointer = null;
    var startPosition = null;

    function ignoredTarget(target) {
      if (!target || !target.closest) return false;
      return !!target.closest('button, input, textarea, select, label, a');
    }

    function onDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (ignoredTarget(event.target)) return;
      dragging = true;
      pointerId = event.pointerId;
      startPointer = { x: event.clientX, y: event.clientY };
      startPosition = options.getPosition() || { x: 0, y: 0 };
      if (handle.setPointerCapture && pointerId !== undefined) {
        try { handle.setPointerCapture(pointerId); } catch (err) { /* нет capture — работаем на window */ }
      }
      if (handle.classList) handle.classList.add('sui-dragging');
      event.preventDefault();
    }

    function onMove(event) {
      if (!dragging) return;
      var rect = options.element ? options.element.getBoundingClientRect() : null;
      var next = {
        x: startPosition.x + event.clientX - startPointer.x,
        y: startPosition.y + event.clientY - startPointer.y
      };
      if (options.clamp) next = options.clamp(next, rect) || next;
      options.setPosition(next);
      event.preventDefault();
    }

    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (handle.releasePointerCapture && pointerId !== undefined) {
        try { handle.releasePointerCapture(pointerId); } catch (err) { /* уже отпущено */ }
      }
      pointerId = null;
      if (handle.classList) handle.classList.remove('sui-dragging');
      if (options.onEnd) options.onEnd(options.getPosition());
    }

    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);

    return function () {
      handle.removeEventListener('pointerdown', onDown);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
    };
  }

  SUI.drag = {
    attach: attach,
    clampToViewport: clampToViewport,
    validPosition: validPosition,
    clampNumber: clampNumber
  };

  SUI_FILES[SUI_FILE] = 'done';
})();
