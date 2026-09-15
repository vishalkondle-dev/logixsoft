# @logixsoft/wa

Client SDK and direct helper functions for sending WhatsApp messages, images, documents, and OTPs via the local/cloud OpenWA Gateway (`https://wa.logixsoft.in`).

## Installation

Within the monorepo:

```json
{
  "dependencies": {
    "@logixsoft/wa": "workspace:*"
  }
}
```

## Environment Variables

All configuration is automatically read from environment variables if not passed explicitly:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `WA_API_URL` | Gateway URL | `http://127.0.0.1:2785` (or `https://wa.logixsoft.in`) |
| `WA_API_KEY` | OpenWA API Key (`X-Api-Key`) | Auto-configured system key |
| `WA_SESSION_NAME` | Active WhatsApp session name | `logixsoft` |

---

## Usage

### 1. Send Plain Text Message

Phone numbers are automatically normalized (e.g. `9876543210`, `+91 98765 43210` -> `919876543210@c.us`):

```typescript
import { sendWhatsAppText } from '@logixsoft/wa';

const res = await sendWhatsAppText('919876543210', 'Hello from Logixsoft!');

if (res.success) {
  console.log('Message ID:', res.messageId);
} else {
  console.error('Error:', res.error);
}
```

### 2. Send Image (URL, Base64, or Buffer)

```typescript
import { sendWhatsAppImage } from '@logixsoft/wa';

// With public URL
await sendWhatsAppImage('919876543210', 'https://example.com/receipt.jpg', {
  caption: 'Payment Receipt #1024',
});

// With Buffer
import fs from 'node:fs';
const imageBuffer = fs.readFileSync('./qrcode.png');

await sendWhatsAppImage('919876543210', imageBuffer, {
  filename: 'qrcode.png',
  caption: 'Scan to pay',
});
```

### 3. Send Document / Attachment (PDF, Excel, Docs, ZIP)

```typescript
import { sendWhatsAppDocument } from '@logixsoft/wa';
import fs from 'node:fs';

const pdfBuffer = fs.readFileSync('./invoice.pdf');

await sendWhatsAppDocument('919876543210', pdfBuffer, {
  filename: 'Invoice_2026.pdf',
  caption: 'Your monthly invoice is ready',
});
```

### 4. Send OTP Verification

```typescript
import { sendWhatsAppOtp } from '@logixsoft/wa';

await sendWhatsAppOtp('919876543210', '491820', {
  appName: 'Logixsoft PG',
  expiryMinutes: 10,
});
```

### 5. Send Location Pin

```typescript
import { sendWhatsAppLocation } from '@logixsoft/wa';

await sendWhatsAppLocation('919876543210', {
  latitude: 19.0760,
  longitude: 72.8777,
  title: 'Logixsoft Headquarters',
  address: 'Mumbai, Maharashtra',
});
```

### 6. Custom Client Instance

```typescript
import { WhatsAppClient } from '@logixsoft/wa';

const wa = new WhatsAppClient({
  url: 'https://wa.logixsoft.in',
  apiKey: 'your-custom-key',
  sessionName: 'logixsoft',
});

// Check gateway health
const isHealthy = await wa.healthCheck();

// List active sessions
const sessions = await wa.getSessions();
```
