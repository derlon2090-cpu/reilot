export function filterByTenant(records, tenantId) {
  return records.filter((record) => record.tenantId === tenantId);
}

export function getTenantRecord(records, tenantId, id) {
  const record = records.find((item) => item.id === id);
  if (!record) return { ok: false, status: 404, error: "Record not found" };
  if (record.tenantId !== tenantId) return { ok: false, status: 403, error: "Tenant access denied" };
  return { ok: true, record };
}

export function exportTenantCsv(records, tenantId) {
  const tenantRows = filterByTenant(records, tenantId);
  const header = "id,tenantId,name";
  const rows = tenantRows.map((record) => [record.id, record.tenantId, record.name].join(","));
  return [header, ...rows].join("\n");
}
