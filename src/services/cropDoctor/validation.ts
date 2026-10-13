// Client-side checks that mirror the documented rules, so obvious mistakes are
// caught before a rate-limited (5 per hour) diagnosis request is spent. The
// server stays the authority: its field errors are shown too.

export type FormFieldName =
  | "crop"
  | "photo"
  | "sowingDate"
  | "areaAcres"
  | "waterLitresPerAcre"
  | "symptoms";

/** Error codes; the screen maps each to a localized string. */
export type FormErrorCode =
  | "required"
  | "dateFormat"
  | "dateFuture"
  | "areaRange"
  | "positive"
  | "symptomsLength";

export type FormValues = {
  cropId: number | null;
  hasPhoto: boolean;
  sowingDate: string;
  areaAcres: string;
  waterLitresPerAcre: string;
  symptoms: string;
};

export const SYMPTOMS_MIN = 10;
export const SYMPTOMS_MAX = 500;
export const MAX_AREA_ACRES = 500;

/** Local calendar date as YYYY-MM-DD. */
export function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The local date `days` days before today, as YYYY-MM-DD. */
export function daysAgoDate(days: number, now: Date = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return formatDate(date);
}

/** Turns typed digits into YYYY-MM-DD as the farmer types. */
export function maskDate(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  // Rejects 2026-02-31 and similar, which Date would silently roll over.
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

export function toPositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function validateForm(
  values: FormValues,
  today: Date = new Date(),
): Partial<Record<FormFieldName, FormErrorCode>> {
  const errors: Partial<Record<FormFieldName, FormErrorCode>> = {};

  if (values.cropId === null) errors.crop = "required";
  if (!values.hasPhoto) errors.photo = "required";

  if (!values.sowingDate) {
    errors.sowingDate = "required";
  } else {
    const date = parseDate(values.sowingDate);
    if (!date) errors.sowingDate = "dateFormat";
    else if (formatDate(date) > formatDate(today)) errors.sowingDate = "dateFuture";
  }

  const area = toPositiveNumber(values.areaAcres);
  if (!values.areaAcres.trim()) errors.areaAcres = "required";
  else if (area === null || area > MAX_AREA_ACRES) errors.areaAcres = "areaRange";

  if (!values.waterLitresPerAcre.trim()) errors.waterLitresPerAcre = "required";
  else if (toPositiveNumber(values.waterLitresPerAcre) === null) {
    errors.waterLitresPerAcre = "positive";
  }

  const symptoms = values.symptoms.trim();
  if (symptoms && (symptoms.length < SYMPTOMS_MIN || symptoms.length > SYMPTOMS_MAX)) {
    errors.symptoms = "symptomsLength";
  }

  return errors;
}

/** Normalizes a typed decimal (accepts a comma) into the string the API takes. */
export function toDecimalString(value: string): string {
  return String(toPositiveNumber(value) ?? value.trim());
}

/** Keeps digits and a leading plus, so the dialler gets a clean number. */
export function toDialNumber(phone: string): string {
  const trimmed = phone.trim();
  return (trimmed.startsWith("+") ? "+" : "") + trimmed.replace(/\D/g, "");
}
