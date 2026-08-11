import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getRuntimeSettingsForTenant } from "@/lib/tenant/server";

const LOGO_BUCKET = "retail-site-assets";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

async function ensureLogoBucket() {
  const { data: existingBucket, error: getBucketError } = await supabaseAdmin.storage.getBucket(LOGO_BUCKET);

  if (!getBucketError && existingBucket) {
    return;
  }

  const bucketMissing = getBucketError?.message?.toLowerCase().includes("not found");
  if (getBucketError && !bucketMissing) {
    throw new Error(`Could not verify storage bucket "${LOGO_BUCKET}": ${getBucketError.message}`);
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(LOGO_BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE_BYTES,
    allowedMimeTypes: [...ALLOWED_TYPES],
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(
      `Storage bucket "${LOGO_BUCKET}" is missing and could not be created automatically: ${createError.message}`,
    );
  }
}

function formatStorageError(message: string) {
  if (message.toLowerCase().includes("bucket not found")) {
    return `Storage bucket "${LOGO_BUCKET}" is missing. Run the latest Supabase migrations or local reset, then try the logo upload again.`;
  }

  return message;
}

function fileExtension(contentType: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "jpg";
  }
}

export async function POST(req: Request) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Missing file." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Only JPG, PNG, WEBP, and SVG images are supported." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Logo must be 5MB or smaller." },
        { status: 400 },
      );
    }

    await ensureLogoBucket();

    const tenant = adminAuth.session.business;
    const runtime = await getRuntimeSettingsForTenant(tenant.id);
    const ext = fileExtension(file.type);
    const path = `${runtime.storageNamespace}/retail-header-logo/${tenant.id}/${crypto.randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(LOGO_BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: formatStorageError(uploadError.message) }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from(LOGO_BUCKET).getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
      path,
    });
  } catch (error) {
    const message = error instanceof Error ? formatStorageError(error.message) : "Logo upload failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const adminAuth = await requireAdminOwnerForApi();
  if (!adminAuth.ok) return adminAuth.response;

  try {
    const url = new URL(req.url);
    const path = (url.searchParams.get("path") || "").trim();

    if (!path) {
      return NextResponse.json({ ok: false, error: "Missing file path." }, { status: 400 });
    }

    const runtime = await getRuntimeSettingsForTenant(adminAuth.session.business.id);
    if (!path.startsWith(`${runtime.storageNamespace}/`)) {
      return NextResponse.json({ ok: false, error: "Logo path is not available for this business." }, { status: 403 });
    }

    await ensureLogoBucket();

    const { error } = await supabaseAdmin.storage.from(LOGO_BUCKET).remove([path]);
    if (error) {
      return NextResponse.json({ ok: false, error: formatStorageError(error.message) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? formatStorageError(error.message) : "Logo removal failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
