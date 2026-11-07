import { notFound } from "next/navigation";

import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import CustomerForm from "@/components/customers/CustomerForm";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";

export const instant = false;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function CustomerDetailPage({ params }: PageProps) {
  await requirePageSession();

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      name: true,
      address: true,
      tel: true,
      taxId: true,
      branchType: true,
      branchNumber: true,
      contactName: true,
      email: true,
      note: true,
      isActive: true,
    },
  });

  if (!customer) {
    notFound();
  }

  return (
    <>
      <PageHeader
        back={{ href: "/customers", label: "กลับรายชื่อลูกค้า" }}
        title={customer.name}
        description={`แก้ไขข้อมูลลูกค้า · รหัส ${customer.code}`}
        meta={
          customer.isActive ? (
            <Badge tone="success" dot>
              ใช้งาน
            </Badge>
          ) : (
            <Badge tone="neutral" dot>
              ปิดใช้งาน
            </Badge>
          )
        }
      />

      <CustomerForm customer={customer} />
    </>
  );
}
