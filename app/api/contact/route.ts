import {NextResponse} from 'next/server';

const SUPPORT_EMAIL = 'support@loyelio.com';
const FROM_EMAIL = 'Loyelio <noreply@loyelio.com>';

function stringValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function redirectBack(request: Request, status: 'error' | 'sent') {
  const referer = request.headers.get('referer') || '/contact';
  const url = new URL(referer);
  url.searchParams.set('contact', status);
  return NextResponse.redirect(url, {status: 303});
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = stringValue(formData, 'name');
  const email = stringValue(formData, 'email');
  const subject = stringValue(formData, 'subject');
  const message = stringValue(formData, 'message');

  if (!name || !email || !message) {
    return redirectBack(request, 'error');
  }

  const apiKey = process.env.RESEND_KEY;
  if (!apiKey) {
    return redirectBack(request, 'error');
  }

  const response = await fetch('https://api.resend.com/emails', {
    body: JSON.stringify({
      from: FROM_EMAIL,
      reply_to: email,
      subject: `[Loyelio] ${subject || 'Contact'} - ${name}`,
      text: [`Name: ${name}`, `Email: ${email}`, `Subject: ${subject || '-'}`, '', message].join('\n'),
      to: SUPPORT_EMAIL
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (!response.ok) {
    return redirectBack(request, 'error');
  }

  return redirectBack(request, 'sent');
}
