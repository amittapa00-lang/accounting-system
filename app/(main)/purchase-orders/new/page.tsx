import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import PurchaseOrderForm from "@/components/purchase-orders/PurchaseOrderForm";
import { PageHeader } from "@/components/ui/page-header";

export const instant = false;

export default async function NewPurchaseOrderPage() {
  await requirePageSession();

  // A new PO can only be created for an active customer
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      tel: true,
      taxId: true,
      contactName: true,
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <>
      <PageHeader
        back={{ href: "/purchase-orders", label: "กลับรายการ PO" }}
        title="สร้าง Purchase Order"
        description="กรอกข้อมูลใบสั่งซื้อและรายการสินค้า"
      />

      <PurchaseOrderForm customers={customers} />
    </>
  );
}
