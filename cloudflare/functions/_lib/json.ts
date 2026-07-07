// JSON response helpers, mirroring the Go writeJSON/writeErr.
export function json(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  });
}

export function err(status: number, message: string): Response {
  return json({ error: message }, status);
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

// Parse a JSON request body, tolerating an empty body (returns {}).
export async function readJSON<T>(request: Request): Promise<T> {
  try {
    const text = await request.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    return {} as T;
  }
}
