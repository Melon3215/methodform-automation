// Browser-only, deterministic CSV inspection. No storage, fetch, or network dependencies.
// Deliberately limited to 2 MiB / 20,000 data records to keep the free utility responsive.
export const LIMIT_BYTES = 2 * 1024 * 1024;
export const LIMIT_ROWS = 20000;
export const LIMIT_COLUMNS = 150;

export class CsvProblem extends Error {
  constructor(message) { super(message); this.name = 'CsvProblem'; }
}

export function detectDelimiter(text) {
  const sample = String(text).slice(0, 20000).replace(/\r\n?/g, '\n');
  const tokens = [',', '\t', ';'];
  const records = [];
  let counts = [0, 0, 0], quoted = false, seen = false;
  for (let i = 0; i < sample.length && records.length < 12; i++) {
    const ch = sample[i];
    if (ch === '"') {
      if (quoted && sample[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted) {
      const index = tokens.indexOf(ch);
      if (index >= 0) { counts[index]++; seen = true; }
      if (ch === '\n') {
        if (seen) records.push(counts);
        counts = [0, 0, 0]; seen = false;
      }
    }
  }
  if (seen) records.push(counts);
  const score = tokens.map((_, i) => {
    const active = records.map(row => row[i]).filter(n => n > 0);
    if (!active.length) return -1;
    const consistency = active.length / Math.max(records.length, 1);
    const mean = active.reduce((a, b) => a + b, 0) / active.length;
    return consistency * 10 + Math.min(mean, 20);
  });
  const best = score.indexOf(Math.max(...score));
  return score[best] < 0 ? ',' : tokens[best];
}

export function parseCSV(text, delimiter = detectDelimiter(text)) {
  if (![',', ';', '\t'].includes(delimiter)) throw new CsvProblem('지원하지 않는 구분자입니다.');
  const source = String(text).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!source.trim()) throw new CsvProblem('검사할 CSV 텍스트가 비어 있습니다.');
  const rows = [];
  let row = [], field = '', inQuote = false, justClosed = false;
  let line = 1, startLine = 1, quotedField = false;
  const pushField = () => {
    row.push(field);
    if (row.length > LIMIT_COLUMNS) throw new CsvProblem(`열이 ${LIMIT_COLUMNS}개를 초과합니다.`);
    field = ''; justClosed = false; quotedField = false;
  };
  const pushRow = () => {
    if (!(row.length === 1 && row[0].trim() === '')) {
      rows.push({cells: row, line: startLine});
      if (rows.length > LIMIT_ROWS + 1) throw new CsvProblem(`데이터가 ${LIMIT_ROWS}행을 초과합니다.`);
    }
    row = []; startLine = line + 1;
  };
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuote) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; }
        else { inQuote = false; justClosed = true; }
      } else { field += ch; if (ch === '\n') line++; }
      continue;
    }
    if (ch === delimiter) { pushField(); continue; }
    if (ch === '\n') { pushField(); pushRow(); line++; continue; }
    if (ch === '"') {
      if (field !== '' || justClosed) throw new CsvProblem(`${line}행: 따옴표 위치가 올바르지 않습니다.`);
      inQuote = true; quotedField = true; continue;
    }
    if (justClosed) {
      if (ch === ' ' || (ch === '\t' && delimiter !== '\t')) continue;
      throw new CsvProblem(`${line}행: 닫힌 따옴표 뒤에 문자가 있습니다.`);
    }
    if (ch === '\0') throw new CsvProblem('널 문자가 포함된 파일은 지원하지 않습니다.');
    field += ch;
  }
  if (inQuote) throw new CsvProblem(`${startLine}행: 닫히지 않은 따옴표가 있습니다.`);
  if (field !== '' || row.length || justClosed || quotedField) { pushField(); pushRow(); }
  if (!rows.length) throw new CsvProblem('유효한 CSV 행이 없습니다.');
  return { delimiter, rows };
}

function headersFor(row) {
  const counts = new Map();
  return row.map((raw, i) => {
    const base = raw.trim() || `열 ${i + 1}`;
    const num = (counts.get(base) || 0) + 1;
    counts.set(base, num);
    return num > 1 ? `${base} (${num})` : base;
  });
}

export function normalizeKey(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ko');
}

export function analyzeCSV(input, keys = [0]) {
  const parsed = typeof input === 'string' ? parseCSV(input) : input;
  if (!parsed?.rows?.length) throw new CsvProblem('열 제목이 없습니다.');
  const headers = headersFor(parsed.rows[0].cells);
  const indices = [...new Set(keys.map(Number))].filter(i => Number.isInteger(i) && i >= 0 && i < headers.length);
  if (!indices.length) throw new CsvProblem('중복 확인 기준 열을 하나 이상 선택하세요.');
  const firstSeen = new Map();
  const records = [];
  const stats = {total: 0, unique: 0, duplicate: 0, badColumns: 0, emptyKey: 0};
  for (const row of parsed.rows.slice(1)) {
    const cells = row.cells;
    const record = {line: row.line, cells, status: '정상', firstLine: null};
    stats.total++;
    if (cells.length !== headers.length) { record.status = '열 개수 불일치'; stats.badColumns++; }
    else {
      const parts = indices.map(i => normalizeKey(cells[i]));
      if (parts.some(value => !value)) { record.status = '기준 열 빈칸'; stats.emptyKey++; }
      else {
        const key = JSON.stringify(parts);
        if (firstSeen.has(key)) {
          record.status = '중복';
          record.firstLine = firstSeen.get(key);
          stats.duplicate++;
        } else { firstSeen.set(key, row.line); stats.unique++; }
      }
    }
    records.push(record);
  }
  return {headers, keys: indices, delimiter: parsed.delimiter, records, stats};
}

export function excelSafe(value) {
  const text = String(value ?? '');
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

export function quoteCSV(value) {
  const text = excelSafe(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export function exportReport(report) {
  const lines = [
    [...report.headers, '검사결과', '최초행', '원본행'].map(quoteCSV).join(','),
    ...report.records.map(r => [
      ...Array.from({length: report.headers.length}, (_, i) => r.cells[i] ?? ''),
      r.status, r.firstLine ?? '', r.line
    ].map(quoteCSV).join(','))
  ];
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
