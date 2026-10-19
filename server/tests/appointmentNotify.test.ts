import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyRequested, notifyStatus, requestedMessages, summarise, statusMessages, esc } from '../appointmentNotify';

const appt = (extra: any = {}) => ({ _id: '65f0a1b2c3d4e5f60718293a', facilityName: 'Mercy Clinic', scheduledFor: new Date('2026-11-02T00:00:00Z'), timeSlot: '09:30 AM', visitType: 'in_person', ...extra });
const fakes = (opts: { email?: boolean; sms?: boolean } = {}) => {
  const sent: string[] = [];
  const d = {
    push: async () => { sent.push('push'); },
    email: async (to: string) => { sent.push(`email:${to}`); return opts.email !== false; },
    sms: async (to: string) => { sent.push(`sms:${to}`); return opts.sms !== false; },
  };
  return { d, sent };
};

test('a platform facility with contacts is told, and so is the patient', async () => {
  const { d, sent } = fakes();
  const r = await notifyRequested({ patient: d }, appt(), 'Ada', { email: 'a@x.ng', phone: '+2348012345678' }, { email: 'f@clinic.ng', phone: '+2348099999999' });
  assert.deepEqual(r, { patient: { push: true, email: true, sms: true }, facility: { contact: true, email: true, sms: true } });
  assert.deepEqual(sent.sort(), ['email:a@x.ng', 'email:f@clinic.ng', 'push', 'sms:+2348012345678', 'sms:+2348099999999']);
});

test('an unreachable channel is reported as not delivered, not as sent', async () => {
  const { d } = fakes({ email: false, sms: false });
  const r = await notifyRequested({ patient: d }, appt(), 'Ada', { email: 'a@x.ng', phone: '+2348012345678' }, { email: 'f@clinic.ng' });
  assert.equal(r.patient.email, false);
  assert.equal(r.patient.sms, false);
  assert.equal(r.facility.email, false);
  assert.match(summarise(r, false), /no email or phone|You will also see/);
});

test('a channel that throws does not stop the others', async () => {
  const d = { push: async () => { throw new Error('x'); }, email: async () => { throw new Error('y'); }, sms: async () => true };
  const r = await notifyRequested({ patient: d }, appt(), 'Ada', { email: 'a@x.ng', phone: '+2348012345678' }, null);
  assert.deepEqual(r.patient, { push: false, email: false, sms: true });
});

test('a facility without contact details is not claimed as notified', async () => {
  const { d, sent } = fakes();
  const r = await notifyRequested({ patient: d }, appt(), 'Ada', { email: 'a@x.ng' }, null);
  assert.equal(r.facility.contact, false);
  assert.ok(!sent.some((s) => s.includes('clinic')));
  assert.match(summarise(r, false), /We have no email or phone for this facility/);
});

test('a Google-listed facility is never messaged and the patient is told to share the request', async () => {
  const { d, sent } = fakes();
  const r = await notifyRequested({ patient: d }, appt({ externalFacility: true }), 'Ada', { email: 'a@x.ng' }, { email: 'f@clinic.ng' });
  assert.equal(r.facility.email, false);
  assert.ok(!sent.includes('email:f@clinic.ng'));
  assert.match(summarise(r, true), /Send the request to the facility/);
  assert.match(requestedMessages(appt({ externalFacility: true }), 'Ada').patient.body, /not on WelliRecord yet/);
});

test('messages carry the date, time and a reference but not the reason or health details', () => {
  const m = requestedMessages(appt(), 'Ada');
  for (const t of [m.facility.text, m.facility.sms, m.patient.sms]) { assert.match(t, /09:30 AM/); assert.match(t, /[A-F0-9]{6}/); }
  assert.match(m.facility.text, /2 Nov|02 Nov/);
});

test('status messages and escaping', async () => {
  assert.match(statusMessages(appt({ visitType: 'video' }), 'confirmed').body, /Join from Upcoming visits/);
  assert.match(statusMessages(appt(), 'cancelled').sms, /cancelled/);
  assert.equal(esc('<b>"x"&'), '&lt;b&gt;&quot;x&quot;&amp;');
  const { d, sent } = fakes();
  const r = await notifyStatus(d, appt(), 'confirmed', { email: 'a@x.ng', phone: '+2348012345678' });
  assert.deepEqual(r, { push: true, email: true, sms: true });
  assert.equal(sent.length, 3);
});
