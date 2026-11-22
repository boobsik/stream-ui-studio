/* stream-ui-studio — стили панели. Строго внутри Shadow DOM, страницу не трогаем. */
(function () {
  'use strict';

  var SUI_FILE = 'lib/ui-styles.js';
  var SUI_FILES = (window.__SUI_FILES__ = window.__SUI_FILES__ || {});
  if (window.__SUI_LOADED__ || SUI_FILES[SUI_FILE] === 'done') return;
  window.__SUI_LOADING__ = SUI_FILE;

  var SUI = window.SUI;

  SUI.UI_CSS = [
    ':host { all: initial; }',
    '* { box-sizing: border-box; }',
    ':host { --bg: #0B0C0E; --line: rgba(255,255,255,0.08); --text: #E7E7EA; --muted: #77777E; --accent: #FF0033; }',
    'button, input, textarea { font: inherit; color: inherit; }',
    'button { cursor: pointer; }',

    '.panel { position: fixed; top: 16px; right: 16px; width: 344px; max-height: calc(100vh - 32px); display: flex; flex-direction: column; background: var(--bg); border: 1px solid var(--line); color: var(--text); font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; z-index: 2147483647; pointer-events: auto; box-shadow: 0 12px 40px rgba(0,0,0,.55); }',
    '.panel[hidden] { display: none; }',
    '.head { padding: 13px 14px 11px; border-bottom: 1px solid var(--line); display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }',
    '.panel-header { cursor: move; touch-action: none; user-select: none; }',
    '.panel-header.sui-dragging { background: rgba(255,255,255,.03); }',
    '.brand { font: 11px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; letter-spacing: .1em; }',
    '.brand b { color: var(--accent); font-weight: 600; }',
    '.sub { margin-top: 5px; color: var(--muted); font-size: 11px; }',
    '.platform { display: flex; align-items: center; gap: 6px; padding: 3px 6px; border: 1px solid var(--line); font: 10px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: .06em; color: var(--text); white-space: nowrap; }',
    '.dot { width: 6px; height: 6px; background: var(--accent); }',
    '.x { margin-left: 2px; width: 20px; height: 20px; padding: 0; display: grid; place-items: center; background: transparent; border: 1px solid var(--line); color: var(--muted); font-size: 14px; line-height: 1; }',
    '.x:hover { color: var(--text); border-color: rgba(255,255,255,.2); }',

    '.body { overflow-y: auto; overscroll-behavior: contain; }',
    '.body::-webkit-scrollbar { width: 8px; }',
    '.body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border: 2px solid var(--bg); }',
    'section { padding: 12px 14px; border-bottom: 1px solid var(--line); }',
    'section:last-child { border-bottom: 0; }',
    'h2 { margin: 0 0 10px; font: 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; font-weight: 500; text-transform: uppercase; letter-spacing: .1em; color: var(--muted); }',

    '.row { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 28px; }',
    '.row + .row { margin-top: 6px; }',
    '.row label { display: flex; align-items: center; gap: 9px; cursor: pointer; user-select: none; }',
    '.box { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; margin: 0; border: 1px solid rgba(255,255,255,.22); background: transparent; position: relative; flex: none; cursor: pointer; }',
    '.box:checked { border-color: var(--accent); background: var(--accent); }',
    '.box:checked::after { content: ""; position: absolute; left: 3px; top: 0px; width: 5px; height: 9px; border: solid #0B0C0E; border-width: 0 2px 2px 0; transform: rotate(45deg); }',

    '.btn { padding: 6px 9px; background: transparent; border: 1px solid var(--line); color: var(--text); font: 11px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .02em; }',
    '.btn:hover { border-color: rgba(255,255,255,.22); background: rgba(255,255,255,.04); }',
    '.btn.accent { border-color: var(--accent); color: var(--accent); }',
    '.btn.wide { width: 100%; text-align: center; }',
    '.btn.danger:hover { border-color: var(--accent); color: var(--accent); }',
    '.btnrow { display: flex; gap: 6px; }',
    '.btnrow + .btnrow { margin-top: 6px; }',
    '.btnrow .btn { flex: 1; }',

    '.slider { width: 100%; height: 18px; margin: 2px 0 8px; appearance: none; -webkit-appearance: none; background: transparent; cursor: pointer; }',
    '.slider::-webkit-slider-runnable-track { height: 2px; background: rgba(255,255,255,.16); }',
    '.slider::-webkit-slider-thumb { appearance: none; -webkit-appearance: none; width: 10px; height: 14px; margin-top: -6px; background: var(--accent); border: 0; }',
    '.slider::-moz-range-track { height: 2px; background: rgba(255,255,255,.16); }',
    '.slider::-moz-range-thumb { width: 10px; height: 14px; background: var(--accent); border: 0; border-radius: 0; }',
    '.val { color: var(--muted); font: 11px/1 ui-monospace, monospace; }',

    '.colors { display: flex; gap: 8px; }',
    '.colors label { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--muted); font: 10px/1 ui-monospace, monospace; }',
    '.colors input[type="color"] { width: 28px; height: 20px; padding: 0; border: 1px solid var(--line); background: transparent; cursor: pointer; }',
    '.chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 4px 0 8px; }',
    '.chip { padding: 4px 7px; background: transparent; border: 1px solid var(--line); color: var(--muted); font: 10px/1.2 ui-monospace, monospace; }',
    '.chip.active { border-color: var(--accent); color: var(--accent); }',

    '.ov-list { margin: 0 0 8px; display: flex; flex-direction: column; gap: 4px; max-height: 148px; overflow-y: auto; }',
    '.ov { display: flex; align-items: center; gap: 6px; padding: 5px 6px; border: 1px solid var(--line); background: rgba(255,255,255,.015); }',
    '.ov code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 10px/1.3 ui-monospace, monospace; color: #B9B9C0; }',
    '.ov .tag { font: 9px/1 ui-monospace, monospace; text-transform: uppercase; color: var(--accent); }',
    '.ov .del { border: 0; background: transparent; color: var(--muted); padding: 0 2px; font-size: 13px; line-height: 1; }',
    '.ov .del:hover { color: var(--accent); }',
    '.empty { color: var(--muted); font-size: 11px; margin-bottom: 8px; }',

    'textarea { width: 100%; height: 92px; margin: 0 0 6px; padding: 8px; resize: vertical; background: #101114; border: 1px solid var(--line); color: #C9C9D0; font: 10px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; outline: none; }',
    'textarea:focus { border-color: rgba(255,255,255,.2); }',

    '.foot { padding: 8px 14px; border-top: 1px solid var(--line); color: var(--muted); font: 10px/1.35 ui-monospace, monospace; min-height: 28px; }',
    '.foot.ok { color: var(--text); }',
    '.foot.err { color: var(--accent); }',
    '.kbd { display: inline-block; padding: 0 4px; border: 1px solid var(--line); color: #B9B9C0; }'
  ].join('\n');

  SUI_FILES[SUI_FILE] = 'done';
})();
