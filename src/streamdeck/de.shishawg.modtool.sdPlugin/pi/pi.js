// Property Inspector: pick a command, the key image is generated automatically.
(function () {
  'use strict';

  var ws = null;
  var uuid = '';
  var action = '';
  var settings = {};
  var commands = [];

  var selCommand = document.getElementById('command');
  var selMode = document.getElementById('mode');
  var status = document.getElementById('status');

  function send(obj) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); }

  function save() {
    send({ event: 'setSettings', context: uuid, payload: settings });
  }

  function fillCommands(error) {
    selCommand.innerHTML = '';
    var empty = document.createElement('option');
    empty.value = '';
    empty.textContent = commands.length ? '– bitte wählen –' : (error ? '– nicht verbunden –' : '– keine Commands –');
    selCommand.appendChild(empty);
    var known = false;
    commands.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.label === c.command ? c.command : c.label + '  (' + c.command + ')';
      if (c.id === settings.commandId) known = true;
      selCommand.appendChild(o);
    });
    // Keep a saved command visible even while the tool is offline.
    if (settings.commandId && !known) {
      var keep = document.createElement('option');
      keep.value = settings.commandId;
      keep.textContent = (settings.label || settings.command || settings.commandId) + (error ? '' : ' (gelöscht?)');
      selCommand.appendChild(keep);
    }
    selCommand.value = settings.commandId || '';
    status.className = error ? 'hint error' : 'hint';
    status.textContent = error || 'Commands kommen aus dem Quick-Command Board im Mod-Tool.';
  }

  selCommand.addEventListener('change', function () {
    var cmd = commands.filter(function (c) { return c.id === selCommand.value; })[0];
    settings.commandId = selCommand.value || '';
    settings.label = cmd ? cmd.label : '';
    settings.command = cmd ? cmd.command : '';
    save();
  });

  selMode.addEventListener('change', function () {
    settings.mode = selMode.value;
    save();
  });

  document.getElementById('refresh').addEventListener('click', function () {
    send({ event: 'sendToPlugin', action: action, context: uuid, payload: { type: 'refresh' } });
  });

  window.connectElgatoStreamDeckSocket = function (port, inUUID, registerEvent, info, actionInfo) {
    uuid = inUUID;
    try {
      var a = JSON.parse(actionInfo);
      action = a.action;
      settings = (a.payload && a.payload.settings) || {};
    } catch (e) {}
    selMode.value = settings.mode || 'auto';

    ws = new WebSocket('ws://127.0.0.1:' + port);
    ws.onopen = function () {
      send({ event: registerEvent, uuid: uuid });
      send({ event: 'sendToPlugin', action: action, context: uuid, payload: { type: 'refresh' } });
    };
    ws.onmessage = function (evt) {
      var msg;
      try { msg = JSON.parse(evt.data); } catch (e) { return; }
      if (msg.event === 'sendToPropertyInspector' && msg.payload && msg.payload.type === 'commands') {
        commands = msg.payload.commands || [];
        fillCommands(msg.payload.error);
      } else if (msg.event === 'didReceiveSettings') {
        settings = (msg.payload && msg.payload.settings) || settings;
      }
    };
  };
})();
