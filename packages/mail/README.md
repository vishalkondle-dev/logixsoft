# @logixsoft/mail

Client SDK and helper functions for sending emails through the Logixsoft Mail Worker (`https://mail.logixsoft.in`).

## Installation

Within the monorepo:

```json
{
  "dependencies": {
    "@logixsoft/mail": "workspace:*"
  }
}
```

## Environment Variables

The package automatically reads configuration from environment variables if not passed explicitly:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `MAIL_WORKER_URL` | The URL of the mail worker | `https://mail.logixsoft.in` |
| `MAIL_API_KEY` | Secret API key required by the worker | `process.env.API_KEY` |

## Usage

### 1. Direct Function `sendMail`

```typescript
import { sendMail } from '@logixsoft/mail';

// Send a basic email
const result = await sendMail({
  to: 'customer@example.com',
  subject: 'Order Confirmation',
  html: '<p>Thank you for your order!</p>',
});

if (result.success) {
  console.log('Sent successfully, messageId:', result.messageId);
} else {
  console.error('Failed to send:', result.error);
}
```

### 2. Send with Attachments

Attachments accept base64 strings, `Buffer`, or `Uint8Array`:

```typescript
import { sendMail } from '@logixsoft/mail';
import fs from 'node:fs';

const pdfBuffer = fs.readFileSync('./invoice.pdf');

await sendMail({
  to: 'client@example.com',
  subject: 'Your Monthly Invoice',
  html: '<p>Please find attached your invoice for this month.</p>',
  attachments: [
    {
      filename: 'invoice.pdf',
      content: pdfBuffer, // Uint8Array or Buffer is automatically base64-encoded
      contentType: 'application/pdf',
    },
  ],
});
```

### 3. Send OTP / Verification Code

Generates a responsive, clean HTML email with a highlighted OTP code:

```typescript
import { sendOtpEmail } from '@logixsoft/mail';

await sendOtpEmail({
  to: 'user@example.com',
  otp: '729183',
  appName: 'Logixsoft PG',
  expiryMinutes: 10,
});
```

### 4. Send Welcome Email

Generates a modern onboarding email with a call-to-action button:

```typescript
import { sendWelcomeEmail } from '@logixsoft/mail';

await sendWelcomeEmail({
  to: 'newuser@example.com',
  name: 'Alex',
  appName: 'Logixsoft PG',
  loginUrl: 'https://payment.logixsoft.in/login',
});
```

### 5. Custom Client Instance

You can instantiate `MailClient` with specific configurations:

```typescript
import { MailClient } from '@logixsoft/mail';

const client = new MailClient({
  url: 'https://mail.logixsoft.in',
  apiKey: 'your-worker-api-key',
  timeoutMs: 20_000,
});

await client.sendOrThrow({
  to: 'support@logixsoft.in',
  subject: 'System Alert',
  text: 'Server threshold reached 90%',
});
```

## API Reference

### `sendMail(options, config?): Promise<SendMailResponse>`
Sends an email and returns `{ success, messageId, error, statusCode }`.

### `sendMailOrThrow(options, config?): Promise<string>`
Sends an email and throws an error if delivery fails. Returns the `messageId`.

### `sendOtpEmail(options, config?): Promise<SendMailResponse>`
Sends a pre-formatted verification email.

### `sendWelcomeEmail(options, config?): Promise<SendMailResponse>`
Sends a pre-formatted welcome onboarding email.
