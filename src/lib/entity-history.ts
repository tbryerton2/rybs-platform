import type { SupabaseClient } from "@supabase/supabase-js";

export type EntityHistoryEntry = {
  entityType: "customer" | "booking" | "employee";
  entityId: string;
  fieldName: string;
  oldValue?: unknown;
  newValue?: unknown;
  changedByType?: "system" | "admin" | "customer";
  changedById?: string | null;
  changeReason?: string | null;
};

function serializeHistoryValue(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export async function recordEntityHistory(
  supabase: SupabaseClient,
  entries: EntityHistoryEntry[],
) {
  if (entries.length === 0) return;

  const { error } = await supabase.from("entity_history").insert(
    entries.map((entry) => ({
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      field_name: entry.fieldName,
      old_value: serializeHistoryValue(entry.oldValue),
      new_value: serializeHistoryValue(entry.newValue),
      changed_by_type: entry.changedByType ?? "system",
      changed_by_id: entry.changedById ?? null,
      change_reason: entry.changeReason ?? null,
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function diffEntityFields<
  TBefore extends Record<string, unknown>,
  TAfter extends Record<string, unknown>,
>(
  entityType: "customer" | "booking" | "employee",
  entityId: string,
  before: TBefore,
  after: TAfter,
  fields: Array<keyof TAfter & string>,
  options?: Pick<EntityHistoryEntry, "changedByType" | "changedById" | "changeReason">,
) {
  return fields.flatMap((fieldName) => {
    const oldValue = before[fieldName];
    const newValue = after[fieldName];
    if (serializeHistoryValue(oldValue) === serializeHistoryValue(newValue)) return [];

    return [
      {
        entityType,
        entityId,
        fieldName,
        oldValue,
        newValue,
        changedByType: options?.changedByType,
        changedById: options?.changedById,
        changeReason: options?.changeReason,
      } satisfies EntityHistoryEntry,
    ];
  });
}
