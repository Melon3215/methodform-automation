import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV, analyzeCSV, detectDelimiter, normalizeKey, excelSafe, exportReport, CsvProblem, LIMIT_ROWS} from '../csv-core.mjs';

test('detects comma, tab and semicolon without mistaking quoted separators', () => {
  assert.equal(detectDelimiter('a,b,c\n1,2,3'), ',');
  assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
  assert.equal(detectDelimiter('a;b;c\n"semi;colon";x;y'), ';');
});
test('UTF8 BOM, Windows CRLF and doubled quotes', () => {
  const p = parseCSV('\uFEFFid,description\r\n1,"a,b"\r\n2,"say ""hello"""\r\n');
  assert.equal(p.rows.length, 3);
  assert.deepEqual(p.rows[1].cells, ['1','a,b']);
  assert.deepEqual(p.rows[2].cells, ['2','say "hello"']);
});
test('embedded newline preserves source line and data', () => {
  const p = parseCSV('id,description\nA,"two\nlines"\nB,test');
  assert.deepEqual(p.rows[1], {cells:['A','two\nlines'],line:2});
  assert.equal(p.rows[2].line, 4);
});
test('counts duplicates, wrong column widths and empty key independently', () => {
  const a = analyzeCSV('id,value\nA001,first\n a001 ,second\nA002,third\nA003\n,empty');
  assert.deepEqual(a.stats, {total:5,unique:2,duplicate:1,badColumns:1,emptyKey:1});
  assert.equal(a.records[1].firstLine, 2);
  assert.equal(a.records[1].status,'중복');
});
test('multiple selected key columns change duplicate classification', () => {
  const p=parseCSV('id,variant,qty\nAAA,a,1\nAAA,b,1\nAAA,a,2');
  assert.equal(analyzeCSV(p,[0]).stats.duplicate,2);
  assert.equal(analyzeCSV(p,[0,1]).stats.duplicate,1);
  assert.equal(analyzeCSV(p,[0,1,2]).stats.duplicate,0);
});
test('normalized keys handle unicode width, spacing and case', () => {
  assert.equal(normalizeKey('  Ａ０１  '),normalizeKey('a01'));
  assert.equal(normalizeKey(' A   B '),'a b');
  const result=analyzeCSV('id,num\nＡ０１,one\na01,two');
  assert.equal(result.stats.duplicate,1);
});
test('repeated or blank headers remain readable', () => {
  const r=analyzeCSV('name,name,\nA,B,C\nD,E,F');
  assert.deepEqual(r.headers,['name','name (2)','열 3']);
});
test('CSV injection is escaped in all exported cells (Excel)', () => {
  const report=analyzeCSV('id,value\nA,"=HYPERLINK(""bad"",""x"")"\nB,"+SUM(1,2)"\nC,-1\nD,@cmd');
  const out=exportReport(report);
  assert.equal(out[0],'\uFEFF');
  assert.match(out,/"'=HYPERLINK/);
  assert.match(out,/"'\+SUM/);
  assert.match(out,/"'-1"/);
  assert.match(out,/"'@cmd"/);
  assert.equal(excelSafe('  =7'),"'  =7");
  assert.equal(excelSafe('normal'),'normal');
});
test('escaped CSV output can round-trip report without losing rows', () => {
  const p=analyzeCSV('id,name\nA,"a,b"\nA,"c"');
  const out=exportReport(p);
  const read=parseCSV(out);
  assert.equal(read.rows.length,3);
  assert.equal(read.rows[2].cells[3],'2');
});
test('malformed quotes and NUL fail with explicit errors', () => {
  assert.throws(()=>parseCSV('id,value\n1,"unterminated'),CsvProblem);
  assert.throws(()=>parseCSV('id,value\n1,a"b'),CsvProblem);
  assert.throws(()=>parseCSV('id,value\n1,"done"garbage'),CsvProblem);
  assert.throws(()=>parseCSV('id,value\n1,\0'),CsvProblem);
  assert.throws(()=>analyzeCSV(parseCSV('a,b'),[]),CsvProblem);
});
test('empty lines ignored and trailing empty cells preserved', () => {
  const p=parseCSV('id,value\n\nA,\n\nB,b\n');
  assert.equal(p.rows.length,3);
  assert.deepEqual(p.rows[1].cells,['A','']);
  assert.equal(p.rows[2].line,5);
});
test('large input row cap enforced', () => {
  const data='id,value\n' + 'a,b\n'.repeat(LIMIT_ROWS+1);
  assert.throws(()=>parseCSV(data), /초과/);
});
