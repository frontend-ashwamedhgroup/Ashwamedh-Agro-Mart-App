import { isAxiosError } from "axios";

import { classifyError, isConnectionError, isRecord } from "../api/errors";

/** How a failed Crop Doctor call should be presented, per Crop_Doctor_AI.md. */
export type CropDoctorFailure =
  /** 400 `errors.photo`: ask for a new photo; keep every other answer. */
  | { kind: "photo"; message: string }
  /** 400 with per-field arrays: show the first string under each field. */
  | { kind: "fields"; fields: Record<string, string> }
  /** 502 / 503: nothing was saved; the farmer can simply try again. */
  | { kind: "aiUnavailable" }
  | { kind: "rateLimited" }
  /** Offline, unreachable or timed out. */
  | { kind: "connection"; timedOut: boolean }
  | { kind: "other"; error: unknown };

function firstString(value: unknown): string | undefined {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : undefined;
}

export function toFailure(error: unknown): CropDoctorFailure {
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const body: unknown = error.response?.data;
    const errors = isRecord(body) && isRecord(body.errors) ? body.errors : null;

    if (status === 400 && errors) {
      const photo = firstString(errors.photo);
      if (photo) return { kind: "photo", message: photo };

      const fields: Record<string, string> = {};
      for (const [field, value] of Object.entries(errors)) {
        const message = firstString(value);
        if (message) fields[field] = message;
      }
      if (Object.keys(fields).length > 0) return { kind: "fields", fields };
    }
    if (status === 502 || status === 503) return { kind: "aiUnavailable" };
    if (status === 429) return { kind: "rateLimited" };
  }
  if (isConnectionError(error)) {
    return { kind: "connection", timedOut: classifyError(error) === "timeout" };
  }
  return { kind: "other", error };
}
