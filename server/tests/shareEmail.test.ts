import test from 'node:test';
import assert from 'node:assert/strict';
import { shareCodeHtml, shareCodeSubject, shareCodeText } from '../shareEmail';

const base = { recipientName: 'Dr Uche', code: '086303', minutes: 10, linkExpiresAt: new Date('2026-10-21T09:00:00Z') };

test('the email carries the code, the minutes and the link expiry', () => {
  const html = shareCodeHtml(base);
  assert.match(html, /id="code">086303</);
  assert.match(html, /Works for 10 minutes/);
  assert.match(html, /21 Oct 2026, 10:00/);
  const text = shareCodeText(base);
  assert.match(text, /Verification code: 086303/);
  assert.match(text, /10 minutes/);
  assert.match(text, /does not replace the patient's consent/);
  assert.equal(shareCodeSubject().includes('086303'), false, 'the code is not put in the subject');
});

test('the provider name from the patient cannot inject markup', () => {
  const html = shareCodeHtml({ ...base, recipientName: '<img src=x onerror=alert(1)>"&' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;&quot;&amp;/);
});

test('it works without a name or an expiry and never names the patient', () => {
  const html = shareCodeHtml({ code: '123456', minutes: 10 });
  assert.match(html, /Hello,/);
  assert.doesNotMatch(html, /available until/);
  assert.match(shareCodeText({ code: '123456', minutes: 10 }), /^Hello,/);
  assert.match(html, /A patient has shared/);
});
