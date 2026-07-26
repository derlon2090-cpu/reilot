function text(value) {
  return String(value ?? "").trim();
}

function scalar(value) {
  if (value && typeof value === "object") {
    return text(value.slug ?? value.status ?? value.name ?? value.id);
  }
  return text(value);
}

export function isSallaPaymentCompleted(data = {}, payload = {}) {
  const paymentStatuses = [
    data.payment?.status,
    data.payment_status,
    data.payment?.state
  ].map((value) => scalar(value).toLowerCase()).filter(Boolean);

  if (paymentStatuses.some((value) => ["paid", "completed", "success", "successful"].includes(value))) {
    return true;
  }

  const events = [payload.event, payload.event_type]
    .map((value) => text(value).toLowerCase()).filter(Boolean);
  return events.some((value) =>
    /(^|[._ -])payment[._ -]?(completed|paid|success|successful)($|[._ -])/.test(value)
  );
}
