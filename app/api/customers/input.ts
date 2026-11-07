/**
 * Request-body parsing shared by POST /api/customers and PUT /api/customers/[id].
 * Not a route (only route.ts files are routable), just colocated with the handlers that use it.
 */
import { optionalText, requiredText } from "@/lib/api";

export function parseCustomerInput(body: Record<string, unknown>) {
  return {
    code: requiredText(body.code, "กรุณากรอกรหัสลูกค้า"),
    name: requiredText(body.name, "กรุณากรอกชื่อลูกค้า"),
    address: optionalText(body.address),
    tel: optionalText(body.tel),
    taxId: optionalText(body.taxId),
    branchType: optionalText(body.branchType),
    branchNumber: optionalText(body.branchNumber),
    contactName: optionalText(body.contactName),
    email: optionalText(body.email),
    note: optionalText(body.note),
  };
}

export const CUSTOMER_CODE_CONFLICT = "รหัสลูกค้านี้มีอยู่แล้ว";
