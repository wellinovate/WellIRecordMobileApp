// Text that tells a provider outside WelliRecord how this patient's records work, so they know
// how to see them. Used on appointment requests to facilities found through the locators.
export function buildProviderRemark(welliId?: string): string {
  return [
    'This patient keeps their health records on WelliRecord, a patient-owned record platform.',
    welliId ? `WelliID: ${welliId}.` : '',
    'You do not need an account to see what they choose to share: ask them for a WelliBridge link, which opens with a one-time code.',
    'Providers can learn more at wellirecord.com.',
  ].filter(Boolean).join(' ');
}

export function buildShareMessage(p: { facility: string; patient: string; date: string; timeSlot: string; reason?: string; remark?: string }): string {
  return [
    'Appointment request',
    `Facility: ${p.facility}`,
    `Patient: ${p.patient}`,
    `Preferred date: ${p.date}`,
    `Preferred time: ${p.timeSlot}`,
    p.reason ? `Reason: ${p.reason}` : '',
    p.remark ? `\n${p.remark}` : '',
    '\nSent from the WelliRecord app.',
  ].filter((x) => x !== '').join('\n');
}
