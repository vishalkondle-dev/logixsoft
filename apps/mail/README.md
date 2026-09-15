# mail

A serverless email-sending API deployed on Cloudflare Workers. Speaks SMTP directly over TCP sockets (`cloudflare:sockets`) — no local server, no runtime dependencies.

## Deployed endpoint

**`https://mail.logixsoft.in`** (custom domain, DNS managed by Cloudflare)

## API

`POST /send-email`

| Header | Required | Description |
| --- | --- | --- |
| `Content-Type` | yes | `application/json` |
| `x-api-key` | yes | The `API_KEY` worker secret |

Body:

```json
{
  "to": "recipient@example.com",
  "subject": "Hello",
  "body": "<h1>Hi</h1>",
  "attachments": [
    {
      "filename": "report.pdf",
      "content": "<base64-encoded bytes>",
      "contentType": "application/pdf"
    }
  ]
}
```

- `body` is treated as HTML.
- `attachments` is optional; each needs `filename` and `content` (base64 string). `contentType` defaults to `application/octet-stream`. Max 20 MB per attachment.
- Rate limited to 10 requests per minute per IP.

Response:

```json
{ "messageId": "250 Message received" }
```

Error codes: `400` (missing/invalid fields, bad base64), `401` (bad API key), `429` (rate limit), `500` (SMTP failure).

### Example

```bash
curl -X POST https://mail.logixsoft.in/send-email \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"to": "recipient@example.com", "subject": "Hello", "body": "<h1>Hi</h1>", "attachments": [{"filename": "report.pdf", "content": "'"$(base64 -w0 report.pdf)"'", "contentType": "application/pdf"}]}'
```

## Configuration

SMTP credentials are stored as Cloudflare Worker secrets (never in code or config):

```bash
echo "support@logixsoft.in" | npx wrangler secret put SMTP_USER
echo "your-app-password"    | npx wrangler secret put SMTP_PASS
echo "smtp.zoho.in"         | npx wrangler secret put SMTP_HOST
echo "465"                  | npx wrangler secret put SMTP_PORT
echo "true"                 | npx wrangler secret put SMTP_SECURE
echo "your-secret-api-key"  | npx wrangler secret put API_KEY
```

| Variable | Description |
| --- | --- |
| `SMTP_USER` | Full email address used for SMTP auth (e.g. `support@logixsoft.in`) |
| `SMTP_PASS` | App-specific password, not your regular login password |
| `API_KEY` | Secret key required in the `x-api-key` header |
| `SMTP_HOST` | SMTP server host (default `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (default `465`) |
| `SMTP_SECURE` | `true` = implicit TLS (465), `false` = STARTTLS (587) |

### App passwords

- **Gmail:** https://myaccount.google.com/apppasswords
- **Zoho:** https://accounts.zoho.in/home#security/app_password

### Zoho Mail (India region)

| Variable | Value |
| --- | --- |
| `SMTP_USER` | `support@logixsoft.in` |
| `SMTP_HOST` | `smtp.zoho.in` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |

Other Zoho regions: `smtp.zoho.com` / `smtp.zoho.eu`. For port 587 use `SMTP_SECURE=false`.

## Local development

```bash
npm install
echo "your-app-password" >> .dev.vars   # SMTP_PASS, API_KEY and other vars for local testing
npm run dev                            # wrangler dev on :8787
```

`.dev.vars` is gitignored. Deploy with:

```bash
npm run deploy
```

The custom domain (`mail.logixsoft.in`) is declared in `wrangler.toml`; Cloudflare creates the DNS record automatically. Change the SMTP provider by updating the secrets and redeploying.

## Security notes

- Never commit `.dev.vars` (gitignored).
- Use app-specific passwords, not account passwords.
- The API key is required on every request; keep it out of client-side code.
