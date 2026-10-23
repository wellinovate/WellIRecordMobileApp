import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFile, safeFileName, RECORD_FILE_MAX_B64, RECORD_FILE_MAX_BYTES } from '../recordFilesCore';

const b = (...v: number[]) => Buffer.from(v);
const pad = (head: Buffer, n = 64) => Buffer.concat([head, Buffer.alloc(n)]);

test('images and PDF are recognised by their first bytes, whatever the name says', () => {
  assert.equal(detectFile(pad(b(0xff, 0xd8, 0xff, 0xe0)), 'scan.pdf')?.contentType, 'image/jpeg');
  assert.equal(detectFile(pad(b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'x.jpg')?.contentType, 'image/png');
  assert.equal(detectFile(Buffer.from('%PDF-1.7\n'), 'note.jpg')?.contentType, 'application/pdf');
  assert.equal(detectFile(Buffer.concat([Buffer.from('RIFF'), b(1, 2, 3, 4), Buffer.from('WEBPVP8 ')]), 'a.webp')?.contentType, 'image/webp');
  assert.equal(detectFile(Buffer.concat([b(0, 0, 0, 24), Buffer.from('ftypheic')]), 'IMG.HEIC')?.contentType, 'image/heic');
});

test('Word, Excel and PowerPoint need the matching signature and extension', () => {
  const zip = pad(b(0x50, 0x4b, 0x03, 0x04));
  assert.equal(detectFile(zip, 'report.docx')?.ext, 'docx');
  assert.equal(detectFile(zip, 'sheet.xlsx')?.ext, 'xlsx');
  assert.equal(detectFile(zip, 'archive.zip'), null);
  const ole = pad(b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1));
  assert.equal(detectFile(ole, 'letter.doc')?.contentType, 'application/msword');
  assert.equal(detectFile(ole, 'letter.exe'), null);
});

test('text files must look like text; programs and binary data are refused', () => {
  assert.equal(detectFile(Buffer.from('Blood pressure 120/80\nPulse 72'), 'notes.txt')?.contentType, 'text/plain');
  assert.equal(detectFile(Buffer.from('a,b\n1,2\n'), 'values.csv')?.contentType, 'text/csv');
  assert.equal(detectFile(pad(b(1, 2, 3, 0, 5)), 'notes.txt'), null);
  assert.equal(detectFile(Buffer.from('MZ\u0090\u0000\u0003'), 'setup.exe'), null);
  assert.equal(detectFile(Buffer.from('<script>alert(1)</script>'), 'page.html'), null);
  assert.equal(detectFile(Buffer.alloc(0), 'empty.txt'), null);
});

test('file names lose paths and control characters', () => {
  assert.equal(safeFileName('../../etc/passwd', 'pdf'), '.. .. etc passwd');
  assert.equal(safeFileName('', 'pdf'), 'document.pdf');
  assert.equal(safeFileName('Scan\u0000 <1>.jpg', 'jpg'), 'Scan 1.jpg');
  assert.ok(safeFileName('x'.repeat(500), 'pdf').length <= 120);
});

test('the base64 limit covers the byte limit', () => {
  assert.ok(RECORD_FILE_MAX_B64 >= Math.ceil((RECORD_FILE_MAX_BYTES * 4) / 3));
});
