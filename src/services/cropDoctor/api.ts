import type { ApiEnvelope } from "../../components/location/types";
import apiClient from "../api/client";
import {
  InvalidResponseError,
  isRecord,
  parseList,
  unwrapEnvelope,
} from "../api/errors";
import type {
  Crop,
  Diagnosis,
  DiagnosisOutcome,
  DiagnosisRequest,
  LikelyCondition,
  Offer,
  PickedPhoto,
  PriceStatus,
  TreatmentOrderInput,
} from "./types";

const FARMER = "/api/v1/farmer";
// The AI call can take far longer than the client's default 20 seconds, and a
// photo upload is slow on rural connections.
const SLOW_REQUEST_TIMEOUT_MS = 60_000;

const OUTCOMES: DiagnosisOutcome[] = ["sure", "unsure", "no_product", "healthy"];
const PRICE_STATUSES: PriceStatus[] = ["preparing", "ready", "unavailable"];

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

// --- parsing --------------------------------------------------------------------

const isCrop = (value: unknown): value is Crop =>
  isRecord(value) && typeof value.id === "number" && typeof value.name === "string";

function parseDiagnosis(value: unknown): Diagnosis {
  if (!isRecord(value) || typeof value.id !== "number") {
    throw new InvalidResponseError("Diagnosis is missing or malformed.");
  }
  if (!OUTCOMES.includes(value.outcome as DiagnosisOutcome)) {
    throw new InvalidResponseError("Diagnosis has an unknown outcome.");
  }
  const conditions: LikelyCondition[] = Array.isArray(value.likely_conditions)
    ? value.likely_conditions.filter(isRecord).map((entry) => ({
        name: asString(entry.name),
        evidence: asString(entry.evidence),
      }))
    : [];

  const price = isRecord(value.price) && value.price.amount != null
    ? {
        quote_id: Number(value.price.quote_id),
        amount: String(value.price.amount),
        currency: asString(value.price.currency) || "INR",
        quoted_at: asString(value.price.quoted_at) || undefined,
      }
    : null;

  // An unknown price status is treated as "no price", never as ready.
  const priceStatus = PRICE_STATUSES.includes(value.price_status as PriceStatus)
    ? (value.price_status as PriceStatus)
    : "unavailable";

  return {
    id: value.id,
    image_id: typeof value.image_id === "number" ? value.image_id : undefined,
    crop_name: asString(value.crop_name),
    sowing_date: asString(value.sowing_date) || undefined,
    area_acres: value.area_acres != null ? String(value.area_acres) : undefined,
    water_litres_per_acre:
      value.water_litres_per_acre != null ? String(value.water_litres_per_acre) : undefined,
    water_warning: asString(value.water_warning),
    application_method: (asString(value.application_method) || null) as Diagnosis["application_method"],
    outcome: value.outcome as DiagnosisOutcome,
    summary: asString(value.summary),
    likely_conditions: conditions,
    observations: Array.isArray(value.observations)
      ? value.observations.filter((o): o is string => typeof o === "string")
      : [],
    severity: asString(value.severity) || undefined,
    confidence_label: asString(value.confidence_label),
    farmer_message: asString(value.farmer_message),
    disclaimer: asString(value.disclaimer),
    contact_phone: asString(value.contact_phone),
    price_status: priceStatus,
    // The price is shown only when it is ready, whatever else the server sent.
    price: priceStatus === "ready" ? price : null,
    created_at: asString(value.created_at),
  };
}

const OFFER_STATUSES = [
  "pending",
  "offer_available",
  "accepted",
  "rejected",
  "expired",
  "converted",
];

function parseOffer(value: unknown): Offer | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    typeof value.diagnosis_id !== "number" ||
    !OFFER_STATUSES.includes(value.status as string)
  ) {
    return null;
  }
  return {
    id: value.id,
    diagnosis_id: value.diagnosis_id,
    quote_id: typeof value.quote_id === "number" ? value.quote_id : undefined,
    status: value.status as Offer["status"],
    offer_price: value.offer_price != null ? String(value.offer_price) : "",
    currency: asString(value.currency) || "INR",
    expires_at: asString(value.expires_at) || null,
    created_at: asString(value.created_at) || undefined,
  };
}

// --- endpoints ------------------------------------------------------------------

export async function fetchCrops(): Promise<Crop[]> {
  try {
    const { data } = await apiClient.get<ApiEnvelope<{ results: unknown }>>(
      `${FARMER}/crop-catalog/`,
    );
    const raw = unwrapEnvelope<{ results: unknown }>(data).results;
    const crops = parseList(raw, "Crops", isCrop);
    console.log("[CropDoctor] crops loaded", {
      received: Array.isArray(raw) ? raw.length : "not-a-list",
      valid: crops.length,
    });
    return crops;
  } catch (error) {
    console.error("[CropDoctor] crops load failed", error);
    throw error;
  }
}

/** Step 1: upload the photo. Resolves with `data.image.id`. */
export async function uploadDiagnosisImage(photo: PickedPhoto): Promise<number> {
  const form = new FormData();
  // React Native's FormData accepts a { uri, name, type } descriptor for files.
  form.append("image", {
    uri: photo.uri,
    name: "crop-photo.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  console.log("[CropDoctor] POST images", { uri: photo.uri, w: photo.width, h: photo.height });
  const started = Date.now();
  const { data } = await apiClient.post<ApiEnvelope<{ image: { id: number } }>>(
    `${FARMER}/images/`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: SLOW_REQUEST_TIMEOUT_MS,
      // Axios would otherwise try to serialize FormData as JSON.
      transformRequest: (body: unknown) => body,
    },
  );
  const image = unwrapEnvelope<{ image?: { id?: unknown } }>(data).image;
  if (!isRecord(image) || typeof image.id !== "number") {
    console.error("[CropDoctor] upload response had no image id", data);
    throw new InvalidResponseError("Upload did not return an image id.");
  }
  console.log("[CropDoctor] image upload ok", { imageId: image.id, ms: Date.now() - started });
  return image.id;
}

/** Step 2: send the form with the uploaded `image_id`. */
export async function createDiagnosis(request: DiagnosisRequest): Promise<Diagnosis> {
  const started = Date.now();
  const { data } = await apiClient.post<ApiEnvelope<{ diagnosis: unknown }>>(
    `${FARMER}/diagnoses/`,
    request,
    { timeout: SLOW_REQUEST_TIMEOUT_MS },
  );
  console.log("[CropDoctor] POST diagnoses ok", { ms: Date.now() - started });
  try {
    return parseDiagnosis(unwrapEnvelope<{ diagnosis: unknown }>(data).diagnosis);
  } catch (error) {
    // The request succeeded but the reply did not parse: show what the server sent.
    console.error("[CropDoctor] diagnosis response could not be parsed", error, data);
    throw error;
  }
}

export async function fetchDiagnoses(): Promise<Diagnosis[]> {
  const { data } = await apiClient.get<ApiEnvelope<{ results: unknown }>>(
    `${FARMER}/diagnoses/`,
  );
  const results = unwrapEnvelope<{ results: unknown }>(data).results;
  const parsed: Diagnosis[] = [];
  for (const entry of Array.isArray(results) ? results : []) {
    try {
      parsed.push(parseDiagnosis(entry));
    } catch (error) {
      // One bad record must not hide the farmer's other diagnoses.
      console.warn("[CropDoctor] skipped unparseable diagnosis in list", error, entry);
    }
  }
  return parsed.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function fetchDiagnosis(id: number | string): Promise<Diagnosis> {
  const { data } = await apiClient.get<ApiEnvelope<{ diagnosis: unknown }>>(
    `${FARMER}/diagnoses/${id}/`,
  );
  try {
    const diagnosis = parseDiagnosis(unwrapEnvelope<{ diagnosis: unknown }>(data).diagnosis);
    console.log("[CropDoctor] diagnosis loaded", {
      id: diagnosis.id,
      outcome: diagnosis.outcome,
      priceStatus: diagnosis.price_status,
      hasPrice: diagnosis.price !== null,
    });
    return diagnosis;
  } catch (error) {
    console.error("[CropDoctor] diagnosis response could not be parsed", error, data);
    throw error;
  }
}

/** All offers; the screen picks the one whose `diagnosis_id` matches. */
export async function fetchOffers(): Promise<Offer[]> {
  const { data } = await apiClient.get<ApiEnvelope<{ results: unknown }>>(
    `${FARMER}/offers/`,
  );
  const results = unwrapEnvelope<{ results: unknown }>(data).results;
  return (Array.isArray(results) ? results : [])
    .map(parseOffer)
    .filter((offer): offer is Offer => offer !== null);
}

export async function fetchOfferForDiagnosis(diagnosisId: number): Promise<Offer | null> {
  const offers = await fetchOffers();
  return offers.find((offer) => offer.diagnosis_id === diagnosisId) ?? null;
}

// The docs give accept/reject no body and no response shape, so callers re-read
// the offers afterwards instead of trusting the response.
export async function acceptOffer(offerId: number): Promise<void> {
  console.log("[CropDoctor] accept offer", { offerId });
  await apiClient.post(`${FARMER}/offers/${offerId}/accept/`);
}

export async function rejectOffer(offerId: number): Promise<void> {
  console.log("[CropDoctor] reject offer", { offerId });
  await apiClient.post(`${FARMER}/offers/${offerId}/reject/`);
}

/** Treatment cart: `POST /farmer/cart/` with `{ offer_id }`. */
export async function addOfferToTreatmentCart(offerId: number): Promise<void> {
  await apiClient.post(`${FARMER}/cart/`, { offer_id: offerId });
}

/**
 * Treatment order: `POST /farmer/orders/`. The docs do not describe the
 * response, so the new order id is read defensively and may be null.
 */
export async function placeTreatmentOrder(
  input: TreatmentOrderInput,
): Promise<number | null> {
  const { data } = await apiClient.post<ApiEnvelope<unknown>>(`${FARMER}/orders/`, input);
  const body = isRecord(data) && isRecord(data.data) ? data.data : null;
  const order = body && isRecord(body.order) ? body.order : body;
  return order && typeof order.id === "number" ? order.id : null;
}
