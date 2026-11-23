// Key artwork: emoji pictogram + command text, or text only.
(function (root) {
  'use strict';

  var EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

  function firstGrapheme(text) {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      var it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)[Symbol.iterator]().next();
      return it.done ? '' : it.value.segment;
    }
    var m = text.match(/^(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}️?)*)/u);
    return m ? m[0] : text.charAt(0);
  }

  // "💬 !discord" -> { emoji: "💬", text: "!discord" }
  function splitLabel(label, command) {
    var clean = String(label || '').trim();
    var first = clean ? firstGrapheme(clean) : '';
    var emoji = first && EMOJI_RE.test(first) ? first : '';
    var text = (emoji ? clean.slice(first.length) : clean).trim() || String(command || '').trim();
    return { emoji: emoji, text: text };
  }

  function wrap(ctx, text, maxWidth, maxLines) {
    var words = text.split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var probe = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
      else { lines.push(line); line = words[i]; }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) return null;
    for (var j = 0; j < lines.length; j++) if (ctx.measureText(lines[j]).width > maxWidth) return null;
    return lines;
  }

  function fitText(ctx, text, maxWidth, maxLines, maxSize, minSize) {
    for (var size = maxSize; size >= minSize; size -= 2) {
      ctx.font = '700 ' + size + 'px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
      var lines = wrap(ctx, text, maxWidth, maxLines);
      if (lines) return { size: size, lines: lines };
    }
    ctx.font = '700 ' + minSize + 'px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
    var t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return { size: minSize, lines: [t + '…'] };
  }

  // mode: "auto" (emoji + text), "emoji" (emoji only, falls back to text), "text"
  function renderKey(opts) {
    var S = 144;
    var canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    var ctx = canvas.getContext('2d');

    var bg = ctx.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#24324a');
    bg.addColorStop(1, '#0d131f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, S, S);

    var parts = splitLabel(opts.label, opts.command);
    var mode = opts.mode || 'auto';
    var emoji = mode === 'text' ? '' : parts.emoji;
    var text = mode === 'emoji' && emoji ? '' : parts.text;
    if (!emoji && !text) text = opts.placeholder || 'Command wählen';

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var emojiFont = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

    if (emoji && text) {
      ctx.font = '64px ' + emojiFont;
      ctx.fillText(emoji, S / 2, 52);
      var fit = fitText(ctx, text, S - 14, 2, 26, 14);
      ctx.fillStyle = opts.dim ? '#8b95a7' : '#ffffff';
      var lh = fit.size * 1.1;
      var y0 = 112 - ((fit.lines.length - 1) * lh) / 2;
      fit.lines.forEach(function (l, i) { ctx.fillText(l, S / 2, y0 + i * lh); });
    } else if (emoji) {
      ctx.font = '96px ' + emojiFont;
      ctx.fillText(emoji, S / 2, S / 2 + 4);
    } else {
      var fitOnly = fitText(ctx, text, S - 14, 3, 34, 14);
      ctx.fillStyle = opts.dim ? '#8b95a7' : '#ffffff';
      var lh2 = fitOnly.size * 1.1;
      var y1 = S / 2 - ((fitOnly.lines.length - 1) * lh2) / 2;
      fitOnly.lines.forEach(function (l, i) { ctx.fillText(l, S / 2, y1 + i * lh2); });
    }
    return canvas.toDataURL('image/png');
  }

  root.SWGRender = { splitLabel: splitLabel, renderKey: renderKey };
  if (typeof module !== 'undefined') module.exports = root.SWGRender;
})(typeof window !== 'undefined' ? window : globalThis);
