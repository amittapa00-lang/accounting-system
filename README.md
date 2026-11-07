# Accounting System

ระบบจัดการบัญชีและลูกหนี้: ลูกค้า → Purchase Order → Invoice → รับชำระเงิน

Next.js 16 (App Router) · React 19 · Prisma 7 + PostgreSQL · next-auth (Credentials) · Tailwind CSS 4 · ExcelJS

## เริ่มใช้งาน (เครื่อง dev)

ต้องมี Node.js 24 และ PostgreSQL (หรือ Docker)

```bash
# 1) ฐานข้อมูล (ถ้ายังไม่มี PostgreSQL) — รันบน port 5433
docker run -d --name accounting-db --restart unless-stopped \
  -e POSTGRES_USER=accounting -e POSTGRES_PASSWORD=<รหัสผ่าน> -e POSTGRES_DB=accounting \
  -p 127.0.0.1:5433:5432 -v accounting-db-data:/var/lib/postgresql/data postgres:17-alpine

# 2) ตั้งค่า
cp .env.example .env          # แล้วแก้ DATABASE_URL และ NEXTAUTH_SECRET

# 3) ติดตั้งและสร้างตาราง
npm install
npm run db:migrate

# 4) สร้างผู้ใช้ admin (รหัสผ่านอย่างน้อย 8 ตัวอักษร)
npm run create-admin -- admin <รหัสผ่าน>

# 5) เปิดแอป → http://localhost:3000
npm run dev
```

## คำสั่ง

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` | เปิด dev server |
| `npm run build` / `npm start` | build และรันแบบ production |
| `npm run lint` / `npm run typecheck` | ตรวจโค้ด |
| `npm run db:migrate` | อัปเดตตารางในฐานข้อมูลตาม migration |
| `npm run db:migrate:dev` | สร้าง migration ใหม่หลังแก้ `prisma/schema.prisma` |
| `npm run db:studio` | เปิดดู/แก้ข้อมูลผ่าน Prisma Studio |
| `npm run create-admin -- <user> <pass>` | สร้าง admin หรือรีเซ็ตรหัสผ่าน admin |

## โครงสร้างโปรเจกต์

```
app/
  (main)/            หน้าที่ต้องล็อกอิน ใช้ layout เดียวกัน (เมนูด้านบน + ออกจากระบบ)
    dashboard/  customers/  purchase-orders/  invoices/  payments/
  api/               API (ทุก route ตรวจการล็อกอินด้วย requireApiSession)
  login/             หน้าเข้าสู่ระบบ
components/
  layout/            เมนูนำทาง ปุ่มออกจากระบบ
  customers/  purchase-orders/  invoices/  payments/   ฟอร์มและตารางของแต่ละส่วน
lib/
  auth.ts            ตั้งค่า next-auth + requirePageSession / requireApiSession
  prisma.ts          Prisma client
  api.ts             ApiError, readJson, handleApiError (รูปแบบ error ของ API)
  money.ts           คำนวณเงินทั้งหมด (ปัดเป็นสตางค์, ส่วนลด, VAT, ยอดคงเหลือ)
  format.ts          แสดงผลเงิน/วันที่ (เวลาไทย Asia/Bangkok)
  labels.ts          สถานะ ประเภทเอกสาร วิธีชำระเงิน + ป้ายภาษาไทย
  bahtText.ts        จำนวนเงินเป็นคำอ่านภาษาไทย (แบบ BAHTTEXT)
prisma/              schema และ migrations
scripts/             create-admin
templates/           ไฟล์ที่ server ใช้สร้างเอกสาร (ไม่อยู่ใน public/ จึงดาวน์โหลดตรงไม่ได้)
  forms/             แบบฟอร์ม M-T82-01 (PDF ต้นฉบับ) ใช้เป็นพื้นหลังของ PDF ตัวอย่าง
  fonts/             ฟอนต์ Sarabun (OFL) สำหรับภาษาไทยใน PDF
  invoice-template.xlsx  แบบฟอร์ม Excel ของ Invoice
types/               type เพิ่มเติมของ next-auth
```

## พิมพ์ลงฟอร์ม M-T82-01 (Epson LQ-630)

ฟอร์มต่อเนื่อง 9 × 11 นิ้ว 6 ชั้น (ใบกำกับภาษี / ใบวางบิล / ใบเสร็จ ต้นฉบับ + สำเนา) ทุกชั้นช่องตรงกัน พิมพ์ครั้งเดียวได้ครบชุด
ในหน้ารายละเอียด Invoice มีปุ่ม:

| ปุ่ม | ได้อะไร |
|---|---|
| 📄 ดู PDF บนฟอร์ม | PDF มีภาพฟอร์มเป็นพื้นหลัง (ตามประเภทเอกสาร) ใช้ตรวจ/ส่งลูกค้า |
| ↓ ดาวน์โหลด PDF | ไฟล์เดียวกัน แบบดาวน์โหลด |
| 🖨️ พิมพ์ลงฟอร์ม (LQ-630) | เฉพาะข้อมูล สำหรับพิมพ์ลงกระดาษฟอร์มจริง |
| ⚙️ | เลื่อนตำแหน่งข้อมูล (มม.) ถ้าพิมพ์แล้วไม่ตรงช่อง จำค่าไว้ในเครื่องนั้น |

ตั้งค่าเครื่องพิมพ์: สร้าง paper size 9 × 11 นิ้วในไดรเวอร์ LQ-630 แล้วสั่งพิมพ์ PDF แบบ **Actual size / 100%** (ห้าม Fit to page)
API: `GET /api/invoices/:id/pdf?mode=preview|print&dx=<มม.>&dy=<มม.>&download=1` — ตำแหน่งช่องทั้งหมดอยู่ใน `lib/invoiceFormPdf.ts`

## กติกาที่ควรรู้

- **เงิน**: ทุกยอดเก็บเป็นทศนิยม 2 ตำแหน่ง คำนวณผ่าน `lib/money.ts` เท่านั้น (อย่าบวกลบเงินด้วย float ตรง ๆ)
- **PO → Invoice**: PO หนึ่งใบออก Invoice ได้หนึ่งใบ (ถ้าจะออกใหม่ต้องยกเลิก Invoice ฉบับร่างเดิมก่อน)
- **การชำระเงิน**: รับเงินได้เฉพาะ Invoice ที่ออกแล้ว และรับเกินยอดคงเหลือไม่ได้
- **วันที่**: แสดงผลและวันที่ตั้งต้นใช้เวลาประเทศไทยเสมอ
