import { createRoute, z } from "@hono/zod-openapi";

// ====================================================
// CORE DATA SCHEMAS
// ====================================================

export const ErrorResponseSchema = z.object({
  error: z.string().openapi({ example: "Invalid request parameters" }),
}).openapi("ErrorResponse");

export const UserSchema = z.object({
  id: z.string().openapi({ example: "usr_admin_logixsoft" }),
  email: z.string().email().openapi({ example: "admin@logixsoft.in" }),
  name: z.string().openapi({ example: "Admin" }),
  role: z.enum(["admin", "user"]).openapi({ example: "admin" }),
  avatar_url: z.string().nullable().optional().openapi({ example: "/api/user/avatar/usr_admin_logixsoft" }),
  status_message: z.string().nullable().optional().openapi({ example: "High Velocity Dev" }),
  bio: z.string().nullable().optional(),
  signature: z.string().nullable().optional().openapi({ example: "Best regards,\nLogixSoft Executive Admin" }),
  sound_enabled: z.number().openapi({ example: 1 }),
  created_at: z.number().optional().openapi({ example: 1729600000 }),
}).openapi("User");

export const AuthResponseSchema = z.object({
  token: z.string().openapi({ example: "tq1Uc0nCAdmD2nEfWohAbjYDJRMrGTum" }),
  user: UserSchema,
}).openapi("AuthResponse");

export const LoginRequestSchema = z.object({
  email: z.string().email().openapi({ example: "admin@logixsoft.in" }),
  password: z.string().min(1).openapi({ example: "Vammavg@1605" }),
}).openapi("LoginRequest");

export const LabelSchema = z.object({
  id: z.string().openapi({ example: "lbl_finance_1" }),
  user_id: z.string().optional(),
  name: z.string().openapi({ example: "Finance" }),
  color: z.string().openapi({ example: "#12b886" }),
  created_at: z.number().optional(),
}).openapi("Label");

export const AttachmentSchema = z.object({
  id: z.string().openapi({ example: "att_1729600000_doc" }),
  message_id: z.string(),
  filename: z.string().openapi({ example: "invoice.pdf" }),
  content_type: z.string().openapi({ example: "application/pdf" }),
  size: z.number().openapi({ example: 1048576 }),
  created_at: z.number(),
}).openapi("Attachment");

export const EmailMessageSchema = z.object({
  id: z.string().openapi({ example: "msg_welcome_1" }),
  user_id: z.string().openapi({ example: "usr_admin_logixsoft" }),
  direction: z.enum(["inbound", "outbound"]).openapi({ example: "inbound" }),
  from_addr: z.string().openapi({ example: "system@cloudflare.com" }),
  to_addr: z.string().openapi({ example: "admin@logixsoft.in" }),
  cc_addr: z.string().nullable().optional(),
  subject: z.string().openapi({ example: "Welcome to LogixMail on Cloudflare Workers" }),
  snippet: z.string().optional().openapi({ example: "Your custom domain webmail suite is now fully active..." }),
  status: z.string().openapi({ example: "received" }),
  created_at: z.number().openapi({ example: 1729600000 }),
  read: z.number().openapi({ example: 1 }),
  starred: z.number().openapi({ example: 0 }),
  spam_verdict: z.string().nullable().optional().openapi({ example: "automated_transactional" }),
  clef_analysis: z.string().nullable().optional(),
  labels: z.array(LabelSchema).optional(),
  relevance_score: z.number().optional().openapi({ example: 95 }),
  ai_reason: z.string().optional().openapi({ example: "Matches billing criteria" }),
}).openapi("EmailMessage");

export const EmailDetailSchema = EmailMessageSchema.extend({
  text_body: z.string().nullable().optional(),
  html_body: z.string().nullable().optional(),
  attachments: z.array(AttachmentSchema).optional(),
}).openapi("EmailDetail");

export const MailboxAliasSchema = z.object({
  id: z.string().openapi({ example: "alias_support_1" }),
  email: z.string().email().openapi({ example: "support@logixsoft.in" }),
  mailbox_id: z.string().openapi({ example: "mbx_default" }),
  name: z.string().optional(),
  created_at: z.number().optional(),
}).openapi("MailboxAlias");

export const SendEmailRequestSchema = z.object({
  to: z.string().openapi({ example: "client@example.com" }),
  subject: z.string().openapi({ example: "Proposal for Cloudflare Migration" }),
  text: z.string().optional().openapi({ example: "Hello, please review the proposal attached." }),
  html: z.string().optional().openapi({ example: "<p>Hello, please review the proposal attached.</p>" }),
  from: z.string().optional().openapi({ example: "admin@logixsoft.in" }),
  cc: z.string().optional(),
  reply_to: z.string().optional(),
  in_reply_to: z.string().optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string().describe("Base64 encoded string"),
    contentType: z.string().optional(),
  })).optional(),
}).openapi("SendEmailRequest");

// AI Request Schemas
export const AiSummarizeRequestSchema = z.object({
  subject: z.string().openapi({ example: "Quarterly Performance Review" }),
  content: z.string().openapi({ example: "Team members showed outstanding velocity this quarter..." }),
}).openapi("AiSummarizeRequest");

export const AiQuickRepliesRequestSchema = z.object({
  subject: z.string().openapi({ example: "Meeting tomorrow at 3pm?" }),
  content: z.string().openapi({ example: "Can we sync tomorrow afternoon regarding edge deployment?" }),
  sender: z.string().optional().openapi({ example: "John Doe" }),
}).openapi("AiQuickRepliesRequest");

export const AiDraftRequestSchema = z.object({
  prompt: z.string().openapi({ example: "Accept the meeting and confirm 3pm works" }),
  recipient: z.string().optional().openapi({ example: "John Doe" }),
  context: z.string().optional().openapi({ example: "Regarding edge deployment discussion" }),
  tone: z.string().optional().openapi({ example: "professional" }),
}).openapi("AiDraftRequest");

export const ClefInspectRequestSchema = z.object({
  from: z.string().openapi({ example: "security-alert@suspicious-bank-link.com" }),
  subject: z.string().openapi({ example: "Urgent: Verify your account within 24 hours" }),
  body: z.string().openapi({ example: "Click here immediately to restore access to your account." }),
}).openapi("ClefInspectRequest");

export const ClefToneCheckRequestSchema = z.object({
  subject: z.string().openapi({ example: "Project Delay Notice" }),
  body: z.string().openapi({ example: "We will unfortunately need another 2 days to finalize QA." }),
  desired_tone: z.string().optional().openapi({ example: "collaborative_friendly" }),
}).openapi("ClefToneCheckRequest");

export const AiGlobalSearchRequestSchema = z.object({
  query: z.string().openapi({ example: "invoices and payments" }),
  mailbox_id: z.string().optional(),
}).openapi("AiGlobalSearchRequest");

export const UserProfileUpdateRequestSchema = z.object({
  name: z.string().optional().openapi({ example: "Admin User" }),
  status_message: z.string().optional().openapi({ example: "Available" }),
  bio: z.string().optional(),
  signature: z.string().optional(),
  sound_enabled: z.number().optional(),
  avatar_url: z.string().optional(),
}).openapi("UserProfileUpdateRequest");

export const AdminCreateUserRequestSchema = z.object({
  email: z.string().email().openapi({ example: "support@logixsoft.in" }),
  name: z.string().openapi({ example: "Support Team" }),
  password: z.string().min(6).openapi({ example: "SecurePass123!" }),
  role: z.enum(["admin", "user"]).default("user"),
}).openapi("AdminCreateUserRequest");

// ====================================================
// OPENAPI ROUTE DEFINITIONS
// ====================================================

export const loginRoute = createRoute({
  method: "post",
  path: "/api/auth/login",
  tags: ["Authentication"],
  summary: "User Sign In",
  description: "Authenticate with email and password via Better Auth session management.",
  request: {
    body: {
      content: { "application/json": { schema: LoginRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: AuthResponseSchema } },
      description: "Successfully authenticated with session cookie and token.",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid credentials.",
    },
  },
});

export const meRoute = createRoute({
  method: "get",
  path: "/api/auth/me",
  tags: ["Authentication"],
  summary: "Get Current Active Session",
  description: "Retrieve authenticated user details and preferences.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ user: UserSchema }) } },
      description: "Current authenticated user profile.",
    },
    401: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Unauthorized session.",
    },
  },
});

export const getMessagesRoute = createRoute({
  method: "get",
  path: "/api/messages",
  tags: ["Messages"],
  summary: "List Messages & AI Semantic Search",
  description: "Query messages by folder, label, or search string with Workers AI semantic evaluation.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    query: z.object({
      folder: z.string().optional().default("inbox").openapi({ example: "inbox" }),
      search: z.string().optional().openapi({ example: "billing document" }),
      label: z.string().optional(),
      limit: z.string().optional().default("50"),
      offset: z.string().optional().default("0"),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            messages: z.array(EmailMessageSchema),
            ai_summary: z.string().nullable().optional(),
            is_ai_search: z.boolean().optional(),
          }),
        },
      },
      description: "List of emails matching query.",
    },
  },
});

export const getMessageDetailRoute = createRoute({
  method: "get",
  path: "/api/messages/{id}",
  tags: ["Messages"],
  summary: "Get Full Message Details",
  description: "Fetch complete email body (HTML and plaintext), attachments, Clef spam/tone analysis, and labels.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().openapi({ example: "msg_welcome_1" }),
    }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ message: EmailDetailSchema }) } },
      description: "Detailed message object.",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Message not found.",
    },
  },
});

export const sendMessageRoute = createRoute({
  method: "post",
  path: "/api/messages/send",
  tags: ["Messages"],
  summary: "Send Email (Edge SMTP)",
  description: "Dispatch an outbound email natively via Cloudflare Workers Send Email binding.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: SendEmailRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean(), id: z.string() }) } },
      description: "Message sent and stored successfully.",
    },
  },
});

export const getLabelsRoute = createRoute({
  method: "get",
  path: "/api/labels",
  tags: ["Labels"],
  summary: "List Labels",
  description: "Retrieve all customizable email category labels for the user.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ labels: z.array(LabelSchema) }) } },
      description: "List of labels.",
    },
  },
});

export const createLabelRoute = createRoute({
  method: "post",
  path: "/api/labels",
  tags: ["Labels"],
  summary: "Create Label",
  description: "Create a new tag label with custom name and color hex.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().min(1).openapi({ example: "VIP Clients" }),
            color: z.string().default("#0ca678").openapi({ example: "#0ca678" }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: z.object({ label: LabelSchema }) } },
      description: "Label created.",
    },
  },
});

export const deleteLabelRoute = createRoute({
  method: "delete",
  path: "/api/labels/{id}",
  tags: ["Labels"],
  summary: "Delete Label",
  description: "Remove an email category label.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Label deleted.",
    },
  },
});

export const aiSummarizeRoute = createRoute({
  method: "post",
  path: "/api/ai/summarize",
  tags: ["Workers AI & Clef"],
  summary: "Generate Email Summary",
  description: "Summarize email thread content into concise bullet points using Cloudflare Workers AI.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: AiSummarizeRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ summary: z.string() }) } },
      description: "Synthesized AI summary.",
    },
  },
});

export const clefInspectRoute = createRoute({
  method: "post",
  path: "/api/ai/clef-inspect",
  tags: ["Workers AI & Clef"],
  summary: "Clef Security & Tone Inspection",
  description: "Comprehensive AI evaluation analyzing phishing probability, urgency score, communication tone, and recommended safety actions.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: ClefInspectRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ analysis: z.any() }) } },
      description: "Clef inspection report.",
    },
  },
});

export const clefToneCheckRoute = createRoute({
  method: "post",
  path: "/api/ai/clef-tone-check",
  tags: ["Workers AI & Clef"],
  summary: "Outgoing Email Tone Checker",
  description: "Analyzes draft email text before dispatch to verify professional tone, alignment, and actionable feedback.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: ClefToneCheckRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ toneCheck: z.any() }) } },
      description: "Clef outgoing tone analysis.",
    },
  },
});

export const getUserProfileRoute = createRoute({
  method: "get",
  path: "/api/user/profile",
  tags: ["User Profile"],
  summary: "Get User Profile",
  description: "Retrieve profile preferences, avatar URL, signature, and sound notification settings.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ user: UserSchema }) } },
      description: "User profile.",
    },
  },
});

export const updateUserProfileRoute = createRoute({
  method: "patch",
  path: "/api/user/profile",
  tags: ["User Profile"],
  summary: "Update Profile Settings",
  description: "Update display name, signature, status message, bio, or sound notification settings.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: UserProfileUpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ user: UserSchema }) } },
      description: "Updated user profile.",
    },
  },
});

export const adminGetUsersRoute = createRoute({
  method: "get",
  path: "/api/admin/users",
  tags: ["Admin Operations"],
  summary: "List System Users",
  description: "Admin view of all provisioned users, roles, and status.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ users: z.array(UserSchema) }) } },
      description: "List of users.",
    },
    403: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Admin privilege required.",
    },
  },
});

export const getAliasesRoute = createRoute({
  method: "get",
  path: "/api/aliases",
  tags: ["Mailboxes & Aliases"],
  summary: "List Active Aliases & Mailboxes",
  description: "Get all personal and dynamically routed catch-all email addresses for the user on logixsoft.in.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ aliases: z.array(MailboxAliasSchema) }) } },
      description: "List of mailboxes and aliases.",
    },
  },
});

export const starMessageRoute = createRoute({
  method: "post",
  path: "/api/messages/{id}/star",
  tags: ["Messages"],
  summary: "Toggle Star Status",
  description: "Mark an email as starred or unstarred.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ starred: z.boolean().optional() }) } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean(), starred: z.number() }) } },
      description: "Star status updated.",
    },
  },
});

export const trashMessageRoute = createRoute({
  method: "post",
  path: "/api/messages/{id}/trash",
  tags: ["Messages"],
  summary: "Move Message to Trash",
  description: "Move an email message to trash or permanently delete if already in trash.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Message moved to trash.",
    },
  },
});

export const updateMessageLabelsRoute = createRoute({
  method: "post",
  path: "/api/messages/{id}/labels",
  tags: ["Messages"],
  summary: "Update Message Labels",
  description: "Assign or replace tags and categories on an email message.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ label_ids: z.array(z.string()) }) } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean(), labels: z.array(LabelSchema) }) } },
      description: "Message labels updated.",
    },
  },
});

export const downloadAttachmentRoute = createRoute({
  method: "get",
  path: "/api/attachments/{id}/download",
  tags: ["Attachments"],
  summary: "Download File Attachment",
  description: "Stream binary attachment file from Cloudflare R2 object storage.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({ token: z.string().optional() }),
  },
  responses: {
    200: {
      description: "Binary file stream with Content-Disposition header.",
    },
  },
});

export const previewAttachmentRoute = createRoute({
  method: "get",
  path: "/api/attachments/{id}/preview",
  tags: ["Attachments"],
  summary: "Preview Attachment Inline",
  description: "Stream attachment for inline browser viewing (PDF, PNG, JPG, WebP).",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({ token: z.string().optional() }),
  },
  responses: {
    200: {
      description: "Inline preview file stream.",
    },
  },
});

export const deleteAttachmentRoute = createRoute({
  method: "delete",
  path: "/api/attachments/{id}",
  tags: ["Attachments"],
  summary: "Delete Attachment",
  description: "Remove attachment object from R2 and delete database metadata.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Attachment removed.",
    },
  },
});

export const aiQuickRepliesRoute = createRoute({
  method: "post",
  path: "/api/ai/quick-replies",
  tags: ["Workers AI & Clef"],
  summary: "Generate Suggested Quick Replies",
  description: "Produces 3 contextual 1-click quick replies using Workers AI Llama 3.1.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: AiQuickRepliesRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ replies: z.array(z.string()) }) } },
      description: "List of suggested quick replies.",
    },
  },
});

export const aiDraftRoute = createRoute({
  method: "post",
  path: "/api/ai/draft",
  tags: ["Workers AI & Clef"],
  summary: "AI Email Draft Assistant",
  description: "Generates or refines email draft text from a prompt or previous message context.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: AiDraftRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ draft: z.string() }) } },
      description: "Generated draft text.",
    },
  },
});

export const aiGlobalSearchRoute = createRoute({
  method: "post",
  path: "/api/ai/global-search",
  tags: ["Workers AI & Clef"],
  summary: "AI Semantic Global Search",
  description: "Searches all user emails semantically using Workers AI and Clef entity signals.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: AiGlobalSearchRequestSchema } },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(EmailMessageSchema),
            ai_summary: z.string(),
            count: z.number(),
          }),
        },
      },
      description: "Ranked semantic search results.",
    },
  },
});

export const uploadUserAvatarRoute = createRoute({
  method: "post",
  path: "/api/user/avatar",
  tags: ["User Profile"],
  summary: "Upload User Avatar",
  description: "Uploads avatar image to Cloudflare R2 and updates user profile avatar URL.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            imageBase64: z.string(),
            mimeType: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ avatar_url: z.string() }) } },
      description: "Avatar URL.",
    },
  },
});

export const getUserAvatarRoute = createRoute({
  method: "get",
  path: "/api/user/avatar/{id}",
  tags: ["User Profile"],
  summary: "Get Avatar Image",
  description: "Fetches user avatar image from R2 with edge caching.",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Avatar image binary stream.",
    },
  },
});

export const adminCreateUserRoute = createRoute({
  method: "post",
  path: "/api/admin/users",
  tags: ["Admin Operations"],
  summary: "Admin Create User",
  description: "Provision a new user account with mailbox on logixsoft.in.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: { "application/json": { schema: AdminCreateUserRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean(), user: UserSchema }) } },
      description: "User created.",
    },
  },
});

export const adminUpdateUserRoute = createRoute({
  method: "patch",
  path: "/api/admin/users/{id}",
  tags: ["Admin Operations"],
  summary: "Admin Update User",
  description: "Update user role, enable/disable account, or reset password.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            disabled: z.boolean().optional(),
            role: z.enum(["admin", "user"]).optional(),
            password: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "User updated.",
    },
  },
});

export const adminGetAliasesRoute = createRoute({
  method: "get",
  path: "/api/admin/aliases",
  tags: ["Admin Operations"],
  summary: "Admin List All Routing Aliases",
  description: "Get all domain mailbox aliases configured across all users.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ mailboxes: z.array(z.any()), aliases: z.array(z.any()) }) } },
      description: "All aliases and mailboxes.",
    },
  },
});

export const adminCreateAliasRoute = createRoute({
  method: "post",
  path: "/api/admin/aliases",
  tags: ["Admin Operations"],
  summary: "Admin Create Alias",
  description: "Attach a new email alias to a mailbox.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            mailbox_id: z.string(),
            local_part: z.string(),
            domain_id: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean(), alias: z.any() }) } },
      description: "Alias created.",
    },
  },
});

export const adminDeleteAliasRoute = createRoute({
  method: "delete",
  path: "/api/admin/aliases/{id}",
  tags: ["Admin Operations"],
  summary: "Admin Delete Alias",
  description: "Remove an alias from a mailbox.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
      description: "Alias deleted.",
    },
  },
});

export const adminGetLogsRoute = createRoute({
  method: "get",
  path: "/api/admin/system-logs",
  tags: ["Admin Operations"],
  summary: "Admin System & Ingestion Logs",
  description: "Fetch recent Cloudflare Workers email routing events, inbound bounces, and error audit trail.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ logs: z.array(z.any()) }) } },
      description: "Recent system logs.",
    },
  },
});

export const realtimeEventsRoute = createRoute({
  method: "get",
  path: "/api/events",
  tags: ["Realtime SSE"],
  summary: "Server-Sent Events Stream",
  description: "Connect to live Server-Sent Events (SSE) stream via Cloudflare Durable Object for real-time mail notifications.",
  security: [{ BearerAuth: [] }, { CookieAuth: [] }],
  request: {
    query: z.object({ token: z.string().optional() }),
  },
  responses: {
    200: {
      description: "Server-Sent Events stream (text/event-stream).",
    },
  },
});
