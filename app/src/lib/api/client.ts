import { z } from "zod";
import { contracts } from "./types";
import { keys } from "./keys";

export { keys, contracts };

type SchemaKey = keyof typeof contracts;
type InferKey<K extends SchemaKey> = z.infer<(typeof contracts)[K]>;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
} as const;

/**
 * Single fetch wrapper for SolPredict. Returns the validated, typed response
 * body or throws ApiError. This is the ONLY place the app should talk to our
 * own json routes so every number is contract-checked.
 */
export async function apiFetch<T extends SchemaKey>(
  key: T,
  path: string,
  init?: RequestInit,
): Promise<InferKey<T>> {
  const res = await fetch(path, {
    ...init,
    headers: { ...DEFAULT_HEADERS, ...(init?.headers ?? {}) },
  });

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(`Invalid JSON from ${path}`, res.status);
  }

  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }

  const parsed = contracts[key].safeParse(body);
  if (!parsed.success) {
    throw new ApiError(
      `Response from ${path} failed contract validation: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      res.status,
    );
  }
  return parsed.data;
}

/** Convenience: perform a POST/PATCH/DELETE with a typed JSON body. */
export async function apiMutate(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(path, {
    method,
    headers: DEFAULT_HEADERS,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    /* ignore empty body */
  }
  if (!res.ok) {
    const msg = (parsed as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return parsed;
}