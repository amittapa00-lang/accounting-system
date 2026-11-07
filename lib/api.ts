/**
 * Helpers for route handlers (app/api/**): consistent JSON errors and status codes.
 *
 * Usage:
 *   export async function POST(request: Request) {
 *     try {
 *       await requireApiSession();
 *       const body = await readJson(request);
 *       if (!body.name) throw new ApiError(400, "กรุณากรอกชื่อ");
 *       ...
 *     } catch (error) {
 *       return handleApiError(error, "ไม่สามารถบันทึกข้อมูลได้", {
 *         conflict: "รหัสนี้มีอยู่ในระบบแล้ว",
 *       });
 *     }
 *   }
 *
 * Every error response has the shape { error: string } with a Thai message.
 */
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { MoneyInputError } from "@/lib/money";

/** An error whose message is safe to show to the user, with its HTTP status. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Reads the JSON body as an object. Malformed JSON or a non-object body is a 400. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "ข้อมูลที่ส่งมาไม่ถูกต้อง");
  }

  return body as Record<string, unknown>;
}

/** Trimmed string or null when missing/blank. Non-string values become null. */
export function optionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text === "" ? null : text;
}

/** Trimmed non-empty string, otherwise ApiError(400, message). */
export function requiredText(value: unknown, message: string): string {
  const text = optionalText(value);
  if (!text) throw new ApiError(400, message);
  return text;
}

type ErrorMessages = {
  /** Unique constraint violation (Prisma P2002). */
  conflict?: string;
  /** Record not found (Prisma P2025). */
  notFound?: string;
  /** Foreign key violation, e.g. deleting something still referenced (Prisma P2003). */
  inUse?: string;
};

/**
 * Converts any thrown value into a JSON error response:
 *   ApiError          -> its status and message
 *   MoneyInputError   -> 400 with its message
 *   Prisma P2002      -> 409, P2025 -> 404, P2003 -> 409
 *   anything else     -> 500 with `fallbackMessage` (details only go to the server log)
 */
export function handleApiError(error: unknown, fallbackMessage: string, messages: ErrorMessages = {}) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status);
  }

  if (error instanceof MoneyInputError) {
    return jsonError(error.message, 400);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return jsonError(messages.conflict ?? "ข้อมูลนี้มีอยู่ในระบบแล้ว", 409);
      case "P2025":
        return jsonError(messages.notFound ?? "ไม่พบข้อมูลที่ต้องการ", 404);
      case "P2003":
        return jsonError(messages.inUse ?? "ไม่สามารถดำเนินการได้ เนื่องจากมีข้อมูลอื่นอ้างอิงอยู่", 409);
    }
  }

  console.error(fallbackMessage, error);
  return jsonError(fallbackMessage, 500);
}
