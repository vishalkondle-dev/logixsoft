export interface Attachment {
  filename: string;
  content: string;
  contentType?: string;
}

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  attachments?: Attachment[];
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
}

const b64 = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)));

function b64wrap(data: string) {
  const out: string[] = [];
  for (let i = 0; i < data.length; i += 76) out.push(data.slice(i, i + 76));
  return out.join("\r\n");
}

const encodedName = (name: string) =>
  "UTF-8''" + encodeURIComponent(name).replace(/%20/g, " ");

function buildAttachments(attachments: Attachment[]) {
  const boundary =
    "----=_mail_" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const parts: string[] = [];
  for (const att of attachments) {
    parts.push(
      `--${boundary}\r\n` +
        `Content-Type: ${att.contentType || "application/octet-stream"}; name*=${encodedName(att.filename)}\r\n` +
        `Content-Disposition: attachment; filename*=${encodedName(att.filename)}\r\n` +
        `Content-Transfer-Encoding: base64\r\n\r\n` +
        b64wrap(att.content) +
        "\r\n"
    );
  }
  parts.push(`--${boundary}--\r\n`);
  return { boundary, parts };
}

class SmtpClient {
  private socket: any;
  private reader: any;
  private writer: any;
  private buffer = "";

  constructor(socket: any) {
    this.attach(socket);
  }

  attach(socket: any) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  async readLine(timeoutMs = 30_000): Promise<string> {
    const deadline = () =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP read timeout")), timeoutMs)
      );
    while (true) {
      if (this.buffer.includes("\n")) {
        const idx = this.buffer.indexOf("\n");
        const line = this.buffer.slice(0, idx).replace(/\r$/, "");
        this.buffer = this.buffer.slice(idx + 1);
        return line;
      }
      const { done, value } = await Promise.race([
        this.reader.read(),
        deadline(),
      ]);
      if (done) throw new Error("SMTP connection closed by server");
      this.buffer += new TextDecoder().decode(value);
    }
  }

  async readReply(): Promise<{ code: number; lines: string[] }> {
    let code = 0;
    let last = "";
    const lines: string[] = [];
    do {
      last = await this.readLine();
      lines.push(last);
      code = parseInt(last.slice(0, 3));
    } while (last[3] === "-");
    return { code, lines };
  }

  async sendRaw(text: string) {
    await this.writer.write(new TextEncoder().encode(text));
  }

  async cmd(text: string) {
    await this.sendRaw(text + "\r\n");
    return this.readReply();
  }
}

async function ehlo(client: SmtpClient, hostname: string) {
  const r = await client.cmd(`EHLO ${hostname}`);
  if (r.code !== 250) throw new Error(`EHLO failed: ${r.code}`);
  return r;
}

export async function sendMail(
  smtp: SmtpConfig,
  options: SendMailOptions
): Promise<string> {
  const { host, port, secure, user, pass } = smtp;
  const from = options.from || user;
  const { to, subject, html, attachments } = options;

  const socketOptions: any = { allowHalfOpen: true };
  if (secure) {
    socketOptions.secureTransport = "on";
  } else {
    socketOptions.secureTransport = "starttls";
  }

  // @ts-ignore - cloudflare:sockets is provided by Cloudflare Workers runtime
  const { connect } = await import("cloudflare:sockets");
  let socket = connect({ hostname: host, port }, socketOptions);
  try {
    await socket.opened;
  } catch {
    socket.close();
    throw new Error("SMTP connection failed");
  }

  const client = new SmtpClient(socket);

  const greeting = await client.readReply();
  if (greeting.code !== 220) {
    socket.close();
    throw new Error(`SMTP greeting failed: ${greeting.code}`);
  }

  await ehlo(client, host);

  if (!secure) {
    const r = await client.cmd("STARTTLS");
    if (r.code !== 220) {
      socket.close();
      throw new Error(`STARTTLS rejected: ${r.code}`);
    }
    socket = socket.startTls();
    client.attach(socket);
    await ehlo(client, host);
  }

  const auth = await client.cmd("AUTH PLAIN " + b64(`\0${user}\0${pass}`));
  if (auth.code !== 235) {
    socket.close();
    throw new Error(`Authentication failed: ${auth.code}`);
  }

  const mf = await client.cmd(`MAIL FROM:<${from}>`);
  if (mf.code !== 250) {
    socket.close();
    throw new Error(`MAIL FROM rejected: ${mf.code}`);
  }

  const rcpt = await client.cmd(`RCPT TO:<${to}>`);
  if (rcpt.code !== 250 && rcpt.code !== 251) {
    socket.close();
    throw new Error(`RCPT TO rejected: ${rcpt.code}`);
  }

  const data = await client.cmd("DATA");
  if (data.code !== 354) {
    socket.close();
    throw new Error(`DATA rejected: ${data.code}`);
  }

  const baseHeaders =
    `From: "Mailer" <${from}>\r\n` +
    `To: <${to}>\r\n` +
    `Subject: =?UTF-8?B?${b64(subject)}?=\r\n` +
    `MIME-Version: 1.0\r\n`;

  let body: string;
  if (attachments && attachments.length > 0) {
    const built = buildAttachments(attachments);
    body =
      baseHeaders +
      `Content-Type: multipart/mixed; boundary="${built.boundary}"\r\n\r\n` +
      `--${built.boundary}\r\n` +
      `Content-Type: text/html; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: 8bit\r\n\r\n` +
      html +
      "\r\n" +
      built.parts.join("");
  } else {
    body = baseHeaders + `Content-Type: text/html; charset=utf-8\r\n\r\n` + html;
  }

  const stuffed = body
    .split(/\r?\n/)
    .map((l) => (l.startsWith(".") ? "." + l : l))
    .join("\r\n");

  await client.sendRaw(stuffed + "\r\n.\r\n");
  const sent = await client.readReply();
  if (sent.code !== 250) {
    socket.close();
    throw new Error(`Message rejected: ${sent.code}`);
  }

  await client.cmd("QUIT").catch(() => {});
  socket.close();
  return sent.lines[0];
}
