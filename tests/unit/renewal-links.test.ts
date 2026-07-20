import { describe, expect, it } from "vitest";
import {
  extractSallaCustomerUrl,
  findRenewalCatalogProduct,
  parseRenewalOption,
  resolveStoredRenewalOption,
  safeRenewalUrl
} from "../../src/lib/renewal-links.js";

const base = {
  label: "تجديد سنة",
  customerNote: "أفضل قيمة",
  durationValue: 1,
  durationUnit: "year",
  showInPortal: true,
  showInWhatsapp: false,
  showInEmail: false,
  isActive: true,
  sortOrder: 0
};

describe("product renewal links", () => {
  it("accepts public HTTPS links and rejects unsafe or private destinations", () => {
    expect(safeRenewalUrl("https://store.salla.sa/p/abc")).toBe("https://store.salla.sa/p/abc");
    for (const url of ["http://store.test/p", "javascript:alert(1)", "data:text/html,x", "file:///tmp/x", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.2/x", "https://192.168.1.2/x", "https://172.16.0.1/x", "https://169.254.1.1/x"])
      expect(safeRenewalUrl(url)).toBeNull();
  });

  it("requires a safe URL in manual mode", () => {
    expect(parseRenewalOption({ ...base, linkMode: "manual", manualUrl: "https://store.salla.sa/p/1" }).ok).toBe(true);
    expect(parseRenewalOption({ ...base, linkMode: "manual", manualUrl: "http://localhost/p" }).ok).toBe(false);
  });

  it("requires a selected Salla product or variant in automatic mode", () => {
    expect(parseRenewalOption({ ...base, linkMode: "automatic" }).ok).toBe(false);
    expect(parseRenewalOption({ ...base, linkMode: "automatic", targetSallaProductId: "p1" }).ok).toBe(true);
  });

  it("matches variant before product then SKU and never matches by name", () => {
    const products = [
      { productId: "p1", variantId: null, sku: "BASE", name: "الخطة", customerUrl: "https://salla.sa/base" },
      { productId: "p1", variantId: "v1", sku: "YEAR", name: "الخطة", customerUrl: "https://salla.sa/year" },
      { productId: "p2", variantId: null, sku: "MONTH", name: "الخطة", customerUrl: "https://salla.sa/month" }
    ];
    expect(findRenewalCatalogProduct(products, { targetSallaVariantId: "v1", targetSallaProductId: "p2", targetSallaSku: "MONTH" })?.variantId).toBe("v1");
    expect(findRenewalCatalogProduct(products, { targetSallaProductId: "p2", targetSallaSku: "YEAR" })?.productId).toBe("p2");
    expect(findRenewalCatalogProduct(products, { targetSallaSku: "YEAR" })?.variantId).toBe("v1");
    expect(findRenewalCatalogProduct(products, { name: "الخطة" })).toBeNull();
  });

  it("reads only a trusted customer-facing Salla URL", () => {
    expect(extractSallaCustomerUrl({ urls: { customer: "https://store.salla.sa/p/1" } })).toBe("https://store.salla.sa/p/1");
    expect(extractSallaCustomerUrl({ urls: { customer: "http://127.0.0.1/admin" } })).toBeNull();
  });

  it("keeps the last trusted automatic URL when the catalog temporarily lacks one", () => {
    const option = { ...base, linkMode: "automatic", resolvedUrl: "https://store.salla.sa/p/old" };
    expect(resolveStoredRenewalOption(option, { customerUrl: null })).toMatchObject({ ok: true, url: "https://store.salla.sa/p/old" });
    expect(resolveStoredRenewalOption({ ...option, isActive: false }, null)).toEqual({ ok: false, reason: "renewal_option_unavailable" });
  });
});
