import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";
import { RETAIL_SITE_CMS_CONTENT_KEYS } from "@/lib/admin/cms";

const VALID_KEYS = new Set(RETAIL_SITE_CMS_CONTENT_KEYS);

type ContentEntryInput = {
  key: string;
  value: unknown;
};

function parseEntries(body: Record<string, unknown>) {
  const rawEntries = Array.isArray(body.entries) ? body.entries : null;

  if (rawEntries) {
    return rawEntries
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        return {
          key: String(record.key ?? "").trim(),
          value: record.value ?? {},
        };
      })
      .filter((entry): entry is ContentEntryInput => Boolean(entry?.key));
  }

  const key = String(body.key ?? "").trim();
  return key ? [{ key, value: body.value ?? {} }] : [];
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "").trim();
  const entries = parseEntries(body);

  if (!entries.length || entries.some((entry) => !VALID_KEYS.has(entry.key))) {
    return NextResponse.json({ ok: false, error: "Invalid content key." }, { status: 400 });
  }

  if (action !== "save_draft" && action !== "publish") {
    return NextResponse.json({ ok: false, error: "Invalid CMS action." }, { status: 400 });
  }

  const tenant = await getCurrentTenant();

  if (action === "save_draft") {
    const results = await Promise.all(
      entries.map(async (entry) => {
        const { data, error } = await supabaseAdmin
          .from("tenant_content_entries")
          .upsert(
            {
              tenant_id: tenant.id,
              key: entry.key,
              status: "draft",
              value_json: entry.value ?? {},
            },
            { onConflict: "tenant_id,key,status" },
          )
          .select("key, updated_at")
          .single();

        return { data, error };
      }),
    );

    const failed = results.find((result) => result.error);

    if (failed?.error) {
      return NextResponse.json({ ok: false, error: failed.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      updates: results.map((result) => ({
        key: result.data?.key ?? null,
        draftUpdatedAt: result.data?.updated_at ?? null,
        publishedUpdatedAt: null,
      })),
    });
  }

  const draftResults = await Promise.all(
    entries.map((entry) =>
      supabaseAdmin
        .from("tenant_content_entries")
        .upsert(
          {
            tenant_id: tenant.id,
            key: entry.key,
            status: "draft",
            value_json: entry.value ?? {},
          },
          { onConflict: "tenant_id,key,status" },
        ),
    ),
  );

  const publishedResults = await Promise.all(
    entries.map(async (entry) => {
      const { data, error } = await supabaseAdmin
        .from("tenant_content_entries")
        .upsert(
          {
            tenant_id: tenant.id,
            key: entry.key,
            status: "published",
            value_json: entry.value ?? {},
          },
          { onConflict: "tenant_id,key,status" },
        )
        .select("key, updated_at")
        .single();

      return { data, error };
    }),
  );

  const failedDraft = draftResults.find((result) => result.error);
  if (failedDraft?.error) {
    return NextResponse.json({ ok: false, error: failedDraft.error.message }, { status: 500 });
  }

  const failedPublished = publishedResults.find((result) => result.error);
  if (failedPublished?.error) {
    return NextResponse.json({ ok: false, error: failedPublished.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updates: publishedResults.map((result) => ({
      key: result.data?.key ?? null,
      draftUpdatedAt: null,
      publishedUpdatedAt: result.data?.updated_at ?? null,
    })),
  });
}
