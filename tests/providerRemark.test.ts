import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderRemark, buildShareMessage } from '../src/utils/providerRemark';

test('the remark names WelliBridge and includes the WelliID only when there is one', () => {
  assert.match(buildProviderRemark('WR-123'), /WelliID: WR-123\./);
  assert.match(buildProviderRemark(), /WelliBridge/);
  assert.doesNotMatch(buildProviderRemark(), /WelliID/);
});

test('the share message carries the request and the remark', () => {
  const m = buildShareMessage({ facility: 'Mercy Clinic', patient: 'Ada', date: '2026-11-02', timeSlot: '09:30 AM', reason: 'Antenatal check', remark: 'R' });
  for (const t of ['Mercy Clinic', 'Ada', '2026-11-02', '09:30 AM', 'Antenatal check', 'R']) assert.ok(m.includes(t));
});
