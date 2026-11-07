"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  tel: string | null;
  taxId: string | null;
  branchType: string | null;
  branchNumber: string | null;
  contactName: string | null;
};

type POItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: string;
  vat: number;
};

type PurchaseOrderInitialData = {
  id: string;
  poNumber: string;
  customerId: string;
  plant: string;
  poDate: string;
  deliveryDate: string;
  deliveryPlace: string;
  billPlacement: string;
  paymentTerm: string;
  quotationNumber: string;
  quotationDate: string;
  contactName: string;
  contactPhone: string;
  contactMobile: string;
  acceptanceCondition: string;
  note: string;
  status: string;
  items: {
    id: string;
    itemNo: number;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
    discountType: string;
    vat: number;
    amount: number;
  }[];
};

type PurchaseOrderFormProps = {
  customers: Customer[];
  initialData?: PurchaseOrderInitialData;
};

export default function PurchaseOrderForm({
  customers,
  initialData,
}: PurchaseOrderFormProps) {
  const router = useRouter();

  const isEditMode = Boolean(initialData);

  const [poNumber, setPoNumber] = useState(
    initialData?.poNumber ?? ""
  );

  const [customerId, setCustomerId] = useState(
    initialData?.customerId ?? ""
  );

  const [plant, setPlant] = useState(
    initialData?.plant ?? ""
  );

  const [poDate, setPoDate] = useState(
    initialData?.poDate ??
      new Date().toISOString().split("T")[0]
  );

  const [deliveryDate, setDeliveryDate] = useState(
    initialData?.deliveryDate ?? ""
  );

  const [deliveryPlace, setDeliveryPlace] = useState(
    initialData?.deliveryPlace ?? ""
  );

  const [billPlacement, setBillPlacement] = useState(
    initialData?.billPlacement ?? ""
  );

  const [paymentTerm, setPaymentTerm] = useState(
    initialData?.paymentTerm ?? ""
  );

  const [quotationNumber, setQuotationNumber] = useState(
    initialData?.quotationNumber ?? ""
  );

  const [quotationDate, setQuotationDate] = useState(
    initialData?.quotationDate ?? ""
  );

  const [contactName, setContactName] = useState(
    initialData?.contactName ?? ""
  );

  const [contactPhone, setContactPhone] = useState(
    initialData?.contactPhone ?? ""
  );

  const [contactMobile, setContactMobile] = useState(
    initialData?.contactMobile ?? ""
  );

  const [acceptanceCondition, setAcceptanceCondition] =
    useState(initialData?.acceptanceCondition ?? "");

  const [note, setNote] = useState(
    initialData?.note ?? ""
  );

  const [items, setItems] = useState<POItem[]>(
    initialData?.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      discount:
        item.discountType === "PERCENT"
          ? item.discount === 0
            ? ""
            : `${item.discount}%`
          : item.discount === 0
            ? ""
            : String(item.discount),
      vat: item.vat,
    })) ?? [
      {
        id: "new-item",
        description: "",
        quantity: 1,
        unit: "",
        unitPrice: 0,
        discount: "",
        vat: 7,
      },
    ]
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId
  );

  function handleCustomerChange(value: string) {
    setCustomerId(value);

    const customer = customers.find(
      (item) => item.id === value
    );

    if (!customer) {
      setContactName("");
      setContactPhone("");
      return;
    }

    setContactName(customer.contactName ?? "");
    setContactPhone(customer.tel ?? "");
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        id: String(Date.now()),
        description: "",
        quantity: 1,
        unit: "",
        unitPrice: 0,
        discount: "",
        vat: 7,
      },
    ]);
  }

  function removeItem(id: string) {
    setItems((currentItems) => {
      if (currentItems.length === 1) {
        return currentItems;
      }

      return currentItems.filter(
        (item) => item.id !== id
      );
    });
  }

  function updateItem(
    id: string,
    field: keyof Omit<POItem, "id">,
    value: string
  ) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) {
          return item;
        }

        if (
          field === "description" ||
          field === "unit" ||
          field === "discount"
        ) {
          return {
            ...item,
            [field]: value,
          };
        }

        return {
          ...item,
          [field]: Number(value) || 0,
        };
      })
    );
  }

  function calculateDiscountAmount(item: POItem) {
    const baseAmount =
      item.quantity * item.unitPrice;

    const value = item.discount
      .trim()
      .replace(/,/g, "");

    if (!value) {
      return 0;
    }

    const isPercent = value.endsWith("%");

    const numberValue = Number(
      isPercent
        ? value.slice(0, -1).trim()
        : value
    );

    if (
      !Number.isFinite(numberValue) ||
      numberValue < 0
    ) {
      return 0;
    }

    if (isPercent) {
      return baseAmount * (numberValue / 100);
    }

    return Math.min(numberValue, baseAmount);
  }

  function calculateItemAmount(item: POItem) {
    const baseAmount =
      item.quantity * item.unitPrice;

    const discountAmount =
      calculateDiscountAmount(item);

    return baseAmount - discountAmount;
  }

  const subtotal = items.reduce(
  (total, item) =>
    total + calculateItemAmount(item),
  0
);

const vatTotal = items.reduce((total, item) => {
  const amount =
    calculateItemAmount(item);

  return (
    total +
    amount * (item.vat / 100)
  );
}, 0);


  const grandTotal = subtotal + vatTotal;

  function formatMoney(value: number) {
    return value.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function validateDiscount(item: POItem) {
    const baseAmount =
      item.quantity * item.unitPrice;

    const value = item.discount
      .trim()
      .replace(/,/g, "");

    if (!value) {
      return null;
    }

    const isPercent = value.endsWith("%");

    const numberValue = Number(
      isPercent
        ? value.slice(0, -1).trim()
        : value
    );

    if (
      !Number.isFinite(numberValue) ||
      numberValue < 0
    ) {
      return "Discount ไม่ถูกต้อง";
    }

    if (isPercent && numberValue > 100) {
      return "Discount % ต้องไม่เกิน 100%";
    }

    if (
      !isPercent &&
      numberValue > baseAmount
    ) {
      return "Discount แบบจำนวนเงินต้องไม่เกินยอดสินค้า";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!poNumber.trim()) {
      setError("กรุณากรอก PO No.");
      return;
    }

    if (!customerId) {
      setError("กรุณาเลือกลูกค้า");
      return;
    }

    if (!poDate) {
      setError("กรุณาเลือกวันที่ PO");
      return;
    }

    if (items.length === 0) {
      setError(
        "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ"
      );
      return;
    }

    const invalidItem = items.find(
      (item) =>
        !item.description.trim() ||
        item.quantity <= 0 ||
        item.unitPrice < 0
    );

    if (invalidItem) {
      setError(
        "กรุณากรอก Description, Qty และ Unit Price ให้ครบถ้วน"
      );
      return;
    }

    for (
      let index = 0;
      index < items.length;
      index++
    ) {
      const item = items[index];

      const discountError =
        validateDiscount(item);

      if (discountError) {
        setError(
          `รายการที่ ${index + 1}: ${discountError}`
        );
        return;
      }

      if (
        item.vat < 0 ||
        item.vat > 100
      ) {
        setError(
          `รายการที่ ${index + 1}: VAT ต้องอยู่ระหว่าง 0-100%`
        );
        return;
      }
    }

    setLoading(true);

    try {
      const url = isEditMode
        ? `/api/purchase-orders/${initialData!.id}`
        : "/api/purchase-orders";

      const response = await fetch(url, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          poNumber,
          customerId,
          plant,
          poDate,
          deliveryDate,
          deliveryPlace,
          billPlacement,
          paymentTerm,
          quotationNumber,
          quotationDate,
          contactName,
          contactPhone,
          contactMobile,
          acceptanceCondition,
          note,
          status: initialData?.status ?? "DRAFT",
          items: items.map((item, index) => ({
            itemNo: index + 1,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discount: item.discount,
            vat: item.vat,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.error ||
            "ไม่สามารถบันทึก PO ได้"
        );
        return;
      }

      if (isEditMode) {
        setSuccess(
          "แก้ไข PO สำเร็จ"
        );

        setTimeout(() => {
          router.push(
            `/purchase-orders/${initialData!.id}`
          );
          router.refresh();
        }, 500);

        return;
      }

      setSuccess(
        "บันทึก PO พร้อมรายการสำเร็จ"
      );

      setPoNumber("");
      setCustomerId("");
      setPlant("");
      setPoDate(
        new Date().toISOString().split("T")[0]
      );
      setDeliveryDate("");
      setDeliveryPlace("");
      setBillPlacement("");
      setPaymentTerm("");
      setQuotationNumber("");
      setQuotationDate("");
      setContactName("");
      setContactPhone("");
      setContactMobile("");
      setAcceptanceCondition("");
      setNote("");

      setItems([
        {
          id: String(Date.now()),
          description: "",
          quantity: 1,
          unit: "",
          unitPrice: 0,
          discount: "",
          vat: 7,
        },
      ]);

      router.refresh();
    } catch (error) {
      console.error(error);

      setError(
        "ไม่สามารถเชื่อมต่อกับระบบได้"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-sm">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">
          {isEditMode
            ? "แก้ไข Purchase Order"
            : "สร้าง Purchase Order"}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {isEditMode
            ? "แก้ไขข้อมูล PO และรายการสินค้า"
            : "กรอกข้อมูลใบสั่งซื้อและรายการสินค้า"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-8"
      >
        <section>
          <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">
            ข้อมูลหลัก
          </h3>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="poNumber"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                PO No. *
              </label>

              <input
                id="poNumber"
                type="text"
                value={poNumber}
                onChange={(event) =>
                  setPoNumber(event.target.value)
                }
                placeholder="เช่น PO-2026-001"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-1 text-xs text-gray-400">
                เลขที่ PO ห้ามซ้ำ
              </p>
            </div>

            <div>
              <label
                htmlFor="poDate"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                PO Date *
              </label>

              <input
                id="poDate"
                type="date"
                value={poDate}
                onChange={(event) =>
                  setPoDate(event.target.value)
                }
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">
            ข้อมูลลูกค้า
          </h3>

          <div>
            <label
              htmlFor="customerId"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              ลูกค้า *
            </label>

            <select
              id="customerId"
              value={customerId}
              onChange={(event) =>
                handleCustomerChange(
                  event.target.value
                )
              }
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                -- เลือกลูกค้า --
              </option>

              {customers.map((customer) => (
                <option
                  key={customer.id}
                  value={customer.id}
                >
                  {customer.code} - {customer.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCustomer && (
            <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-5">
              <h4 className="font-semibold text-blue-900">
                ข้อมูลลูกค้า
              </h4>

              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <p>
                  <span className="font-medium">
                    รหัส:
                  </span>{" "}
                  {selectedCustomer.code}
                </p>

                <p>
                  <span className="font-medium">
                    ชื่อ:
                  </span>{" "}
                  {selectedCustomer.name}
                </p>

                <p className="md:col-span-2">
                  <span className="font-medium">
                    ที่อยู่:
                  </span>{" "}
                  {selectedCustomer.address || "-"}
                </p>

                <p>
                  <span className="font-medium">
                    โทร:
                  </span>{" "}
                  {selectedCustomer.tel || "-"}
                </p>

                <p>
                  <span className="font-medium">
                    เลขผู้เสียภาษี:
                  </span>{" "}
                  {selectedCustomer.taxId || "-"}
                </p>
              </div>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">
            การส่งมอบ
          </h3>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="plant"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Plant
              </label>

              <input
                id="plant"
                type="text"
                value={plant}
                onChange={(event) =>
                  setPlant(event.target.value)
                }
                placeholder="ระบุ Plant"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="deliveryDate"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Delivery Date
              </label>

              <input
                id="deliveryDate"
                type="date"
                value={deliveryDate}
                onChange={(event) =>
                  setDeliveryDate(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="deliveryPlace"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Delivery Place
              </label>

              <input
                id="deliveryPlace"
                type="text"
                value={deliveryPlace}
                onChange={(event) =>
                  setDeliveryPlace(event.target.value)
                }
                placeholder="สถานที่จัดส่ง"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="billPlacement"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Bill Placement
              </label>

              <input
                id="billPlacement"
                type="text"
                value={billPlacement}
                onChange={(event) =>
                  setBillPlacement(event.target.value)
                }
                placeholder="สถานที่วางบิล"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="paymentTerm"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Payment Term
              </label>

              <input
                id="paymentTerm"
                type="text"
                value={paymentTerm}
                onChange={(event) =>
                  setPaymentTerm(event.target.value)
                }
                placeholder="เช่น เครดิต 30 วัน"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">
            อ้างอิง Quotation
          </h3>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="quotationNumber"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Quotation No.
              </label>

              <input
                id="quotationNumber"
                type="text"
                value={quotationNumber}
                onChange={(event) =>
                  setQuotationNumber(
                    event.target.value
                  )
                }
                placeholder="เช่น QT-2026-001"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="quotationDate"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Quotation Date
              </label>

              <input
                id="quotationDate"
                type="date"
                value={quotationDate}
                onChange={(event) =>
                  setQuotationDate(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">
            ผู้ติดต่อ
          </h3>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label
                htmlFor="contactName"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Contact Name
              </label>

              <input
                id="contactName"
                type="text"
                value={contactName}
                onChange={(event) =>
                  setContactName(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="contactPhone"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Contact Phone
              </label>

              <input
                id="contactPhone"
                type="text"
                value={contactPhone}
                onChange={(event) =>
                  setContactPhone(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="contactMobile"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Contact Mobile
              </label>

              <input
                id="contactMobile"
                type="text"
                value={contactMobile}
                onChange={(event) =>
                  setContactMobile(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-800">
                รายการสินค้า / งาน
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                เพิ่มรายการสินค้าได้หลายรายการ
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              + เพิ่มรายการ
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-1100px border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="w-12 px-3 py-3 text-center text-xs font-semibold text-gray-700">
                    #
                  </th>

                  <th className="min-w-260px px-3 py-3 text-xs font-semibold text-gray-700">
                    Description
                  </th>

                  <th className="w-24 px-3 py-3 text-right text-xs font-semibold text-gray-700">
                    Qty
                  </th>

                  <th className="w-28 px-3 py-3 text-xs font-semibold text-gray-700">
                    Unit
                  </th>

                  <th className="w-36 px-3 py-3 text-right text-xs font-semibold text-gray-700">
                    Unit Price
                  </th>

                  <th className="w-36 px-3 py-3 text-right text-xs font-semibold text-gray-700">
                    Discount
                  </th>

                  <th className="w-24 px-3 py-3 text-right text-xs font-semibold text-gray-700">
                    VAT %
                  </th>

                  <th className="w-40 px-3 py-3 text-right text-xs font-semibold text-gray-700">
                    Amount
                  </th>

                  <th className="w-20 px-3 py-3 text-center text-xs font-semibold text-gray-700">
                    ลบ
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((item, index) => {
                  const amount =
                    calculateItemAmount(item);

                  return (
                    <tr
                      key={item.id}
                      className="border-t"
                    >
                      <td className="px-3 py-3 text-center text-sm font-semibold text-gray-700">
                        {index + 1}
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "description",
                              event.target.value
                            )
                          }
                          placeholder="รายละเอียดสินค้า / งาน"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "quantity",
                              event.target.value
                            )
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "unit",
                              event.target.value
                            )
                          }
                          placeholder="ชิ้น"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "unitPrice",
                              event.target.value
                            )
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="text"
                          value={item.discount}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "discount",
                              event.target.value
                            )
                          }
                          placeholder="10% หรือ 1,500"
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />

                        <p className="mt-1 text-right text-[10px] text-gray-400">
                          % หรือจำนวนเงิน
                        </p>
                      </td>

                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.vat}
                          onChange={(event) =>
                            updateItem(
                              item.id,
                              "vat",
                              event.target.value
                            )
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-right text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </td>

                      <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">
                        {formatMoney(amount)}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(item.id)
                          }
                          disabled={
                            items.length === 1
                          }
                          className="rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ลบ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-md rounded-lg border border-gray-200 bg-gray-50 p-5">
              <div className="flex justify-between py-2 text-sm">
                <span className="text-gray-600">
                  Sub Total
                </span>

                <span className="font-semibold text-gray-900">
                  ฿{formatMoney(subtotal)}
                </span>
              </div>

              <div className="flex justify-between border-t py-3 text-sm">
                <span className="text-gray-600">
                  V.A.T.
                </span>

                <span className="font-semibold text-gray-900">
                  ฿{formatMoney(vatTotal)}
                </span>
              </div>

              <div className="flex justify-between border-t pt-3">
                <span className="font-bold text-gray-900">
                  Grand Total
                </span>

                <span className="text-xl font-bold text-blue-600">
                  ฿{formatMoney(grandTotal)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">
            เงื่อนไขการรับมอบ / ตรวจรับ
          </h3>

          <textarea
            value={acceptanceCondition}
            onChange={(event) =>
              setAcceptanceCondition(
                event.target.value
              )
            }
            rows={4}
            placeholder="ระบุเงื่อนไขการรับมอบหรือการตรวจรับ"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </section>

        <section>
          <h3 className="mb-5 border-b pb-3 text-lg font-bold text-gray-800">
            หมายเหตุ
          </h3>

          <textarea
            value={note}
            onChange={(event) =>
              setNote(event.target.value)
            }
            rows={4}
            placeholder="หมายเหตุเพิ่มเติม"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              router.push(
                isEditMode
                  ? `/purchase-orders/${initialData!.id}`
                  : "/purchase-orders"
              )
            }
            className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ยกเลิก
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "กำลังบันทึก..."
              : isEditMode
                ? "บันทึกการแก้ไข"
                : "บันทึก PO"}
          </button>
        </div>
      </form>
    </div>
  );
}