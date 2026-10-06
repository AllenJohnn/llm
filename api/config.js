// Public, non-secret runtime settings used by the browser client.
function isEnabled(value) {
  return value === true || value === 1 || /^(true|1|yes|on)$/i.test(String(value ?? "").trim());
}

export default function handler(_req, res) {
  const configuredMode = process.env.FALLBACKMODE;
  const body = JSON.stringify({ FALLBACKMODE: configuredMode == null ? false : isEnabled(configuredMode) });
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
  if (res) {
    res.statusCode = 200;
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    res.end(body);
    return;
  }
  return new Response(body, { headers });
}
