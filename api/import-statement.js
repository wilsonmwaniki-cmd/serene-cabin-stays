import { parse } from "date-fns";
import { PDFParse } from "pdf-parse";

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const PERIOD_RE = /^[A-Za-z]+, [A-Za-z]+ \d{2} \d{4} - [A-Za-z]+, [A-Za-z]+ \d{2} \d{4}$/;

const toKes = (value) => {
  const normalized = String(value || "")
    .replace(/,/g, "")
    .trim();
  if (!normalized) return 0;
  return Math.round(Number.parseFloat(normalized) || 0);
};

const parseStatementPeriod = (line) => {
  if (!PERIOD_RE.test(String(line || "").trim())) return { statementFrom: null, statementTo: null };
  const [fromLabel, toLabel] = line.split(" - ");
  try {
    const from = parse(fromLabel.trim(), "EEEE, MMMM dd yyyy", new Date()).toISOString().slice(0, 10);
    const to = parse(toLabel.trim(), "EEEE, MMMM dd yyyy", new Date()).toISOString().slice(0, 10);
    return { statementFrom: from, statementTo: to };
  } catch {
    return { statementFrom: null, statementTo: null };
  }
};

const stripPageMarkers = (value) =>
  String(value || "")
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
    .replace(/\b\d+\s+of\s+\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const splitTransactionBlocks = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let currentBlock = null;

  for (const line of lines) {
    const timestamp = line.slice(0, 19);
    if (TIMESTAMP_RE.test(timestamp)) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = line;
      continue;
    }

    if (currentBlock) {
      currentBlock += ` ${line}`;
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return blocks.map(stripPageMarkers);
};

const classifyTransaction = (description, amountKes) => {
  const normalized = description.toLowerCase();

  if (normalized.includes("opening balance") || normalized.includes("closing balance")) {
    return { entryKind: "balance", debitKes: 0, creditKes: 0 };
  }

  if (normalized.includes("received payment") || normalized.includes("bank to till")) {
    return { entryKind: "income", debitKes: 0, creditKes: amountKes };
  }

  if (normalized.includes("reversal")) {
    return { entryKind: "reversal", debitKes: 0, creditKes: amountKes };
  }

  if (normalized.includes("transfer charge")) {
    return { entryKind: "transfer", debitKes: amountKes, creditKes: 0 };
  }

  if (normalized.includes("transfer of")) {
    return { entryKind: "transfer", debitKes: amountKes, creditKes: 0 };
  }

  if (normalized.includes("fee") || normalized.includes("charge")) {
    return { entryKind: "expense", debitKes: amountKes, creditKes: 0 };
  }

  return { entryKind: "other", debitKes: 0, creditKes: amountKes };
};

const parseTransactionBlock = (block) => {
  const timestamp = block.slice(0, 19);
  if (!TIMESTAMP_RE.test(timestamp)) return null;

  const body = block.slice(19).trim();
  const normalizedBody = body.toLowerCase();
  if (normalizedBody.startsWith("closing balance") || normalizedBody.startsWith("opening balance")) {
    return null;
  }

  const amountMatch = body.match(/(\d[\d,]*\.\d{2})(?:\s+(\d[\d,]*\.\d{2}))?\s*$/);
  if (!amountMatch) return null;

  const amountKes = toKes(amountMatch[1]);
  const balanceKes = amountMatch[2] ? toKes(amountMatch[2]) : amountKes;
  const detailText = body.slice(0, amountMatch.index).trim();

  const detailMatch = detailText.match(/^(.*?)(?:\s+(\d{6,}))?(?:\s+([A-Za-z0-9,.-]+))?$/);
  const description = (detailMatch?.[1] || detailText).trim();
  const accountNumber = detailMatch?.[2] || null;
  const reference = detailMatch?.[3] ? detailMatch[3].replace(/\s+/g, "") : null;

  const classified = classifyTransaction(description, amountKes);
  if (classified.entryKind === "balance") return null;

  return {
    transactionAt: new Date(timestamp.replace(" ", "T")).toISOString(),
    description,
    accountNumber,
    reference,
    debitKes: classified.debitKes,
    creditKes: classified.creditKes,
    balanceKes,
    entryKind: classified.entryKind,
    rawText: block,
  };
};

const parseStatementPdf = async (fileBytes) => {
  const parser = new PDFParse({ data: fileBytes });

  try {
    const textResult = await parser.getText();
    const plainText = textResult.text || "";
    const sourceName = plainText.toLowerCase().includes("kopokopo") ? "Kopo Kopo" : "Payment statement";
    const periodLine = plainText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => PERIOD_RE.test(line)) || "";
    const { statementFrom, statementTo } = parseStatementPeriod(periodLine);

    const transactions = splitTransactionBlocks(plainText)
      .map(parseTransactionBlock)
      .filter(Boolean);

    if (transactions.length === 0) {
      throw new Error("No transactions were found in that statement.");
    }

    return {
      sourceName,
      statementFrom,
      statementTo,
      transactions,
    };
  } finally {
    await parser.destroy();
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { fileBase64 } = req.body || {};
    if (!fileBase64) {
      return res.status(400).json({ error: "Statement file is missing." });
    }

    const fileBytes = Uint8Array.from(Buffer.from(fileBase64, "base64"));
    const parsed = await parseStatementPdf(fileBytes);
    return res.status(200).json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read that statement.";
    return res.status(500).json({ error: message });
  }
}
