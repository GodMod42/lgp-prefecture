/** Netlify proxy from same-origin /api/* requests to the Python Discord bot. */
export default async function handler(request) {
  const configuredUrl = process.env.BOT_API_URL;
  if (!configuredUrl) {
    return Response.json({ error: "api_not_configured" }, { status: 503 });
  }

  const incoming = new URL(request.url);
  let upstream;
  try {
    upstream = new URL(configuredUrl);
  } catch {
    return Response.json({ error: "api_not_configured" }, { status: 503 });
  }
  if (upstream.protocol !== "https:") {
    return Response.json({ error: "api_requires_https" }, { status: 503 });
  }

  const suffix = incoming.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  upstream.pathname = `${upstream.pathname.replace(/\/$/, "")}${suffix}`;
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  for (const name of ["host", "connection", "content-length", "transfer-encoding", "accept-encoding"])
    headers.delete(name);
  headers.set("X-Forwarded-Host", incoming.host);

  try {
    const response = await fetch(new Request(upstream, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      duplex: ["GET", "HEAD"].includes(request.method) ? undefined : "half",
      redirect: "manual",
    }));
    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json({ error: "api_unavailable" }, { status: 502 });
  }
}

export const config = { path: "/api/*" };
