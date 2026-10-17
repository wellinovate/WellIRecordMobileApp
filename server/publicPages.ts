// Public pages the Play Store listing links to. No scripts, no forms.
import type { Request, Response } from 'express';

const CONTACT = process.env.PRIVACY_CONTACT_EMAIL || 'privacy@wellirecord.com';

const page = (title: string, body: string) => `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#0F172A;line-height:1.55}h1{font-size:24px}h2{font-size:17px;margin-top:28px}li{margin:4px 0}.muted{color:#64748B;font-size:14px}</style></head><body>${body}</body></html>`;

export function accountDeletionPage(_req: Request, res: Response) {
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
  res.type('html').send(
    page(
      'Delete your WelliRecord account',
      `<h1>Delete your WelliRecord account</h1>
<p class="muted">WelliRecord, by Wellinovate Limited.</p>
<h2>Delete it in the app</h2>
<ol>
<li>Open WelliRecord and sign in.</li>
<li>Go to Profile, then Privacy and security.</li>
<li>Choose Delete account, enter your password, confirm, and tap Delete my account.</li>
</ol>
<p>Deletion happens straight away and cannot be undone.</p>
<h2>What is deleted</h2>
<ul>
<li>Your account and sign-in details, including Google or Apple sign-in linked to it.</li>
<li>Health records and documents you uploaded, prescriptions, vitals and medication entries.</li>
<li>Family members you added, and for each child: vaccines, growth and development entries, school profile, guardians, clinic access codes, reminders and the access log.</li>
<li>Sharing links you created.</li>
</ul>
<h2>What is not deleted</h2>
<ul>
<li>Records that a clinic, hospital, laboratory or pharmacy keeps in its own systems. They are held under that organisation's own duties.</li>
<li>Error reports, which contain no name, email, phone number or health data, are removed automatically after 30 days.</li>
<li>Backups are overwritten on the host's normal cycle.</li>
</ul>
<h2>If you cannot open the app</h2>
<p>Email <a href="mailto:${CONTACT}?subject=Account%20deletion%20request">${CONTACT}</a> from the address registered on your account, with the subject "Account deletion request". We reply to confirm it is you before we delete anything.</p>`
    )
  );
}
