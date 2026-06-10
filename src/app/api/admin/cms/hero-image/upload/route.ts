import { NextResponse } from "next/server";
import { requireAdminOwnerForApi } from "@/lib/admin/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant, getRuntimeSettings } from "@/lib/tenant/server";

const HERO_IMAGE_BUCKET = "retail-site-assets";
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BUCKET_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

async function ensureHeroImageBucket() {
  const { data: existingBucket, error: getBucketError } =
    await supabaseAdmin.storage.getBucket(HERO_IMAGE_BUCKET);

  if (!getBucketError && existingBucket) {
    return;
  }

  const bucketMissing = getBucketError?.message?.toLowerCase().includes("not found");
  if (getBucketError && !bucketMissing) {
    throw new Error(`Could not verify storage bucket "${HERO_IMAGE_BUCKET}": ${getBucketError.message}`);
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(HERO_IMAGE_BUCKET, {
    public: true,
    fileSizeLimit: MAX_SIZE_BYTES,
    allowedMimeTypes: BUCKET_ALLOWED_TYPES,
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(
      `Storage bucket "${HERO_IMAGE_BUCKET}" is missing and could not be created automatically: ${createError.message}`,
    );
  }
}

function formatStorageError(message: string) {
  if (message.toLowerCase().includes("bucket not found")) {
    return `Storage bucket "${HERO_IMAGE_BUCKET}" is missing. Run the latest Supabase migrations or local reset, then try the hero image upload again.`;
  }

  return message;
}

function fileExtension(contentType: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function sanitizeFileName(name: string) {
  const baseName = name
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return baseName || "hero-image";
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
        { ok: false, error: "Only JPG, PNG, and WEBP hero images are supported." },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Hero image must be 5MB or smaller." },
        { status: 400 },
      );
    }

    await ensureHeroImageBucket();

    const [tenant, runtime] = await Promise.all([getCurrentTenant(), getRuntimeSettings()]);
    const ext = fileExtension(file.type);
    const safeName = sanitizeFileName(file.name);
    const path = `${runtime.storageNamespace}/cms/hero/${tenant.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await supabaseAdmin.storage
      .from(HERO_IMAGE_BUCKET)
      .upload(path, bytes, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ ok: false, error: formatStorageError(uploadError.message) }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from(HERO_IMAGE_BUCKET).getPublicUrl(path);

    return NextResponse.json({
      ok: true,
      url: data.publicUrl,
      path,
    });
  } catch (error) {
    const message = error instanceof Error ? formatStorageError(error.message) : "Hero image upload failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
