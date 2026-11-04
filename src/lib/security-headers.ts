/**
 * Security headeri za svaki odgovor (Faza 0, srednji nalaz S6: nema headera).
 *
 * Namjerno konzervativan skup koji ne moze slomiti PWA:
 *  - mikrofon ostaje dopusten (glasovne biljeske), kamera/geolokacija ne
 *  - umjesto punog CSP-a samo frame-ancestors: TanStack Start hidratacija
 *    koristi inline skripte pa bi script-src zahtijevao nonce infrastrukturu;
 *    svjesno odgodjeno, ne zaboravljeno
 */

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(self)",
};

function setAll(headers: Headers): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
}

/** Adds the headers in place when possible, otherwise re-wraps the response. */
export function withSecurityHeaders(response: Response): Response {
  try {
    setAll(response.headers);
    return response;
  } catch {
    const rewrapped = new Response(response.body, response);
    setAll(rewrapped.headers);
    return rewrapped;
  }
}
