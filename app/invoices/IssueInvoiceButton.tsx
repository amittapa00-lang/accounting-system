"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type IssueInvoiceButtonProps = {
  invoiceId: string;
};

export default function IssueInvoiceButton({
  invoiceId,
}: IssueInvoiceButtonProps) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleIssueInvoice() {
    const confirmed = window.confirm(
      "ยืนยันการออก Invoice?\n\nหลังจากออก Invoice แล้ว สถานะจะเปลี่ยนจาก DRAFT เป็น ISSUED"
    );

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/invoices/${invoiceId}/issue`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "ไม่สามารถออก Invoice ได้"
        );

        return;
      }

      alert("ออก Invoice สำเร็จ");

      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        "เกิดข้อผิดพลาดในการเชื่อมต่อระบบ"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleIssueInvoice}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading
          ? "กำลังออก Invoice..."
          : "ออก Invoice"}
      </button>

      {error && (
        <p className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}