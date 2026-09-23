import { useEffect, useState } from "react";
import type { Currency } from "../types";
import { formatMoney } from "../format";
import { Button, Field, Modal, NumberInput, TextInput } from "./ui";

export default function PaymentModal({
  open,
  onClose,
  title,
  due,
  paid,
  currency,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  due: number;
  paid: number;
  currency: Currency;
  onSave: (amount: number, date: string) => void;
}) {
  const remaining = Math.max(0, due - paid);
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    if (open) {
      setAmount(String(remaining || ""));
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, remaining]);

  const save = () => {
    const n = Number(amount) || 0;
    onSave(n, date ? new Date(date).toISOString() : new Date().toISOString());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-400">المستحق</div>
            <div className="mt-0.5 text-sm font-extrabold text-gray-800">
              {formatMoney(due, currency)}
            </div>
          </div>
          <div className="rounded-2xl bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-400">المتبقي</div>
            <div className="mt-0.5 text-sm font-extrabold text-emerald-700">
              {formatMoney(remaining, currency)}
            </div>
          </div>
        </div>

        <Field label="المبلغ المدفوع">
          <NumberInput
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="تاريخ الدفع">
          <TextInput
            type="date"
            dir="ltr"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            إلغاء
          </Button>
          <Button onClick={save} className="flex-1">
            حفظ الدفع
          </Button>
        </div>
      </div>
    </Modal>
  );
}
