export type ValidationRule<T> = {
  key: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
};

export function validate<T extends Record<string, unknown>>(data: T, rules: ValidationRule<T>[]): string | null {
  for (const rule of rules) {
    const val = data[rule.key];
    const key = rule.key;

    if (val === undefined || val === null) {
      if (rule.required) return `${key} is required`;
      continue;
    }

    if (rule.type === "string" && typeof val !== "string") return `${key} must be a string`;
    if (rule.type === "number" && typeof val !== "number") return `${key} must be a number`;
    if (rule.type === "boolean" && typeof val !== "boolean") return `${key} must be a boolean`;

    if (typeof val === "string" && rule.min !== undefined && val.length < rule.min) {
      return `${key} must be at least ${rule.min} characters`;
    }
    if (typeof val === "string" && rule.max !== undefined && val.length > rule.max) {
      return `${key} must be at most ${rule.max} characters`;
    }
    if (typeof val === "number" && rule.min !== undefined && val < rule.min) {
      return `${key} must be at least ${rule.min}`;
    }
    if (typeof val === "number" && rule.max !== undefined && val > rule.max) {
      return `${key} must be at most ${rule.max}`;
    }
    if (typeof val === "string" && rule.pattern && !rule.pattern.test(val)) {
      return `${key} format is invalid`;
    }
  }
  return null;
}

export const WALLET_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const SIGNATURE_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
export const PUBLIC_KEY_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
