/* stream-ui-studio — визуальный инспектор DOM: подсветка, селектор, действия и цвета. */
(function () {
  'use strict';

  var SUI_FILE = 'lib/inspector.js';
  var SUI_FILES = (window.__SUI_FILES__ = window.__SUI_FILES__ || {});
  if (window.__SUI_LOADED__ || SUI_FILES[SUI_FILE] === 'done') return;
  window.__SUI_LOADING__ = SUI_FILE;

  var SUI = window.SUI;
  var SWATCHES = ['#0B0C0E', '#9146FF', '#FF0033', '#10B981', '#F5F5F5'];
  var active = false;
  var host = null;
  var shadow = null;
  var box = null;
  var tip = null;
  var menu = null;
  var menuHead = null;
  var menuBody = null;
  var menuDragDetach = null;
  var hovered = null;
  var changeCallbacks = [];
  var accent = '#FF0033';
  var currentPlatform = null;

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (ch) {
      return '\\' + ch;
    });
  }

  function attrSelector(el, name) {
    var value = el.getAttribute(name);
    if (!value) return '';
    value = value.trim();
    if (!value || value.length > 80) return '';
    return '[' + name + '=' + JSON.stringify(value) + ']';
  }

  function part(el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'html' || tag === 'body') return tag;
    var result = tag;
    var preferred = ['data-a-target', 'data-test-selector', 'data-testid', 'id'];
    for (var i = 0; i < preferred.length; i += 1) {
      var partValue = preferred[i] === 'id' ? '#' + cssEscape(el.id) : attrSelector(el, preferred[i]);
      if (preferred[i] === 'id' && !el.id) partValue = '';
      if (partValue) {
        result += partValue;
        return result;
      }
    }
    var aria = attrSelector(el, 'aria-label');
    if (aria) result += aria;
    if (el.classList && el.classList.length) {
      var classes = Array.prototype.slice.call(el.classList).filter(function (name) {
        return name.indexOf('sui-') !== 0 && name.length < 48 && /^[a-zA-Z][\w-]*$/.test(name);
      }).slice(0, 2);
      if (classes.length) result += classes.map(function (name) { return '.' + cssEscape(name); }).join('');
    }
    var parent = el.parentElement;
    if (parent) {
      var sameTag = Array.prototype.filter.call(parent.children, function (child) {
        return child.tagName === el.tagName;
      });
      if (sameTag.length > 1) result += ':nth-of-type(' + (sameTag.indexOf(el) + 1) + ')';
    }
    return result;
  }

  function buildSelector(el) {
    if (!el || el.nodeType !== 1 || el === document.documentElement) return 'html';
    var path = [];
    var node = el;
    var depth = 0;
    while (node && node.nodeType === 1 && depth < 7) {
      path.unshift(part(node));
      if (node.id && path.length > 1) break;
      if (node === document.body) break;
      node = node.parentElement;
      depth += 1;
    }
    var selector = path.join(' > ');
    try {
      var matches = document.querySelectorAll(selector);
      if (matches.length === 1 && matches[0] === el) return selector;
    } catch (e) { /* fallback ниже */ }
    return selector;
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function (value) {
      return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
    }).join('');
  }

  function computedHex(el, property, fallback) {
    var value = '';
    try { value = window.getComputedStyle(el)[property] || ''; } catch (e) { return fallback; }
    var match = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(value);
    if (match) {
      return rgbToHex({ r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) });
    }
    if (/^#[0-9a-f]{6}$/i.test(value.trim())) return value.trim();
    return fallback;
  }

  function readableText(hex) {
    var rgb = /^#([0-9a-f]{6})$/i.exec(hex || '');
    if (!rgb) return '#E7E7EA';
    var number = parseInt(rgb[1], 16);
    var r = (number >> 16) & 255;
    var g = (number >> 8) & 255;
    var b = number & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0B0C0E' : '#FFFFFF';
  }

  function ensureOverlay() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.id = 'sui-inspector-overlay';
    host.setAttribute('data-sui', 'overlay');
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483646',
      pointerEvents: 'none'
    });
    shadow = host.attachShadow({ mode: 'open' });

    var style = document.createElement('style');
    style.textContent = [
      ':host { all: initial; }',
      '* { box-sizing: border-box; }',
      '.box { position: fixed; border: 1px solid var(--sui-accent, #FF0033); background: rgba(255,0,51,0.06); box-shadow: 0 0 0 1px rgba(0,0,0,.55); pointer-events: none; }',
      '.tip { position: fixed; max-width: min(520px, 70vw); padding: 5px 8px; background: #0B0C0E; border: 1px solid rgba(255,255,255,.08); color: #E7E7EA; font: 11px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }',
      '.menu { position: fixed; width: 216px; padding: 0 0 4px; background: #0B0C0E; border: 1px solid rgba(255,255,255,.08); box-shadow: 0 10px 30px rgba(0,0,0,.5); pointer-events: auto; font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }',
      '.menu-head { display: flex; align-items: center; height: 24px; padding: 0 8px; border-bottom: 1px solid rgba(255,255,255,.08); background: #101114; color: #77777E; font: 10px/1 ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; cursor: move; touch-action: none; user-select: none; }',
      '.menu-head.sui-dragging { color: var(--sui-accent, #FF0033); }',
      '.menu-title { padding: 6px 8px; color: #77777E; font: 10px/1.3 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid rgba(255,255,255,.06); margin-bottom: 3px; word-break: break-all; }',
      '.menu button { display: block; width: 100%; text-align: left; padding: 7px 8px; margin: 0; background: transparent; border: 1px solid transparent; color: #E7E7EA; font: inherit; cursor: pointer; }',
      '.menu button:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.08); }',
      '.menu button span { color: #77777E; margin-right: 7px; font-family: ui-monospace, monospace; }',
      '.menu-colors { padding: 6px 8px 2px; border-top: 1px solid rgba(255,255,255,.06); display: flex; gap: 8px; }',
      '.menu-colors label { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 4px; color: #77777E; font: 10px/1 ui-monospace, monospace; }',
      '.menu-colors input[type="color"] { width: 26px; height: 20px; padding: 0; border: 1px solid rgba(255,255,255,.08); background: transparent; cursor: pointer; }',
      '.swatches { display: flex; gap: 5px; padding: 4px 8px 6px; }',
      '.swatches button { width: 22px; height: 18px; padding: 0; border: 1px solid rgba(255,255,255,.12); cursor: pointer; }',
      '.swatches button:hover { border-color: var(--sui-accent, #FF0033); }',
      '.reset-color { border-top: 1px solid rgba(255,255,255,.06) !important; color: #77777E !important; font: 10px/1 ui-monospace, monospace !important; letter-spacing: .06em; }'
    ].join('\n');
    shadow.appendChild(style);

    box = document.createElement('div');
    box.className = 'box';
    tip = document.createElement('div');
    tip.className = 'tip';
    menu = document.createElement('div');
    menu.className = 'menu';
    menu.hidden = true;

    menuHead = document.createElement('div');
    menuHead.className = 'menu-head';
    menuHead.textContent = 'Действия ⋮⋮';
    menu.appendChild(menuHead);

    menuBody = document.createElement('div');
    menu.appendChild(menuBody);

    shadow.appendChild(box);
    shadow.appendChild(tip);
    shadow.appendChild(menu);
    (document.body || document.documentElement).appendChild(host);

    if (SUI.drag) {
      menuDragDetach = SUI.drag.attach({
        handle: menuHead,
        element: menu,
        getPosition: function () {
          return {
            x: parseFloat(menu.style.left) || menu.getBoundingClientRect().left,
            y: parseFloat(menu.style.top) || menu.getBoundingClientRect().top
          };
        },
        setPosition: function (position) {
          menu.style.left = Math.round(position.x) + 'px';
          menu.style.top = Math.round(position.y) + 'px';
        },
        clamp: function (position, rect) {
          return SUI.drag.clampToViewport(position, rect || menu.getBoundingClientRect(), 4);
        },
        onEnd: function (position) {
          var state = SUI.storage.platform(currentPlatform);
          if (!state) return;
          var full = SUI.storage.getState();
          full.ui.menuPos = { x: Math.round(position.x), y: Math.round(position.y) };
          SUI.storage.save();
        }
      });
    }
  }

  function setAccent(platform) {
    if (!SUI.SELECTORS[platform]) return;
    currentPlatform = platform;
    if (SUI.styleEngine && SUI.styleEngine.resolveTheme) {
      var state = SUI.storage.platform(platform);
      accent = SUI.styleEngine.resolveTheme(platform, state).accentCss;
    } else {
      accent = SUI.SELECTORS[platform].accent;
    }
    if (host) host.style.setProperty('--sui-accent', accent);
  }

  function hideHighlights() {
    if (!box) return;
    box.style.display = 'none';
    tip.style.display = 'none';
    hovered = null;
  }

  function closeMenu() {
    if (!menu) return;
    menu.hidden = true;
    menuBody.textContent = '';
  }

  function notifyChange() {
    changeCallbacks.forEach(function (fn) { try { fn(); } catch (e) { /* noop */ } });
  }

  function applyAction(action, selector, display) {
    var platformState = SUI.storage.platform(currentPlatform);
    if (!platformState) return;
    var overrides = platformState.overrides;
    var existingIndex = overrides.findIndex(function (item) { return item.selector === selector; });

    if (action === 'restore') {
      if (existingIndex >= 0) overrides.splice(existingIndex, 1);
      else overrides.push({
        id: 'ov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        selector: selector,
        action: 'restore',
        display: display || 'block',
        createdAt: Date.now()
      });
    } else if (existingIndex >= 0) {
      overrides[existingIndex].action = action;
    } else {
      overrides.push({
        id: 'ov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        selector: selector,
        action: action,
        createdAt: Date.now()
      });
    }
    SUI.storage.save();
    notifyChange();
  }

  function applyColor(selector, bg, text) {
    var platformState = SUI.storage.platform(currentPlatform);
    if (!platformState) return;
    var overrides = platformState.overrides;
    var existingIndex = overrides.findIndex(function (item) {
      return item.selector === selector && item.action === 'color';
    });

    if (!bg && !text) {
      if (existingIndex >= 0) overrides.splice(existingIndex, 1);
      else return;
    } else if (existingIndex >= 0) {
      var entry = overrides[existingIndex];
      if (bg) entry.bg = bg;
      else delete entry.bg;
      if (text) entry.text = text;
      else delete entry.text;
    } else {
      var item = {
        id: 'ov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        selector: selector,
        action: 'color',
        createdAt: Date.now()
      };
      if (bg) item.bg = bg;
      if (text) item.text = text;
      overrides.push(item);
    }
    SUI.storage.save();
    notifyChange();
  }

  function colorInput(labelText, value, onInput) {
    var wrap = document.createElement('label');
    wrap.appendChild(document.createTextNode(labelText));
    var input = document.createElement('input');
    input.type = 'color';
    input.value = value;
    input.addEventListener('input', function () { onInput(input.value); });
    wrap.appendChild(input);
    return { node: wrap, input: input };
  }

  function buildColorControls(selector, el) {
    var platformState = SUI.storage.platform(currentPlatform);
    var existing = platformState ? platformState.overrides.find(function (item) {
      return item.selector === selector && item.action === 'color';
    }) : null;
    var fallbackBg = computedHex(el, 'backgroundColor', '#0B0C0E');
    var fallbackText = computedHex(el, 'color', '#E7E7EA');
    var bgValue = existing && existing.bg ? existing.bg : fallbackBg;
    var textValue = existing && existing.text ? existing.text : fallbackText;

    var colors = document.createElement('div');
    colors.className = 'menu-colors';
    var bgControl = colorInput('ФОН', bgValue, function (value) { applyColor(selector, value, textControl.input.value); });
    var textControl = colorInput('ТЕКСТ', textValue, function (value) { applyColor(selector, bgControl.input.value, value); });
    colors.appendChild(bgControl.node);
    colors.appendChild(textControl.node);

    var swatches = document.createElement('div');
    swatches.className = 'swatches';
    SWATCHES.forEach(function (value) {
      var button = document.createElement('button');
      button.type = 'button';
      button.style.background = value;
      button.title = value + ' — фон с контрастным текстом';
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        bgControl.input.value = value;
        textControl.input.value = readableText(value);
        applyColor(selector, value, textControl.input.value);
      });
      swatches.appendChild(button);
    });

    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'reset-color';
    reset.textContent = 'Сбросить цвет';
    reset.addEventListener('click', function (event) {
      event.stopPropagation();
      bgControl.input.value = fallbackBg;
      textControl.input.value = fallbackText;
      applyColor(selector, '', '');
    });

    menuBody.appendChild(colors);
    menuBody.appendChild(swatches);
    menuBody.appendChild(reset);
  }

  function openMenu(x, y, el, selector) {
    ensureOverlay();
    closeMenu();
    var display = getComputedStyle(el).display || 'block';
    var title = document.createElement('div');
    title.className = 'menu-title';
    title.textContent = selector.length > 60 ? selector.slice(0, 57) + '…' : selector;
    menuBody.appendChild(title);

    [
      { action: 'hide', label: 'Скрыть', mark: '01' },
      { action: 'dim', label: 'Полупрозрачный', mark: '02' },
      { action: 'restore', label: 'Вернуть обратно', mark: '03' }
    ].forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      var mark = document.createElement('span');
      mark.textContent = item.mark;
      button.appendChild(mark);
      button.appendChild(document.createTextNode(item.label));
      button.addEventListener('click', function (event) {
        event.stopPropagation();
        event.preventDefault();
        applyAction(item.action, selector, display);
        closeMenu();
        hideHighlights();
      });
      menuBody.appendChild(button);
    });

    buildColorControls(selector, el);

    menu.hidden = false;
    var full = SUI.storage.getState();
    var saved = full.ui && full.ui.menuPos;
    var desired = saved || { x: x + 8, y: y + 8 };
    var position = SUI.drag
      ? SUI.drag.clampToViewport(desired, menu.getBoundingClientRect(), 4)
      : { x: Math.min(desired.x, window.innerWidth - 224), y: Math.min(desired.y, window.innerHeight - 300) };
    menu.style.left = Math.round(position.x) + 'px';
    menu.style.top = Math.round(position.y) + 'px';
  }

  function onMove(event) {
    if (!active) return;
    if (menu && !menu.hidden) return;
    var el = document.elementFromPoint(event.clientX, event.clientY);
    if (!el || el.getRootNode && el.getRootNode() !== document) {
      hideHighlights();
      return;
    }
    if (el === document.documentElement || el === document.body || el.closest && el.closest('#sui-inspector-overlay')) {
      hideHighlights();
      return;
    }
    hovered = el;
    var rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      hideHighlights();
      return;
    }
    var selector = buildSelector(el);
    box.style.display = 'block';
    box.style.left = rect.left + 'px';
    box.style.top = rect.top + 'px';
    box.style.width = rect.width + 'px';
    box.style.height = rect.height + 'px';
    tip.style.display = 'block';
    tip.textContent = selector;
    tip.style.left = Math.max(4, Math.min(event.clientX + 14, window.innerWidth - 540)) + 'px';
    tip.style.top = Math.max(4, event.clientY - 30) + 'px';
  }

  function onClick(event) {
    if (!active) return;
    if (shadow && shadow.host === event.target) return;
    if (event.target && event.target.id === 'sui-ui-host') return;
    var el = hovered || document.elementFromPoint(event.clientX, event.clientY);
    if (!el || el.getRootNode && el.getRootNode() !== document) return;
    if (el === document.documentElement || el === document.body) return;
    event.preventDefault();
    event.stopPropagation();
    openMenu(event.clientX, event.clientY, el, buildSelector(el));
  }

  function onKey(event) {
    if (event.key === 'Escape') {
      closeMenu();
      hideHighlights();
      if (active) disable();
    }
  }

  function enable(platform) {
    setAccent(platform);
    ensureOverlay();
    active = true;
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    SUI.styleEngine.setInspector(true);
  }

  function disable() {
    active = false;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    SUI.styleEngine.setInspector(false);
    closeMenu();
    hideHighlights();
  }

  SUI.inspector = {
    enable: function (platform) { if (!active) enable(platform); },
    disable: disable,
    toggle: function (platform) { active ? disable() : enable(platform); },
    isActive: function () { return active; },
    setPlatform: setAccent,
    onChange: function (fn) { changeCallbacks.push(fn); }
  };

  SUI_FILES[SUI_FILE] = 'done';
})();
