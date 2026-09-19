(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);

  const input = $('#fileInput');
  const dropzone = $('#dropzone');
  const formatNames = {
    srt: 'SRT',
    vtt: 'WebVTT',
    ass: 'ASS',
    ttml: 'TTML',
    json: 'JSON',
    txt: 'plain text'
  };

  let currentFile = null;
  let currentCues = [];

  function detectFormat(filename, text) {
    const extension = filename.split('.').pop().toLowerCase();

    if (['srt', 'vtt', 'ass', 'ssa', 'ttml', 'xml', 'json', 'txt'].includes(extension)) {
      if (extension === 'ssa') return 'ass';
      if (extension === 'xml') return 'ttml';
      return extension;
    }

    const trimmed = text.trim();

    if (/^WEBVTT/i.test(trimmed)) return 'vtt';
    if (/^\[Script Info\]/im.test(trimmed)) return 'ass';
    if (/<tt[\s>]/i.test(trimmed)) return 'ttml';
    if (/^\s*[\[{]/.test(trimmed)) return 'json';
    if (/\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s+-->/.test(trimmed)) return 'srt';

    return 'txt';
  }

  function timeToSeconds(value) {
    const parts = value
      .trim()
      .replace(',', '.')
      .split(':')
      .map(Number);

    if (parts.some(Number.isNaN)) return 0;

    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return parts[0] * 60 + parts[1];
  }

  function secondsToTime(seconds, separator = '.') {
    const safe = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(safe / 3600);
    const minutes = Math.floor((safe % 3600) / 60);
    const wholeSeconds = Math.floor(safe % 60);
    const milliseconds = Math.round((safe % 1) * 1000);

    return [
      String(hours).padStart(2, '0'),
      String(minutes).padStart(2, '0'),
      String(wholeSeconds).padStart(2, '0')
    ].join(':') +
      separator +
      String(milliseconds).padStart(3, '0');
  }

  function cleanText(text) {
    return String(text || '')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  function parseTimedCaptions(text, format) {
    const lines = text
      .replace(/^\uFEFF/, '')
      .replace(/\r/g, '')
      .split('\n');

    const cues = [];
    let index = format === 'vtt' ? 1 : 0;

    while (index < lines.length) {
      if (!lines[index].trim()) {
        index += 1;
        continue;
      }

      if (
        format === 'vtt' &&
        /^(NOTE|STYLE|REGION)\b/i.test(lines[index])
      ) {
        index += 1;
        continue;
      }

      if (
        !/-->/.test(lines[index]) &&
        index + 1 < lines.length &&
        /-->/.test(lines[index + 1])
      ) {
        index += 1;
      }

      if (!/-->/.test(lines[index])) {
        index += 1;
        continue;
      }

      const timing = lines[index].split('-->');
      const start = timeToSeconds(timing[0]);
      const end = timeToSeconds(timing[1].trim().split(/\s+/)[0]);

      index += 1;

      const body = [];

      while (index < lines.length && lines[index].trim()) {
        body.push(lines[index]);
        index += 1;
      }

      if (end >= start) {
        cues.push({
          start,
          end,
          text: cleanText(body.join('\n'))
        });
      }
    }

    return cues;
  }

  function parseAss(text) {
    return text
      .split(/\r?\n/)
      .filter((line) => /^Dialogue\s*:/i.test(line))
      .map((line) => {
        const values = line
          .slice(line.indexOf(':') + 1)
          .split(',');

        return {
          start: timeToSeconds(values[1] || '0'),
          end: timeToSeconds(values[2] || '0'),
          text: cleanText(
            values
              .slice(9)
              .join(',')
              .replace(/\\N/g, '\n')
              .replace(/\\n/g, '\n')
              .replace(/\\H/g, ' ')
          )
        };
      })
      .filter((cue) => cue.text);
  }

  function parseTtml(text) {
    const document = new DOMParser().parseFromString(
      text,
      'application/xml'
    );

    if (document.querySelector('parsererror')) {
      throw new Error('Invalid TTML XML');
    }

    return [...document.querySelectorAll('p')]
      .map((paragraph) => ({
        start: timeToSeconds(paragraph.getAttribute('begin') || '0'),
        end: timeToSeconds(
          paragraph.getAttribute('end') ||
          paragraph.getAttribute('dur') ||
          '0'
        ),
        text: cleanText(paragraph.textContent)
      }))
      .filter((cue) => cue.text && cue.end >= cue.start);
  }

  function parseJson(text) {
    const data = JSON.parse(text);
    const rows = Array.isArray(data)
      ? data
      : data.cues || data.subtitles || data.events || [];

    return rows
      .map((cue) => ({
        start: Number(
          cue.start ??
          cue.startTime ??
          cue.from ??
          0
        ),
        end: Number(
          cue.end ??
          cue.endTime ??
          cue.to ??
          0
        ),
        text: cleanText(
          cue.text ??
          cue.caption ??
          cue.content ??
          ''
        )
      }))
      .filter((cue) => cue.text);
  }

  function parsePlainText(text) {
    return text
      .split(/\n\s*\n/)
      .map((paragraph, index) => ({
        start: index * 5,
        end: index * 5 + 4,
        text: cleanText(paragraph)
      }))
      .filter((cue) => cue.text);
  }

  function parseCaptions(text, format) {
    if (format === 'ass') return parseAss(text);
    if (format === 'ttml') return parseTtml(text);
    if (format === 'json') return parseJson(text);
    if (format === 'txt') return parsePlainText(text);

    return parseTimedCaptions(text, format);
  }

  function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;'
    }[character]));
  }

  function exportCaptions(cues, format) {
    if (format === 'srt') {
      return cues
        .map((cue, index) => [
          index + 1,
          `${secondsToTime(cue.start, ',')} --> ${secondsToTime(cue.end, ',')}`,
          cue.text,
          ''
        ].join('\n'))
        .join('\n');
    }

    if (format === 'vtt') {
      return [
        'WEBVTT',
        '',
        ...cues.flatMap((cue) => [
          `${secondsToTime(cue.start)} --> ${secondsToTime(cue.end)}`,
          cue.text,
          ''
        ])
      ].join('\n');
    }

    if (format === 'ass') {
      return [
        '[Script Info]',
        'Title: Caption Forge export',
        'ScriptType: v4.00+',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
        'Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,10,10,10,1',
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
        ...cues.map((cue) => {
          const start = secondsToTime(cue.start).slice(0, -4);
          const end = secondsToTime(cue.end).slice(0, -4);
          const text = cue.text.replace(/\n/g, '\\N');

          return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
        }),
        ''
      ].join('\n');
    }

    if (format === 'ttml') {
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<tt xmlns="http://www.w3.org/ns/ttml">',
        '  <body>',
        '    <div>',
        ...cues.map((cue) =>
          `      <p begin="${secondsToTime(cue.start)}" end="${secondsToTime(cue.end)}">${escapeXml(cue.text)}</p>`
        ),
        '    </div>',
        '  </body>',
        '</tt>',
        ''
      ].join('\n');
    }

    if (format === 'json') {
      return `${JSON.stringify({
        cues: cues.map((cue) => ({
          start: cue.start,
          end: cue.end,
          text: cue.text
        }))
      }, null, 2)}\n`;
    }

    return `${cues.map((cue) => cue.text).join('\n\n')}\n`;
  }

  function showMessage(message, isError = false) {
    const element = $('#message');

    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  function formatBytes(size) {
    if (size < 1024) return `${size} B`;
    return `${(size / 1024).toFixed(1)} KB`;
  }

  function reset() {
    currentFile = null;
    currentCues = [];
    input.value = '';

    $('#dropzone').classList.remove('hidden');
    $('#fileRow').classList.add('hidden');
    $('#convertButton').disabled = true;

    showMessage('');
  }

  function loadFile(file) {
    currentFile = file;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const text = String(reader.result);
        const detectedFormat = detectFormat(file.name, text);

        currentCues = parseCaptions(text, detectedFormat);

        if (!currentCues.length) {
          throw new Error('No readable captions found');
        }

        $('#dropzone').classList.add('hidden');
        $('#fileRow').classList.remove('hidden');
        $('#fileName').textContent = file.name;
        $('#fileInfo').textContent =
          `${formatNames[detectedFormat]} · ${formatBytes(file.size)} · ` +
          `${currentCues.length} cue${currentCues.length === 1 ? '' : 's'}`;

        $('#inputFormat').value = detectedFormat;
        $('#convertButton').disabled = false;

        showMessage(
          `${currentCues.length} caption${currentCues.length === 1 ? '' : 's'} ready to convert.`
        );
      } catch (error) {
        reset();
        showMessage(
          error.message || 'Could not read this file.',
          true
        );
      }
    };

    reader.readAsText(file);
  }

  $('#browseButton').addEventListener('click', () => {
    input.click();
  });

  dropzone.addEventListener('click', (event) => {
    if (event.target !== $('#browseButton')) {
      input.click();
    }
  });

  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', (event) => {
    const file = event.target.files?.[0];

    if (file) {
      loadFile(file);
    }
  });

  $('#removeFile').addEventListener('click', reset);

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    });
  });

  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer.files?.[0];

    if (file) {
      loadFile(file);
    }
  });

  $('#convertButton').addEventListener('click', () => {
    try {
      const format = $('#outputFormat').value;
      const content = exportCaptions(currentCues, format);
      const blob = new Blob([content], {
        type: format === 'json'
          ? 'application/json'
          : 'text/plain;charset=utf-8'
      });

      const link = document.createElement('a');
      const baseName = currentFile.name.replace(/\.[^.]+$/, '');

      link.href = URL.createObjectURL(blob);
      link.download = `${baseName}.${format === 'ttml' ? 'ttml' : format}`;
      link.click();

      URL.revokeObjectURL(link.href);

      showMessage(`Downloaded ${formatNames[format]} file.`);
    } catch {
      showMessage('Could not create the export.', true);
    }
  });
})();
