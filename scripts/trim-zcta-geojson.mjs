import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourcePath = path.join(rootDir, "data-source", "us-zcta-boundaries.full.geojson");
const outputPath = path.join(rootDir, "public", "data", "us-zcta-boundaries.geojson");
const envPath = path.join(rootDir, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function getFeatureZip(feature) {
  const props = feature?.properties ?? {};
  const raw = props.ZCTA5CE10 ?? props.GEOID10 ?? props.ZCTA5CE20 ?? props.zip;
  return typeof raw === "string" ? raw.trim().slice(0, 5) : null;
}

async function loadServiceAreaZips() {
  loadEnvFile(envPath);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("service_area_zips")
    .select("zip, active")
    .order("zip", { ascending: true });

  if (error) {
    throw new Error(`Could not load service_area_zips: ${error.message}`);
  }

  const rows = (data ?? []).map((row) => ({
    zip: String(row.zip ?? "").trim().slice(0, 5),
    active: row.active === true,
  })).filter((row) => /^\d{5}$/.test(row.zip));

  const allZips = new Set(rows.map((row) => row.zip));
  const activeZips = new Set(rows.filter((row) => row.active).map((row) => row.zip));

  if (allZips.size === 0) {
    throw new Error("No valid ZIPs returned from service_area_zips.");
  }

  return { allZips, activeZips, supabase };
}

function haversineMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

async function loadExpandedMapZips({ allZips, activeZips, supabase }) {
  const { data, error } = await supabase
    .from("zip_reference")
    .select("zip, state, latitude, longitude")
    .eq("state", "NY");

  if (error) {
    throw new Error(`Could not load zip_reference rows: ${error.message}`);
  }

  const refs = (data ?? [])
    .map((row) => ({
      zip: String(row.zip ?? "").trim().slice(0, 5),
      state: String(row.state ?? "").trim(),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    }))
    .filter(
      (row) =>
        /^\d{5}$/.test(row.zip) &&
        row.state === "NY" &&
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude)
    );

  const activeRefs = refs.filter((row) => activeZips.has(row.zip));
  const nearbyRadiusMiles = 18;

  const expanded = new Set(allZips);

  for (const ref of refs) {
    if (expanded.has(ref.zip)) continue;

    for (const activeRef of activeRefs) {
      if (haversineMiles(ref, activeRef) <= nearbyRadiusMiles) {
        expanded.add(ref.zip);
        break;
      }
    }
  }

  return expanded;
}

async function trimGeoJson(allowedZips) {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source GeoJSON not found at ${sourcePath}`);
  }

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

  const reader = fs.createReadStream(sourcePath, { encoding: "utf8" });
  const writer = fs.createWriteStream(outputPath, { encoding: "utf8" });

  writer.write('{"type":"FeatureCollection","features":[');

  let started = false;
  let inString = false;
  let escaping = false;
  let depth = 0;
  let current = "";
  let wroteAny = false;
  let scanned = 0;
  let kept = 0;

  for await (const chunk of reader) {
    for (let i = 0; i < chunk.length; i += 1) {
      const char = chunk[i];

      if (!started) {
        current += char;
        const featuresIndex = current.indexOf('"features"');
        if (featuresIndex === -1) continue;

        const arrayStart = current.indexOf("[", featuresIndex);
        if (arrayStart === -1) continue;

        started = true;
        current = "";
        continue;
      }

      if (depth === 0) {
        if (char === "{") {
          current = "{";
          depth = 1;
          inString = false;
          escaping = false;
        } else if (char === "]") {
          writer.write("]}");
          writer.end();
          return { scanned, kept };
        }
        continue;
      }

      current += char;

      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;

      if (depth === 0) {
        scanned += 1;
        const feature = JSON.parse(current);
        const zip = getFeatureZip(feature);

        if (zip && allowedZips.has(zip)) {
          if (wroteAny) writer.write(",");
          writer.write(current);
          wroteAny = true;
          kept += 1;
        }

        current = "";
      }
    }
  }

  throw new Error("Unexpected end of file while scanning GeoJSON features.");
}

async function main() {
  const { allZips, activeZips, supabase } = await loadServiceAreaZips();
  const allowedZips = await loadExpandedMapZips({ allZips, activeZips, supabase });
  const { scanned, kept } = await trimGeoJson(allowedZips);

  const size = (await fs.promises.stat(outputPath)).size;
  const sizeMb = (size / (1024 * 1024)).toFixed(2);

  console.log(`Trimmed ${kept} of ${scanned} ZCTA features.`);
  console.log(`Included ${allowedZips.size} map ZIPs (service + nearby candidates).`);
  console.log(`Wrote ${outputPath} (${sizeMb} MB).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
