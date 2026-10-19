// Messages sent when a visit is requested, confirmed or cancelled. Delivery is injected so this can
// be tested without email, SMS or a database. Nothing here claims a message was sent unless the
// channel reported delivery.
export interface ApptLike {
  _id: any;
  facilityName: string;
  scheduledFor: Date | string;
  timeSlot: string;
  visitType?: string;
  externalFacility?: boolean;
}

export interface NotifyDeps {
  push: (p: { title: string; body: string }) => Promise<void>;
  email: (to: string, subject: string, text: string, html: string) => Promise<boolean>;
  sms: (phone: string, message: string) => Promise<boolean>;
}

export interface Contact { email?: string | null; phone?: string | null }

export interface NotifyResult {
  patient: { push: boolean; email: boolean; sms: boolean };
  facility: { contact: boolean; email: boolean; sms: boolean };
}

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
const shortRef = (id: any) => String(id).slice(-6).toUpperCase();

export function dayLabel(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' });
}

export function requestedMessages(a: ApptLike, patientName: string) {
  const when = `${dayLabel(a.scheduledFor)}, ${a.timeSlot}`;
  const kind = a.visitType === 'video' ? 'video visit' : 'visit';
  const ref = shortRef(a._id);
  const patient = a.externalFacility
    ? {
        title: 'Visit request saved',
        body: `Your ${kind} request for ${a.facilityName} on ${when} is saved. This facility is not on WelliRecord yet, so send the request to them to confirm.`,
        sms: `WelliRecord: your ${kind} request for ${a.facilityName} on ${when} is saved (ref ${ref}). Send it to the facility to confirm.`,
      }
    : {
        title: 'Visit request sent',
        body: `Your ${kind} request to ${a.facilityName} for ${when} was sent. They will confirm. You will be notified.`,
        sms: `WelliRecord: your ${kind} request to ${a.facilityName} for ${when} was sent (ref ${ref}). We will tell you when they confirm.`,
      };
  const facility = {
    subject: `New appointment request via WelliRecord (${ref})`,
    text: `${patientName} requested a ${kind} on ${when} through WelliRecord. Sign in to the WelliRecord provider console to confirm or decline. Reference ${ref}.`,
    sms: `WelliRecord: new ${kind} request from ${patientName} for ${when} (ref ${ref}). Sign in to the provider console to confirm.`,
  };
  return { patient, facility };
}

export function statusMessages(a: ApptLike, status: 'confirmed' | 'cancelled') {
  const when = `${dayLabel(a.scheduledFor)}, ${a.timeSlot}`;
  const video = a.visitType === 'video';
  const ref = shortRef(a._id);
  if (status === 'confirmed') {
    return {
      title: 'Visit confirmed',
      body: `${a.facilityName} confirmed your ${video ? 'video visit' : 'visit'} on ${when}.${video ? ' Join from Upcoming visits on the day.' : ''}`,
      sms: `WelliRecord: ${a.facilityName} confirmed your ${video ? 'video visit' : 'visit'} on ${when} (ref ${ref}).`,
    };
  }
  return {
    title: 'Visit cancelled',
    body: `${a.facilityName} cancelled your visit on ${when}.`,
    sms: `WelliRecord: ${a.facilityName} cancelled your visit on ${when} (ref ${ref}). Open the app to book another time.`,
  };
}

const safe = async (f: () => Promise<boolean | void>): Promise<boolean> => {
  try { const r = await f(); return r === undefined ? true : Boolean(r); } catch { return false; }
};

export async function notifyRequested(
  deps: { patient: NotifyDeps; facilitySend?: Pick<NotifyDeps, 'email' | 'sms'> },
  a: ApptLike,
  patientName: string,
  patientContact: Contact,
  facilityContact: Contact | null,
): Promise<NotifyResult> {
  const m = requestedMessages(a, patientName);
  const p = deps.patient;
  const fs = deps.facilitySend || p;
  const html = (t: string) => `<p>${esc(t)}</p>`;
  const [push, email, sms, fEmail, fSms] = await Promise.all([
    safe(() => p.push({ title: m.patient.title, body: m.patient.body }).then(() => true)),
    patientContact.email ? safe(() => p.email(patientContact.email!, m.patient.title, m.patient.body, html(m.patient.body))) : Promise.resolve(false),
    patientContact.phone ? safe(() => p.sms(patientContact.phone!, m.patient.sms)) : Promise.resolve(false),
    facilityContact?.email && !a.externalFacility ? safe(() => fs.email(facilityContact.email!, m.facility.subject, m.facility.text, html(m.facility.text))) : Promise.resolve(false),
    facilityContact?.phone && !a.externalFacility ? safe(() => fs.sms(facilityContact.phone!, m.facility.sms)) : Promise.resolve(false),
  ]);
  return {
    patient: { push, email, sms },
    facility: { contact: Boolean(facilityContact && (facilityContact.email || facilityContact.phone) && !a.externalFacility), email: fEmail, sms: fSms },
  };
}

export async function notifyStatus(deps: NotifyDeps, a: ApptLike, status: 'confirmed' | 'cancelled', c: Contact) {
  const m = statusMessages(a, status);
  const html = `<p>${esc(m.body)}</p>`;
  const [push, email, sms] = await Promise.all([
    safe(() => deps.push({ title: m.title, body: m.body }).then(() => true)),
    c.email ? safe(() => deps.email(c.email!, m.title, m.body, html)) : Promise.resolve(false),
    c.phone ? safe(() => deps.sms(c.phone!, m.sms)) : Promise.resolve(false),
  ]);
  return { push, email, sms };
}

// What the app can truthfully tell the person after a request.
export function summarise(r: NotifyResult, external: boolean): string {
  const you = r.patient.email && r.patient.sms ? 'We emailed and texted you.' : r.patient.email ? 'We emailed you.' : r.patient.sms ? 'We texted you.' : 'You will also see it under My appointments.';
  if (external) return `${you} Send the request to the facility so they can confirm.`;
  if (r.facility.email || r.facility.sms) return `${you} The facility was notified.`;
  return `${you} We have no email or phone for this facility, so they may not see it straight away. Call them to confirm.`;
}
