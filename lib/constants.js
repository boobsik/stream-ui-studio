/* stream-ui-studio — константы, селекторы и значения по умолчанию.
   Загружается первым в content script, остальные файлы читают window.SUI. */
(function () {
  'use strict';

  var SUI_FILE = 'lib/constants.js';
  var SUI_FILES = (window.__SUI_FILES__ = window.__SUI_FILES__ || {});
  if (window.__SUI_LOADED__ || SUI_FILES[SUI_FILE] === 'done') return;
  window.__SUI_LOADING__ = SUI_FILE;

  var SUI = (window.SUI = window.SUI || {});

  SUI.APP = 'stream-ui-studio';
  SUI.SCHEMA = 1;

  SUI.KEYS = {
    PRESETS_YT: 'sui.presets.youtube',
    PRESETS_TW: 'sui.presets.twitch',
    CHAT_YT: 'sui.chat.youtube',
    CHAT_TW: 'sui.chat.twitch',
    OVERRIDES_YT: 'sui.overrides.youtube',
    OVERRIDES_TW: 'sui.overrides.twitch',
    THEME_YT: 'sui.theme.youtube',
    THEME_TW: 'sui.theme.twitch',
    UI: 'sui.ui'
  };

  SUI.DOM_IDS = {
    STYLE: 'sui-generated-style',
    HOST: 'sui-shadow-host'
  };

  var PRESET_KEYS = [
    'hideRecommendations',
    'hideShorts',
    'hidePlayerButtons',
    'compactChat',
    'chatOverlay'
  ];

  SUI.PRESET_KEYS = PRESET_KEYS;

  SUI.PRESET_LABELS = {
    hideRecommendations: 'Скрыть рекомендации / сайдбар',
    hideShorts: 'Скрыть Shorts / клипы',
    hidePlayerButtons: 'Скрыть лишние кнопки под плеером',
    compactChat: 'Компактный режим чата',
    chatOverlay: 'Чат поверх видео (театр / фуллскрин)'
  };

  function emptyPresets() {
    var out = {};
    PRESET_KEYS.forEach(function (key) { out[key] = false; });
    return out;
  }

  function emptyChat() {
    return { fontScale: 1, bgOpacity: 1, overlayBgOpacity: 0 };
  }

  SUI.THEME_PRESETS = {
    default: {
      label: 'По умолчанию', accent: '#FF0033', bg: '#0B0C0E',
      surface: '#161719', text: '#E7E7EA', alpha: 1
    },
    graphite: {
      label: 'Тёмный графит', accent: '#E7E7EA', bg: '#0B0C0E',
      surface: '#17191C', text: '#E7E7EA', alpha: 1
    },
    twitch: {
      label: 'Фиолетовый Twitch', accent: '#9146FF', bg: '#0E0A17',
      surface: '#1B1530', text: '#EFEFF1', alpha: 1
    },
    youtube: {
      label: 'Красный YouTube', accent: '#FF0033', bg: '#0B0C0E',
      surface: '#1A1B1E', text: '#F1F1F1', alpha: 1
    },
    emerald: {
      label: 'Изумрудный', accent: '#10B981', bg: '#07120F',
      surface: '#10221C', text: '#E8F6F0', alpha: 1
    },
    glass: {
      label: 'Прозрачное стекло', accent: '#E7E7EA', bg: '#0B0C0E',
      surface: '#16181B', text: '#FFFFFF', alpha: 0.55
    }
  };

  SUI.THEME_DEFAULT = { youtube: 'youtube', twitch: 'twitch' };

  function emptyTheme(platform) {
    var key = SUI.THEME_DEFAULT[platform] || 'default';
    var preset = SUI.THEME_PRESETS[key] || SUI.THEME_PRESETS.default;
    return {
      preset: key,
      accent: preset.accent,
      bg: preset.bg,
      surface: preset.surface,
      text: preset.text,
      alpha: preset.alpha,
      hue: 0,
      saturation: 100,
      contrast: 100
    };
  }

  SUI.emptyPresets = emptyPresets;
  SUI.emptyChat = emptyChat;
  SUI.emptyTheme = emptyTheme;
  SUI.themePresetKeys = function () { return Object.keys(SUI.THEME_PRESETS); };

  /* Селекторы подобраны так, чтобы не задевать видео и чат.
     При расхождении с актуальной версией сайта элемент можно скрыть вручную
     через инспектор — его селектор сохранится в overrides. */
  SUI.SELECTORS = {
    youtube: {
      name: 'YouTube',
      accent: '#FF0033',
      hostMatch: /(^|\.)youtube\.com$|(^|\.)youtube-nocookie\.com$|^youtu\.be$/,
      presets: {
        hideRecommendations: [
          'ytd-watch-next-secondary-results-renderer',
          '#secondary #items > ytd-compact-video-renderer',
          '#related'
        ],
        hideShorts: [
          'ytd-reel-shelf-renderer',
          'ytd-reel-item-renderer',
          'ytd-rich-shelf-renderer[is-shorts]',
          'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer)',
          'ytd-shorts'
        ],
        hidePlayerButtons: [
          'ytd-video-primary-info-renderer #menu',
          'ytd-watch-metadata #menu',
          'ytd-video-primary-info-renderer #actions > ytd-button-renderer:nth-child(n+4)',
          '#actions yt-button-shape:nth-child(n+4)'
        ],
        compactChat: [
          'ytd-live-chat-frame #chat-container'
        ],
        chatOverlay: [
          'ytd-live-chat-frame'
        ]
      },
      chatSurface: [
        'ytd-live-chat-frame',
        '#chat',
        '#chat-messages'
      ],
      chatFullscreenRoot: [
        'ytd-live-chat-frame',
        '#chatframe',
        'iframe#chatframe',
        '#chat'
      ],
      filterTarget: [
        'ytd-app'
      ],
      chatRoot: [
        'ytd-live-chat-frame #chat-container',
        'ytd-live-chat-frame'
      ],
      chatText: [
        'ytd-live-chat-frame #message-content',
        'ytd-live-chat-frame yt-formatted-string#content',
        'ytd-chat-message-renderer #message'
      ],
      theaterSelectors: [
        'ytd-watch-flexy[theater]',
        'ytd-watch-flexy[fullscreen]',
        'ytd-app[data-is-theater-mode]',
        '.ytp-fullscreen'
      ],
      chatOverlayRoot: [
        'ytd-live-chat-frame',
        '#chat',
        'ytd-live-chat-frame #chat-container'
      ],
      compactChatHide: [
        'ytd-live-chat-frame #header',
        'ytd-live-chat-frame #chat-header',
        'ytd-chat-header',
        'ytd-sponsorships-chat-item-renderer',
        'ytd-paid-message-renderer',
        'ytd-gift-purchase-message-renderer',
        'ytd-membership-gift-purchase-message-renderer',
        'ytd-hype-train-message-renderer',
        'ytd-pinned-message-renderer',
        '#pinned-message',
        '.pinned-message',
        'ytd-live-chat-frame .ytd-chat-summary'
      ],
      compactChatBadges: [
        'ytd-chat-message-renderer #avatar',
        'ytd-chat-message-renderer .ytd-chat-avatar',
        'ytd-chat-message-renderer yt-icon#avatar',
        'ytd-chat-message-renderer #badges',
        'ytd-chat-message-renderer .ytd-chat-message-badges'
      ],
      overlayHide: [
        'yt-live-chat-header-renderer',
        'yt-live-chat-ticker-renderer',
        'yt-live-chat-message-input-renderer',
        '#input-panel',
        '#input-panel yt-button-shape',
        '#input-panel yt-icon-button',
        'yt-live-chat-text-input-field-renderer #emoji-button',
        'yt-live-chat-text-input-field-renderer #send-button',
        '#input-panel #send-button',
        '#input-panel [aria-label*="Emoji"]',
        '#input-panel [aria-label*="emoji"]'
      ],
      overlayFeed: [
        '#chat',
        '#chat-messages'
      ],
      overlayMessage: [
        'ytd-live-chat-frame #message-content',
        'ytd-live-chat-frame yt-formatted-string#content',
        'ytd-chat-message-renderer #message',
        'yt-live-chat-text-message-renderer #content'
      ],
      overlayOpaque: [
        'ytd-chat-message-renderer',
        'yt-live-chat-text-message-renderer',
        'ytd-live-chat-frame #message',
        '.ytd-chat-message'
      ],
      overlayEmoji: [
        'yt-emoji-renderer img',
        'img.emoji'
      ]
    },
    twitch: {
      name: 'Twitch',
      accent: '#9146FF',
      hostMatch: /(^|\.)twitch\.tv$/,
      presets: {
        hideRecommendations: [
          '[data-a-target="right-column"] .tw-card-a',
          '[data-a-target="recommendations-card"]',
          '[data-test-selector="recommended-channel"]',
          '.recommended-channel',
          '[data-a-target="channel-home-recommendations"]',
          '[data-a-target="side-nav"]'
        ],
        hideShorts: [
          '[data-a-target="clips-card"]',
          '.clips-card',
          '[data-a-target="discovery-feed"]'
        ],
        hidePlayerButtons: [
          '[data-a-target="player-controls"] [data-a-target="player-minimap-button"]',
          '[data-a-target="player-controls"] [data-a-target="player-share-button"]',
          '[data-a-target="player-controls"] button[aria-label*="Share"]'
        ],
        compactChat: [
          '[data-a-target="chat-container"]'
        ],
        chatOverlay: [
          '[data-a-target="chat-container"]',
          '[data-test-selector="chat-room-component-layout"]',
          '.chat-shell'
        ]
      },
      chatSurface: [
        '.stream-chat',
        '.chat-room__content',
        '.chat-scrollable-area__message-container',
        '.right-column',
        '.channel-root__right-column'
      ],
      chatFullscreenRoot: [
        '.chat-shell',
        '[data-a-target="chat-container"]',
        '.stream-chat',
        '[data-test-selector="chat-room-component-layout"]'
      ],
      filterTarget: [
        '.Layout-sc-1xcs6mc-0.inject-layout',
        'main'
      ],
      chatRoot: [
        '[data-a-target="chat-container"]',
        '.chat-shell'
      ],
      chatText: [
        '[data-a-target="chat-message-text"]',
        '.chat-line__message-body',
        '.chat-line__message'
      ],
      theaterSelectors: [
        '.video-player--theatre',
        '.tw-theatre-mode',
        '[data-a-target="player-theatre-mode-button"][aria-pressed="true"]',
        '.video-player--fullscreen'
      ],
      chatOverlayRoot: [
        '[data-a-target="chat-container"]',
        '.chat-shell',
        '[data-a-target="right-column-chat-bar"]',
        '.right-column--theater',
        '#chat'
      ],
      compactChatHide: [
        '[data-a-target="chat-header"]',
        '.chat-header',
        '[data-a-target="chat-banner"]',
        '.chat-banner',
        '[data-a-target="pinned-chat-message"]',
        '.pinned-chat-message',
        '[data-a-target="chat-reward-message"]',
        '.reward-message',
        '[data-a-target="subscription-notice"]',
        '.chat-line__message--gifts',
        '[data-a-target="hype-train"]',
        '.hype-train',
        '[data-a-target="community-points-message"]',
        '.community-points-message'
      ],
      compactChatBadges: [
        '[data-a-target="chat-message-badges"]',
        '.chat-badge',
        '.chat-line__message .tw-avatar',
        '.chat-line__message .tw-avatar--size-20',
        '.chat-line__message .chat-line__message--badges'
      ],
      overlayHide: [
        '.stream-chat-header',
        '[data-a-target="chat-header"]',
        '[class*="goal"]',
        '[data-test-selector="community-highlight-stack"]',
        '.community-highlight-stack',
        '.community-highlight-stack__scroll-area--disable',
        '.channel-leaderboard',
        '.paid-pinned-chat-message-list',
        '[class*="pinned-chat"]',
        '[class*="bits-card"]',
        '[data-a-target="chat-channel-points-button"]',
        '[data-a-target="chat-bits-button"]',
        '[data-a-target="chat-settings-button"]',
        '[data-a-target="chat-send-button"]',
        '[data-a-target="emote-picker"]',
        '[data-a-target="chat-emote-button"]',
        '[data-a-target="chat-badge"]',
        '[data-test-selector="chat-input-tray"]',
        '.chat-input__badge-tray',
        '[data-a-target="emote-picker-button"]',
        '[data-a-target="chat-input"] ~ button',
        '.chat-input > button',
        '.chat-input > div[class*="badge"]',
        '.chat-input > div[class*="tray"]',
        '.chat-input [data-a-target*="bits"]',
        '.chat-input [class*="confetti"]',
        '.chat-input [class*="hype"]',
        '.chat-input__buttons-container',
        '[data-a-target="chat-input-buttons-container"]',
        '[data-a-target="chat-input"] ~ div',
        '.community-points-summary',
        '.bits-button',
        '.chat-settings__button'
      ],
      overlayFeed: [
        '.chat-room__content',
        '.chat-list--default'
      ],
      overlayTransparent: [
        '.sui-chat-overlay',
        '.sui-chat-overlay .chat-shell',
        '.sui-chat-overlay [data-a-target="chat-container"]',
        '.sui-chat-overlay .stream-chat',
        '.sui-chat-overlay [data-test-selector="chat-room-component-layout"]',
        '.sui-chat-overlay .chat-room__content',
        '.sui-chat-overlay .chat-scrollable-area__message-container',
        '.sui-chat-overlay .chat-list--default',
        '.sui-chat-overlay .right-column',
        '.sui-chat-overlay .channel-root__right-column',
        '.sui-chat-overlay .chat-input'
      ],
      overlayDeepTransparent: [
        '.sui-chat-overlay',
        '.sui-chat-overlay > div',
        '.sui-chat-overlay section',
        '.sui-chat-overlay [class*="Layout-sc-"]'
      ],
      overlayMessage: [
        '[data-a-target="chat-message-text"]',
        '.chat-line__message-body',
        '.chat-line__message'
      ],
      overlayOpaque: [
        '.chat-line__message',
        '.chat-line__message-body',
        '.chat-line__message--highlighted',
        '.chat-line--system',
        '[data-a-target="chat-line-message"]'
      ],
      overlayEmoji: [
        'img.emoji',
        '.tw-emoji'
      ]
    }
  };

  SUI.detectPlatform = function detectPlatform(hostname) {
    var host = (hostname || location.hostname).toLowerCase();
    var keys = ['twitch', 'youtube'];
    for (var i = 0; i < keys.length; i += 1) {
      if (SUI.SELECTORS[keys[i]].hostMatch.test(host)) return keys[i];
    }
    return null;
  };

  SUI.clone = function clone(value) {
    return JSON.parse(JSON.stringify(value));
  };

  SUI_FILES[SUI_FILE] = 'done';
})();
