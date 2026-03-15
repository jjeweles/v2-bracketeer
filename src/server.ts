import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  addBowler,
  createSession,
  deleteBowler,
  generateBrackets,
  getSessionSnapshot,
  listBowlers,
  listSessions,
  updateBowler,
  upsertGameScores,
} from "./lib/engine";
import "./lib/db";
import { parseLeagueSecretaryBowlerPdf } from "./lib/pdf-import";

const publicDir = join(process.cwd(), "src", "public");

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      "content-type": "application/json",
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

function parseBowlerId(pathname: string): number | null {
  const parts = pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("bowlers");
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

Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    try {
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
          if (file instanceof File && file.size > 0) {
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

      if (pathname.endsWith("/bowlers") && req.method === "GET") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        return json({ bowlers: listBowlers(sessionId) });
      }

      if (pathname.endsWith("/bowlers") && req.method === "POST") {
        const sessionId = parseSessionId(pathname);
        if (!sessionId) return badRequest("Invalid session id");
        const body = await req.json();
        const bowler = addBowler(sessionId, {
          name: String(body.name ?? ""),
          average: Number(body.average ?? 0),
          scratchEntries: Number(body.scratchEntries ?? 0),
          handicapEntries: Number(body.handicapEntries ?? 0),
        });
        return json({ bowler });
      }

      if (pathname.includes("/bowlers/") && req.method === "PATCH") {
        const sessionId = parseSessionId(pathname);
        const bowlerId = parseBowlerId(pathname);
        if (!sessionId || !bowlerId) return badRequest("Invalid session or bowler id");
        const body = await req.json();
        const patch: {
          name?: string;
          average?: number;
          scratchEntries?: number;
          handicapEntries?: number;
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

        if (Object.keys(patch).length === 0) {
          return badRequest("No valid fields provided");
        }

        const bowler = updateBowler(sessionId, bowlerId, patch);
        return json({ bowler });
      }

      if (pathname.includes("/bowlers/") && req.method === "DELETE") {
        const sessionId = parseSessionId(pathname);
        const bowlerId = parseBowlerId(pathname);
        if (!sessionId || !bowlerId) return badRequest("Invalid session or bowler id");
        const result = deleteBowler(sessionId, bowlerId);
        return json(result);
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
      const message = error instanceof Error ? error.message : "Unexpected error";
      return json({ error: message }, { status: 500 });
    }
  },
});

console.log("Server running on http://localhost:3000");
