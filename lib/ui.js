/* stream-ui-studio — панель инструментов внутри Shadow DOM. */
(function () {
  'use strict';

  var SUI_FILE = 'lib/ui.js';
  var SUI_FILES = (window.__SUI_FILES__ = window.__SUI_FILES__ || {});
  if (window.__SUI_LOADED__ || SUI_FILES[SUI_FILE] === 'done') return;
  window.__SUI_LOADING__ = SUI_FILE;

  var SUI = window.SUI;
  var host = null;
  var shadow = null;
  var panel = null;
  var statusNode = null;
  var statusTimer = null;
  var platform = null;
  var mounted = false;
  var panelDragDetach = null;

  /* Trusted Types: YouTube запрещает строковые присваивания в innerHTML И
     DOMParser.parseFromString. Поэтому всю разметку панели строим через DOM. */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function button(className, text, title) {
    var node = el('button', className, text);
    node.type = 'button';
    if (title) node.title = title;
    return node;
  }

  function btnRow(first, second) {
    var row = el('div', 'btnrow');
    if (first) row.appendChild(first);
    if (second) row.appendChild(second);
    return row;
  }

  function section(title, children) {
    var node = el('section');
    node.appendChild(el('h2', null, title));
    children.forEach(function (child) { node.appendChild(child); });
    return node;
  }

  function settingRow(labelText, forId, valueClass, valueText) {
    var row = el('div', 'row');
    var label = el('label', null, labelText);
    label.htmlFor = forId;
    row.appendChild(label);
    row.appendChild(el('span', 'val ' + valueClass, valueText));
    return row;
  }

  function slider(className, id, min, max, step, value) {
    var node = el('input', className);
    node.type = 'range';
    node.id = id;
    node.min = min;
    node.max = max;
    node.step = step;
    node.value = value;
    return node;
  }

  function colorControl(labelText, className, title) {
    var wrap = el('label');
    wrap.appendChild(document.createTextNode(labelText));
    var input = el('input', className);
    input.type = 'color';
    input.title = title;
    wrap.appendChild(input);
    return wrap;
  }

  function defaultFoot() {
    if (!statusNode) return;
    statusNode.textContent = 'Готово';
  }

  function buildTemplate() {
    var root = el('div', 'panel');
    root.hidden = true;

    var head = el('div', 'head panel-header');
    var titles = el('div');
    var brand = el('div', 'brand');
    brand.appendChild(document.createTextNode('STREAM'));
    brand.appendChild(el('b', null, '/'));
    brand.appendChild(document.createTextNode('UI STUDIO'));
    titles.appendChild(brand);
    titles.appendChild(el('div', 'sub', 'Инспектор DOM и пресеты интерфейса'));

    var controls = el('div');
    controls.style.cssText = 'display:flex;align-items:center;gap:6px';
    var platformBadge = el('div', 'platform');
    platformBadge.appendChild(el('i', 'dot'));
    platformBadge.appendChild(el('span', 'pname', '—'));
    controls.appendChild(platformBadge);
    controls.appendChild(button('x', '×', 'Закрыть панель'));

    head.appendChild(titles);
    head.appendChild(controls);
    root.appendChild(head);

    var body = el('div', 'body');
    body.appendChild(section('Инспектор', [
      btnRow(button('btn accent wide inspect-toggle', 'Включить инспектор')),
      el('div', 'sub', 'Наведите на элемент — увидите селектор. Клик откроет действия: скрыть / полупрозрачный / вернуть / цвет.')
    ]));

    body.appendChild(section('Пресеты в 1 клик', [el('div', 'presets')]));

    body.appendChild(section('Чат', [
      settingRow('Масштаб шрифта', 'sui-font', 'font-val', '1.00×'),
      slider('slider font', 'sui-font', '0.7', '1.8', '0.05', '1'),
      settingRow('Прозрачность фона', 'sui-bg', 'bg-val', '100%'),
      slider('slider bg', 'sui-bg', '0', '1', '0.05', '1'),
      settingRow('Прозрачность чата поверх видео', 'sui-overlay-bg', 'overlay-bg-val', '0%'),
      slider('slider overlay-bg', 'sui-overlay-bg', '0', '1', '0.05', '0'),
      el('div', 'sub', 'Второй ползунок влияет только на оверлей. Оверлей чата перетаскивается за верхнюю полоску.')
    ]));

    var colors = el('div', 'colors');
    colors.appendChild(colorControl('АКЦЕНТ', 'theme-accent', 'Акцентный цвет интерфейса'));
    colors.appendChild(colorControl('ФОН', 'theme-bg', 'Фон площадки'));
    colors.appendChild(colorControl('ТЕКСТ', 'theme-text', 'Основной текст'));

    var chips = el('div', 'chips');
    SUI.themePresetKeys().forEach(function (key) {
      var preset = SUI.THEME_PRESETS[key];
      var chip = button('chip theme-preset', preset.label);
      chip.dataset.preset = key;
      chips.appendChild(chip);
    });

    body.appendChild(section('Общий вид и цвет площадки', [
      el('div', 'sub', 'Темы и цвет переопределяют variables площадки, не трогая разметку.'),
      colors,
      chips,
      settingRow('Оттенок', 'sui-theme-hue', 'theme-hue-val', '0°'),
      slider('slider theme-hue', 'sui-theme-hue', '-60', '60', '1', '0'),
      settingRow('Насыщенность', 'sui-theme-sat', 'theme-sat-val', '100%'),
      slider('slider theme-sat', 'sui-theme-sat', '0', '200', '5', '100'),
      settingRow('Контраст', 'sui-theme-contrast', 'theme-contrast-val', '100%'),
      slider('slider theme-contrast', 'sui-theme-contrast', '50', '150', '5', '100')
    ]));

    body.appendChild(section('Правки элементов', [
      el('div', 'ov-list'),
      btnRow(button('btn wide clear-ov', 'Очистить правки площадки'))
    ]));

    var jsonArea = el('textarea', 'json');
    jsonArea.spellcheck = false;
    jsonArea.placeholder = 'Вставьте JSON профиля и нажмите «Применить»';
    body.appendChild(section('Профиль JSON', [
      btnRow(button('btn accent copy', 'Копировать'), button('btn paste', 'Вставить')),
      jsonArea,
      btnRow(button('btn wide apply', 'Применить JSON'), button('btn danger wide reset', 'Сбросить площадку'))
    ]));

    root.appendChild(body);

    root.appendChild(el('div', 'foot', 'Готово'));

    return root;
  }

  function status(message, kind) {
    if (!statusNode) return;
    statusNode.className = 'foot' + (kind ? ' ' + kind : '');
    statusNode.textContent = message;
    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      if (statusNode) {
        statusNode.className = 'foot';
        defaultFoot();
      }
    }, 3600);
  }

  function buildPresets() {
    var container = shadow.querySelector('.presets');
    container.textContent = '';
    SUI.PRESET_KEYS.forEach(function (key) {
      var row = document.createElement('div');
      row.className = 'row';
      var id = 'sui-preset-' + key;
      var label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = SUI.PRESET_LABELS[key];
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'box preset';
      input.id = id;
      input.dataset.key = key;
      label.insertBefore(input, label.firstChild);
      row.appendChild(label);
      container.appendChild(row);
    });
  }

  /* Закрытие: гарантированно прячем панель и выключаем инспектор. */
  function closePanel() {
    if (mounted) panel.hidden = true;
    if (SUI.inspector && SUI.inspector.isActive()) SUI.inspector.disable();
    refresh();
  }

  function savePanelPosition(position) {
    var full = SUI.storage.getState();
    if (!full.ui) full.ui = {};
    full.ui.panelPos = { x: Math.round(position.x), y: Math.round(position.y) };
    SUI.storage.save();
  }

  function applyPanelPosition() {
    if (!mounted || !SUI.drag) return;
    var full = SUI.storage.getState();
    var saved = full.ui && full.ui.panelPos;
    if (!saved) return;
    var position = SUI.drag.clampToViewport(saved, panel.getBoundingClientRect(), 4);
    panel.style.left = Math.round(position.x) + 'px';
    panel.style.top = Math.round(position.y) + 'px';
    panel.style.right = 'auto';
  }

  function attachPanelDrag() {
    if (!SUI.drag) return;
    if (panelDragDetach) panelDragDetach();
    var head = shadow.querySelector('.panel-header');
    panelDragDetach = SUI.drag.attach({
      handle: head,
      element: panel,
      getPosition: function () {
        var rect = panel.getBoundingClientRect();
        return { x: parseFloat(panel.style.left) || rect.left, y: parseFloat(panel.style.top) || rect.top };
      },
      setPosition: function (position) {
        panel.style.left = Math.round(position.x) + 'px';
        panel.style.top = Math.round(position.y) + 'px';
        panel.style.right = 'auto';
      },
      clamp: function (position, rect) {
        return SUI.drag.clampToViewport(position, rect || panel.getBoundingClientRect(), 4);
      },
      onEnd: savePanelPosition
    });
  }

  function updateTheme(key, value, markCustom) {
    var state = SUI.storage.platform(platform);
    if (!state) return;
    if (!state.theme) state.theme = SUI.emptyTheme(platform);
    state.theme[key] = value;
    if (markCustom) state.theme.preset = 'custom';
    SUI.storage.save();
  }

  function applyThemePreset(key) {
    var state = SUI.storage.platform(platform);
    var preset = SUI.THEME_PRESETS[key];
    if (!state || !preset) return;
    state.theme = {
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
    SUI.storage.save();
    status('Тема: ' + preset.label, 'ok');
  }

  function mount() {
    if (mounted) return;
    mounted = true;
    host = document.createElement('div');
    host.id = 'sui-ui-host';
    host.setAttribute('data-sui', 'ui');
    Object.assign(host.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
      pointerEvents: 'none'
    });
    shadow = host.attachShadow({ mode: 'open' });

    var styles = document.createElement('style');
    styles.textContent = SUI.UI_CSS;
    shadow.appendChild(styles);

    panel = buildTemplate();
    shadow.appendChild(panel);
    statusNode = shadow.querySelector('.foot');
    buildPresets();
    attachPanelDrag();

    shadow.querySelector('.x').addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    });

    shadow.querySelector('.inspect-toggle').addEventListener('click', function () {
      SUI.inspector.toggle(platform);
      refresh();
    });

    shadow.addEventListener('change', function (event) {
      var target = event.target;
      var state = SUI.storage.platform(platform);
      if (!state) return;
      if (target.classList.contains('preset')) {
        state.presets[target.dataset.key] = target.checked;
        SUI.storage.save();
      }
    });

    shadow.addEventListener('input', function (event) {
      var target = event.target;
      var state = SUI.storage.platform(platform);
      if (!state) return;
      if (target.classList.contains('font')) {
        state.chat.fontScale = Number(target.value);
        SUI.storage.save();
      } else if (target.classList.contains('bg')) {
        state.chat.bgOpacity = Number(target.value);
        SUI.storage.save();
      } else if (target.classList.contains('overlay-bg')) {
        state.chat.overlayBgOpacity = Number(target.value);
        SUI.storage.save();
      } else if (target.classList.contains('theme-accent')) {
        updateTheme('accent', target.value, true);
      } else if (target.classList.contains('theme-bg')) {
        updateTheme('bg', target.value, true);
      } else if (target.classList.contains('theme-text')) {
        updateTheme('text', target.value, true);
      } else if (target.classList.contains('theme-hue')) {
        updateTheme('hue', Number(target.value), false);
      } else if (target.classList.contains('theme-sat')) {
        updateTheme('saturation', Number(target.value), false);
      } else if (target.classList.contains('theme-contrast')) {
        updateTheme('contrast', Number(target.value), false);
      }
    });

    shadow.querySelector('.chips').addEventListener('click', function (event) {
      var chip = event.target.closest('.theme-preset');
      if (chip) applyThemePreset(chip.dataset.preset);
    });

    shadow.querySelector('.ov-list').addEventListener('click', function (event) {
      var buttonEl = event.target.closest('.del');
      if (!buttonEl) return;
      var state = SUI.storage.platform(platform);
      if (!state) return;
      state.overrides = state.overrides.filter(function (item) { return item.id !== buttonEl.dataset.id; });
      SUI.storage.save();
      status('Правка удалена');
    });

    shadow.querySelector('.clear-ov').addEventListener('click', function () {
      var state = SUI.storage.platform(platform);
      if (!state || !state.overrides.length) return;
      state.overrides = [];
      SUI.storage.save();
      status('Правки площадки очищены');
    });

    shadow.querySelector('.copy').addEventListener('click', function () {
      copyText(SUI.storage.exportJSON()).then(function (ok) {
        status(ok ? 'Профиль скопирован в буфер' : 'Не удалось скопировать — выделите JSON вручную', ok ? 'ok' : 'err');
      });
    });

    shadow.querySelector('.paste').addEventListener('click', function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        status('Вставьте JSON в поле и нажмите «Применить»', 'err');
        return;
      }
      navigator.clipboard.readText().then(function (text) {
        shadow.querySelector('.json').value = text;
        status('JSON вставлен из буфера');
      }).catch(function () {
        status('Нет доступа к буферу — вставьте JSON в поле вручную', 'err');
      });
    });

    shadow.querySelector('.apply').addEventListener('click', function () {
      var text = shadow.querySelector('.json').value.trim();
      if (!text) {
        status('Поле JSON пустое', 'err');
        return;
      }
      SUI.storage.importJSON(text, function (err) {
        if (err) status(err.message, 'err');
        else {
          shadow.querySelector('.json').value = '';
          status('Профиль применён', 'ok');
        }
      });
    });

    shadow.querySelector('.reset').addEventListener('click', function () {
      SUI.storage.reset(platform, function () { status('Настройки площадки сброшены'); });
    });

    SUI.storage.subscribe(function () { refresh(); });

    (document.body || document.documentElement).appendChild(host);
    refresh();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(area);
    return ok;
  }

  function refresh() {
    if (!mounted || !platform) return;
    var spec = SUI.SELECTORS[platform];
    var state = SUI.storage.platform(platform);
    if (!state) return;
    var theme = state.theme || (state.theme = SUI.emptyTheme(platform));
    var resolved = SUI.styleEngine.resolveTheme(platform, theme);

    host.style.setProperty('--accent', resolved.accentCss);
    shadow.querySelector('.pname').textContent = spec.name;
    shadow.querySelector('.inspect-toggle').textContent = SUI.inspector.isActive()
      ? 'Выключить инспектор'
      : 'Включить инспектор';

    SUI.PRESET_KEYS.forEach(function (key) {
      var input = shadow.querySelector('.preset[data-key="' + key + '"]');
      if (input) input.checked = state.presets[key] === true;
    });

    var font = shadow.querySelector('.font');
    var bg = shadow.querySelector('.bg');
    var overlayBg = shadow.querySelector('.overlay-bg');
    font.value = String(state.chat.fontScale);
    bg.value = String(state.chat.bgOpacity);
    overlayBg.value = String(state.chat.overlayBgOpacity);
    shadow.querySelector('.font-val').textContent = Number(state.chat.fontScale).toFixed(2) + '×';
    shadow.querySelector('.bg-val').textContent = Math.round(state.chat.bgOpacity * 100) + '%';
    shadow.querySelector('.overlay-bg-val').textContent = Math.round(state.chat.overlayBgOpacity * 100) + '%';

    var accentInput = shadow.querySelector('.theme-accent');
    var bgInput = shadow.querySelector('.theme-bg');
    var textInput = shadow.querySelector('.theme-text');
    if (accentInput) accentInput.value = resolved.accentCss;
    if (bgInput) bgInput.value = /^#[0-9a-f]{6}$/i.test(theme.bg) ? theme.bg : resolved.accentCss;
    if (textInput) textInput.value = /^#[0-9a-f]{6}$/i.test(theme.text) ? theme.text : resolved.textCss;

    var hue = shadow.querySelector('.theme-hue');
    var sat = shadow.querySelector('.theme-sat');
    var contrast = shadow.querySelector('.theme-contrast');
    hue.value = String(theme.hue);
    sat.value = String(theme.saturation);
    contrast.value = String(theme.contrast);
    shadow.querySelector('.theme-hue-val').textContent = theme.hue + '°';
    shadow.querySelector('.theme-sat-val').textContent = theme.saturation + '%';
    shadow.querySelector('.theme-contrast-val').textContent = theme.contrast + '%';

    Array.prototype.forEach.call(shadow.querySelectorAll('.theme-preset'), function (chip) {
      chip.classList.toggle('active', chip.dataset.preset === theme.preset);
    });

    var list = shadow.querySelector('.ov-list');
    list.textContent = '';
    if (!state.overrides.length) {
      var empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Нет правок. Выделите элемент инспектором.';
      list.appendChild(empty);
    } else {
      state.overrides.slice().reverse().forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'ov';
        var code = document.createElement('code');
        code.textContent = item.selector;
        code.title = item.selector;
        var tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = item.action === 'hide' ? 'hide'
          : item.action === 'dim' ? 'dim'
            : item.action === 'color' ? 'color' : 'restore';
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'del';
        del.dataset.id = item.id;
        del.title = 'Удалить правку';
        del.textContent = '×';
        row.appendChild(code);
        row.appendChild(tag);
        row.appendChild(del);
        list.appendChild(row);
      });
    }
  }

  SUI.ui = {
    mount: mount,
    setPlatform: function (next) {
      platform = next;
      refresh();
    },
    open: function () {
      mount();
      panel.hidden = false;
      applyPanelPosition();
      refresh();
    },
    close: closePanel,
    toggle: function () {
      if (!mounted || panel.hidden) SUI.ui.open();
      else closePanel();
    },
    isOpen: function () { return mounted && !panel.hidden; },
    refresh: refresh,
    status: status
  };

  SUI_FILES[SUI_FILE] = 'done';
})();
