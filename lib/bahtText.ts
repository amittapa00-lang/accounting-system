/**
 * Thai baht amount in words, following Excel's BAHTTEXT:
 *   21        -> "ยี่สิบเอ็ดบาทถ้วน"
 *   1000001   -> "หนึ่งล้านเอ็ดบาทถ้วน"
 *   100.10    -> "หนึ่งร้อยบาทสิบสตางค์"
 *   0.5       -> "ห้าสิบสตางค์"
 *   -5        -> "ลบห้าบาทถ้วน"
 *
 * The amount is rounded to satang the same way as lib/money (half away from zero),
 * so the words always match the printed figure.
 */
import { toSatang, type Numeric } from "@/lib/money";

const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

/** Reads a group of up to 6 digits (the part below one million). */
function readGroup(digits: string): string {
  let out = "";
  const len = digits.length;

  for (let i = 0; i < len; i++) {
    const d = Number(digits[i]);
    const place = len - i - 1;
    if (d === 0) continue;

    if (place === 0 && d === 1 && len > 1) {
      // a trailing 1 after other digits is "เอ็ด" (11, 101, and the "000001" group of 1,000,001)
      out += "เอ็ด";
    } else if (place === 1) {
      out += d === 1 ? "สิบ" : d === 2 ? "ยี่สิบ" : DIGITS[d] + "สิบ";
    } else {
      out += DIGITS[d] + PLACES[place];
    }
  }

  return out;
}

function readInteger(digits: string): string {
  const s = digits.replace(/^0+(?=\d)/, "");

  if (s.length > 6) {
    const high = s.slice(0, -6);
    const low = s.slice(-6); // always 6 digits, so a lone trailing 1 becomes "เอ็ด"
    return readInteger(high) + "ล้าน" + (Number(low) > 0 ? readGroup(low) : "");
  }

  return readGroup(s);
}

export function bahtText(amount: Numeric): string {
  const totalSatang = toSatang(amount);
  const abs = Math.abs(totalSatang);
  const baht = Math.floor(abs / 100);
  const satang = abs % 100;

  let text: string;
  if (baht === 0 && satang === 0) {
    text = "ศูนย์บาทถ้วน";
  } else if (baht === 0) {
    text = readGroup(String(satang)) + "สตางค์";
  } else {
    text = readInteger(String(baht)) + "บาท" + (satang === 0 ? "ถ้วน" : readGroup(String(satang)) + "สตางค์");
  }

  return totalSatang < 0 ? "ลบ" + text : text;
}
