/* stream-ui-studio — генерация CSS, темы/цвета, оверлей чата, SPA-навигация. */
(function () {
  'use strict';

  var SUI_FILE = 'lib/style-engine.js';
  var SUI_FILES = (window.__SUI_FILES__ = window.__SUI_FILES__ || {});
  if (window.__SUI_LOADED__ || SUI_FILES[SUI_FILE] === 'done') return;
  window.__SUI_LOADING__ = SUI_FILE;

  var SUI = window.SUI;
  var DOM_IDS = SUI.DOM_IDS;
  var routeCallbacks = [];
  var currentPlatform = null;
  var currentState = null;
  var inspectorActive = false;
  var overlayEnabled = false;
  var styleNode = null;
  var lastSignature = '';
  var routeTimer = null;
  var chatHandle = null;
  var chatDragDetach = null;
  var chatOverlayRoot = null;
  var chatPlatform = null;
  var chatMove = null;

  function ensureStyleNode() {
    if (styleNode && styleNode.isConnected) return styleNode;
    styleNode = document.getElementById(DOM_IDS.STYLE);
    if (!styleNode) {
      styleNode = document.createElement('style');
      styleNode.id = DOM_IDS.STYLE;
      styleNode.setAttribute('data-sui', 'generated');
    }
    var target = document.head || document.documentElement;
    if (styleNode.parentNode !== target) target.appendChild(styleNode);
    return styleNode;
  }

  function firstMatching(selectors) {
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        if (document.querySelector(selectors[i])) return selectors[i];
      } catch (e) { /* несовместимый селектор — пропускаем */ }
    }
    return null;
  }

  function block(selectors, declarations) {
    if (!selectors || !selectors.length) return '';
    var rules = declarations.map(function (declaration) { return declaration + ' !important'; });
    return selectors.join(',\n') + ' {\n  ' + rules.join(';\n  ') + ';\n}\n';
  }

  function overlayScoped(selectors) {
    return (selectors || []).map(function (selector) {
      return '.sui-chat-overlay ' + selector;
    });
  }

  /* Селектор ленты может совпадать с корнем оверлея (например, в fullscreen),
     поэтому поддерживаем и потомка, и сам корень с классом .sui-chat-overlay. */
  function overlayFeedSelectors(selector) {
    if (!selector) return [];
    return ['.sui-chat-overlay ' + selector, selector + '.sui-chat-overlay'];
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function platformRootPresent(platform) {
    if (platform === 'twitch') return !!document.querySelector('.tw-root, #root');
    if (platform === 'youtube') return !!document.querySelector('ytd-app, #player, ytd-watch-flexy');
    return false;
  }

  function isTheaterOrFullscreen(platform) {
    if (fullscreenElement()) return true;
    var spec = platform ? SUI.SELECTORS[platform] : null;
    var selectors = spec && spec.theaterSelectors ? spec.theaterSelectors : [];
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        if (document.querySelector(selectors[i])) return true;
      } catch (e) { /* noop */ }
    }
    return false;
  }

  function routeSignature(platform) {
    var spec = platform ? SUI.SELECTORS[platform] : null;
    var chat = spec ? firstMatching(spec.chatRoot) : null;
    var overlayRoot = spec && spec.chatOverlayRoot ? firstMatching(spec.chatOverlayRoot) : null;
    var fs = fullscreenElement();
    return [
      location.href,
      document.title,
      chat || '-',
      overlayRoot || '-',
      platform ? (platformRootPresent(platform) ? 'dom' : 'nodom') : '-',
      fs ? 'fs:' + (fs.id || fs.tagName || 'el') : '-',
      platform && isTheaterOrFullscreen(platform) ? 'theater' : '-'
    ].join('|');
  }

  function emitRoute(reason) {
    routeCallbacks.forEach(function (fn) {
      try { fn(reason); } catch (e) { /* noop */ }
    });
  }

  function checkRoute(reason) {
    var platform = SUI.detectPlatform(location.hostname);
    var signature = routeSignature(platform);
    if (signature === lastSignature) return;
    lastSignature = signature;
    emitRoute(reason || 'route');
  }

  function scheduleRouteCheck(reason) {
    if (routeTimer) clearTimeout(routeTimer);
    routeTimer = setTimeout(function () {
      routeTimer = null;
      checkRoute(reason);
    }, 220);
  }

  /* --- Цвет: безопасное преобразование hex -------------------------------- */

  function hexToRgb(value) {
    var match = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
    if (!match) return { r: 11, g: 12, b: 14 };
    var number = parseInt(match[1], 16);
    return { r: (number >> 16) & 255, g: (number >> 8) & 255, b: number & 255 };
  }

  function channel(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function rgbToHex(rgb) {
    return '#' + [rgb.r, rgb.g, rgb.b].map(function (value) {
      return channel(value).toString(16).padStart(2, '0');
    }).join('');
  }

  function rgbaCss(rgb, alpha, minAlpha) {
    var low = minAlpha == null ? 0 : minAlpha;
    var a = SUI.drag.clampNumber(alpha, low, 1, 1);
    return 'rgba(' + channel(rgb.r) + ', ' + channel(rgb.g) + ', ' + channel(rgb.b) + ', ' + a + ')';
  }

  /* Оттенок/насыщенность/контраст — это filter на контенте, а не пересчёт
     hex-значений. Так пипетки остаются честными, а фильтр не трогает панель. */
  function themeFilter(theme) {
    var hue = SUI.drag.clampNumber(theme.hue, -60, 60, 0);
    var sat = SUI.drag.clampNumber(theme.saturation, 0, 200, 100);
    var contrast = SUI.drag.clampNumber(theme.contrast, 50, 150, 100);
    if (!hue && sat === 100 && contrast === 100) return 'none';
    var parts = [];
    if (hue) parts.push('hue-rotate(' + hue + 'deg)');
    if (sat !== 100) parts.push('saturate(' + sat + '%)');
    if (contrast !== 100) parts.push('contrast(' + contrast + '%)');
    return parts.length ? parts.join(' ') : 'none';
  }

  function resolveTheme(platform, state) {
    var fallbackKey = SUI.THEME_DEFAULT[platform] || 'default';
    var theme = state && state.theme ? state.theme : SUI.emptyTheme(platform);
    var preset = SUI.THEME_PRESETS[theme.preset] || SUI.THEME_PRESETS[fallbackKey] || SUI.THEME_PRESETS.default;
    var alpha = SUI.drag.clampNumber(theme.alpha, 0.15, 1, preset.alpha == null ? 1 : preset.alpha);

    var accent = hexToRgb(theme.accent || preset.accent);
    var bg = hexToRgb(theme.bg || preset.bg);
    var surface = hexToRgb(theme.surface || preset.surface);
    var text = hexToRgb(theme.text || preset.text);

    return {
      preset: preset,
      accentCss: rgbToHex(accent),
      bgCss: rgbaCss(bg, alpha, 0.15),
      surfaceCss: rgbaCss(surface, alpha, 0.15),
      textCss: rgbToHex(text),
      accentRgb: accent,
      bgRgb: bg,
      surfaceRgb: surface,
      textRgb: text,
      filter: themeFilter(theme)
    };
  }

  function themeSelectors(platform) {
    if (platform === 'youtube') {
      return [
        'html',
        'html[dark]',
        'html.sui-youtube',
        'html[dark].sui-youtube',
        'body',
        'ytd-app',
        '#masthead-container',
        'ytd-mini-guide-renderer',
        'tp-yt-app-drawer'
      ];
    }
    return [':root', 'html.sui-twitch', '.tw-root--theme-dark', 'body'];
  }

  function themeDeclarations(platform, resolved) {
    if (platform === 'youtube') {
      return [
        '--yt-spec-base-background: ' + resolved.bgCss,
        '--yt-spec-raised-background: ' + resolved.surfaceCss,
        '--yt-spec-menu-background: ' + resolved.surfaceCss,
        '--yt-spec-general-background-a: ' + resolved.bgCss,
        '--yt-spec-brand-background-solid: ' + resolved.bgCss,
        '--yt-spec-10-percent-layer: ' + resolved.surfaceCss,
        '--yt-spec-text-primary: ' + resolved.textCss,
        '--yt-spec-text-secondary: ' + resolved.textCss,
        '--yt-spec-inverted-background: ' + resolved.textCss,
        '--yt-spec-call-to-action: ' + resolved.accentCss
      ];
    }
    return [
      '--color-background-body: ' + resolved.bgCss,
      '--color-background-base: ' + resolved.bgCss,
      '--color-background-alt: ' + resolved.surfaceCss,
      '--color-background-alt-2: ' + resolved.surfaceCss,
      '--color-background-float: ' + resolved.surfaceCss,
      '--color-text-base: ' + resolved.textCss,
      '--color-text-alt: ' + resolved.textCss,
      '--color-brand-accent: ' + resolved.accentCss,
      '--color-brand: ' + resolved.accentCss,
      '--color-brand-alt: ' + resolved.accentCss,
      '--color-accent: ' + resolved.accentCss
    ];
  }

  function filterSelectors(platform) {
    var spec = SUI.SELECTORS[platform];
    var targets = spec && spec.filterTarget ? spec.filterTarget : [];
    /* Фильтр родителя и потомка складывался бы: между .inject-layout и main
       берём только первый реально существующий контейнер. */
    var selector = firstMatching(targets);
    if (!selector) return [];
    return ['html.sui-' + platform + ' ' + selector +
      ':not(#sui-ui-host):not(#sui-inspector-overlay):not(#sui-chat-handle)'];
  }

  /* --- Оверлей чата ------------------------------------------------------- */

  function chatOffset() {
    var root = document.documentElement;
    return {
      x: parseFloat(root.style.getPropertyValue('--sui-chat-dx')) || 0,
      y: parseFloat(root.style.getPropertyValue('--sui-chat-dy')) || 0
    };
  }

  function setChatOffset(position) {
    var root = document.documentElement;
    root.style.setProperty('--sui-chat-dx', Math.round(position.x) + 'px');
    root.style.setProperty('--sui-chat-dy', Math.round(position.y) + 'px');
  }

  function clampChatOffset(position) {
    /* Базовое положение чата: right:16px; top:64px; width:340px;
       высота = viewport - 64px - 72px. */
    var baseLeft = Math.max(0, window.innerWidth - 16 - 340);
    var baseTop = 64;
    var minLeft = 8;
    var maxLeft = Math.max(minLeft, window.innerWidth - 340 - 8);
    var minTop = 8;
    var maxTop = Math.max(minTop, window.innerHeight - Math.max(120, window.innerHeight - 136) - 8);
    var left = SUI.drag.clampNumber(baseLeft + position.x, minLeft, maxLeft);
    var top = SUI.drag.clampNumber(baseTop + position.y, minTop, maxTop);
    return { x: left - baseLeft, y: top - baseTop };
  }

  function saveChatOffset(position) {
    if (!chatPlatform) return;
    var full = SUI.storage.getState();
    if (!full.ui) full.ui = { chatPos: {} };
    if (!full.ui.chatPos) full.ui.chatPos = {};
    full.ui.chatPos[chatPlatform] = { x: Math.round(position.x), y: Math.round(position.y) };
    SUI.storage.save();
  }

  function overlayRootElement() {
    if (!chatOverlayRoot) return null;
    try {
      return document.querySelector(chatOverlayRoot);
    } catch (e) {
      return null;
    }
  }

  function removeChatHandle() {
    if (chatDragDetach) {
      chatDragDetach();
      chatDragDetach = null;
    }
    if (chatHandle && chatHandle.parentNode) chatHandle.parentNode.removeChild(chatHandle);
    chatHandle = null;
  }

  function ensureChatHandle(platform) {
    if (!chatOverlayRoot || !SUI.drag) return;
    chatPlatform = platform;
    /* Полоска живёт внутри корня оверлея: тогда она всегда поверх ленты и
       автоматически переезжает вместе с чатом в нативный fullscreen. */
    var target = overlayRootElement() || document.body || document.documentElement;
    if (!chatHandle || !chatHandle.isConnected) {
      if (chatDragDetach) chatDragDetach();
      chatHandle = document.getElementById('sui-chat-handle');
      if (!chatHandle) {
        chatHandle = document.createElement('div');
        chatHandle.id = 'sui-chat-handle';
        chatHandle.setAttribute('data-sui', 'chat-handle');
        var label = document.createElement('span');
        label.textContent = 'ЧАТ · ПЕРЕТАСКИВАТЬ';
        chatHandle.appendChild(label);
      }
      target.insertBefore(chatHandle, target.firstChild);
      chatDragDetach = SUI.drag.attach({
        handle: chatHandle,
        element: chatHandle,
        getPosition: chatOffset,
        setPosition: setChatOffset,
        clamp: clampChatOffset,
        onEnd: saveChatOffset
      });
    } else if (chatHandle.parentNode !== target) {
      target.insertBefore(chatHandle, target.firstChild);
    }
  }

  /* В нативном fullscreen браузер показывает в top-layer только
     document.fullscreenElement. Поэтому чат временно переезжает внутрь него,
     а на исходное место его возвращает comment-placeholder. */
  function findChatMoveRoot(platform) {
    var spec = SUI.SELECTORS[platform];
    var selectors = spec && spec.chatFullscreenRoot
      ? spec.chatFullscreenRoot
      : (spec && spec.chatOverlayRoot) || [];
    var node = null;
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        node = document.querySelector(selectors[i]);
        if (node) break;
      } catch (e) { /* noop */ }
    }
    if (!node) return null;

    /* Если нашли внутренний узел — берём его обёртку, чтобы React/Polymer
       не потеряли свой контейнер. */
    if (platform === 'twitch' && node.classList && node.classList.contains('stream-chat')) {
      var shell = node.closest('.chat-shell') || node.closest('[data-a-target="chat-container"]');
      if (shell && shell.contains(node)) node = shell;
    }
    if (platform === 'youtube' && node.tagName && node.tagName.toLowerCase() === 'iframe') {
      var frame = node.closest('ytd-live-chat-frame');
      if (frame) node = frame;
    }
    return node;
  }

  function restoreChatFromFullscreen() {
    if (!chatMove) return;
    var info = chatMove;
    chatMove = null;

    if (info.node && info.node.classList) info.node.classList.remove('sui-chat-overlay');
    if (!info.moved || !info.placeholder) return;

    var parent = info.placeholder.parentNode || info.parent;
    if (parent && parent.isConnected) {
      if (info.placeholder.parentNode === parent) parent.insertBefore(info.node, info.placeholder);
      else if (info.next && info.next.parentNode === parent) parent.insertBefore(info.node, info.next);
      else parent.appendChild(info.node);
    } else if (info.parent && info.parent.isConnected) {
      info.parent.appendChild(info.node);
    } else {
      (document.body || document.documentElement).appendChild(info.node);
    }
    if (info.placeholder.parentNode) info.placeholder.parentNode.removeChild(info.placeholder);
  }

  function moveChatIntoFullscreen(platform, fsElement) {
    if (!fsElement || !fsElement.appendChild) return;
    var node = findChatMoveRoot(platform);
    if (!node) return;
    if (chatMove && chatMove.node === node && chatMove.fullscreen === fsElement) {
      node.classList.add('sui-chat-overlay');
      return;
    }
    if (chatMove) restoreChatFromFullscreen();
    if (!node.parentNode) return;

    var parent = node.parentNode;
    var next = node.nextSibling;
    var placeholder = document.createComment('sui-chat-placeholder');
    parent.insertBefore(placeholder, node);

    chatMove = {
      node: node,
      fullscreen: fsElement,
      placeholder: placeholder,
      parent: parent,
      next: next,
      moved: true
    };
    try {
      fsElement.appendChild(node);
      node.classList.add('sui-chat-overlay');
    } catch (e) {
      restoreChatFromFullscreen();
    }
  }

  function syncFullscreenChat(platform, platformState) {
    var active = !!(platform && platformState && platformState.presets.chatOverlay);
    var fs = fullscreenElement();
    if (!active || !fs) {
      restoreChatFromFullscreen();
      return;
    }
    moveChatIntoFullscreen(platform, fs);
  }

  /* --- CSS ---------------------------------------------------------------- */

  function buildCSS(platform, platformState, overlayActive) {
    var spec = SUI.SELECTORS[platform];
    var css = [];
    var resolved = resolveTheme(platform, platformState);
    var chatOpacity = SUI.drag.clampNumber(platformState.chat.bgOpacity, 0, 1, 1);
    var overlayOpacity = SUI.drag.clampNumber(platformState.chat.overlayBgOpacity, 0, 1, 0);
    var chatBg = rgbaCss(resolved.bgRgb, chatOpacity, 0);
    var overlayBg = rgbaCss(resolved.bgRgb, overlayOpacity, 0);
    var transparentOverlay = overlayOpacity < 0.65;

    css.push('/* stream-ui-studio :: ' + spec.name + ' */');
    css.push(block(themeSelectors(platform), themeDeclarations(platform, resolved)));

    if (platform === 'youtube') {
      css.push('/* прямой фон приложения и шапки */');
      css.push(block(['ytd-app', '#masthead'], [
        'background-color: ' + resolved.bgCss,
        'color: ' + resolved.textCss
      ]));
    }

    if (resolved.filter !== 'none') {
      css.push('/* фильтр только на контенте, не на хосте панели */');
      css.push(block(filterSelectors(platform), ['filter: ' + resolved.filter]));
    }
    css.push(block(['#sui-ui-host', '#sui-inspector-overlay', '#sui-chat-handle'], ['filter: none']));

    css.push('html.sui-inspector-active, html.sui-inspector-active * { cursor: crosshair !important; }');
    css.push('html.sui-inspector-active #sui-ui-host, html.sui-inspector-active #sui-inspector-overlay, html.sui-inspector-active #sui-chat-handle { cursor: default !important; }');

    SUI.PRESET_KEYS.forEach(function (key) {
      if (!platformState.presets[key]) return;
      if (key === 'chatOverlay' || key === 'compactChat') return;
      var selectors = spec.presets[key] || [];
      if (!selectors.length) return;
      css.push('/* preset: ' + key + ' */');
      css.push(block(selectors, ['display: none']));
    });

    var chatRoot = firstMatching(spec.chatRoot);
    var base = platform === 'twitch' ? 13 : 14;

    css.push('/* чат: масштаб и фон */');
    css.push(block(spec.chatText, [
      'font-size: calc(' + base + 'px * var(--sui-chat-scale, 1))',
      'line-height: calc(1.35 * var(--sui-chat-scale, 1))'
    ]));
    css.push(block(spec.chatSurface || [], [
      'background: ' + chatBg,
      'color: ' + resolved.textCss
    ]));
    if (chatRoot) {
      css.push(block([chatRoot], ['background: ' + chatBg]));
    }

    if (platformState.presets.compactChat) {
      css.push('/* compact chat: плотность, без шапок, наград и бейджей */');
      if (spec.compactChatHide && spec.compactChatHide.length) {
        css.push(block(spec.compactChatHide, ['display: none']));
      }
      if (spec.compactChatBadges && spec.compactChatBadges.length) {
        css.push(block(spec.compactChatBadges, ['display: none']));
      }
      css.push(block(spec.chatText, [
        'padding: 2px 6px',
        'line-height: 1.25',
        'letter-spacing: -0.01em'
      ]));
      css.push(block(spec.chatText.concat(spec.chatRoot), [
        'padding-top: 1px',
        'padding-bottom: 1px'
      ]));
    }

    if (platformState.presets.chatOverlay && chatOverlayRoot) {
      var activeRoot = 'html.sui-chat-overlay-active ' + chatOverlayRoot;
      /* В нативном fullscreen функциональный корень оверлея — перенесённый узел
         с .sui-chat-overlay. В театре им остаётся обычный корень чата. */
      var overlayRootSelector = fullscreenElement()
        ? 'html.sui-chat-overlay-active .sui-chat-overlay'
        : activeRoot;
      css.push('/* чат поверх видео: CSS-оверлей; в fullscreen узел внутри fullscreenElement */');
      css.push(block([activeRoot, 'html.sui-chat-overlay-active .sui-chat-overlay'], [
        'position: fixed',
        'top: 64px',
        'right: 16px',
        'bottom: 72px',
        'left: auto',
        'width: 340px',
        'max-width: none',
        'height: auto',
        'max-height: none',
        'margin: 0',
        'box-sizing: border-box',
        'z-index: 2147483645',
        'pointer-events: auto',
        'border-radius: 10px',
        'overflow: hidden',
        'border: 1px solid rgba(255, 255, 255, 0.08)',
        'box-shadow: 0 14px 48px rgba(0, 0, 0, 0.55)',
        'background: ' + overlayBg,
        'transform: translate3d(var(--sui-chat-dx, 0px), var(--sui-chat-dy, 0px), 0)'
      ]));

      if (spec.overlayTransparent && spec.overlayTransparent.length) {
        css.push('/* внутренние слои полностью прозрачные; фон задаёт только корень оверлея */');
        css.push(block(spec.overlayTransparent, [
          'background: transparent',
          'background-color: transparent'
        ]));
        css.push(block([overlayRootSelector], ['background: ' + overlayBg]));
      }

      if (platform === 'twitch' && overlayOpacity < 0.2 &&
          spec.overlayDeepTransparent && spec.overlayDeepTransparent.length) {
        css.push('/* Twitch: при прозрачности <20% убираем любые динамические подложки */');
        css.push(block(spec.overlayDeepTransparent, [
          'background: transparent',
          'background-color: transparent'
        ]));
      }

      css.push('/* оверлей: только лента сообщений — блок отправки скрыт целиком */');
      css.push(block([
        '.sui-chat-overlay .chat-input',
        '.sui-chat-overlay [data-a-target="chat-input"]',
        '.sui-chat-overlay yt-live-chat-message-input-renderer',
        '.sui-chat-overlay #input-panel'
      ].concat(overlayScoped(spec.overlayHide)), ['display: none']));

      var feedRoot = firstMatching(spec.overlayFeed || []);
      if (feedRoot) {
        css.push('/* сообщения начинаются строго под полоской перетаскивания */');
        css.push(block(overlayFeedSelectors(feedRoot), ['padding-top: 28px']));
      }

      if (transparentOverlay) {
        css.push('/* читаемость поверх видео при прозрачном фоне */');
        css.push(block(overlayScoped(spec.overlayMessage), [
          'text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.8)'
        ]));
        css.push(block(overlayScoped(spec.overlayOpaque), [
          'background: transparent',
          'background-image: none',
          'box-shadow: none',
          'border-color: transparent'
        ]));
        css.push(block(overlayScoped(spec.overlayEmoji), [
          'filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.95))'
        ]));
      }

      css.push('/* полоска для перетаскивания чата */');
      css.push('#sui-chat-handle { position: relative; display: none; box-sizing: border-box; left: 0; top: 0; width: 100%; height: 28px; flex: 0 0 28px; margin: 0 0 -28px; align-items: center; justify-content: center; background: var(--sui-accent, #FF0033); color: #0B0C0E; border: 1px solid rgba(255,255,255,.08); border-radius: 10px 10px 0 0; font: 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .1em; text-transform: uppercase; cursor: grab; touch-action: none; user-select: none; z-index: 2147483647; pointer-events: auto; }');
      css.push('.sui-chat-overlay #sui-chat-handle { position: relative !important; z-index: 2147483647 !important; pointer-events: auto !important; cursor: grab !important; margin-bottom: -28px !important; }');
      css.push('html.sui-chat-overlay-active #sui-chat-handle { display: flex !important; }');
      css.push('#sui-chat-handle.sui-dragging { filter: brightness(1.15) !important; cursor: grabbing !important; }');
    }

    platformState.overrides.forEach(function (item) {
      var selector = SUI.storage.validSelector(item.selector);
      if (!selector) return;
      if (item.action === 'hide') {
        css.push(block([selector], ['display: none']));
      } else if (item.action === 'dim') {
        css.push(block([selector], ['opacity: 0.28']));
      } else if (item.action === 'restore') {
        css.push(block([selector], [
          'display: ' + (item.display || 'block'),
          'opacity: 1',
          'visibility: visible'
        ]));
      } else if (item.action === 'color') {
        var declarations = [];
        if (item.bg) declarations.push('background-color: ' + item.bg);
        if (item.text) declarations.push('color: ' + item.text);
        if (declarations.length) css.push(block([selector], declarations));
      }
    });

    return css.join('\n');
  }

  function syncInspector() {
    if (!currentPlatform || !currentState) return;
    render(currentPlatform, currentState);
  }

  function render(platform, platformState) {
    currentPlatform = platform;
    currentState = platformState;
    var fullState = SUI.storage.getState();
    var root = document.documentElement;
    var resolved = platform ? resolveTheme(platform, platformState) : null;
    var overlayOn = !!(platform && platformState && platformState.presets.chatOverlay);

    syncFullscreenChat(platform, platformState);

    var overlayActive = overlayOn && isTheaterOrFullscreen(platform);
    var nextOverlayRoot = overlayOn ? firstMatching((SUI.SELECTORS[platform] || {}).chatOverlayRoot || []) : null;

    overlayEnabled = overlayOn;
    if (nextOverlayRoot !== chatOverlayRoot) removeChatHandle();
    chatOverlayRoot = nextOverlayRoot;
    if (overlayActive && chatOverlayRoot) {
      var ui = fullState.ui || {};
      var saved = ui.chatPos && ui.chatPos[platform];
      if (saved && !root.style.getPropertyValue('--sui-chat-dx')) setChatOffset(saved);
      ensureChatHandle(platform);
    } else if (chatHandle) {
      removeChatHandle();
    }

    var classes = root.className.split(/\s+/).filter(function (name) {
      return name && name.indexOf('sui-') !== 0;
    });
    if (platform) classes.push('sui-' + platform);
    if (platform && platformState && platformState.presets.compactChat) classes.push('sui-compact-chat');
    if (overlayActive) {
      classes.push('sui-chat-overlay');
      classes.push('sui-chat-overlay-active');
    }
    if (inspectorActive) classes.push('sui-inspector-active');
    root.className = classes.join(' ').trim();

    if (platform) {
      root.style.setProperty('--sui-accent', resolved.accentCss);
      root.style.setProperty('--sui-chat-scale', String(platformState.chat.fontScale));
      root.style.setProperty('--sui-chat-bg', String(platformState.chat.bgOpacity));
    }

    ensureStyleNode().textContent = platform ? buildCSS(platform, platformState, overlayActive) : '';
  }

  function onFullscreenChange() {
    syncFullscreenChat(currentPlatform, currentState);
    /* Корень чата переезжает в fullscreen вместе с полоской — достаточно
       вернуть полоску внутрь актуального корня, если сайт её вытеснил. */
    var overlayRoot = overlayRootElement();
    if (chatHandle && overlayRoot && chatHandle.parentNode !== overlayRoot) {
      try {
        overlayRoot.insertBefore(chatHandle, overlayRoot.firstChild);
      } catch (e) { /* корень временно недоступен — поправит следующий render */ }
    }
    scheduleRouteCheck('fullscreenchange');
  }

  function startWatching() {
    var originalPush = history.pushState;
    var originalReplace = history.replaceState;
    history.pushState = function () {
      var result = originalPush.apply(this, arguments);
      scheduleRouteCheck('pushState');
      return result;
    };
    history.replaceState = function () {
      var result = originalReplace.apply(this, arguments);
      scheduleRouteCheck('replaceState');
      return result;
    };

    window.addEventListener('popstate', function () { scheduleRouteCheck('popstate'); });
    document.addEventListener('yt-navigate-finish', function () { scheduleRouteCheck('yt-navigate-finish'); });
    document.addEventListener('yt-page-data-updated', function () { scheduleRouteCheck('yt-page-data-updated'); });
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    if (window.MutationObserver) {
      var observer = new MutationObserver(function () { scheduleRouteCheck('mutation'); });
      observer.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'theater', 'fullscreen', 'aria-pressed', 'data-is-theater-mode']
      });
    }

    setInterval(function () { checkRoute('poll'); }, 1500);
    setInterval(function () {
      if (overlayEnabled || fullscreenElement()) checkRoute('overlay-poll');
    }, 400);
    checkRoute('init');
  }

  SUI.styleEngine = {
    render: render,
    startWatching: startWatching,
    resolveTheme: resolveTheme,
    syncInspector: syncInspector,
    setInspector: function (active) {
      inspectorActive = !!active;
      syncInspector();
    },
    onRoute: function (fn) { routeCallbacks.push(fn); },
    restoreChat: function () {
      restoreChatFromFullscreen();
      removeChatHandle();
    },
    firstMatching: firstMatching
  };

  SUI_FILES[SUI_FILE] = 'done';
})();
