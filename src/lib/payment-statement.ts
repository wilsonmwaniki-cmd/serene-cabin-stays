import { parse } from "date-fns";
import type { TablesInsert } from "@/integrations/supabase/types";

type BusinessArea = TablesInsert<"statement_imports">["business_area"];
type StatementEntryKind = TablesInsert<"statement_transactions">["entry_kind"];

type TextItem = {
  str: string;
  transform: number[];
};

export type ParsedStatementTransaction = {
  transactionAt: string;
  description: string;
  accountNumber: string | null;
  reference: string | null;
  debitKes: number;
  creditKes: number;
  balanceKes: number | null;
  entryKind: StatementEntryKind;
  rawText: string;
};

export type ParsedStatement = {
  sourceName: string;
  statementFrom: string | null;
  statementTo: string | null;
  transactions: ParsedStatementTransaction[];
};

type ParsedLine = {
  y: number;
  columns: {
    date: string[];
    description: string[];
    account: string[];
    reference: string[];
    debit: string[];
    credit: string[];
    balance: string[];
  };
};

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const PERIOD_RE = /^[A-Za-z]+, [A-Za-z]+ \d{2} \d{4} - [A-Za-z]+, [A-Za-z]+ \d{2} \d{4}$/;

const toKes = (value: string) => {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  return Math.round(Number.parseFloat(normalized) || 0);
};

const classifyEntryKind = (description: string, debitKes: number, creditKes: number): StatementEntryKind => {
  const normalized = description.toLowerCase();
  if (normalized.includes("opening balance") || normalized.includes("closing balance")) return "balance";
  if (normalized.includes("reversal")) return debitKes > 0 ? "reversal" : "income";
  if (normalized.includes("transfer")) return debitKes > 0 ? "transfer" : "income";
  if (creditKes > 0) return "income";
  if (debitKes > 0) return "expense";
  return "other";
};

const parseStatementPeriod = (line: string) => {
  if (!PERIOD_RE.test(line.trim())) return { statementFrom: null, statementTo: null };
  const [fromLabel, toLabel] = line.split(" - ");
  try {
    const from = parse(fromLabel.trim(), "EEEE, MMMM dd yyyy", new Date()).toISOString().slice(0, 10);
    const to = parse(toLabel.trim(), "EEEE, MMMM dd yyyy", new Date()).toISOString().slice(0, 10);
    return { statementFrom: from, statementTo: to };
  } catch {
    return { statementFrom: null, statementTo: null };
  }
};

const groupLines = (items: TextItem[]) => {
  const groups = new Map<number, TextItem[]>();
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const y = Math.round(item.transform[5]);
    const line = groups.get(y) ?? [];
    line.push(item);
    groups.set(y, line);
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([y, lineItems]) => {
      const columns: ParsedLine["columns"] = {
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

const buildTransactions = (lines: ParsedLine[]) => {
  const transactions: ParsedStatementTransaction[] = [];
  let current: {
    timestamp: string;
    descriptionParts: string[];
    accountParts: string[];
    referenceParts: string[];
    debitParts: string[];
    creditParts: string[];
    balanceParts: string[];
  } | null = null;

  const flush = () => {
    if (!current) return;
    const description = current.descriptionParts.join(" ").replace(/\s+/g, " ").trim();
    const debitKes = toKes(current.debitParts.join(" "));
    const creditKes = toKes(current.creditParts.join(" "));
    const balanceText = current.balanceParts.join(" ").trim();
    const balanceKes = balanceText ? toKes(balanceText) : null;
    const entryKind = classifyEntryKind(description, debitKes, creditKes);

    if (entryKind !== "balance" && (debitKes > 0 || creditKes > 0)) {
      transactions.push({
        transactionAt: new Date(current.timestamp.replace(" ", "T")).toISOString(),
        description,
        accountNumber: current.accountParts.join(" ").trim() || null,
        reference: current.referenceParts.join(" ").replace(/\s+/g, "").trim() || null,
        debitKes,
        creditKes,
        balanceKes,
        entryKind,
        rawText: [
          current.timestamp,
          description,
          current.accountParts.join(" "),
          current.referenceParts.join(" "),
          current.debitParts.join(" "),
          current.creditParts.join(" "),
          current.balanceParts.join(" "),
        ].join(" | "),
      });
    }

    current = null;
  };

  for (const line of lines) {
    const timestamp = line.columns.date.join(" ").trim();
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

export const parsePaymentStatementPdf = async (file: File): Promise<ParsedStatement> => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data, useWorker: false }).promise;

  const parsedLines: ParsedLine[] = [];
  const allLineTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageItems = textContent.items.filter((item): item is TextItem => "str" in item);

    const pageLines = groupLines(pageItems);
    parsedLines.push(...pageLines);
    allLineTexts.push(
      ...pageLines.map((line) =>
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
    );
  }

  const sourceName =
    allLineTexts.find((line) => line.toLowerCase().includes("kopokopo")) ? "Kopo Kopo" : "Payment statement";
  const periodLine = allLineTexts.find((line) => PERIOD_RE.test(line.trim())) ?? "";
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

export const toStatementTransactionRows = (
  statement: ParsedStatement,
  importId: string,
  businessArea: BusinessArea,
): TablesInsert<"statement_transactions">[] =>
  statement.transactions.map((transaction) => ({
    import_id: importId,
    business_area: businessArea,
    transaction_at: transaction.transactionAt,
    description: transaction.description,
    account_number: transaction.accountNumber,
    reference: transaction.reference,
    debit_kes: transaction.debitKes,
    credit_kes: transaction.creditKes,
    balance_kes: transaction.balanceKes,
    entry_kind: transaction.entryKind,
    raw_text: transaction.rawText,
  }));
