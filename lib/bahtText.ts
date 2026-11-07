const NUM = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

function readSix(s: string) {
  let out = "";
  const len = s.length;
  for (let i = 0; i < len; i++) {
    const d = Number(s[i]);
    const pos = len - i - 1;
    if (d === 0) continue;
    if (pos === 0 && d === 1 && len > 1) out += "เอ็ด";
    else if (pos === 1) out += d === 1 ? "สิบ" : d === 2 ? "ยี่สิบ" : NUM[d] + "สิบ";
    else out += NUM[d] + POS[pos];
  }
  return out;
}

function readInt(input: string): string {
  const s = input.replace(/^0+(?=\d)/, "");
  if (s.length > 6) {
    const high = s.slice(0, -6);
    const low = s.slice(-6);
    return readInt(high) + "ล้าน" + (Number(low) > 0 ? readSix(low) : "");
  }
  return readSix(s);
}

export function bahtText(amount: number) {
  const total = Math.round(Math.abs(amount) * 100);
  const baht = Math.floor(total / 100);
  const satang = total % 100;

  let text = baht === 0 ? "ศูนย์" : readInt(String(baht));
  text += "บาท";
  text += satang === 0 ? "ถ้วน" : readSix(String(satang)) + "สตางค์";

  return text;
}