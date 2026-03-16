// v1 "exact-ish": whitelist ZIP codes in Onondaga + Madison counties.
// We'll start with a small list and expand as you confirm service towns/ZIPs.

const ONONDAGA_MADISON_ZIPS = new Set([
  // Onondaga (sample starters)
  "13031", // Camillus
  "13057", // East Syracuse
  "13066", // Fayetteville
  "13104", // Manlius
  "13108", // Marcellus
  "13152", // Skaneateles
  "13202", // Syracuse
  "13203",
  "13204",
  "13205",
  "13206",
  "13207",
  "13208",
  "13209",
  "13210",
  "13211",
  "13212",
  "13214",
  "13215",
  "13219",
  "13224",

  // Madison (sample starters)
  "13035", // Cazenovia
  "13037", // Chittenango
  "13082", // Kirkville
  "13122", // New Woodstock
  "13154", // Sullivan
  "13346", // Hamilton
  "13348", // Lebanon
]);

export function isServicedZip(zipRaw: string): boolean {
  const zip = (zipRaw || "").trim();
  if (!/^\d{5}$/.test(zip)) return false;
  return ONONDAGA_MADISON_ZIPS.has(zip);
}