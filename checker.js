import { LIMIT_BYTES, CsvProblem, parseCSV, analyzeCSV, exportReport } from './csv-core.mjs';

const $ = id => document.getElementById(id);
const file = $('csv-file');
const textArea = $('csv-text');
const message = $('input-message');
const results = $('results');
let parsed = null;
let report = null;

const SAMPLE = [
  '주문번호,상품,수량,담당자',
  'A001,키보드,1,김가람',
  'A002,마우스,2,박나래',
  ' a001 ,키보드,1,김가람',
  'A003,"키보드, 무선",1,이민서',
  'A004,모니터,1,',
  'A005,웹캠',
  ',조명,3,서하늘',
  'A006,"거치대\n대형",1,박나래',
].join('\n');

function notify(value, error = false) {
  message.textContent = value;
  message.classList.toggle('input-error', error);
}

function numeric(id, number) {
  $(id).textContent = Number(number).toLocaleString('ko-KR');
}

function element(tag, text, className = '') {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

function renderKeys() {
  const parent = $('key-fields');
  parent.replaceChildren();
  report.headers.forEach((name, index) => {
    const label = element('label', undefined, 'key-choice');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.value = String(index);
    checkbox.checked = index === 0;
    checkbox.addEventListener('change', () => {
      const selected = [...parent.querySelectorAll('input:checked')].map(item => Number(item.value));
      if (selected.length) {
        report = analyzeCSV(parsed, selected);
        renderSummary();
        renderRows();
      } else {
        checkbox.checked = true;
        notify('중복 확인 기준 열을 하나 이상 선택해야 합니다.', true);
      }
    });
    label.append(checkbox, document.createTextNode(name));
    parent.append(label);
  });
}

function renderSummary() {
  const s = report.stats;
  numeric('total', s.total);
  numeric('duplicate', s.duplicate);
  numeric('bad-columns', s.badColumns);
  numeric('empty-key', s.emptyKey);
}

function renderRows() {
  const filter = $('status-filter').value;
  const rows = report.records.filter(row => filter === 'all' || row.status === filter);
  $('result-summary').textContent = `전체 ${report.stats.total.toLocaleString('ko-KR')}행 중 ${rows.length.toLocaleString('ko-KR')}행 표시 · 기준: ${report.keys.map(i => report.headers[i]).join(', ')}`;

  const header = element('tr');
  ['원본행', ...report.headers, '검사결과', '최초행'].forEach(name => header.append(element('th', name)));
  $('result-head').replaceChildren(header);
  const body = document.createDocumentFragment();
  rows.slice(0, 20).forEach(record => {
    const tr = element('tr');
    if (record.status === '중복') tr.className = 'flag-duplicate';
    else if (record.status !== '정상') tr.className = 'flag-error';
    tr.append(element('td', record.line));
    report.headers.forEach((_, i) => {
      const cell = element('td', record.cells[i] ?? '');
      cell.title = record.cells[i] ?? '';
      tr.append(cell);
    });
    const td = element('td');
    const status = element('span', record.status, 'status' + (
      record.status === '중복' ? ' duplicate' : record.status !== '정상' ? ' warning' : ''
    ));
    td.append(status);
    tr.append(td, element('td', record.firstLine ?? '—'));
    body.append(tr);
  });
  if (rows.length === 0) {
    const tr = element('tr');
    const cell = element('td', '현재 조건에 해당하는 행이 없습니다.');
    cell.colSpan = report.headers.length + 3;
    tr.append(cell); body.append(tr);
  }
  $('result-body').replaceChildren(body);
}

async function inspect() {
  try {
    notify('파일을 검사하고 있습니다…');
    let input = textArea.value;
    if (file.files?.length) {
      const selected = file.files[0];
      if (selected.size > LIMIT_BYTES) throw new CsvProblem('2 MiB 이하의 CSV 파일을 선택해 주세요.');
      input = await selected.text();
    } else {
      if (new TextEncoder().encode(input).length > LIMIT_BYTES) throw new CsvProblem('CSV 텍스트는 2 MiB를 넘을 수 없습니다.');
    }
    if (!input.trim()) throw new CsvProblem('CSV 파일을 선택하거나 텍스트를 입력해 주세요.');
    parsed = parseCSV(input);
    if (parsed.rows[0].cells.length < 2) {
      throw new CsvProblem('열을 구분하지 못했습니다. CSV UTF-8 저장 형식과 구분자(쉼표, 탭, 세미콜론)를 확인해 주세요.');
    }
    report = analyzeCSV(parsed);
    renderSummary();
    renderKeys();
    $('status-filter').value = 'all';
    renderRows();
    results.hidden = false;
    notify(`분석 완료: ${report.stats.total.toLocaleString('ko-KR')}개 데이터 행 / 중복 ${report.stats.duplicate.toLocaleString('ko-KR')}건.` + (input.includes('�') ? ' 한글이 깨졌다면 UTF-8로 다시 저장해 주세요.' : ''));
    results.scrollIntoView({behavior: 'smooth', block: 'start'});
  } catch (error) {
    results.hidden = true;
    parsed = null; report = null;
    notify(error instanceof Error ? error.message : 'CSV를 분석하지 못했습니다.', true);
  }
}

$('inspect').addEventListener('click', inspect);
$('sample').addEventListener('click', () => {
  file.value = '';
  textArea.value = SAMPLE;
  inspect();
});
$('clear').addEventListener('click', () => {
  file.value = ''; textArea.value = '';
  parsed = null; report = null; results.hidden = true;
  notify('입력을 초기화했습니다. 파일이나 텍스트를 선택해 주세요.');
  textArea.focus();
});
file.addEventListener('change', () => {
  if (file.files?.length) {
    textArea.value = '';
    notify(`${file.files[0].name} 파일을 선택했습니다. ‘CSV 분석하기’를 눌러 주세요.`);
  }
});
textArea.addEventListener('input', () => {
  if (file.value) file.value = '';
});
$('status-filter').addEventListener('change', () => { if (report) renderRows(); });
$('download').addEventListener('click', () => {
  if (!report) return;
  const output = exportReport(report);
  const blob = new Blob([output], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = element('a');
  a.href = url; a.download = 'methodform-csv-inspection.csv';
  document.body.append(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
});
