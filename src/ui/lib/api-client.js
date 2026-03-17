let baseUrlCache = "";

export async function api(path, init) {
  const inBrowser = typeof window !== "undefined" && Boolean(window.location);
  const protocol = inBrowser ? window.location.protocol : "";
  const host = inBrowser ? window.location.hostname : "";
  const isTauri = protocol === "tauri:";
  const shouldTryLocalBackend = isTauri || host === "localhost" || host === "127.0.0.1" || host === "";
  if (!baseUrlCache) {
    baseUrlCache = isTauri ? "http://127.0.0.1:31337" : shouldTryLocalBackend ? "http://127.0.0.1:3000" : "";
  }

  const baseCandidates = isTauri
    ? ["http://127.0.0.1:31337"]
    : shouldTryLocalBackend
      ? [baseUrlCache, "http://127.0.0.1:3000", ""]
      : [""];

  const headers = new Headers(init?.headers ?? {});
  const maybeBody = init?.body;
  const isFormDataBody = Boolean(
    maybeBody &&
      typeof maybeBody === "object" &&
      typeof maybeBody.append === "function" &&
      typeof maybeBody.get === "function",
  );

  if (!isFormDataBody && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  let lastErr = null;
  let lastApiError = null;
  for (const baseUrl of baseCandidates) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        headers,
        ...init,
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok) {
        if (data == null || typeof data !== "object") {
          const raw = await res.text().catch(() => "");
          throw new Error(`Invalid API response from ${url} (status ${res.status})${raw ? `: ${raw.slice(0, 120)}` : ""}`);
        }
        baseUrlCache = baseUrl;
        return data;
      }

      if (res.status === 404) {
        lastApiError = new Error(data?.error || `Request failed (${res.status})`);
        continue;
      }

      throw new Error(`${data?.error || `Request failed (${res.status}) at ${url}`}${data?.details ? `\n${data.details}` : ""}`);
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr ?? lastApiError ?? new Error("API unavailable");
}
