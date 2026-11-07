/**
 * Invoice PDF laid out for the pre-printed continuous form M-T82-01
 * (9 x 11 inch, 6 parts: tax invoice, billing note and receipt, original + copy),
 * printed on an Epson LQ-630 dot-matrix printer.
 *
 * Two modes:
 *   - "preview": the form artwork (templates/forms/*.pdf, vector) is drawn behind the data,
 *     so the PDF can be checked on screen or sent electronically.
 *   - "print":   data only, for printing onto the pre-printed paper. Print at 100% / "Actual size"
 *     with paper size 9 x 11 in. `offsetMm` shifts everything to compensate for printer feed.
 *
 * Server-only (reads files from disk). pdfkit renders the data (it applies the font's
 * Thai mark positioning, so vowels and tone marks stack correctly); pdf-lib places the form
 * artwork underneath.
 *
 * Coordinates below are in PDF points measured on the form artwork, origin at the top-left
 * of the artwork page. The artwork page is larger than the paper (it has crop marks): the
 * 9 x 11 in sheet starts at TRIM.x / TRIM.y.
 */
import fs from "node:fs/promises";
import path from "node:path";

import PDFDocument from "pdfkit";
import { PDFDocument as PdfLibDocument } from "pdf-lib";

import { bahtText } from "@/lib/bahtText";
import { formatDate, formatMoney } from "@/lib/format";
import { formatLineDiscount, formatQuantity } from "@/lib/invoices";
import type { Numeric } from "@/lib/money";

// ---------------------------------------------------------------------------- geometry

const MM = 72 / 25.4;
const PAGE = { width: 9 * 72, height: 11 * 72 }; // 648 x 792 pt
/** Top-left of the paper inside the artwork page (from the crop marks). */
const TRIM = { x: 41, y: 30.1 };
/** Artwork page height, needed to convert to pdf-lib's bottom-left origin. */
const ARTWORK_HEIGHT = 1031.81;

const FONT_SIZE = { normal: 9, small: 8, total: 10 };

/** Single-line fields: [x, baseline y, max width, align]. */
type Slot = { x: number; y: number; width: number; align?: "left" | "center" | "right" };

const HEADER = {
  number: { x: 528, y: 92.5, width: 112 } as Slot,
  date: { x: 528, y: 112.5, width: 112 } as Slot,
  pageNo: { x: 474, y: 150, width: 170, align: "right" } as Slot,
};

const CUSTOMER = {
  code: { x: 192, y: 170.5, width: 276 } as Slot,
  /** name, address lines and tax id share this block */
  block: { x: 89, firstBaseline: 201, lineHeight: 11.5, lastBaseline: 242, width: 380 },
};

const RIGHT_BOX = {
  /** Ship To row is 155-185: first line continues after the printed label, second line below it. */
  shipTo: [
    { x: 557, y: 167, width: 83 },
    { x: 479, y: 181, width: 161 },
  ] as Slot[],
  dueDate: { x: 535, y: 208.5, width: 105 } as Slot,
  paymentTerm: { x: 479, y: 241, width: 161 } as Slot,
};

/** The row under "Sale Order No | Term Of Payment | Due Date | Purchase Order No | Sale Name | Entry By". */
const INFO_ROW_Y = 283.2;
const INFO_COLUMNS = [83.5, 192.5, 268, 350, 474, 552, 644];

const ITEMS = {
  firstBaseline: 323.5,
  rowHeight: 12,
  rows: 26, // 312.7 .. 633 on the form
  columns: {
    itemNo: { x: 83.5, width: 33.5, align: "center" } as Slot & { y?: number },
    description: { x: 120, width: 227 },
    quantity: { x: 352, width: 40, align: "right" } as Slot & { y?: number },
    unitPrice: { x: 396.5, width: 75, align: "right" } as Slot & { y?: number },
    discount: { x: 476, width: 73, align: "right" } as Slot & { y?: number },
    amount: { x: 554, width: 87, align: "right" } as Slot & { y?: number },
  },
};

const TOTALS = {
  subtotal: { x: 554, y: 651, width: 87, align: "right" } as Slot,
  vat: { x: 554, y: 679.5, width: 87, align: "right" } as Slot,
  grandTotal: { x: 554, y: 708, width: 87, align: "right" } as Slot,
  words: { x: 86, y: 708, width: 385, align: "center" } as Slot,
};

// ---------------------------------------------------------------------------- assets

const TEMPLATES_DIR = path.join(process.cwd(), "templates");
const FONT_REGULAR = path.join(TEMPLATES_DIR, "fonts", "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(TEMPLATES_DIR, "fonts", "Sarabun-Bold.ttf");

const FORM_BY_DOCUMENT_TYPE: Record<string, string> = {
  TAX_INVOICE_DELIVERY: "M-T82-01-tax-invoice.pdf",
  BILLING_INVOICE: "M-T82-01-billing-note.pdf",
  RECEIPT: "M-T82-01-receipt.pdf",
};

const fileCache = new Map<string, Promise<Buffer>>();
function readCached(file: string) {
  if (!fileCache.has(file)) fileCache.set(file, fs.readFile(file));
  return fileCache.get(file)!;
}

// ---------------------------------------------------------------------------- input

export type InvoiceForForm = {
  invoiceNumber: string;
  documentType: string;
  invoiceDate: Date;
  dueDate: Date | null;
  paymentTerm: string | null;
  saleOrderNumber: string | null;
  saleName: string | null;
  entryBy: string | null;
  customerCodeSnapshot: string | null;
  customerNameSnapshot: string;
  customerAddressSnapshot: string | null;
  customerTaxIdSnapshot: string | null;
  /** e.g. "สำนักงานใหญ่" or "สาขาที่ 00001"; printed after the tax id */
  customerBranch: string | null;
  shipToSnapshot: string | null;
  purchaseOrderNumber: string | null;
  subtotal: Numeric;
  vat: Numeric;
  grandTotal: Numeric;
  items: {
    itemNo: number;
    description: string;
    quantity: Numeric;
    unit: string | null;
    unitPrice: Numeric;
    discount: Numeric;
    discountType: string;
    amount: Numeric;
  }[];
};

export type InvoiceFormOptions = {
  mode: "preview" | "print";
  /** Shift all data on the paper, in millimetres (+x = right, +y = down). */
  offsetMm?: { x: number; y: number };
};

// ---------------------------------------------------------------------------- text helpers

type Doc = PDFKit.PDFDocument;

const wordSegmenter = new Intl.Segmenter("th", { granularity: "word" });
const graphemeSegmenter = new Intl.Segmenter("th", { granularity: "grapheme" });

/** Converts artwork coordinates to coordinates on the 9 x 11 sheet. */
const sx = (x: number) => x - TRIM.x;
const sy = (y: number) => y - TRIM.y;

function setFont(doc: Doc, bold: boolean, size: number) {
  doc.font(bold ? "bold" : "regular").fontSize(size);
}

/**
 * OpenType features for Thai text. fontkit applies Sarabun's `ccmp` lookup without honouring
 * its mark filtering set, so tone marks after an upper vowel (ชิ้น, ที่, ทั้ง) get the lowered
 * ".small" form and end up beside or below the vowel. With ccmp off, mark/mkmk positioning
 * still stacks them correctly.
 */
const TEXT_FEATURES = { ccmp: false } as unknown as PDFKit.Mixins.TextOptions["features"];

function measure(doc: Doc, text: string) {
  return doc.widthOfString(text, { features: TEXT_FEATURES });
}

/**
 * Splits text into wrap units: Thai words (Thai has no spaces between words), spaces, and
 * runs of non-space ASCII kept whole so codes like "034-123456" or "QT-2026-0158" never split.
 */
function wrapUnits(paragraph: string): string[] {
  const units: string[] = [];
  const ascii = /^[\x21-\x7E]+$/;

  for (const { segment } of wordSegmenter.segment(paragraph)) {
    const last = units[units.length - 1];
    if (last !== undefined && ascii.test(last) && ascii.test(segment)) {
      units[units.length - 1] = last + segment;
    } else {
      units.push(segment);
    }
  }

  return units;
}

/** Breaks Thai/English text into lines that fit `width`. */
function wrapText(doc: Doc, text: string, width: number): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";

    for (const segment of wrapUnits(paragraph)) {
      const candidate = line + segment;
      if (measure(doc, candidate) <= width) {
        line = candidate;
        continue;
      }

      if (line.trim() !== "") {
        lines.push(line.trimEnd());
        line = segment.trimStart();
      } else {
        line = candidate;
      }

      // a single word wider than the line: break it between characters
      while (measure(doc, line) > width) {
        let head = "";
        for (const { segment: g } of graphemeSegmenter.segment(line)) {
          if (measure(doc, head + g) > width && head !== "") break;
          head += g;
        }
        lines.push(head);
        line = line.slice(head.length);
      }
    }

    lines.push(line.trimEnd());
  }

  // drop trailing empty lines but keep intentional blank lines in the middle
  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Draws one line at a baseline, shrinking the font (down to minSize) and then truncating to fit. */
function drawFitted(doc: Doc, text: string | null | undefined, slot: Slot, size: number, bold = false, minSize = 6.5) {
  const value = (text ?? "").replace(/\s+/g, " ").trim();
  if (!value) return;

  let fontSize = size;
  setFont(doc, bold, fontSize);
  while (measure(doc, value) > slot.width && fontSize > minSize) {
    fontSize -= 0.5;
    setFont(doc, bold, fontSize);
  }

  let out = value;
  if (measure(doc, out) > slot.width) {
    const graphemes = [...graphemeSegmenter.segment(value)].map((g) => g.segment);
    while (graphemes.length && measure(doc, graphemes.join("") + "…") > slot.width) graphemes.pop();
    out = graphemes.join("") + "…";
  }

  const textWidth = measure(doc, out);
  const left =
    slot.align === "right"
      ? slot.x + slot.width - textWidth
      : slot.align === "center"
        ? slot.x + (slot.width - textWidth) / 2
        : slot.x;

  doc.text(out, sx(left), sy(slot.y), { lineBreak: false, baseline: "alphabetic", features: TEXT_FEATURES });
}

// ---------------------------------------------------------------------------- layout

type Row = { kind: "item"; item: InvoiceForForm["items"][number]; lines: string[] };

/** Splits the items into pages of ITEMS.rows lines; a long description takes several lines. */
function paginate(doc: Doc, invoice: InvoiceForForm): Row[][] {
  setFont(doc, false, FONT_SIZE.normal);
  const pages: Row[][] = [[]];
  let used = 0;

  for (const item of invoice.items) {
    let lines = wrapText(doc, item.description, ITEMS.columns.description.width);
    if (lines.length > ITEMS.rows) lines = lines.slice(0, ITEMS.rows);

    if (used + lines.length > ITEMS.rows) {
      pages.push([]);
      used = 0;
    }

    pages[pages.length - 1].push({ kind: "item", item, lines });
    used += lines.length;
  }

  return pages;
}

function drawHeader(doc: Doc, invoice: InvoiceForForm, pageIndex: number, pageCount: number) {
  drawFitted(doc, invoice.invoiceNumber, HEADER.number, FONT_SIZE.total, true);
  drawFitted(doc, formatDate(invoice.invoiceDate, ""), HEADER.date, FONT_SIZE.total);
  if (pageCount > 1) {
    drawFitted(doc, `หน้า ${pageIndex + 1}/${pageCount}`, HEADER.pageNo, FONT_SIZE.small);
  }

  // customer
  drawFitted(doc, invoice.customerCodeSnapshot, CUSTOMER.code, FONT_SIZE.normal, true);

  const block = CUSTOMER.block;
  const maxLines = Math.floor((block.lastBaseline - block.firstBaseline) / block.lineHeight) + 1;
  const taxLine = [
    invoice.customerTaxIdSnapshot ? `เลขประจำตัวผู้เสียภาษี ${invoice.customerTaxIdSnapshot}` : "",
    invoice.customerBranch ?? "",
  ]
    .filter(Boolean)
    .join("  ");

  setFont(doc, true, FONT_SIZE.normal);
  const nameLines = wrapText(doc, invoice.customerNameSnapshot, block.width).slice(0, 2);
  setFont(doc, false, FONT_SIZE.normal);
  const addressRoom = maxLines - nameLines.length - (taxLine ? 1 : 0);
  const addressLines = wrapText(doc, invoice.customerAddressSnapshot ?? "", block.width)
    .filter((l) => l !== "")
    .slice(0, Math.max(addressRoom, 0));

  let y = block.firstBaseline;
  for (const line of nameLines) {
    drawFitted(doc, line, { x: block.x, y, width: block.width }, FONT_SIZE.normal, true);
    y += block.lineHeight;
  }
  for (const line of addressLines) {
    drawFitted(doc, line, { x: block.x, y, width: block.width }, FONT_SIZE.normal);
    y += block.lineHeight;
  }
  if (taxLine) {
    drawFitted(doc, taxLine, { x: block.x, y: Math.min(y, block.lastBaseline), width: block.width }, FONT_SIZE.normal);
  }

  // right box: ship-to wraps into the two slots; whatever does not fit is shrunk/truncated on the last one
  const [shipFirst, shipSecond] = RIGHT_BOX.shipTo;
  setFont(doc, false, FONT_SIZE.small);
  const shipText = (invoice.shipToSnapshot ?? "").replace(/\s+/g, " ").trim();
  const firstLine = wrapText(doc, shipText, shipFirst.width)[0] ?? "";
  drawFitted(doc, firstLine, shipFirst, FONT_SIZE.small);
  drawFitted(doc, shipText.slice(firstLine.length).trim(), shipSecond, FONT_SIZE.small);
  drawFitted(doc, formatDate(invoice.dueDate, ""), RIGHT_BOX.dueDate, FONT_SIZE.normal);
  drawFitted(doc, invoice.paymentTerm, RIGHT_BOX.paymentTerm, FONT_SIZE.normal);

  // info row
  const infoValues = [
    invoice.saleOrderNumber,
    invoice.paymentTerm,
    formatDate(invoice.dueDate, ""),
    invoice.purchaseOrderNumber,
    invoice.saleName,
    invoice.entryBy,
  ];
  infoValues.forEach((value, i) => {
    const left = INFO_COLUMNS[i] + 3;
    const width = INFO_COLUMNS[i + 1] - INFO_COLUMNS[i] - 6;
    drawFitted(doc, value, { x: left, y: INFO_ROW_Y, width, align: "center" }, FONT_SIZE.normal);
  });
}

function drawItems(doc: Doc, rows: Row[]) {
  const c = ITEMS.columns;
  let line = 0;

  for (const row of rows) {
    const y = ITEMS.firstBaseline + line * ITEMS.rowHeight;
    const { item } = row;
    const qty = formatQuantity(item.quantity) + (item.unit ? ` ${item.unit}` : "");

    drawFitted(doc, String(item.itemNo), { ...c.itemNo, y }, FONT_SIZE.normal);
    row.lines.forEach((text, i) => {
      drawFitted(doc, text, { x: c.description.x, y: y + i * ITEMS.rowHeight, width: c.description.width }, FONT_SIZE.normal);
    });
    drawFitted(doc, qty, { ...c.quantity, y }, FONT_SIZE.normal);
    drawFitted(doc, formatMoney(item.unitPrice), { ...c.unitPrice, y }, FONT_SIZE.normal);
    drawFitted(doc, formatLineDiscount(item.discount, item.discountType), { ...c.discount, y }, FONT_SIZE.normal);
    drawFitted(doc, formatMoney(item.amount), { ...c.amount, y }, FONT_SIZE.normal);

    line += row.lines.length;
  }
}

function drawTotals(doc: Doc, invoice: InvoiceForForm, isLastPage: boolean) {
  if (!isLastPage) {
    drawFitted(doc, "*** มีต่อหน้าถัดไป ***", TOTALS.words, FONT_SIZE.total);
    return;
  }

  drawFitted(doc, formatMoney(invoice.subtotal), TOTALS.subtotal, FONT_SIZE.total);
  drawFitted(doc, formatMoney(invoice.vat), TOTALS.vat, FONT_SIZE.total);
  drawFitted(doc, formatMoney(invoice.grandTotal), TOTALS.grandTotal, FONT_SIZE.total, true);
  drawFitted(doc, `(${bahtText(invoice.grandTotal)})`, TOTALS.words, FONT_SIZE.total, true);
}

/** Renders the data pages (no artwork) with pdfkit. */
async function renderDataPages(invoice: InvoiceForForm, offsetMm: { x: number; y: number }): Promise<Buffer> {
  const [regular, bold] = await Promise.all([readCached(FONT_REGULAR), readCached(FONT_BOLD)]);

  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margin: 0,
    autoFirstPage: false,
    info: { Title: invoice.invoiceNumber, Creator: "Accounting System" },
  });
  doc.registerFont("regular", regular);
  doc.registerFont("bold", bold);

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.addPage();
  const pages = paginate(doc, invoice);

  pages.forEach((rows, index) => {
    if (index > 0) doc.addPage();
    doc.save();
    doc.translate(offsetMm.x * MM, offsetMm.y * MM);
    drawHeader(doc, invoice, index, pages.length);
    drawItems(doc, rows);
    drawTotals(doc, invoice, index === pages.length - 1);
    doc.restore();
  });

  doc.end();
  return done;
}

/** Builds the invoice PDF. Returns the file bytes. */
export async function renderInvoiceFormPdf(invoice: InvoiceForForm, options: InvoiceFormOptions): Promise<Uint8Array> {
  const offset = options.offsetMm ?? { x: 0, y: 0 };
  const data = await renderDataPages(invoice, offset);

  if (options.mode === "print") {
    return data;
  }

  const formFile = FORM_BY_DOCUMENT_TYPE[invoice.documentType] ?? FORM_BY_DOCUMENT_TYPE.TAX_INVOICE_DELIVERY;
  const [formBytes] = await Promise.all([readCached(path.join(TEMPLATES_DIR, "forms", formFile))]);

  const out = await PdfLibDocument.create();
  out.setTitle(invoice.invoiceNumber);

  const formDoc = await PdfLibDocument.load(formBytes);
  // Clip the artwork to the 9 x 11 sheet (pdf-lib uses a bottom-left origin).
  const artwork = await out.embedPage(formDoc.getPage(0), {
    left: TRIM.x,
    right: TRIM.x + PAGE.width,
    top: ARTWORK_HEIGHT - TRIM.y,
    bottom: ARTWORK_HEIGHT - TRIM.y - PAGE.height,
  });

  const dataDoc = await PdfLibDocument.load(data);
  const dataPages = await out.embedPdf(dataDoc, dataDoc.getPageIndices());

  for (const dataPage of dataPages) {
    const page = out.addPage([PAGE.width, PAGE.height]);
    page.drawPage(artwork, { x: 0, y: 0, width: PAGE.width, height: PAGE.height });
    page.drawPage(dataPage, { x: 0, y: 0 });
  }

  return out.save();
}
