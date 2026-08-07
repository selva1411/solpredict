import { NextResponse } from "next/server";
import { getErrorMessage } from "./errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverError(err: unknown) {
  const message = getErrorMessage(err);
  console.error("[API Error]", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function serviceUnavailable(message = "Database not available") {
  return NextResponse.json({ error: message }, { status: 503 });
}
