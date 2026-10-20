interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  APP_NAME?: string;
  APP_ENV?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await env.ASSETS.fetch(request);
    
    // Inject enhanced security and hardware permission headers
    const headers = new Headers(response.headers);
    headers.set("Permissions-Policy", "camera=(self), screen-wake-lock=(self)");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
