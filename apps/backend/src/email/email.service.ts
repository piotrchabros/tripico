import { Injectable, OnModuleInit } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { Resend } from 'resend';

interface EmailRecipient {
  email: string;
  displayName?: string;
}

interface EmailPayload {
  to: EmailRecipient;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private resend: Resend | null = null;
  private from = 'Tripico <no-reply@tripico.pl>';

  constructor(private readonly logger: PinoLogger) {}

  onModuleInit(): void {
    const apiKey = process.env['RESEND_API_KEY'];
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.from = process.env['EMAIL_FROM'] ?? this.from;
      this.logger.log('Resend email provider initialized');
    } else {
      this.logger.log(
        'RESEND_API_KEY not set — falling back to log-only delivery',
      );
    }
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.resend) {
      // Log-only mode (dev / no key). Body intentionally short — full
      // text could leak PII; we just confirm dispatch attempt.
      this.logger.log(
        `[email][log-only] → ${payload.to.email}: ${payload.subject}`,
      );
      return;
    }

    const toLine = payload.to.displayName
      ? `${payload.to.displayName} <${payload.to.email}>`
      : payload.to.email;

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: toLine,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? payload.text.replace(/\n/g, '<br>'),
      });
      if (error) {
        this.logger.error(
          `[email] Resend rejected (${payload.to.email}): ${error.message}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[email] send failed (${payload.to.email}): ${
          (err as Error)?.message ?? err
        }`,
      );
    }
  }

  sendVerificationEmail(args: {
    to: EmailRecipient;
    verifyUrl: string;
  }): Promise<void> {
    return this.send({
      to: args.to,
      subject: 'Potwierdź adres email · Tripico',
      text:
        `Cześć${args.to.displayName ? ` ${args.to.displayName}` : ''},\n\n` +
        `Aby zacząć korzystać z Tripico (organizować i dołączać do wycieczek), ` +
        `potwierdź swój adres email:\n\n${args.verifyUrl}\n\n` +
        `Link jest ważny przez 24h. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość.\n\n` +
        `— zespół Tripico`,
    });
  }

  sendPasswordResetEmail(args: {
    to: EmailRecipient;
    resetUrl: string;
  }): Promise<void> {
    return this.send({
      to: args.to,
      subject: 'Zresetuj hasło · Tripico',
      text:
        `Cześć${args.to.displayName ? ` ${args.to.displayName}` : ''},\n\n` +
        `Otrzymaliśmy prośbę o reset hasła do Twojego konta Tripico. ` +
        `Aby ustawić nowe hasło, kliknij w link:\n\n${args.resetUrl}\n\n` +
        `Link jest ważny przez godzinę. Jeśli to nie Ty prosiłeś o reset, ` +
        `zignoruj tę wiadomość — hasło nie zostanie zmienione.\n\n` +
        `— zespół Tripico`,
    });
  }
}
