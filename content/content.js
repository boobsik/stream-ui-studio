/* stream-ui-studio — точка входа content script.
   ВАЖНО: слушатель chrome.runtime.onMessage/b.runtime.onMessage регистрируется
   ПЕРВЫМ, до обращения к lib/*. Обработчик возвращает нативный Promise: это
   требуется Firefox MV3 и поддерживается Chromium/Edge/WebView2. */
(function () {
  'use strict';

  /* Повторная инъекция через scripting.executeScript не должна вешать второй
     слушатель и пересоздавать модули. */
  if (window.__SUI_LOADED__) return;

  const ext = globalThis.browser ?? globalThis.chrome;

  let SUI = null;
  let lastPlatform = null;
  let initialized = false;
  let initError = null;
  let starting = false;
  let initPromise = null;
  let resolvers = [];
  let rejecters = [];
  let pageErrors = [];
  let pollTimer = null;
  let pollCount = 0;

  /* Ловим необработанные ошибки lib/*.js — их текст уйдёт обратно в popup. */
  window.addEventListener('error', function (event) {
    const src = event.filename || '';
    if (/\/lib\/|content\/content\.js/.test(src)) {
      pageErrors.push((event.message || 'Unknown error') + ' @ ' + src + ':' + (event.lineno || 0));
    }
  });
  window.addEventListener('unhandledrejection', function (event) {
    pageErrors.push('Unhandled rejection: ' + String(event.reason));
  });

  /* Ввод в чат-оверлее не должен уходить в горячие клавиши плеера. Слушатели
     висят в capture на window: до того, как событие дойдёт до document/плеера. */
  var SUI_OVERLAY_INPUT = '[data-a-target="chat-input"], textarea, input, [contenteditable="true"]';

  function isSuiOverlayInput(target) {
    if (!target || target.nodeType !== 1 || !target.closest) return false;
    var input = target.closest(SUI_OVERLAY_INPUT);
    if (!input) return false;
    var overlay = input.closest('.sui-chat-overlay');
    if (!overlay) return false;
    if (overlay !== document.documentElement) return true;

    /* В театральном режиме класс висит на html — проверяем реальный корень чата. */
    var roots = document.querySelectorAll(
      '[data-a-target="chat-container"], .chat-shell, ytd-live-chat-frame, #chat'
    );
    for (var i = 0; i < roots.length; i += 1) {
      if (roots[i].contains(input)) return true;
    }
    return false;
  }

  ['keydown', 'keypress', 'keyup'].forEach(function (type) {
    window.addEventListener(type, function (event) {
      if (isSuiOverlayInput(event.target)) event.stopPropagation();
    }, true);
  });

  function errorText(err) {
    if (!err) return 'нет ошибки';
    return err.stack ? String(err.stack) : String(err);
  }

  function currentPlatform() {
    return SUI && SUI.detectPlatform ? SUI.detectPlatform(location.hostname) : null;
  }

  function missingModules() {
    const s = window.SUI || {};
    return ['PRESET_KEYS', 'drag', 'storage', 'styleEngine', 'inspector', 'UI_CSS', 'ui'].filter(function (name) {
      return !s[name];
    });
  }

  function modulesReady() {
    return missingModules().length === 0;
  }

  function describeNotLoaded() {
    return 'Модули SUI не загружены: ' + missingModules().join(', ') +
      (pageErrors.length ? ' | ' + pageErrors.join(' | ') : ' | проверьте консоль страницы');
  }

  function settle(err) {
    initialized = true;
    initError = err || null;
    starting = false;
    const ok = resolvers.splice(0);
    const bad = rejecters.splice(0);
    if (err) bad.forEach(function (fn) { fn(err); });
    else ok.forEach(function (fn) { fn(); });
  }

  function startPolling() {
    if (pollTimer) return;
    pollCount = 0;
    pollTimer = setInterval(function () {
      pollCount += 1;
      if (modulesReady()) {
        clearInterval(pollTimer);
        pollTimer = null;
        initialize();
      } else if (pollCount > 200) { /* ~3 секунды */
        clearInterval(pollTimer);
        pollTimer = null;
        settle(new Error(describeNotLoaded()));
      }
    }, 15);
  }

  function applyState() {
    if (!SUI) return;
    const platform = currentPlatform();
    const platformState = platform ? SUI.storage.getState().platforms[platform] : null;
    if (!platformState) return;
    SUI.styleEngine.render(platform, platformState);
    if (platform !== lastPlatform) {
      lastPlatform = platform;
      SUI.inspector.setPlatform(platform);
      SUI.ui.setPlatform(platform);
    } else {
      SUI.ui.refresh();
    }
  }

  function boot() {
    try {
      SUI.storage.load(function () {
        try {
          SUI.ui.mount();
          applyState();
          SUI.styleEngine.startWatching();
        } catch (err) {
          window.__SUI_BOOT_ERROR__ = errorText(err);
        }
      });
    } catch (err) {
      window.__SUI_BOOT_ERROR__ = errorText(err);
    }
  }

  function initialize() {
    if (initialized || starting) return;
    if (!modulesReady()) { startPolling(); return; }

    starting = true;
    try {
      SUI = window.SUI;
      SUI.storage.subscribe(applyState);
      SUI.styleEngine.onRoute(function () { applyState(); });
      applyState();

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
      } else {
        boot();
      }

      window.__SUI_LOADED__ = true;
      settle(null);
    } catch (err) {
      settle(err);
    }
  }

  /* Единый Promise, на который ждут все сообщения, пришедшие до загрузки lib/*. */
  function getInitPromise() {
    if (initialized) {
      return initError ? Promise.reject(initError) : Promise.resolve();
    }
    if (!initPromise) {
      initPromise = new Promise(function (resolve, reject) {
        resolvers.push(resolve);
        rejecters.push(reject);
      });
      if (modulesReady()) initialize();
      else startPolling();
    }
    return initPromise;
  }

  function replyOk(extra) {
    const payload = { ok: true, platform: currentPlatform() };
    if (extra) {
      Object.keys(extra).forEach(function (key) { payload[key] = extra[key]; });
    }
    return payload;
  }

  function handle(message) {
    switch (message.type) {
      case 'sui-ping':
        return replyOk();

      case 'sui-open':
        SUI.ui.open();
        return replyOk();

      case 'sui-inspector-on':
        const platform = currentPlatform();
        SUI.ui.open();
        if (platform) SUI.inspector.enable(platform);
        SUI.ui.refresh();
        return replyOk();

      case 'sui-preset':
        const state = SUI.storage.platform(currentPlatform());
        if (!state || typeof message.key !== 'string' || !(message.key in state.presets)) {
          return { ok: false, error: 'Неизвестный пресет: ' + message.key };
        }
        state.presets[message.key] = message.value !== false;
        SUI.storage.save();
        return replyOk({ key: message.key, value: state.presets[message.key] });

      default:
        return { ok: false, error: 'Неизвестная команда: ' + message.type };
    }
  }

  /* Регистрация слушателя — первое действие content script. Никаких
     sendResponse / return true: только нативный Promise. */
  if (ext && ext.runtime && ext.runtime.onMessage) {
    ext.runtime.onMessage.addListener(function (message, sender) {
      if (!message || typeof message.type !== 'string' || message.type.indexOf('sui-') !== 0) return;

      return getInitPromise()
        .then(function () {
          if (window.__SUI_BOOT_ERROR__) throw new Error(window.__SUI_BOOT_ERROR__);
          return handle(message);
        })
        .catch(function (err) {
          return { ok: false, error: errorText(err) };
        });
    });
  }

  /* Запускаем инициализацию сразу, не дожидаясь первого сообщения. */
  getInitPromise().catch(function () { /* ошибка уже вернётся в ответе на сообщение */ });
})();
