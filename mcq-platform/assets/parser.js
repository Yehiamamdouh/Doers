// Turns text copied or extracted from a PDF into MCQ questions.
// Understands numbered questions, lettered options (A-J or أ-ي), "Answer:" lines,
// options marked with * or ✓, "Explanation:" blocks and a separate answer key.
(function (root) {
  'use strict';

  const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي'];
  const LETTER = '(?:[A-Ja-j]|هـ|[أاإبجدهوزحطي])';
  const AFTER_LETTER = '(?=$|[\\s).\\]:,;\\-–])';

  const Q_NUM = /^(?:(?:Q(?:uestion)?|س(?:ؤال)?)\s*\.?\s*)?[(\[]?(\d{1,4})\s*[-.)\]:،]\s*(.*)$/i;
  const Q_LABEL = /^(?:Q(?:uestion)?|س(?:ؤال)?)\s*\.?\s*(\d{1,4})\s*[-.)\]:،]?\s*(.*)$/i;
  const OPTION = new RegExp('^[(\\[]?\\s*(' + LETTER + ')\\s*[).\\]\\-:–]\\s*(.*)$');
  const ANSWER = new RegExp(
    '^(?:the\\s+)?(?:correct\\s+answer|right\\s+answer|answer|ans|correct|key|الإجابة\\s+الصحيحة|الاجابة\\s+الصحيحة|الإجابة\\s+الصحيحه|الاجابة\\s+الصحيحه|الإجابة|الاجابة|الجواب|الحل)' +
    '\\s*(?:is|هي|هو)?\\s*[:\\-–=.]?\\s*(.*)$', 'i');
  const ANSWER_LETTER = new RegExp('^[(\\[]?\\s*(' + LETTER + ')' + AFTER_LETTER + '\\s*[).\\]]?\\s*[-–:.]?\\s*(.*)$');
  const EXPLAIN = /^(?:explanation|explain|rationale|reason|notes?|discussion|الشرح|شرح|التوضيح|توضيح|التفسير|تفسير|السبب|التعليل|ملاحظة)\s*(?:[:\-–]\s*(.*)|$)/i;
  const KEY_HEADING = /^(?:answers?|answer\s+key|key\s+answers?|model\s+answers?|مفتاح\s+الإجابات?|مفتاح\s+الاجابات?|الإجابات|الاجابات|نموذج\s+الإجابة|نموذج\s+الاجابة)\s*:?$/i;
  const KEY_PAIR = new RegExp('(\\d{1,4})\\s*[-.):=]?\\s*[(\\[]?(' + LETTER + ')' + '(?![A-Za-z\\u0621-\\u064A])', 'g');
  const CORRECT_MARK = /(^\s*[*✓✔]\s*)|(\s*[*✓✔]\s*$)|\s*\((?:correct|true|صح|صحيح)\)\s*$/i;

  function letterIndex(letter) {
    if (!letter) return -1;
    const l = letter.trim();
    if (/^[A-Ja-j]$/.test(l)) return l.toLowerCase().charCodeAt(0) - 97;
    if (l === 'هـ' || l === 'ه') return 4;
    if (l === 'ا' || l === 'إ') return 0;
    return AR_LETTERS.indexOf(l);
  }

  function normalize(raw) {
    return String(raw || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
      .replace(/[  -​ ⁠﻿]/g, ' ')
      .replace(/[‎‏‪-‮⁦-⁩]/g, '')
      .replace(/\t/g, ' ');
  }

  // "a) 10  b) 20  c) 30" → separate lines. Needs at least two markers in order a, b, c…
  function splitInline(line) {
    const re = new RegExp('(^|\\s)[(\\[]?\\s*(' + LETTER + ')\\s*[).\\]]\\s+', 'g');
    const marks = [];
    let m;
    while ((m = re.exec(line))) {
      const idx = letterIndex(m[2]);
      if (idx === marks.length) marks.push(m.index + m[1].length);
      else if (idx === 0 && marks.length === 0) marks.push(m.index + m[1].length);
    }
    if (marks.length < 2) return [line];
    const parts = [];
    if (marks[0] > 0) parts.push(line.slice(0, marks[0]).trim());
    marks.forEach((start, i) => parts.push(line.slice(start, marks[i + 1]).trim()));
    return parts.filter(Boolean);
  }

  function isKeyLine(line) {
    const stripped = line.replace(KEY_PAIR, '').replace(/[\s,;|/]+/g, '');
    const pairs = line.match(KEY_PAIR);
    return pairs && pairs.length >= 2 && stripped === '';
  }

  function readKey(text, into) {
    let m;
    KEY_PAIR.lastIndex = 0;
    while ((m = KEY_PAIR.exec(text))) into[Number(m[1])] = letterIndex(m[2]);
    return into;
  }

  function cleanOption(text) {
    const marked = CORRECT_MARK.test(text);
    return { text: text.replace(CORRECT_MARK, '').trim(), marked };
  }

  function matchAnswerToOption(answerText, options) {
    const norm = (s) => s.toLowerCase().replace(/[\s.،,;:()]+/g, ' ').trim();
    const a = norm(answerText);
    if (!a) return -1;
    let idx = options.findIndex((o) => norm(o) === a);
    if (idx === -1) idx = options.findIndex((o) => norm(o).startsWith(a) || a.startsWith(norm(o)));
    return idx;
  }

  function parse(raw, keyText) {
    const lines = normalize(raw).split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).flatMap(splitInline);
    const key = readKey(normalize(keyText), {});
    const questions = [];
    let cur = null;
    let mode = null; // q | opt | ans | exp | key

    const push = () => {
      if (cur && (cur.text || cur.options.length)) questions.push(cur);
      cur = null;
    };
    const newQ = (num, text) => {
      push();
      cur = { num, text: text || '', options: [], correct: -1, explanation: '' };
      mode = 'q';
    };

    // Inside an explanation, a numbered line only starts a new question if options follow it.
    const optionsFollow = (from) => {
      for (let j = from + 1, seen = 0; j < lines.length && seen < 8; j++) {
        const next = lines[j];
        if (!next) continue;
        seen++;
        const om = next.replace(/^[*✓✔]\s*/, '').match(OPTION);
        if (om && letterIndex(om[1]) === 0) return true;
        if (Q_LABEL.test(next) || Q_NUM.test(next)) return false;
      }
      return false;
    };

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line) continue;
      if (/^(?:page\s*)?\d{1,4}\s*(?:of\s*\d+|\/\s*\d+)?$/i.test(line) && !(cur && mode === 'q' && !cur.text)) continue; // page numbers

      if (KEY_HEADING.test(line)) { push(); mode = 'key'; continue; }
      if (isKeyLine(line) || (mode === 'key' && KEY_PAIR.test(line))) { readKey(line, key); mode = 'key'; KEY_PAIR.lastIndex = 0; continue; }
      KEY_PAIR.lastIndex = 0;

      let m = line.match(Q_LABEL) || line.match(Q_NUM);
      if (m) {
        const num = Number(m[1]);
        const sequential = !cur || cur.num === null || num === cur.num + 1;
        const looksNew = mode === 'exp'
          ? sequential && optionsFollow(li)
          : sequential || (mode !== 'q' && cur.options.length >= 2);
        if (looksNew && mode !== 'key') { newQ(num, m[2].trim()); continue; }
      }

      if (cur && mode !== 'exp') {
        m = line.match(OPTION);
        if (m) {
          const idx = letterIndex(m[1]);
          const raw = line.replace(/^\s*[*✓✔]\s*/, '');
          const starred = raw !== line;
          if (idx === cur.options.length && (mode !== 'q' || cur.text)) {
            const opt = cleanOption(m[2]);
            cur.options.push(opt.text);
            if (opt.marked || starred) cur.correct = idx;
            mode = 'opt';
            continue;
          }
        } else if (/^[*✓✔]\s*/.test(line)) {
          const m2 = line.replace(/^[*✓✔]\s*/, '').match(OPTION);
          if (m2 && letterIndex(m2[1]) === cur.options.length) {
            cur.options.push(cleanOption(m2[2]).text);
            cur.correct = cur.options.length - 1;
            mode = 'opt';
            continue;
          }
        }
      }

      if (cur) {
        m = line.match(ANSWER);
        if (m && (cur.options.length >= 2 || mode === 'opt')) {
          const rest = m[1].trim();
          const lm = rest.match(ANSWER_LETTER);
          let idx = lm ? letterIndex(lm[1]) : -1;
          let tail = lm ? lm[2].trim() : '';
          if (idx < 0 || idx >= cur.options.length) {
            idx = matchAnswerToOption(rest, cur.options);
            tail = '';
          } else if (tail && matchAnswerToOption(tail, cur.options) === idx) {
            tail = ''; // "Answer: B) the option text" — the text is not an explanation
          }
          if (idx >= 0) cur.correct = idx;
          if (tail.length > 3) { cur.explanation = tail; mode = 'exp'; } else mode = 'ans';
          continue;
        }
        m = line.match(EXPLAIN);
        if (m && (cur.options.length >= 2 || cur.correct >= 0)) {
          cur.explanation = (cur.explanation ? cur.explanation + '\n' : '') + (m[1] || '').trim();
          mode = 'exp';
          continue;
        }
      }

      // Plain line: continues whatever came before it.
      if (!cur) { newQ(null, line); continue; }
      if (mode === 'q') cur.text = (cur.text + ' ' + line).trim();
      else if (mode === 'opt') {
        if (cur.correct >= 0 && cur.options.length >= 2 && /[?؟:]$/.test(line)) newQ(null, line); // an unnumbered next question
        else cur.options[cur.options.length - 1] += ' ' + line;
      } else if (mode === 'ans') { cur.explanation = line; mode = 'exp'; }
      else if (mode === 'exp') {
        const sep = !cur.explanation ? '' : /^(?:\d{1,2}\s*[-.)]|[-•●▪])\s/.test(line) ? '\n' : ' ';
        cur.explanation += sep + line;
      }
    }
    push();

    // Apply the answer key by question number (or position when unnumbered).
    questions.forEach((q, i) => {
      const k = key[q.num !== null ? q.num : i + 1];
      if (q.correct < 0 && k !== undefined && k >= 0 && k < q.options.length) q.correct = k;
    });

    return questions.map((q) => {
      const warnings = [];
      if (!q.text) warnings.push('بدون نص للسؤال');
      if (q.options.length < 2) warnings.push('أقل من اختيارين');
      if (q.correct < 0) warnings.push('لم يتم تحديد الإجابة الصحيحة');
      return { num: q.num, text: q.text, options: q.options, correct: q.correct, explanation: q.explanation.trim(), warnings };
    });
  }

  const api = { parse, letterIndex, normalize };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MCQParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
