// lib/templates.ts

export interface GameTemplate {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  missionIds: string[];
  isBuiltin: boolean;
  userId: string | null;
  createdAt: string;
  activeFrom: string | null; // "MM-DD", e.g. "10-01"
  activeTo: string | null;   // "MM-DD", e.g. "10-31"
}

// Converts a raw Supabase DB row (snake_case) to GameTemplate (camelCase)
export function toGameTemplate(row: Record<string, unknown>): GameTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: row.icon as string,
    description: row.description as string | null,
    missionIds: row.mission_ids as string[],
    isBuiltin: row.is_builtin as boolean,
    userId: row.user_id as string | null,
    createdAt: row.created_at as string,
    activeFrom: row.active_from as string | null,
    activeTo: row.active_to as string | null,
  };
}
