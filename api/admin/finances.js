import { db, discordUser, sendJson } from "../../lib/contact-data.js";

const STATUSES = new Set(["Non renseigné", "À jour", "À régulariser", "En attente", "En contrôle"]);
let schemaReady;

async function ensureFinanceSchema() {
  if (!schemaReady) schemaReady = db()`CREATE TABLE IF NOT EXISTS dgi_companies (
    id BIGSERIAL PRIMARY KEY,
    company_key TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    source_reference TEXT,
    tax_status TEXT NOT NULL DEFAULT 'Non renseigné',
    tax_period TEXT NOT NULL DEFAULT '',
    tax_details TEXT NOT NULL DEFAULT '',
    investigation TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`.catch((error) => { schemaReady = undefined; throw error; });
  return schemaReady;
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function valueFromSummary(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "mi"))?.[1]?.trim() || "";
}

async function syncSubmittedCompanies(sql) {
  const submissions = await sql()`SELECT reference, messages FROM contact_tickets
    WHERE motif = 'Déclaration / démarche'
      AND subject = 'Démarche en ligne — Création d''entreprise'`;
  for (const submission of submissions) {
    const message = Array.isArray(submission.messages) ? submission.messages[0] : null;
    const text = String(message?.text || "");
    const tradeName = valueFromSummary(text, "Nom commercial / professionnel");
    const sign = valueFromSummary(text, "Enseigne");
    const person = [valueFromSummary(text, "Prénoms"), valueFromSummary(text, "Nom de naissance")]
      .filter(Boolean).join(" ");
    const companyName = clean(tradeName || sign || (person ? `Entreprise de ${person}` : ""), 120);
    if (!companyName) continue;
    const key = companyName.normalize("NFKC").toLocaleLowerCase("fr-FR");
    await sql()`INSERT INTO dgi_companies (company_key, company_name, source_reference)
      VALUES (${key}, ${companyName}, ${submission.reference})
      ON CONFLICT (company_key) DO UPDATE SET
        source_reference = COALESCE(dgi_companies.source_reference, EXCLUDED.source_reference)`;
  }
}

export default async function handler(req, res) {
  const identity = await discordUser(req, true).catch(() => ({ error: "discord_auth_unavailable", status: 502 }));
  if (identity.error) return sendJson(res, identity.status, { error: identity.error });

  try {
    await ensureFinanceSchema();
    const sql = db();

    if (req.method === "GET") {
      await syncSubmittedCompanies(sql);
      const companies = await sql()`SELECT id, company_name, source_reference, tax_status, tax_period,
        tax_details, investigation, notes, created_at, updated_at
        FROM dgi_companies ORDER BY lower(company_name), id`;
      return sendJson(res, 200, companies);
    }

    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    if (req.method === "POST") {
      const companyName = clean(payload.company_name, 120);
      if (!companyName) return sendJson(res, 400, { error: "company_name_required" });
      const key = companyName.normalize("NFKC").toLocaleLowerCase("fr-FR");
      const created = await sql()`INSERT INTO dgi_companies (company_key, company_name)
        VALUES (${key}, ${companyName})
        ON CONFLICT (company_key) DO NOTHING
        RETURNING id, company_name, source_reference, tax_status, tax_period, tax_details,
          investigation, notes, created_at, updated_at`;
      if (created.length) return sendJson(res, 201, created[0]);
      const existing = await sql()`SELECT id, company_name, source_reference, tax_status, tax_period,
        tax_details, investigation, notes, created_at, updated_at
        FROM dgi_companies WHERE company_key = ${key}`;
      return sendJson(res, 200, existing[0]);
    }

    const id = Number(payload.id);
    if (!Number.isSafeInteger(id) || id <= 0)
      return sendJson(res, 400, { error: "company_id_invalid" });

    if (req.method === "PATCH") {
      const companyName = clean(payload.company_name, 120);
      const taxStatus = clean(payload.tax_status, 32);
      if (!companyName) return sendJson(res, 400, { error: "company_name_required" });
      if (!STATUSES.has(taxStatus)) return sendJson(res, 400, { error: "tax_status_invalid" });

      const updated = await sql()`UPDATE dgi_companies SET
        company_key = ${companyName.normalize("NFKC").toLocaleLowerCase("fr-FR")},
        company_name = ${companyName}, tax_status = ${taxStatus},
        tax_period = ${clean(payload.tax_period, 80)},
        tax_details = ${clean(payload.tax_details, 6000)},
        investigation = ${clean(payload.investigation, 6000)},
        notes = ${clean(payload.notes, 6000)}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, company_name, source_reference, tax_status, tax_period, tax_details,
          investigation, notes, created_at, updated_at`;
      if (!updated.length) return sendJson(res, 404, { error: "company_not_found" });
      return sendJson(res, 200, updated[0]);
    }

    if (req.method === "DELETE") {
      const deleted = await sql()`DELETE FROM dgi_companies WHERE id = ${id} RETURNING id`;
      if (!deleted.length) return sendJson(res, 404, { error: "company_not_found" });
      return sendJson(res, 200, { ok: true });
    }

    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    console.error("Finance records operation failed:", error?.message || error);
    if (error?.message === "database_not_configured")
      return sendJson(res, 503, { error: "database_not_configured" });
    return sendJson(res, 500, { error: "finance_records_unavailable" });
  }
}

