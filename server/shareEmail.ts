// The email a provider gets with the code to open a WelliBridge link. Built here so it can be tested.
// The patient typed the provider's name, so it is escaped. The email says "a patient", not who: the
// address may be wrong, and the patient's name is shown only after the code is entered.

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export interface ShareCodeEmail {
  recipientName?: string;
  code: string;
  minutes: number;
  linkExpiresAt?: Date;
}

const when = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }).format(d) + ' (Lagos time)';

export function shareCodeSubject() {
  return 'Your WelliRecord verification code';
}

export function shareCodeText({ recipientName, code, minutes, linkExpiresAt }: ShareCodeEmail): string {
  return [
    `Hello${recipientName ? ` ${recipientName.trim()}` : ''},`,
    '',
    'A patient has shared health information with you through WelliRecord. To open it, enter this code on the page where you opened the link:',
    '',
    `Verification code: ${code}`,
    `The code works for ${minutes} minutes.`,
    linkExpiresAt ? `The shared information is available until ${when(linkExpiresAt)}, unless the patient withdraws it sooner.` : '',
    '',
    'Do not share this code with anyone. WelliRecord will never ask you for it by phone, email or message. If you were not expecting this, ignore this email and do not open the link.',
    'Verification confirms you received the link. It does not replace the patient\'s consent, and the patient can withdraw access at any time.',
    '',
    'WelliRecord™ · Patient-owned health records',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}

export function shareCodeHtml({ recipientName, code, minutes, linkExpiresAt }: ShareCodeEmail): string {
  const name = recipientName?.trim() ? esc(recipientName.trim()) : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your WelliRecord verification code</title>
</head>
<body style="margin:0;padding:0;background-color:#F8FAFC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#334155;line-height:1.6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your code is ${esc(code)}. It works for ${minutes} minutes.</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F8FAFC;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr><td style="background-color:#041E42;padding:28px 24px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">WelliRecord™</h1>
          <p style="margin:6px 0 0 0;color:#93C5FD;font-size:12px;font-weight:600;">Patient-owned health records</p>
        </td></tr>
        <tr><td style="padding:32px 32px 8px 32px;">
          <p style="margin:0 0 12px 0;font-size:16px;color:#1E293B;">Hello${name ? ` <strong style="color:#041E42;">${name}</strong>` : ''},</p>
          <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#0F172A;">A patient has shared health information with you</h2>
          <p style="margin:0 0 20px 0;font-size:15px;color:#475569;">Enter this code on the page where you opened the link to view it.</p>
          <div style="background-color:#F0FDF4;border:1px solid #86EFAC;border-radius:12px;padding:22px;text-align:center;margin:0 0 20px 0;">
            <div style="font-size:12px;font-weight:700;color:#15803D;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Verification code</div>
            <div style="font-size:36px;font-weight:800;color:#041E42;letter-spacing:8px;margin:8px 0;font-family:'Courier New',monospace;"><span id="code">${esc(code)}</span></div>
            <div style="font-size:13px;font-weight:600;color:#16A34A;">Works for ${minutes} minutes</div>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;font-size:14px;color:#475569;">
            <tr><td style="padding:4px 0;"><strong style="color:#041E42;">1.</strong> Open the link you were sent, on a phone or computer.</td></tr>
            <tr><td style="padding:4px 0;"><strong style="color:#041E42;">2.</strong> Enter the code above where the page asks for it.</td></tr>
            <tr><td style="padding:4px 0;"><strong style="color:#041E42;">3.</strong> Read the record. The page decrypts it on your device.</td></tr>
          </table>
          ${linkExpiresAt ? `<p style="margin:0 0 16px 0;font-size:14px;color:#475569;">The shared information is available until <strong>${esc(when(linkExpiresAt))}</strong>, unless the patient withdraws it sooner.</p>` : ''}
          <div style="background-color:#F0F9FF;border-left:4px solid #0284C7;border-radius:8px;padding:14px 18px;margin:0 0 14px 0;">
            <div style="font-size:14px;font-weight:700;color:#075985;margin-bottom:4px;">Security</div>
            <div style="font-size:13px;color:#0C4A6E;line-height:1.5;">Do not share this code with anyone. WelliRecord will never ask you for it by phone, email or message. If you were not expecting this, ignore this email and do not open the link.</div>
          </div>
          <p style="margin:0 0 24px 0;font-size:13px;color:#64748B;line-height:1.5;">Verification confirms you received the link. It does not replace the patient's consent, and the patient can withdraw access at any time.</p>
        </td></tr>
        <tr><td style="background-color:#F8FAFC;padding:20px 24px;text-align:center;border-top:1px solid #E2E8F0;">
          <div style="font-size:14px;font-weight:700;color:#041E42;">WelliRecord™</div>
          <div style="font-size:12px;color:#94A3B8;margin-top:4px;">One patient. One trusted record. Accessible when it matters.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
