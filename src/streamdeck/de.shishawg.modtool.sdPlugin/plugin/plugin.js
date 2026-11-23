// Stream Deck plugin backend (runs in Stream Deck's embedded browser).
(function () {
  'use strict';

  var ACTION = 'de.shishawg.modtool.chatcommand';
  var conn = window.SWG_CONNECTION || { port: 18942, token: '' };
  var API = 'http://127.0.0.1:' + conn.port + '/api/streamdeck';

  var ws = null;
  var contexts = {};      // context -> settings
  var commands = [];
  var lastError = '';
  var pollTimer = null;

  function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

  function api(path, body) {
    return fetch(API + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'X-SWG-Token': conn.token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      var isJson = (r.headers.get('Content-Type') || '').indexOf('application/json') !== -1;
      if (!isJson) throw new Error('Mod-Tool ist zu alt für Stream Deck. Bitte auf die neueste Version updaten und neu starten.');
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok || !d.success) throw new Error(d.error || ('HTTP ' + r.status));
        return d;
      });
    }, function () {
      throw new Error('Mod-Tool nicht erreichbar. Läuft das ShishaWG Mod Setup Tool?');
    });
  }

  function render(context) {
    var s = contexts[context] || {};
    var image = window.SWGRender.renderKey({
      label: s.label, command: s.command, mode: s.mode,
      placeholder: 'Command wählen', dim: !s.commandId
    });
    send({ event: 'setImage', context: context, payload: { image: image, target: 0 } });
  }

  function pushToInspectors() {
    Object.keys(contexts).forEach(function (context) {
      send({ event: 'sendToPropertyInspector', action: ACTION, context: context,
        payload: { type: 'commands', commands: commands, error: lastError } });
    });
  }

  // Pull the current list; keep keys in sync when a command was renamed in the tool.
  function refresh() {
    return api('/commands').then(function (d) {
      commands = d.commands || [];
      lastError = '';
      Object.keys(contexts).forEach(function (context) {
        var s = contexts[context];
        var cmd = commands.filter(function (c) { return c.id === s.commandId; })[0];
        if (cmd && (cmd.label !== s.label || cmd.command !== s.command)) {
          s.label = cmd.label; s.command = cmd.command;
          send({ event: 'setSettings', context: context, payload: s });
          render(context);
        }
      });
    }, function (e) { lastError = e.message; }).then(pushToInspectors);
  }

  function ensurePolling() {
    var active = Object.keys(contexts).length > 0;
    if (active && !pollTimer) pollTimer = setInterval(refresh, 30000);
    if (!active && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function onKeyDown(context) {
    var s = contexts[context] || {};
    if (!s.commandId) { send({ event: 'showAlert', context: context }); return; }
    api('/run', { id: s.commandId }).then(function () {
      send({ event: 'showOk', context: context });
    }, function (e) {
      lastError = e.message;
      send({ event: 'showAlert', context: context });
      send({ event: 'logMessage', payload: { message: 'SWG: ' + e.message } });
    });
  }

  window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent) {
    ws = new WebSocket('ws://127.0.0.1:' + port);
    ws.onopen = function () { send({ event: registerEvent, uuid: uuid }); };
    ws.onmessage = function (evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      var context = msg.context;
      var payload = msg.payload || {};
      switch (msg.event) {
        case 'willAppear':
        case 'didReceiveSettings':
          contexts[context] = payload.settings || {};
          render(context);
          ensurePolling();
          if (msg.event === 'willAppear') refresh();
          break;
        case 'willDisappear':
          delete contexts[context];
          ensurePolling();
          break;
        case 'keyDown':
          if (payload.settings) contexts[context] = payload.settings;
          onKeyDown(context);
          break;
        case 'propertyInspectorDidAppear':
          refresh();
          break;
        case 'sendToPlugin':
          if (payload.type === 'refresh') refresh();
          break;
      }
    };
  };
})();
