import { parse } from "date-fns";

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

const classifyEntryKind = (description, debitKes, creditKes) => {
  const normalized = description.toLowerCase();
  if (normalized.includes("opening balance") || normalized.includes("closing balance")) {
    return "balance";
  }
  if (normalized.includes("reversal")) return debitKes > 0 ? "reversal" : "income";
  if (normalized.includes("transfer")) return debitKes > 0 ? "transfer" : "income";
  if (creditKes > 0) return "income";
  if (debitKes > 0) return "expense";
  return "other";
};

const groupLines = (items) => {
  const groups = new Map();

  for (const item of items) {
    const text = item?.str?.trim();
    if (!text) continue;
    const y = Math.round(item.transform[5]);
    const line = groups.get(y) || [];
    line.push(item);
    groups.set(y, line);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([y, lineItems]) => {
      const columns = {
        date: [],
        description: [],
        account: [],
        reference: [],
        debit: [],
        credit: [],
        balance: [],
      };

      for (const item of lineItems.sort((a, b) => a.transform[4] - b.transform[4])) {
        const x = item.transform[4];
        const text = item.str.trim();
        if (x < 100) columns.date.push(text);
        else if (x < 330) columns.description.push(text);
        else if (x < 375) columns.account.push(text);
        else if (x < 455) columns.reference.push(text);
        else if (x < 500) columns.debit.push(text);
        else if (x < 545) columns.credit.push(text);
        else columns.balance.push(text);
      }

      return { y, columns };
    });
};

const buildTransactions = (lines) => {
  const transactions = [];
  let current = null;

  const flush = () => {
    if (!current) return;

    const description = stripPageMarkers(current.descriptionParts.join(" ").replace(/\s+/g, " ").trim());
    const debitKes = toKes(stripPageMarkers(current.debitParts.join(" ")));
    const creditKes = toKes(stripPageMarkers(current.creditParts.join(" ")));
    const balanceText = stripPageMarkers(current.balanceParts.join(" ").trim());
    const balanceKes = balanceText ? toKes(balanceText) : null;
    const entryKind = classifyEntryKind(description, debitKes, creditKes);

    if (entryKind !== "balance" && (debitKes > 0 || creditKes > 0)) {
      transactions.push({
        transactionAt: new Date(current.timestamp.replace(" ", "T")).toISOString(),
        description,
        accountNumber: stripPageMarkers(current.accountParts.join(" ").trim()) || null,
        reference: stripPageMarkers(current.referenceParts.join(" ").replace(/\s+/g, "").trim()) || null,
        debitKes,
        creditKes,
        balanceKes,
        entryKind,
        rawText: stripPageMarkers(
          [
            current.timestamp,
            description,
            current.accountParts.join(" "),
            current.referenceParts.join(" "),
            current.debitParts.join(" "),
            current.creditParts.join(" "),
            current.balanceParts.join(" "),
          ].join(" | "),
        ),
      });
    }

    current = null;
  };

  for (const line of lines) {
    const timestamp = stripPageMarkers(line.columns.date.join(" ").trim());

    if (TIMESTAMP_RE.test(timestamp)) {
      flush();
      current = {
        timestamp,
        descriptionParts: [...line.columns.description],
        accountParts: [...line.columns.account],
        referenceParts: [...line.columns.reference],
        debitParts: [...line.columns.debit],
        creditParts: [...line.columns.credit],
        balanceParts: [...line.columns.balance],
      };
      continue;
    }

    if (!current) continue;
    current.descriptionParts.push(...line.columns.description);
    current.accountParts.push(...line.columns.account);
    current.referenceParts.push(...line.columns.reference);
    current.debitParts.push(...line.columns.debit);
    current.creditParts.push(...line.columns.credit);
    current.balanceParts.push(...line.columns.balance);
  }

  flush();
  return transactions;
};

const parseStatementPdf = async (fileBytes) => {
  if (typeof globalThis.DOMMatrix === "undefined") {
    const canvas = await import("@napi-rs/canvas");
    globalThis.DOMMatrix = canvas.DOMMatrix;
    globalThis.DOMPoint = canvas.DOMPoint;
    globalThis.DOMRect = canvas.DOMRect;
    globalThis.ImageData = canvas.ImageData;
    globalThis.Path2D = canvas.Path2D;
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data: fileBytes, disableWorker: true }).promise;
  const parsedLines = [];
  const allLineTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageItems = textContent.items.filter((item) => "str" in item);
    const pageLines = groupLines(pageItems);
    parsedLines.push(...pageLines);
    allLineTexts.push(
      ...pageLines.map((line) =>
        stripPageMarkers(
          [
            line.columns.date.join(" "),
            line.columns.description.join(" "),
            line.columns.account.join(" "),
            line.columns.reference.join(" "),
            line.columns.debit.join(" "),
            line.columns.credit.join(" "),
            line.columns.balance.join(" "),
          ]
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        ),
      ),
    );
  }

  const sourceName = allLineTexts.find((line) => line.toLowerCase().includes("kopokopo")) ? "Kopo Kopo" : "Payment statement";
  const periodLine = allLineTexts.find((line) => PERIOD_RE.test(line.trim())) || "";
  const { statementFrom, statementTo } = parseStatementPeriod(periodLine);
  const transactions = buildTransactions(parsedLines);

  if (transactions.length === 0) {
    throw new Error("No transactions were found in that statement.");
  }

  return {
    sourceName,
    statementFrom,
    statementTo,
    transactions,
  };
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
