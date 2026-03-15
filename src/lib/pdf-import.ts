import { PDFParse } from "pdf-parse";

type ImportedBowler = {
  name: string;
  average: number;
};

function normalizeLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function tryParseBowlerRow(lastName: string, combined: string): ImportedBowler | null {
  const normalized = normalizeLine(combined);
  const match = normalized.match(/^(.*?)\s+\d+\s+\d+\s+.*?\b[MW]\b\s+\d+\s+\d+\s+(\d+)\b/);
  if (!match) return null;

  const givenNames = normalizeLine(match[1]);
  const average = Number(match[2]);
  if (!givenNames || !Number.isFinite(average)) return null;

  return {
    name: `${givenNames} ${lastName}`.trim(),
    average,
  };
}

export async function parseLeagueSecretaryBowlerPdf(data: Uint8Array): Promise<ImportedBowler[]> {
  const parser = new PDFParse({ data });
  const textResult = await parser.getText();
  await parser.destroy();

  const lines = textResult.text.split("\n").map(normalizeLine);
  const parsed: ImportedBowler[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !line.endsWith(",")) continue;

    const lastName = line.slice(0, -1).trim();
    if (!lastName) continue;

    const chunks: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j];
      if (!next) continue;

      if (next.startsWith("League Secretary") || next.startsWith("Page ") || next.startsWith("-- ")) {
        continue;
      }
      if (next.startsWith("Name Team#")) {
        continue;
      }
      if (next.endsWith(",")) {
        break;
      }

      chunks.push(next);
      const candidate = tryParseBowlerRow(lastName, chunks.join(" "));
      if (candidate) {
        parsed.push(candidate);
        i = j;
        break;
      }
    }
  }

  return parsed;
}
