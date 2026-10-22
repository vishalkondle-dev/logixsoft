import { CONFIG } from "./config";

export interface D1QueryResult<T = any> {
  results: T[];
  success: boolean;
  meta?: any;
}

export async function queryD1<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/d1/database/${CONFIG.CF_D1_DATABASE_ID}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });

  const data = (await response.json()) as any;
  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message || "D1 query execution failed";
    console.error("D1 Error:", errorMsg, "for SQL:", sql);
    throw new Error(errorMsg);
  }

  return (data.result?.[0]?.results || []) as T[];
}

export async function executeD1(sql: string, params: any[] = []): Promise<boolean> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/d1/database/${CONFIG.CF_D1_DATABASE_ID}/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql,
      params,
    }),
  });

  const data = (await response.json()) as any;
  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message || "D1 execution failed";
    console.error("D1 Error:", errorMsg, "for SQL:", sql);
    throw new Error(errorMsg);
  }

  return true;
}
