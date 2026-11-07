/**
 * Request-body parsing shared by POST /api/purchase-orders and PUT /api/purchase-orders/[id].
 * Not a route (only route.ts files are routable), just colocated with the handlers that use it.
 */
import { ApiError, optionalText, requiredText } from "@/lib/api";
import { parseDateInput } from "@/lib/format";
import { isPoStatus, type PoStatus } from "@/lib/labels";

export type PurchaseOrderHeader = {
  poNumber: string;
  customerId: string;
  plant: string | null;
  poDate: Date;
  deliveryDate: Date | null;
  deliveryPlace: string | null;
  billPlacement: string | null;
  paymentTerm: string | null;
  quotationNumber: string | null;
  quotationDate: Date | null;
  contactName: string | null;
  contactPhone: string | null;
  contactMobile: string | null;
  acceptanceCondition: string | null;
  note: string | null;
};

function isBlank(value: unknown) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function optionalDate(value: unknown, message: string): Date | null {
  if (isBlank(value)) return null;
  const date = parseDateInput(value);
  if (!date) throw new ApiError(400, message);
  return date;
}

/** PO header fields from the request body: trimmed, blanks become null, dates validated. */
export function parsePurchaseOrderHeader(body: Record<string, unknown>): PurchaseOrderHeader {
  const poNumber = requiredText(body.poNumber, "กรุณากรอก PO No.");
  const customerId = requiredText(body.customerId, "กรุณาเลือกลูกค้า");

  if (isBlank(body.poDate)) throw new ApiError(400, "กรุณาเลือกวันที่ PO");
  const poDate = optionalDate(body.poDate, "วันที่ PO ไม่ถูกต้อง")!;

  return {
    poNumber,
    customerId,
    plant: optionalText(body.plant),
    poDate,
    deliveryDate: optionalDate(body.deliveryDate, "Delivery Date ไม่ถูกต้อง"),
    deliveryPlace: optionalText(body.deliveryPlace),
    billPlacement: optionalText(body.billPlacement),
    paymentTerm: optionalText(body.paymentTerm),
    quotationNumber: optionalText(body.quotationNumber),
    quotationDate: optionalDate(body.quotationDate, "Quotation Date ไม่ถูกต้อง"),
    contactName: optionalText(body.contactName),
    contactPhone: optionalText(body.contactPhone),
    contactMobile: optionalText(body.contactMobile),
    acceptanceCondition: optionalText(body.acceptanceCondition),
    note: optionalText(body.note),
  };
}

/** Status from the request body: undefined when not sent, 400 when not a known PO status. */
export function parsePurchaseOrderStatus(value: unknown): PoStatus | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (!isPoStatus(value)) throw new ApiError(400, "สถานะ PO ไม่ถูกต้อง");
  return value;
}

export const PO_NUMBER_CONFLICT = "เลขที่ PO นี้มีอยู่ในระบบแล้ว กรุณาใช้เลขที่ PO อื่น";
