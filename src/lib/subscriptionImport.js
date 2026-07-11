const aliases = {
  orderNumber: ["orderNumber", "order_number", "رقم الطلب"],
  customerName: ["customerName", "customer_name", "اسم العميل"],
  phoneNumber: ["phoneNumber", "phone_number", "رقم الجوال", "رقم واتساب"],
  serviceName: ["serviceName", "service_name", "الخدمة", "اسم الخدمة"],
  startDate: ["startDate", "start_date", "تاريخ البداية"],
  endDate: ["endDate", "end_date", "تاريخ الانتهاء"],
  renewalUrl: ["renewalUrl", "renewal_url", "رابط التجديد"]
};

function pick(row, key) {
  const name = aliases[key].find((candidate) => row[candidate] != null);
  return String(name ? row[name] : "").trim();
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parseSpreadsheetText(text) {
  const lines = String(text || "").trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t").map((value) => value.trim());
  return lines.slice(1).map((line) => Object.fromEntries(line.split("\t").map((value, index) => [headers[index], value.trim()])));
}

export function previewSubscriptionImport(inputRows) {
  const seenOrders = new Set();
  const seenPhones = new Set();
  const validRows = [];
  const invalidRows = [];

  inputRows.forEach((source, index) => {
    const row = Object.fromEntries(Object.keys(aliases).map((key) => [key, pick(source, key)]));
    row.phoneNumber = row.phoneNumber.replace(/\D/g, "");
    const errors = [];
    if (!row.orderNumber) errors.push("missing_order_number");
    if (!row.customerName) errors.push("missing_customer_name");
    if (!/^[1-9]\d{9,14}$/.test(row.phoneNumber)) errors.push("invalid_phone");
    if (!row.serviceName) errors.push("missing_service_name");
    if (!validDate(row.startDate)) errors.push("invalid_start_date");
    if (!validDate(row.endDate)) errors.push("invalid_end_date");
    if (validDate(row.startDate) && validDate(row.endDate) && row.endDate < row.startDate) errors.push("end_before_start");
    if (row.renewalUrl && !/^https?:\/\//i.test(row.renewalUrl)) errors.push("invalid_renewal_url");
    if (row.orderNumber && seenOrders.has(row.orderNumber)) errors.push("duplicate_order_number");
    if (row.phoneNumber && seenPhones.has(row.phoneNumber)) errors.push("duplicate_phone");
    if (row.orderNumber) seenOrders.add(row.orderNumber);
    if (row.phoneNumber) seenPhones.add(row.phoneNumber);
    const result = { rowNumber: index + 2, ...row, errors };
    (errors.length ? invalidRows : validRows).push(result);
  });

  return {
    total: inputRows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    duplicateCount: invalidRows.filter((row) => row.errors.some((error) => error.startsWith("duplicate_"))).length,
    validRows,
    invalidRows
  };
}
