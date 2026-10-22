export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
}

export interface Alias {
  id: string;
  address: string;
  displayName: string;
  isPrimary?: boolean;
}

export interface EmailMessage {
  id: string;
  user_id: string;
  direction: "inbound" | "outbound";
  from_addr: string;
  to_addr: string;
  cc_addr?: string;
  bcc_addr?: string;
  subject: string;
  snippet?: string;
  status: string;
  created_at: number;
  read: number;
  starred: number;
  in_reply_to?: string;
  text_body?: string;
  html_body?: string;
  spam_verdict?: string;
}

export interface Attachment {
  id: string;
  message_id: string;
  filename: string;
  mime_type?: string;
  content_type?: string;
  size_bytes?: number;
  size?: number;
  r2_key?: string;
}
