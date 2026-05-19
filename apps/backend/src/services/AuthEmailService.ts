import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Resend } from 'resend';

const getRequiredEnv = (key: 'RESEND_API_KEY' | 'EMAIL_FROM') => {
  const value = String(process.env[key] || '').trim();
  if (!value) {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
};

const escapeHtml = (value: string) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const PIQUE_LOGO_INLINE_CONTENT_ID = 'pique-logo-horizontal';
const PIQUE_LOGO_EMAIL_PATH = resolve(
  __dirname,
  '../../../frontend/public/brand/pique-logo-horizontal-email.png'
);

export class AuthEmailService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    this.resend = new Resend(getRequiredEnv('RESEND_API_KEY'));
    this.from = getRequiredEnv('EMAIL_FROM');
  }

  async sendMagicLink(email: string, url: string, ttlMinutes: number): Promise<void> {
    const safeTtl = Math.max(1, Math.floor(ttlMinutes));
    const subject = 'Tu enlace de acceso a Pique';
    const safeUrl = escapeHtml(url);
    const supportCopy = 'Pique — Reservas, agenda y gestión para clubes deportivos.';
    const logoContent = readFileSync(PIQUE_LOGO_EMAIL_PATH);
    const html = `
<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f3f4f6; margin:0; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;">
            <tr>
              <td style="padding:0 0 16px 0; text-align:center;">
                <a
                  href="https://pique.ar"
                  target="_blank"
                  rel="noopener noreferrer"
                  style="display:inline-block; text-decoration:none;"
                >
                  <img
                    src="cid:${PIQUE_LOGO_INLINE_CONTENT_ID}"
                    alt="Pique"
                    width="196"
                    height="64"
                    style="display:block; margin:0 auto; width:196px; max-width:100%; height:auto; border:0;"
                  />
                </a>
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:40px 32px; box-shadow:0 8px 24px rgba(17,24,39,0.06);">
                <div style="font-size:30px; line-height:1.15; font-weight:800; color:#111827; margin:0 0 18px 0;">Ingresá a Pique</div>
                <div style="font-size:16px; line-height:1.65; color:#374151; margin:0 0 28px 0;">
                  Recibimos una solicitud para iniciar sesión con este correo.
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                  <tr>
                    <td align="center" bgcolor="#111827" style="border-radius:12px;">
                      <a
                        href="${safeUrl}"
                        style="display:inline-block; padding:14px 24px; font-size:16px; line-height:1; font-weight:700; color:#ffffff; text-decoration:none; border-radius:12px;"
                      >
                        Ingresar a Pique
                      </a>
                    </td>
                  </tr>
                </table>
                <div style="font-size:15px; line-height:1.65; color:#374151; margin:0 0 14px 0;">
                  Este enlace vence en <strong>${safeTtl} minuto${safeTtl === 1 ? '' : 's'}</strong> y solo puede usarse una vez.
                </div>
                <div style="font-size:15px; line-height:1.65; color:#374151; margin:0 0 28px 0;">
                  Si no pediste este acceso, podés ignorar este correo.
                </div>
                <div style="font-size:12px; line-height:1.7; color:#6b7280; text-align:center; border-top:1px solid #e5e7eb; padding-top:20px;">
                  <div style="margin:0 0 4px 0;">${supportCopy}</div>
                  <div style="margin:0;">pique.ar</div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
    `;
    const text = [
      'Ingresá a Pique',
      '',
      'Recibimos una solicitud para iniciar sesión con este correo.',
      '',
      `Este enlace vence en ${safeTtl} minuto${safeTtl === 1 ? '' : 's'} y solo puede usarse una vez.`,
      'Si no pediste este acceso, podés ignorar este correo.',
      '',
      supportCopy,
      'pique.ar'
    ].join('\n');

    await this.resend.emails.send({
      from: this.from,
      to: email,
      subject,
      html,
      text,
      attachments: [
        {
          filename: 'pique-logo-horizontal-email.png',
          content: logoContent,
          contentType: 'image/png',
          inlineContentId: PIQUE_LOGO_INLINE_CONTENT_ID
        }
      ]
    });
  }
}
