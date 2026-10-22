export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3080,
  CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID || "08b6dbcf3a926b3d07b19715e05efd2b",
  CF_API_TOKEN: process.env.CF_API_TOKEN || "cfut_MtfGX2qAh6bOpf5hbKb0Q4Ta3pcBb5xyX7uyM5Jk208e28b1",
  CF_D1_DATABASE_ID: process.env.CF_D1_DATABASE_ID || "5fa501f6-150d-4ba7-8dcc-795e913bb343",
  DOMAIN: "logixsoft.in",
  JWT_SECRET: process.env.JWT_SECRET || "logixsoft_mail_ultra_secret_key_2026_teal",
};
