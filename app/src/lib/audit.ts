export interface AuditEntry {
  action: string;
  actor: string;
  resource: string;
  details?: Record<string, unknown>;
  ip?: string;
  timestamp?: string;
}

export function logAudit(entry: AuditEntry) {
  const line = JSON.stringify({
    level: "AUDIT",
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
  console.log(line);
}
