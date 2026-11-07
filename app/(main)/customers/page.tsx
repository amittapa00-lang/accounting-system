import { UserPlus } from "lucide-react";

import { requirePageSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import CustomerForm from "@/components/customers/CustomerForm";
import CustomerList from "@/components/customers/CustomerList";
import { ButtonAnchor } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export const instant = false;

export default async function CustomersPage() {
  await requirePageSession();

  const customers = await prisma.customer.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      code: true,
      name: true,
      tel: true,
      taxId: true,
      contactName: true,
      isActive: true,
    },
  });

  return (
    <>
      <PageHeader
        title="ลูกค้า"
        description="Customer Master · ค้นหาและจัดการข้อมูลลูกค้า"
        actions={
          // The form sits beside the list on wide screens; below that it is under the list
          <ButtonAnchor href="#new-customer" variant="brand" className="xl:hidden">
            <UserPlus /> เพิ่มลูกค้า
          </ButtonAnchor>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <CustomerList customers={customers} />
        </div>

        <div id="new-customer" className="min-w-0 scroll-mt-20 lg:scroll-mt-6">
          <CustomerForm />
        </div>
      </div>
    </>
  );
}
