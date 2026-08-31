import { requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { query } from "../../../../../../src/server/db.js";
import { appBaseUrl, authBaseUrl, siteBaseUrl } from "../../../../../../src/server/app-url.js";

function displayDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    timeZone: process.env.APP_TIMEZONE || "Asia/Riyadh"
  }).format(new Date(value));
}

export async function GET(request, { params }) {
  const auth = await requireAdminPermission(request, "templates", "read");
  if (!auth.ok) return auth.response;
  const { templateKey } = await params;
  let rows = [];
  if (templateKey === "admin_account_created") {
    const result = await query(
      `SELECT apj.id,apj.customer_name,apj.customer_email,pp.name AS plan_name,
              ps.current_period_end
         FROM account_provisioning_jobs apj
         LEFT JOIN platform_plans pp ON pp.id=apj.plan_id
         LEFT JOIN LATERAL (
           SELECT current_period_end FROM platform_subscriptions
            WHERE tenant_id=apj.tenant_id ORDER BY created_at DESC LIMIT 1
         ) ps ON true
        WHERE apj.account_created_at IS NOT NULL AND apj.subscription_activated_at IS NOT NULL
        ORDER BY apj.created_at DESC LIMIT 20`
    );
    rows = result.rows.map((row) => ({
      id: row.id,
      label: `${row.customer_name || row.customer_email} — ${row.plan_name || "Renvix"}`,
      values: {
        customer_name: row.customer_name || "",
        customer_email: row.customer_email || "",
        temporary_password: "••••••••••••",
        plan_name: row.plan_name || "Renvix",
        subscription_expiry: displayDate(row.current_period_end),
        login_url: `${authBaseUrl()}/login`,
        support_url: `${siteBaseUrl()}/support`
      }
    }));
  } else if (templateKey === "admin_subscription_renewal_reminder") {
    const result = await query(
      `SELECT ps.id,ps.current_period_end,pp.name AS plan_name,
              COALESCE(s.name,t.name,'Renvix') AS store_name,
              COALESCE(owner.name,t.name,'عميل Renvix') AS customer_name
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id=ps.plan_id
         JOIN tenants t ON t.id=ps.tenant_id
         JOIN LATERAL (
           SELECT u.name FROM tenant_members tm JOIN users u ON u.id=tm.user_id
            WHERE tm.tenant_id=ps.tenant_id AND tm.role='owner' AND tm.status='active'
            ORDER BY tm.created_at LIMIT 1
         ) owner ON true
         LEFT JOIN LATERAL (
           SELECT name FROM stores WHERE tenant_id=ps.tenant_id ORDER BY created_at LIMIT 1
         ) s ON true
        WHERE ps.status='active' AND ps.current_period_end>now()
        ORDER BY ps.current_period_end LIMIT 20`
    );
    rows = result.rows.map((row) => ({
      id: row.id,
      label: `${row.customer_name} — ${row.plan_name}`,
      values: {
        customer_name: row.customer_name,
        plan_name: row.plan_name,
        store_name: row.store_name,
        expiry_date: displayDate(row.current_period_end),
        days_remaining: Math.max(1, Math.ceil((new Date(row.current_period_end).getTime() - Date.now()) / 86_400_000)),
        renewal_url: `${appBaseUrl()}/dashboard/billing`,
        support_url: `${siteBaseUrl()}/support`
      }
    }));
  } else if (templateKey === "admin_subscription_renewed") {
    const result = await query(
      `SELECT sr.id,sr.previous_expires_at,sr.new_expires_at,sc.full_name,sp.name AS plan_name,
              COALESCE(s.name,t.name,'Renvix') AS store_name
         FROM subscription_renewals sr
         JOIN customer_subscriptions cs ON cs.id=sr.subscription_id
         JOIN subscription_customers sc ON sc.id=cs.customer_id
         JOIN subscription_plans sp ON sp.id=cs.plan_id
         JOIN tenants t ON t.id=sr.tenant_id
         LEFT JOIN LATERAL (SELECT name FROM stores WHERE tenant_id=sr.tenant_id ORDER BY created_at LIMIT 1) s ON true
        WHERE sr.status='completed' ORDER BY sr.created_at DESC LIMIT 20`
    );
    rows = result.rows.map((row) => ({
      id: row.id,
      label: `${row.full_name} — ${row.plan_name}`,
      values: {
        customer_name: row.full_name,
        plan_name: row.plan_name,
        store_name: row.store_name,
        old_expiry: displayDate(row.previous_expires_at),
        new_expiry: displayDate(row.new_expires_at),
        login_url: `${authBaseUrl()}/login`,
        support_url: `${siteBaseUrl()}/support`
      }
    }));
  } else if (templateKey === "admin_number_disconnected") {
    const result = await query(
      `SELECT wc.id,wc.phone_number,wc.last_error,wc.disconnected_at,COALESCE(s.name,t.name,'Renvix') AS tenant_name
         FROM whatsapp_channels wc JOIN tenants t ON t.id=wc.tenant_id
         LEFT JOIN LATERAL (SELECT name FROM stores WHERE tenant_id=wc.tenant_id ORDER BY created_at LIMIT 1) s ON true
        WHERE wc.status='disconnected' AND wc.disconnected_at IS NOT NULL
        ORDER BY wc.disconnected_at DESC LIMIT 20`
    );
    rows = result.rows.map((row) => ({
      id: row.id,
      label: `${row.tenant_name} — ${row.phone_number || "بدون رقم"}`,
      values: {
        customer_name: row.tenant_name,
        disconnected_phone: row.phone_number || "",
        disconnect_reason: row.last_error || "فصل مؤكد للقناة",
        disconnected_at: displayDate(row.disconnected_at),
        reconnect_url: `${appBaseUrl()}/dashboard/channels`,
        support_url: `${siteBaseUrl()}/support`
      }
    }));
  } else if (templateKey === "admin_salla_installed") {
    const result = await query(
      `SELECT ac.id,ac.provider_store_name,ac.provider_store_domain,ac.ready_at,u.name
         FROM app_connections ac
         JOIN LATERAL (
           SELECT u.name FROM tenant_members tm JOIN users u ON u.id=tm.user_id
            WHERE tm.tenant_id=ac.tenant_id AND tm.role='owner' AND tm.status='active'
            ORDER BY tm.created_at LIMIT 1
         ) u ON true
        WHERE ac.provider='salla' AND ac.readiness_status='ready'
        ORDER BY ac.ready_at DESC LIMIT 20`
    );
    rows = result.rows.map((row) => ({
      id: row.id,
      label: row.provider_store_name,
      values: {
        customer_name: row.name || "",
        store_name: row.provider_store_name,
        store_domain: row.provider_store_domain || "",
        connected_at: displayDate(row.ready_at),
        dashboard_url: `${appBaseUrl()}/dashboard`,
        integration_settings_url: `${appBaseUrl()}/dashboard/apps`,
        support_url: `${siteBaseUrl()}/support`
      }
    }));
  } else {
    return Response.json({ ok: false, reason: "template_not_found" }, { status: 404 });
  }
  return Response.json(
    { ok: true, samples: rows },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
