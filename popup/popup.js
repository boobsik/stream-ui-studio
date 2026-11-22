/* stream-ui-studio — логика popup: проверяет вкладку и шлёт команды в content script.
   Используем нативный Promise-API: globalThis.browser (Firefox MV3) или
   globalThis.chrome (Chromium/Edge/WebView2). Firefox MV3 не поддерживает
   sendResponse + return true, поэтому ответ приходит только через Promise. */
(function () {
  'use strict';

  const ext = globalThis.browser ?? globalThis.chrome;
  const isNativeBrowserApi = !!globalThis.browser;

  const SUI = window.SUI;
  const statusNode = document.getElementById('status');
  const main = document.getElementById('main');
  const hostNode = document.getElementById('host');
  let tabId = null;
  let platform = null;

  /* Порядок должен совпадать с content_scripts[0].js в manifest.json. */
  const CONTENT_FILES = [
    'content/content.js',
    'lib/constants.js',
    'lib/drag.js',
    'lib/storage.js',
    'lib/style-engine.js',
    'lib/inspector.js',
    'lib/ui-styles.js',
    'lib/ui.js'
  ];

  /* Вызов API с единым Promise-интерфейсом. В Firefox browser.* уже возвращает
     Promise; в Chromium chrome.* тоже, но для совместимости со старыми WebView2
     дополнительно поддерживаем callback-форму через chrome.runtime.lastError. */
  function callApi(method, args) {
    if (isNativeBrowserApi) {
      return method.apply(ext, args);
    }
    return new Promise(function (resolve, reject) {
      let settled = false;
      const finish = function (value, error) {
        if (settled) return;
        settled = true;
        if (error) reject(error instanceof Error ? error : new Error(error.message || String(error)));
        else resolve(value);
      };
      let result;
      try {
        result = method.apply(ext, args.concat([function (value) {
          const err = ext.runtime && ext.runtime.lastError;
          finish(value, err);
        }]));
      } catch (err) {
        finish(undefined, err);
        return;
      }
      /* Современный chrome.* возвращает Promise даже при переданном callback —
         в этом случае считаем его основным источником ответа. */
      if (result && typeof result.then === 'function') {
        result.then(function (value) { finish(value, null); }, function (err) { finish(undefined, err); });
      }
    });
  }

  function tabsQuery() {
    return callApi(ext.tabs.query.bind(ext.tabs), [{ active: true, currentWindow: true }]);
  }

  function tabsSendMessage(id, payload) {
    return callApi(ext.tabs.sendMessage.bind(ext.tabs), [id, payload]);
  }

  function scriptingExecuteScript(id, files) {
    return callApi(ext.scripting.executeScript.bind(ext.scripting), [{ target: { tabId: id }, files: files }]);
  }

  function setStatus(text, kind) {
    statusNode.textContent = text;
    statusNode.className = 'status' + (kind ? ' ' + kind : '');
  }

  function errorText(error) {
    if (!error) return 'нет ошибки';
    return error.message || String(error);
  }

  function checkPageResponse(response) {
    if (response && response.ok === false) {
      throw new Error('Ошибка на странице: ' + (response.error || 'неизвестная ошибка'));
    }
    return response || {};
  }

  async function injectContentScript() {
    if (!ext.scripting || !ext.scripting.executeScript) {
      throw new Error('API scripting недоступно');
    }
    await scriptingExecuteScript(tabId, CONTENT_FILES);
  }

  async function send(type, extra, canInject) {
    if (tabId === null) {
      throw new Error('Активная вкладка не найдена');
    }

    const payload = { type: type };
    if (extra) {
      Object.keys(extra).forEach(function (key) { payload[key] = extra[key]; });
    }

    try {
      return await tabsSendMessage(tabId, payload);
    } catch (sendError) {
      /* content script ещё не внедрён. Внедряем по пользовательскому жесту
         и повторяем ту же команду — без перезагрузки страницы. */
      if (canInject === false) throw sendError;
      setStatus('Внедряем панель… (' + errorText(sendError) + ')');

      try {
        await injectContentScript();
      } catch (injectError) {
        throw new Error('sendMessage: ' + errorText(sendError) + ' · executeScript: ' + errorText(injectError));
      }

      try {
        return await tabsSendMessage(tabId, payload);
      } catch (retryError) {
        throw new Error('Повтор sendMessage: ' + errorText(retryError));
      }
    }
  }

  async function runCommand(type, extra, closeOnSuccess) {
    try {
      const response = checkPageResponse(await send(type, extra, true));
      if (closeOnSuccess) window.close();
      return response;
    } catch (err) {
      setStatus(errorText(err), 'err');
      return null;
    }
  }

  async function init() {
    if (!ext || !ext.tabs || !ext.tabs.query) {
      setStatus('API вкладок недоступно', 'err');
      return;
    }

    try {
      const tabs = await tabsQuery();
      const tab = tabs && tabs[0];
      if (!tab || typeof tab.id !== 'number') {
        setStatus('Активная вкладка не найдена', 'err');
        return;
      }

      tabId = tab.id;
      let hostname = '';
      try {
        hostname = new URL(tab.url || tab.pendingUrl || '').hostname.toLowerCase();
      } catch (err) { /* адрес недоступен — считаем вкладку неподдерживаемой */ }
      hostNode.textContent = hostname || 'неизвестный адрес';

      platform = SUI && SUI.detectPlatform ? SUI.detectPlatform(hostname) : null;
      if (!platform) {
        setStatus('Поддерживаются только YouTube и Twitch', 'err');
        return;
      }

      document.documentElement.style.setProperty('--accent', SUI.SELECTORS[platform].accent);
      main.hidden = false;
      setStatus(SUI.SELECTORS[platform].name + ' · проверяем панель…');

      /* При открытии popup только проверяем наличие панели. Внедрение делаем
         по явному клику, чтобы activeTab был выдан в рамках пользовательского жеста. */
      try {
        const response = checkPageResponse(await send('sui-ping', {}, false));
        if (response.ok) setStatus(SUI.SELECTORS[platform].name + ' · панель готова', 'ok');
      } catch (err) {
        setStatus(SUI.SELECTORS[platform].name + ' · нажмите кнопку (' + errorText(err) + ')');
      }
    } catch (err) {
      setStatus('Не удалось получить вкладку: ' + errorText(err), 'err');
    }
  }

  document.getElementById('open-editor').addEventListener('click', function () {
    runCommand('sui-open', {}, true);
  });

  document.getElementById('inspector').addEventListener('click', function () {
    runCommand('sui-inspector-on', {}, true);
  });

  init();
})();
