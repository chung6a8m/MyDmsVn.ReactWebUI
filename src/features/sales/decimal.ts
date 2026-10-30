export type DecimalKind = "qty" | "unitPrice" | "amount";
const limits = {
  qty: 10n ** 18n - 1n,
  unitPrice: 10n ** 19n - 1n,
  amount: 10n ** 28n - 1n,
};
function format(value: bigint) {
  return `${value / 10000n}.${(value % 10000n).toString().padStart(4, "0")}`;
}
export function parseDecimal(raw: string, kind: DecimalKind): string {
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(raw);
  if (!match)
    throw Error(
      "Số không hợp lệ; dùng một dấu thập phân, không phân nhóm/exponent.",
    );
  const fraction = match[2] ?? "";
  if (/[^0]/.test(fraction.slice(4)))
    throw Error("Tối đa 4 chữ số thập phân có nghĩa; không tự làm tròn input.");
  const integer = match[1].replace(/^0+/, "") || "0";
  if (integer.length > 24) throw Error("Số vượt giới hạn.");
  const scaled =
    BigInt(integer) * 10000n + BigInt(fraction.slice(0, 4).padEnd(4, "0"));
  if (scaled > limits[kind] || (kind === "qty" && scaled === 0n))
    throw Error("Số vượt giới hạn hoặc số lượng không lớn hơn 0.");
  return format(scaled);
}
function scaled(value: string, kind: DecimalKind) {
  return BigInt(parseDecimal(value, kind).replace(".", ""));
}
export function lineAmount(qty: string, price: string, gift = false): string {
  const q = scaled(qty, "qty"),
    p = scaled(price, "unitPrice");
  const amount = gift ? 0n : (q * p + 5000n) / 10000n;
  if (amount > limits.amount) throw Error("Thành tiền vượt decimal(28,4).");
  return format(amount);
}
export function totalAmount(amounts: readonly string[]): string {
  const total = amounts.reduce((sum, a) => sum + scaled(a, "amount"), 0n);
  if (total > limits.amount) throw Error("Tổng tiền vượt decimal(28,4).");
  return format(total);
}
