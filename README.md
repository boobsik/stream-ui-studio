# stream-ui-studio

Расширение Manifest V3 для YouTube и Twitch: визуальный инспектор DOM, пресеты очистки интерфейса, настройки чата и перенос профиля через JSON.

Vanilla JS + HTML + CSS. Сборщиков, зависимостей и сетевых запросов нет. Всё, что расширение сохраняет, остаётся в `chrome.storage.local` браузера.

## Что внутри

- **Автоопределение площадки.** Content script срабатывает на Twitch и YouTube и переживает SPA-переходы: `pushState`/`replaceState`, `popstate`, `yt-navigate-finish`, `yt-page-data-updated`, мутации DOM и опроску адреса/заголовка. Стили не слетают при переключении стрима или видео.
- **Инспектор DOM.** Панель на странице открывается кнопкой в popup, дальше — кнопка «Включить инспектор» в панели или в popup. Наведение — тонкая рамка и подсказка со сгенерированным CSS-селектором. Клик — «Скрыть», «Полупрозрачный», «Вернуть обратно», а также выбор цвета фона и текста (пипетки, 5 быстрых оттенков, сброс). Селекторы и цвета сохраняются отдельно для YouTube и Twitch.
- **Перетаскивание.** Панель редактора тянется за верхнюю шапку, мини-панель инспектора — за заголовок «Действия», оверлей чата — за верхнюю полоску. Позиции ограничены viewport и сохраняются в профиле. Кнопка `×` в шапке гарантированно закрывает панель и выключает инспектор.
- **Пресеты в 1 клик.** Скрыть рекомендации/сайдбар, скрыть Shorts/клипы, скрыть лишние кнопки под плеером, компактный чат, чат поверх видео (театр и нативный фуллскрин).
- **Чат.** Масштаб шрифта `0.70–1.80×`, прозрачность обычного чата `0–100%` (`sui.chat.bgOpacity`) и отдельная прозрачность оверлея `0–100%` (`sui.chat.overlayBgOpacity`, по умолчанию `0%`). Второй ползунок влияет только на `.sui-chat-overlay` и не меняет боковой чат. Компактный режим скрывает шапки, награды, подарки, хайп-трейны, закреплённые сообщения, бейджи и аватары, уплотняя сообщения до `padding: 2px 6px` / `line-height: 1.25`. В режиме оверлея дополнительно прячутся шапка чата, тикеры донатов, лидерборд, плашки Bits/Cheer, закреплённые блоки и панель баллов/Bits/смайлов/настроек. Весь нижний блок отправки (`.chat-input`, `[data-a-target="chat-input"]`, `yt-live-chat-message-input-renderer`, `#input-panel`) скрывается целиком — в «Чат поверх видео» остаётся только чистая лента сообщений, без поля, значков и кнопок. На Twitch все внутренние слои чата принудительно прозрачные: общая подложка задаётся только корнем оверлея и вторым ползунком. При его значении `<20%` дополнительно обнуляются фон самого оверлея, его прямых `div`, всех `section` и динамических обёрток `[class*="Layout-sc-"]`. При низкой прозрачности сообщения получают контрастную `text-shadow`, смайлы — `drop-shadow`, а сплошные подложки отдельных блоков убираются. Полоска `ЧАТ · ПЕРЕТАСКИВАТЬ` теперь находится внутри корня оверлея: `position: relative`, `z-index: 2147483647`, `pointer-events: auto`, `cursor: grab`; лента получает `padding-top: 28px`, поэтому сообщения начинаются строго под полоской и не перехватывают мышь. Оверлей чата — чистый CSS (`position: fixed`, `pointer-events: auto`, `z-index: 2147483645`, `width: 340px`). В театральном режиме DOM не трогается; в нативном fullscreen чат вместе с полоской временно переносится внутрь `document.fullscreenElement` и возвращается на место по `comment`-плейсхолдеру.
- **Общий вид и цвет площадки.** Акцент, фон и текст + пресеты «Тёмный графит», «Фиолетовый Twitch», «Красный YouTube», «Изумрудный», «Прозрачное стекло». Переменные `--yt-spec-*`, `--color-background-*`, `--color-text-*` и `--color-brand-*` переопределяются с `!important` на `html`, `html[dark]`, `body`, `ytd-app`, шапке YouTube и `:root` / `.tw-root--theme-dark` Twitch. Ползунки «Оттенок / Насыщенность / Контраст» задают `filter` только на основном контенте (`ytd-app` / `.inject-layout` либо `main`), не затрагивая хост панели.
- **Профиль JSON.** Кнопки «Копировать» / «Вставить» + поле вставки и «Применить JSON». Перенос настроек между обычным браузером и lite-stream-browser.
- **Popup по иконке.** Компактное меню: заголовок площадки, кнопки «Открыть редактор на странице» и «Включить инспектор элементов». Все пресеты находятся только в плавающей панели редактора. Popup проверяет активную вкладку и подсвечивает акцент текущей площадки. Если content script не внедрён (например, Firefox MV3 не выдал хост-разрешения), popup по клику внедряет его через `chrome.scripting.executeScript` и повторяет команду — без перезагрузки страницы и ручного изменения разрешений. На самой странице нет никаких плавающих кнопок расширения — панель появляется только из popup. Горячих клавиш нет.

### Дизайн

Строго по Unslop: фон `#0B0C0E`, границы `1px solid rgba(255,255,255,0.08)`, акцент `#FF0033` для YouTube и `#9146FF` для Twitch. Панель живёт в Shadow DOM и не наследует стили сайта. Никаких градиентов, скруглений и декоративных шумов.

## Установка в Chrome / Edge

1. Скопируйте папку `stream-ui-studio` (ту, где лежит `manifest.json`) туда, где она будет постоянно находиться. Не удаляйте её после загрузки — браузер ссылается на неё, а не на копию.
2. Откройте `chrome://extensions` (в Edge — `edge://extensions`).
3. Включите **Режим разработчика** (правый верхний угол).
4. Нажмите **Загрузить распакованное расширение** и выберите папку с `manifest.json`.
5. Откройте YouTube или Twitch, нажмите иконку расширения и выберите «Открыть редактор на странице» — панель появится в правом верхнем углу.

> Горячие клавиши (`Alt+E` / `Ctrl+E`) и секция `commands` из манифеста удалены: панель открывается только кнопками в popup. Это исключает конфликты с системными сочетаниями браузера.

## Установка в Firefox

Манифест содержит оба варианта фонового скрипта: `background.service_worker` для Chromium и `background.scripts` для Firefox (Firefox игнорирует `service_worker`). Идентификатор расширения зафиксирован в `browser_specific_settings.gecko.id`.

Разрешения `activeTab` и `scripting` нужны для Firefox MV3: если хост-разрешения не выданы, декларативный content script не внедряется. Достаточно нажать любую кнопку в popup — он внедрит файлы из `content_scripts[0].js` программно и сразу выполнит команду. Слушатель сообщений регистрируется в самом начале `content/content.js`, до загрузки модулей, поэтому повторное нажатие кнопки не даёт «Receiving end does not exist». Все файлы защищены от повторного выполнения через `window.__SUI_LOADED__`.

### Протокол сообщений

Оба конца используют единый слой `const ext = globalThis.browser ?? globalThis.chrome;` и **нативный Promise API**. В `content/content.js` обработчик `ext.runtime.onMessage.addListener` возвращает `Promise`, который резолвится в `{ ok: true, ... }` или `{ ok: false, error: '...' }`. Паттерн `sendResponse()` + `return true` полностью убран: именно он ломается в Firefox MV3, закрывая порт до асинхронного ответа. В `popup/popup.js` все вызовы (`tabs.query`, `tabs.sendMessage`, `scripting.executeScript`) выполняются через `await`. Для старых WebView2-сборок, где `chrome.*` работает только через callback, сохранён совместимый враппер, читающий `chrome.runtime.lastError`.

1. Откройте `about:debugging#/runtime/this-firefox`.
2. Нажмите **Загрузить временную надстройку** и выберите `manifest.json` в папке расширения.
3. Проверьте работу на YouTube/Twitch: иконка в панели инструментов открывает popup, кнопка «Открыть редактор на странице» показывает панель. Если popup пишет «Ошибка на странице: …», там указан точный текст исключения из `lib/*.js` или из инициализации.

> Проверка манифеста: `web-ext lint` — 0 ошибок. `web-ext run` успешно устанавливает расширение как временную надстройку с ID `stream-ui-studio@extension.local`.

## Установка в lite-stream-browser (WebView2)

Минимальная версия WebView2 Runtime — **120.0.2210.55** (SDK 1.0.2210.55), с которой появилась поддержка расширений браузера.

### Если в lite-stream-browser уже есть UI загрузки расширений

Используйте «Загрузить распакованное расширение» и укажите путь к папке с `manifest.json`. Дополнительно убедитесь, что хост-приложение включило расширения в WebView2 (см. ниже) — без этого загрузка упадёт с `ERROR_NOT_SUPPORTED`.

### Если загрузка идёт из кода хост-приложения

До вызова `EnsureCoreWebView2Async` нужно включить расширения в опциях окружения, затем добавить папку через профиль:

```csharp
using Microsoft.Web.WebView2.Core;

var options = new CoreWebView2EnvironmentOptions
{
    AreBrowserExtensionsEnabled = true
};

var env = await CoreWebView2Environment.CreateAsync(
    browserExecutableFolder: null,
    userDataFolder: userDataFolder,
    options: options);

await webView.EnsureCoreWebView2Async(env);

await webView.CoreWebView2.Profile.AddBrowserExtensionAsync(
    @"<absolute path to stream-ui-studio>");
```

Для WinRT/C++ это те же шаги: `CoreWebView2EnvironmentOptions.AreBrowserExtensionsEnabled = true`, затем `CoreWebView2Profile.AddBrowserExtensionAsync(extensionFolderPath)`.

Важные особенности WebView2:

- Расширение сохраняется в профиле, но **содержимое папки не копируется**. После изменения любого файла расширения WebView2 считает его удалённым — повторно вызовите `AddBrowserExtensionAsync` (или переустановите через UI) и перезагрузите страницу.
- Панель с иконкой действия в WebView2 может отсутствовать, поэтому popup может быть недоступен. В таком случае панель на странице открыть невозможно: горячих клавиш больше нет, а кнопки в UI хост-приложения нет.
- `chrome.storage.local`, декларативные content scripts и сообщения между расширением и вкладкой поддерживаются. Фолбэк на `localStorage` на случай урезанной сборки уже зашит в `lib/storage.js`.

## Использование

### Инспектор и правки

1. Откройте панель через popup по иконке и нажмите **Включить инспектор**.
2. Наведите на нужный элемент: рамка покажет границы, подсказка — селектор (`#id`, `[data-a-target="…"]`, путь с `:nth-of-type`).
3. Кликните по элементу и выберите действие: скрыть, затемнить, вернуть или задать цвет фона/текста. Мини-панель можно перетащить за заголовок.
4. Список правок для текущей площадки виден в разделе **Правки элементов**; там же можно удалить конкретную правку или очистить все.
5. Панель редактора тянется за шапку, закрывается кнопкой `×` (инспектор при этом выключается).

Правки хранятся раздельно: `sui.overrides.youtube` и `sui.overrides.twitch`. Пресеты, настройки чата и тема тоже разделены (`sui.presets.*`, `sui.chat.*`, `sui.theme.*`); позиции панелей лежат в `sui.ui`.

### Перенос настроек

- **Копировать** — профиль JSON уходит в буфер (с фолбэком на `execCommand` для WebView2).
- **Вставить** — читает буфер через `navigator.clipboard.readText()`. Если доступ к буферу не выдан, вставьте JSON в поле вручную и нажмите **Применить JSON**.
- **Сбросить площадку** — возвращает пресеты, чат и правки текущего сайта к значениям по умолчанию.

Формат экспорта:

```json
{
  "app": "stream-ui-studio",
  "schema": 1,
  "exportedAt": "2026-11-22T12:00:00.000Z",
  "platforms": {
    "youtube": {
      "presets": { "hideRecommendations": false, "hideShorts": true, "hidePlayerButtons": false, "compactChat": false, "chatOverlay": false },
      "chat": { "fontScale": 1, "bgOpacity": 1 },
      "overrides": [],
      "theme": { "preset": "youtube", "accent": "#FF0033", "bg": "#0B0C0E", "surface": "#1A1B1E", "text": "#F1F1F1", "alpha": 1, "hue": 0, "saturation": 100, "contrast": 100 }
    },
    "twitch": {
      "presets": { "hideRecommendations": false, "hideShorts": false, "hidePlayerButtons": false, "compactChat": true, "chatOverlay": false },
      "chat": { "fontScale": 1, "bgOpacity": 1 },
      "overrides": [],
      "theme": { "preset": "twitch", "accent": "#9146FF", "bg": "#0E0A17", "surface": "#1B1530", "text": "#EFEFF1", "alpha": 1, "hue": 0, "saturation": 100, "contrast": 100 }
    }
  },
  "ui": {
    "panelPos": null,
    "menuPos": null,
    "chatPos": {
      "youtube": { "x": 0, "y": 0 },
      "twitch": { "x": 0, "y": 0 }
    }
  }
}
```

Импорт валидируется: некорректные селекторы отбрасываются, числовые значения ограничиваются допустимым диапазоном.

## Структура

```
manifest.json
background/service-worker.js   # дополнительная команда (без onClicked)
popup/popup.html               # popup по иконке
popup/popup.css                # стили popup
popup/popup.js                 # проверка вкладки, команды в content script
content/content.js             # bootstrap и обработка сообщений
lib/constants.js               # площадки, селекторы, темы, дефолты
lib/drag.js                    # перетаскивание панелей/меню/чата с ограничением viewport
lib/storage.js                 # storage.local + import/export
lib/style-engine.js            # CSS, SPA-навигация, fullscreen-чат
lib/inspector.js               # подсветка, селектор, действия и цвета элементов
lib/ui-styles.js               # стили панели (Shadow DOM)
lib/ui.js                      # панель, пресеты, темы, слайдеры, JSON
icons/icon*.png
```

## Важно про match patterns

В исходной формулировке второй паттерн был указан как `*://*://*` — это невалидный match pattern (как и `*://://youtube.com*`). Используются корректные шаблоны, включая явные `youtube.com` / `www.youtube.com` / `www.twitch.tv` для форков Firefox (Zen, Floorp):

```
*://*.twitch.tv/*
*://www.twitch.tv/*
*://*.youtube.com/*
*://youtube.com/*
*://www.youtube.com/*
*://*.youtube-nocookie.com/*
*://youtu.be/*
```

Если нужен ещё один сайт, добавьте его паттерн в `manifest.json` в два места: `content_scripts[0].matches` и `host_permissions`, затем опишите его селекторы в `lib/constants.js`.

## Trusted Types

YouTube включает строгие Trusted Types (`require-trusted-types-for 'script'`). В таком режиме HTML-синками являются не только `.innerHTML`, но и `DOMParser.parseFromString`, `insertAdjacentHTML`, `document.write`. Во всех файлах `lib/` они полностью устранены: разметка панели и меню инспектора собирается через `document.createElement` / `textContent` / `createTextNode`. `lib/style-engine.js` работает только со стилями (`styleNode.textContent`), к HTML-синкам не обращается.

Если popup показывает ошибку, в статусе теперь выводится точное `err.message` от `chrome.tabs.sendMessage` и `chrome.scripting.executeScript` — по нему видно, не хватает ли разрешения, не отвечает ли content script или ошибка в самого скрипта на странице.

## Известные нюансы

- YouTube и Twitch регулярно меняют классы и `data-*` атрибуты. Если пресет перестал работать, выделите элемент инспектором и сохранённый селектор добавится в `overrides` — он имеет приоритет над пресетами.
- «Чат поверх видео» в театральном режиме — это CSS-оверлей с высокой `z-index`, DOM не перемещается. В нативном fullscreen браузер показывает в top-layer только видеоплеер, поэтому чат временно переносится внутрь `document.fullscreenElement`; при выходе он возвращается в исходный `parentNode` на то же место с помощью `comment`-плейсхолдера. Полоска сверху служит для перетаскивания, позиция сохраняется.
- Расширение не делает запросов никуда, кроме загрузки самих страниц YouTube/Twitch браузером.
