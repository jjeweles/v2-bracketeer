import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addBowler,
  cloneSessionFromExisting,
  completeSession,
  createSession,
  deleteSession,
  deleteBowler,
  generateBrackets,
  getSessionSnapshot,
  listBowlers,
  listSessions,
  setOwedPaid,
  setPayoutPaid,
  setRefundPaid,
  updateBowler,
  upsertGameScores,
} from "./lib/engine";
import "./lib/db";

let pdfPolyfillsInstalled = false;

function installPdfPolyfills() {
  if (pdfPolyfillsInstalled) return;
  pdfPolyfillsInstalled = true;

  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix !== "function") {
    class SimpleDOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      constructor(_init?: unknown) {}
      multiplySelf(): this {
        return this;
      }
      preMultiplySelf(): this {
        return this;
      }
      translateSelf(): this {
        return this;
      }
      scaleSelf(): this {
        return this;
      }
      rotateSelf(): this {
        return this;
      }
      invertSelf(): this {
        return this;
      }
    }
    g.DOMMatrix = SimpleDOMMatrix;
  }
  if (typeof g.ImageData !== "function") {
    g.ImageData = class ImageData {
      constructor(_data?: unknown, _width?: unknown, _height?: unknown) {}
    };
  }
  if (typeof g.Path2D !== "function") {
    g.Path2D = class Path2D {};
  }
  if (typeof g.DOMMatrixReadOnly !== "function") {
    g.DOMMatrixReadOnly = g.DOMMatrix;
  }
  if (typeof g.OffscreenCanvas !== "function") {
    g.OffscreenCanvas = class OffscreenCanvas {
      constructor(_width?: unknown, _height?: unknown) {}
      getContext() {
        return null;
      }
    };
  }
  if (typeof g.HTMLCanvasElement !== "function") {
    g.HTMLCanvasElement = class HTMLCanvasElement {};
  }
  if (typeof g.CanvasRenderingContext2D !== "function") {
    g.CanvasRenderingContext2D = class CanvasRenderingContext2D {};
  }
}

async function parseLeagueSecretaryBowlerPdf(bytes: Uint8Array) {
  installPdfPolyfills();
  const mod = await import("./lib/pdf-import");
  return mod.parseLeagueSecretaryBowlerPdf(bytes);
}

function isUploadFileLike(value: unknown): value is { size: number; arrayBuffer: () => Promise<ArrayBuffer> } {
  if (!value || typeof value !== "object") return false;
  const maybe = value as { size?: unknown; arrayBuffer?: unknown };
  return typeof maybe.size === "number" && typeof maybe.arrayBuffer === "function";
}

const publicDir = join(process.cwd(), "src", "public");

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...(init?.headers ?? {}),
    },
  });
}

function badRequest(message: string) {
  return json({ error: message }, { status: 400 });
}

function notFound() {
  return json({ error: "Not found" }, { status: 404 });
}

function parseSessionId(pathname: string): number | null {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("sessions");
  if (idx < 0 || !parts[idx + 1]) {
    return null;
  }
  const n = Number(parts[idx + 1]);
  return Number.isFinite(n) ? n : null;
}

function parseResourceId(pathname: string, segment: string): number | null {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf(segment);
  if (idx < 0 || !parts[idx + 1]) {
    return null;
  }
  const n = Number(parts[idx + 1]);
  return Number.isFinite(n) ? n : null;
}

function staticFile(pathname: string): Response {
  const safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const full = join(publicDir, safePath);

  if (!full.startsWith(publicDir) || !existsSync(full)) {
    return new Response("Not found", { status: 404 });
  }

  const content = readFileSync(full);
  const ext = full.split(".").pop();
  const type =
    ext === "html"
      ? "text/html"
      : ext === "css"
      ? "text/css"
      : ext === "js"
      ? "text/javascript"
      : "application/octet-stream";

  return new Response(content, { headers: { "content-type": type } });
}

const PORT = Number(process.env.BRACKETEER_PORT ?? 3000);

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    try {
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
            "access-control-allow-headers": "content-type",
          },
        });
      }

      if (pathname === "/api/sessions" && req.method === "GET") {
        return json({ sessions: listSessions() });
      }

      if (pathname === "/api/sessions" && req.method === "POST") {
        const contentType = req.headers.get("content-type") ?? "";
        let body: {
          name: string;
          entryFeeDollars: number;
          handicapPercent: number;
          handicapBase: number;
          payoutFirstDollars: number;
          payoutSecondDollars: number;
        };
        let bowlerPdf: Uint8Array | null = null;

        if (contentType.includes("multipart/form-data")) {
          const form = await req.formData();
          body = {
            name: String(form.get("name") ?? ""),
            entryFeeDollars: Number(form.get("entryFeeDollars") ?? 5),
            handicapPercent: Number(form.get("handicapPercent") ?? 80),
            handicapBase: Number(form.get("handicapBase") ?? 220),
            payoutFirstDollars: Number(form.get("payoutFirstDollars") ?? 25),
            payoutSecondDollars: Number(form.get("payoutSecondDollars") ?? 10),
          };

          const file = form.get("bowlerPdf");
          if (isUploadFileLike(file) && file.size > 0) {
            bowlerPdf = new Uint8Array(await file.arrayBuffer());
          }
        } else {
          const jsonBody = await req.json();
          body = {
            name: String(jsonBody.name ?? ""),
            entryFeeDollars: Number(jsonBody.entryFeeDollars ?? 5),
            handicapPercent: Number(jsonBody.handicapPercent ?? 80),
            handicapBase: Number(jsonBody.handicapBase ?? 220),
            payoutFirstDollars: Number(jsonBody.payoutFirstDollars ?? 25),
            payoutSecondDollars: Number(jsonBody.payoutSecondDollars ?? 10),
          };
        }

        const created = createSession({
          name: body.name,
          entryFeeDollars: body.entryFeeDollars,
          handicapPercent: body.handicapPercent,
          handicapBase: body.handicapBase,
          payoutFirstDollars: body.payoutFirstDollars,
          payoutSecondDollars: body.payoutSecondDollars,
        });

        let importedBowlers = 0;
        let skippedBowlers = 0;

        if (bowlerPdf) {
          const parsedBowlers = await parseLeagueSecretaryBowlerPdf(bowlerPdf);
          const seen = new Set<string>();
          for (const parsed of parsedBowlers) {
            const key = parsed.name.toLowerCase();
            if (seen.has(key)) {
              skippedBowlers += 1;
              continue;
            }
            seen.add(key);
            addBowler((created as { id: number }).id, {
              name: parsed.name,
              average: parsed.average,
              scratchEntries: 0,
              handicapEntries: 0,
            });
            importedBowlers += 1;
          }
        }

        return json({ session: created, importedBowlers, skippedBowlers });
      }

      if (pathname.endsWith("/snapshot") && req.method === "GET") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        return json(getSessionSnapshot(sessionId));
      }

      if (pathname.endsWith("/clone") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        const body = await req.json().catch(() => ({}));
        const session = cloneSessionFromExisting(sessionId, body?.name ? String(body.name) : undefined);
        return json({ session });
      }

      if (pathname.endsWith("/complete") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        return json(completeSession(sessionId));
      }

      if (pathname.match(/^\/api\/sessions\/\d+$/) && req.method === "DELETE") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        return json(deleteSession(sessionId));
      }

      if (pathname.endsWith("/bowlers") && req.method === "GET") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        return json({ bowlers: listBowlers(sessionId) });
      }

      if (pathname.endsWith("/bowlers") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        const body = await req.json();
        const allBrackets = Boolean(body.allBrackets);
        const allBracketsMode =
          body.allBracketsMode === "both" || body.allBracketsMode === "scratch" || body.allBracketsMode === "handicap"
            ? body.allBracketsMode
            : allBrackets
            ? "both"
            : "off";
        const allBracketsCount = Number(body.allBracketsCount ?? (allBracketsMode === "off" ? 0 : 1));
        if (allBracketsMode !== "off" && (!Number.isFinite(allBracketsCount) || allBracketsCount < 1)) {
          return badRequest("All brackets count must be at least 1 when enabled");
        }
        const bowler = addBowler(sessionId, {
          name: String(body.name ?? ""),
          average: Number(body.average ?? 0),
          scratchEntries: Number(body.scratchEntries ?? 0),
          handicapEntries: Number(body.handicapEntries ?? 0),
          payLater: Boolean(body.payLater),
          allBracketsMode,
          allBracketsCount,
        });
        return json({ bowler });
      }

      if (pathname.endsWith("/import-bowlers-pdf") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        const form = await req.formData();
        const file = form.get("bowlerPdf");
        if (!isUploadFileLike(file) || file.size === 0) {
          return badRequest("PDF file is required");
        }

        const parsedBowlers = await parseLeagueSecretaryBowlerPdf(new Uint8Array(await file.arrayBuffer()));
        const existing = listBowlers(sessionId) as { name: string }[];
        const existingNames = new Set(existing.map((row) => row.name.trim().toLowerCase()));
        const seen = new Set<string>();

        let importedBowlers = 0;
        let skippedBowlers = 0;
        for (const parsed of parsedBowlers) {
          const key = parsed.name.trim().toLowerCase();
          if (!key || seen.has(key) || existingNames.has(key)) {
            skippedBowlers += 1;
            continue;
          }
          seen.add(key);
          addBowler(sessionId, {
            name: parsed.name,
            average: parsed.average,
            scratchEntries: 0,
            handicapEntries: 0,
          });
          importedBowlers += 1;
        }

        return json({ importedBowlers, skippedBowlers });
      }

      if (pathname.endsWith("/import-bowlers-bytes") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        const body = await req.json().catch(() => null);
        const pdfBase64 = String(body?.pdfBase64 ?? "");
        if (!pdfBase64) {
          return badRequest("pdfBase64 is required");
        }

        const parsedBowlers = await parseLeagueSecretaryBowlerPdf(new Uint8Array(Buffer.from(pdfBase64, "base64")));
        const existing = listBowlers(sessionId) as { name: string }[];
        const existingNames = new Set(existing.map((row) => row.name.trim().toLowerCase()));
        const seen = new Set<string>();

        let importedBowlers = 0;
        let skippedBowlers = 0;
        for (const parsed of parsedBowlers) {
          const key = parsed.name.trim().toLowerCase();
          if (!key || seen.has(key) || existingNames.has(key)) {
            skippedBowlers += 1;
            continue;
          }
          seen.add(key);
          addBowler(sessionId, {
            name: parsed.name,
            average: parsed.average,
            scratchEntries: 0,
            handicapEntries: 0,
          });
          importedBowlers += 1;
        }

        return json({ importedBowlers, skippedBowlers });
      }

      if (pathname.endsWith("/import-bowlers") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        const body = await req.json();
        const incoming = Array.isArray(body?.bowlers) ? body.bowlers : [];
        const existing = listBowlers(sessionId) as { name: string }[];
        const existingNames = new Set(existing.map((row) => row.name.trim().toLowerCase()));
        const seen = new Set<string>();

        let importedBowlers = 0;
        let skippedBowlers = 0;
        for (const row of incoming) {
          const name = String(row?.name ?? "").trim();
          const average = Number(row?.average ?? 0);
          const key = name.toLowerCase();
          if (!name || !Number.isFinite(average) || average < 0 || seen.has(key) || existingNames.has(key)) {
            skippedBowlers += 1;
            continue;
          }
          seen.add(key);
          addBowler(sessionId, {
            name,
            average,
            scratchEntries: 0,
            handicapEntries: 0,
          });
          importedBowlers += 1;
        }

        return json({ importedBowlers, skippedBowlers });
      }

      if (pathname.includes("/bowlers/") && req.method === "PATCH") {
        const sessionId = parseSessionId(pathname);
        const bowlerId = parseResourceId(pathname, "bowlers");
        if (!sessionId || !bowlerId) return badRequest("Invalid session or bowler id");
        const body = await req.json();
        const patch: {
          name?: string;
          average?: number;
          scratchEntries?: number;
          handicapEntries?: number;
          payLater?: boolean;
          allBracketsMode?: "off" | "both" | "scratch" | "handicap";
          allBracketsCount?: number;
        } = {};

        if (body.name != null) {
          const name = String(body.name).trim();
          if (!name) return badRequest("Name cannot be empty");
          patch.name = name;
        }
        if (body.average != null) {
          const average = Number(body.average);
          if (!Number.isFinite(average) || average < 0) {
            return badRequest("Average must be a non-negative number");
          }
          patch.average = average;
        }
        if (body.scratchEntries != null) {
          const scratchEntries = Number(body.scratchEntries);
          if (!Number.isFinite(scratchEntries) || scratchEntries < 0) {
            return badRequest("Scratch entries must be a non-negative number");
          }
          patch.scratchEntries = scratchEntries;
        }
        if (body.handicapEntries != null) {
          const handicapEntries = Number(body.handicapEntries);
          if (!Number.isFinite(handicapEntries) || handicapEntries < 0) {
            return badRequest("Handicap entries must be a non-negative number");
          }
          patch.handicapEntries = handicapEntries;
        }
        if (body.payLater != null) {
          patch.payLater = Boolean(body.payLater);
        }
        if (body.allBracketsMode != null) {
          const allBracketsMode =
            body.allBracketsMode === "both" ||
            body.allBracketsMode === "scratch" ||
            body.allBracketsMode === "handicap" ||
            body.allBracketsMode === "off"
              ? body.allBracketsMode
              : null;
          if (!allBracketsMode) {
            return badRequest("Invalid all brackets mode");
          }
          patch.allBracketsMode = allBracketsMode;
        }
        if (body.allBracketsCount != null) {
          const allBracketsCount = Number(body.allBracketsCount);
          if (!Number.isFinite(allBracketsCount) || allBracketsCount < 0) {
            return badRequest("All brackets count must be a non-negative number");
          }
          patch.allBracketsCount = allBracketsCount;
        }
        const nextAllEnabled = patch.allBracketsMode;
        const nextAllCount = patch.allBracketsCount;
        if (nextAllEnabled && nextAllEnabled !== "off" && nextAllCount != null && nextAllCount < 1) {
          return badRequest("All brackets count must be at least 1 when enabled");
        }

        if (Object.keys(patch).length === 0) {
          return badRequest("No valid fields provided");
        }

        const bowler = updateBowler(sessionId, bowlerId, patch);
        return json({ bowler });
      }

      if (pathname.includes("/bowlers/") && req.method === "DELETE") {
        const sessionId = parseSessionId(pathname);
        const bowlerId = parseResourceId(pathname, "bowlers");
        if (!sessionId || !bowlerId) return badRequest("Invalid session or bowler id");
        const result = deleteBowler(sessionId, bowlerId);
        return json(result);
      }

      if (pathname.includes("/refunds/") && pathname.endsWith("/paid") && req.method === "PATCH") {
        const sessionId = parseSessionId(pathname);
        const bowlerId = parseResourceId(pathname, "refunds");
        if (!sessionId || !bowlerId) return badRequest("Invalid session or bowler id");
        const body = await req.json();
        return json(setRefundPaid(sessionId, bowlerId, Boolean(body.paid)));
      }

      if (pathname.includes("/payouts/") && pathname.endsWith("/paid") && req.method === "PATCH") {
        const sessionId = parseSessionId(pathname);
        const bowlerId = parseResourceId(pathname, "payouts");
        if (!sessionId || !bowlerId) return badRequest("Invalid session or bowler id");
        const body = await req.json();
        return json(setPayoutPaid(sessionId, bowlerId, Boolean(body.paid)));
      }

      if (pathname.includes("/owes/") && pathname.endsWith("/paid") && req.method === "PATCH") {
        const sessionId = parseSessionId(pathname);
        const bowlerId = parseResourceId(pathname, "owes");
        if (!sessionId || !bowlerId) return badRequest("Invalid session or bowler id");
        const body = await req.json();
        return json(setOwedPaid(sessionId, bowlerId, Boolean(body.paid)));
      }

      if (pathname.endsWith("/generate-brackets") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        return json(generateBrackets(sessionId));
      }

      if (pathname.endsWith("/scores") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        const body = await req.json();
        const gameNumber = Number(body.gameNumber);
        if (![1, 2, 3].includes(gameNumber)) {
          return badRequest("gameNumber must be 1, 2, or 3");
        }

        const snapshot = getSessionSnapshot(sessionId) as any;
        const requiredRows = snapshot.requiredScorersByGame?.[`game${gameNumber}`] ?? [];
        const requiredIds = new Set(requiredRows.map((row: any) => Number(row.bowlerId)));

        if (requiredIds.size === 0) {
          return badRequest("No active bowlers require scores for this game yet");
        }

        const scores = Array.isArray(body.scores)
          ? body.scores.map((row: any) => ({
              bowlerId: Number(row.bowlerId),
              scratchScore: Number(row.scratchScore),
            }))
          : [];

        const submittedIds = new Set(scores.map((s) => s.bowlerId));
        if (submittedIds.size !== requiredIds.size || [...requiredIds].some((id) => !submittedIds.has(id))) {
          return badRequest("Scores must be provided for all active bowlers still alive for this game");
        }

        return json(upsertGameScores(sessionId, gameNumber, scores));
      }

      if (pathname.startsWith("/api/")) {
        return notFound();
      }

      return staticFile(pathname);
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error ? String((error as any).message) : "Unexpected error";
      const stack = error && typeof error === "object" && "stack" in error ? String((error as any).stack) : "";
      if (stack) {
        console.error(stack);
      } else {
        console.error(error);
      }
      const includeDetails = pathname.includes("/import-bowlers-pdf");
      return json(
        {
          error: message,
          details: includeDetails ? stack : undefined,
        },
        { status: 500 }
      );
    }
  },
});

console.log(`Server running on http://localhost:${PORT}`);
