/* stream-ui-studio — слой хранилища.
   chrome.storage.local с фолбэком на localStorage (для урезанных WebView2-сборок). */
(function () {
  'use strict';

  var SUI_FILE = 'lib/storage.js';
  var SUI_FILES = (window.__SUI_FILES__ = window.__SUI_FILES__ || {});
  if (window.__SUI_LOADED__ || SUI_FILES[SUI_FILE] === 'done') return;
  window.__SUI_LOADING__ = SUI_FILE;

  var SUI = window.SUI;
  var K = SUI.KEYS;
  var PREFIX = 'sui.fallback.';
  var hasChromeStorage = !!(window.chrome && chrome.storage && chrome.storage.local);
  var listeners = [];

  function defaultUI() {
    return {
      panelPos: null,
      menuPos: null,
      chatPos: { youtube: { x: 0, y: 0 }, twitch: { x: 0, y: 0 } }
    };
  }

  function defaultState() {
    return {
      app: SUI.APP,
      schema: SUI.SCHEMA,
      platforms: {
        youtube: {
          presets: SUI.emptyPresets(), chat: SUI.emptyChat(),
          overrides: [], theme: SUI.emptyTheme('youtube')
        },
        twitch: {
          presets: SUI.emptyPresets(), chat: SUI.emptyChat(),
          overrides: [], theme: SUI.emptyTheme('twitch')
        }
      },
      ui: defaultUI()
    };
  }

  function flat(state) {
    return {
      [K.PRESETS_YT]: state.platforms.youtube.presets,
      [K.PRESETS_TW]: state.platforms.twitch.presets,
      [K.CHAT_YT]: state.platforms.youtube.chat,
      [K.CHAT_TW]: state.platforms.twitch.chat,
      [K.OVERRIDES_YT]: state.platforms.youtube.overrides,
      [K.OVERRIDES_TW]: state.platforms.twitch.overrides,
      [K.THEME_YT]: state.platforms.youtube.theme,
      [K.THEME_TW]: state.platforms.twitch.theme,
      [K.UI]: state.ui
    };
  }

  function readRaw(keys, done) {
    if (hasChromeStorage) {
      chrome.storage.local.get(keys, function (items) {
        done(items || {}, chrome.runtime && chrome.runtime.lastError || null);
      });
      return;
    }
    var items = {};
    try {
      keys.forEach(function (key) {
        var raw = localStorage.getItem(PREFIX + key);
        if (raw !== null) items[key] = JSON.parse(raw);
      });
    } catch (err) {
      /* повреждённый фолбэк — просто игнорируем */
    }
    done(items, null);
  }

  function writeRaw(obj, done) {
    if (hasChromeStorage) {
      chrome.storage.local.set(obj, function () {
        done(chrome.runtime && chrome.runtime.lastError || null);
      });
      return;
    }
    try {
      Object.keys(obj).forEach(function (key) {
        localStorage.setItem(PREFIX + key, JSON.stringify(obj[key]));
      });
      done(null);
    } catch (err) {
      done(err);
    }
  }

  function clamp(num, min, max, fallback) {
    var value = Number(num);
    if (!isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, value));
  }

  var FORBIDDEN_SELECTOR = /[{};@!`%]|\bjavascript\s*:/i;

  function validSelector(selector) {
    if (typeof selector !== 'string') return null;
    var clean = selector.trim();
    if (!clean || clean.length > 600 || FORBIDDEN_SELECTOR.test(clean)) return null;
    if (/sui-ui-host|sui-inspector-overlay|sui-generated-style/.test(clean)) return null;
    try {
      document.querySelector(clean);
    } catch (err) {
      return null;
    }
    return clean;
  }

  function validColor(value, fallback) {
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())) return value.trim();
    return fallback;
  }

  function normalizeTheme(platform, source) {
    var fallback = SUI.emptyTheme(platform);
    var input = source && typeof source === 'object' ? source : {};
    var preset = fallback.preset;
    if (input.preset === 'custom') preset = 'custom';
    else if (typeof input.preset === 'string' && SUI.THEME_PRESETS[input.preset]) preset = input.preset;
    var base = SUI.THEME_PRESETS[preset] || fallback;

    return {
      preset: preset,
      accent: validColor(input.accent, base.accent),
      bg: validColor(input.bg, base.bg),
      surface: validColor(input.surface, base.surface),
      text: validColor(input.text, base.text),
      alpha: clamp(input.alpha, 0.15, 1, base.alpha == null ? 1 : base.alpha),
      hue: clamp(input.hue, -60, 60, 0),
      saturation: clamp(input.saturation, 0, 200, 100),
      contrast: clamp(input.contrast, 50, 150, 100)
    };
  }

  function normalizeUI(source) {
    var input = source && typeof source === 'object' ? source : {};
    var chat = input.chatPos && typeof input.chatPos === 'object' ? input.chatPos : {};
    var positions = {};
    ['youtube', 'twitch'].forEach(function (platform) {
      positions[platform] = SUI.drag.validPosition(chat[platform]) || { x: 0, y: 0 };
    });
    return {
      panelPos: SUI.drag.validPosition(input.panelPos),
      menuPos: SUI.drag.validPosition(input.menuPos),
      chatPos: positions
    };
  }

  function normalize(input) {
    var state = defaultState();
    if (!input || typeof input !== 'object') return state;

    var platforms = input.platforms || input;
    ['youtube', 'twitch'].forEach(function (platform) {
      var source = platforms && platforms[platform];
      if (!source || typeof source !== 'object') return;

      var presets = source.presets || {};
      SUI.PRESET_KEYS.forEach(function (key) {
        state.platforms[platform].presets[key] = presets[key] === true;
      });

      var chat = source.chat || {};
      state.platforms[platform].chat.fontScale = clamp(chat.fontScale, 0.7, 1.8, 1);
      state.platforms[platform].chat.bgOpacity = clamp(chat.bgOpacity, 0, 1, 1);
      state.platforms[platform].chat.overlayBgOpacity = clamp(chat.overlayBgOpacity, 0, 1, 0);

      var overrides = Array.isArray(source.overrides) ? source.overrides : [];
      overrides.slice(0, 300).forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        var selector = validSelector(item.selector);
        if (!selector) return;
        var action = item.action === 'dim' || item.action === 'restore' || item.action === 'color'
          ? item.action : 'hide';
        var entry = {
          id: typeof item.id === 'string' && item.id ? item.id.slice(0, 80) : 'ov-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          selector: selector,
          action: action,
          createdAt: Number(item.createdAt) || Date.now()
        };
        if (action === 'restore') {
          var display = typeof item.display === 'string' && /^[a-z-]{1,20}$/.test(item.display) ? item.display : 'block';
          entry.display = display;
        } else if (action === 'color') {
          if (typeof item.bg === 'string' && /^#[0-9a-f]{6}$/i.test(item.bg.trim())) entry.bg = item.bg.trim();
          if (typeof item.text === 'string' && /^#[0-9a-f]{6}$/i.test(item.text.trim())) entry.text = item.text.trim();
          if (!entry.bg && !entry.text) return;
        }
        state.platforms[platform].overrides.push(entry);
      });

      state.platforms[platform].theme = normalizeTheme(platform, source.theme);
    });

    state.ui = normalizeUI(input.ui);
    return state;
  }

  var state = defaultState();

  var storage = {
    getState: function () { return state; },

    load: function (done) {
      readRaw(Object.keys(K).map(function (key) { return K[key]; }), function (items) {
        var raw = {
          app: items[K.UI] && items[K.UI].__app ? items[K.UI].__app : SUI.APP,
          schema: SUI.SCHEMA,
          platforms: {
            youtube: {
              presets: items[K.PRESETS_YT],
              chat: items[K.CHAT_YT],
              overrides: items[K.OVERRIDES_YT],
              theme: items[K.THEME_YT]
            },
            twitch: {
              presets: items[K.PRESETS_TW],
              chat: items[K.CHAT_TW],
              overrides: items[K.OVERRIDES_TW],
              theme: items[K.THEME_TW]
            }
          },
          ui: items[K.UI]
        };
        state = normalize(raw);
        done(state);
      });
    },

    save: function (done) {
      var payload = flat(state);
      payload[K.UI].__app = SUI.APP;
      writeRaw(payload, function (err) {
        if (!err) listeners.forEach(function (fn) {
          try { fn(state); } catch (e) { /* слушатель не должен ломать запись */ }
        });
        if (done) done(err);
      });
    },

    platform: function (platform) {
      return state.platforms[platform] || null;
    },

    subscribe: function (fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (item) { return item !== fn; });
      };
    },

    exportJSON: function () {
      return JSON.stringify({
        app: SUI.APP,
        schema: SUI.SCHEMA,
        exportedAt: new Date().toISOString(),
        platforms: SUI.clone(state.platforms),
        ui: SUI.clone(state.ui)
      }, null, 2);
    },

    importJSON: function (text, done) {
      var parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        done(new Error('Невалидный JSON: ' + err.message));
        return;
      }
      var next = normalize(parsed);
      if (!parsed || (!parsed.platforms && !parsed.youtube && !parsed.twitch)) {
        done(new Error('В JSON нет раздела platforms'));
        return;
      }
      state.platforms = next.platforms;
      state.ui = next.ui;
      storage.save(function (err) { done(err, state); });
    },

    reset: function (platform, done) {
      state.platforms[platform] = {
        presets: SUI.emptyPresets(),
        chat: SUI.emptyChat(),
        overrides: [],
        theme: SUI.emptyTheme(platform)
      };
      storage.save(function (err) { done(err, state); });
    },

    validSelector: validSelector,
    validColor: validColor
  };

  SUI.storage = storage;

  if (hasChromeStorage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      var touched = Object.keys(K).some(function (key) { return changes[K[key]]; });
      if (!touched) return;
      storage.load(function () {
        listeners.forEach(function (fn) {
          try { fn(state); } catch (e) { /* noop */ }
        });
      });
    });
  }

  SUI_FILES[SUI_FILE] = 'done';
})();
