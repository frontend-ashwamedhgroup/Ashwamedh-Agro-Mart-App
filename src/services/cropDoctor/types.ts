// Types for the AI Crop Doctor API (Crop_Doctor_AI.md). Field names are the
// documented ones. Product names, SKUs, doses and recommendations are never
// returned to farmers, so none are modelled here.

export type DiagnosisOutcome = "sure" | "unsure" | "no_product" | "healthy";
export type PriceStatus = "awaiting_confirmation" | "ready" | "unavailable";
export type ConfirmationStatus = "pending" | "confirmed" | "rejected";
export type ApplicationMethod = "spray" | "soil_drench" | "drip";

export type Crop = {
  id: number;
  name: string;
  description?: string;
};

export type LikelyCondition = {
  name: string;
  evidence: string;
};

export type Disease = {
  name: string;
  symptoms: string[];
  causes: string[];
  severity?: string;
  severity_label?: string;
  preventive_measures: string[];
  recommended_treatment?: string;
};

/** Languages the server writes `diagnosis_details` in. The result opens in English. */
export type DiagnosisLanguage = "en" | "mr";
export const DEFAULT_DIAGNOSIS_LANGUAGE: DiagnosisLanguage = "en";

/** Farmer-facing text in one language. Empty means the server did not send it. */
export type DiagnosisDetails = {
  summary: string;
  disease_name: string;
  affected_crop: string;
  symptoms: string[];
  causes: string[];
  severity: string;
  severity_label: string;
  confidence_label: string;
  preventive_measures: string[];
  recommended_treatment: string;
  precautions: string;
  potential_impact: string;
  farmer_message: string;
};

export type DiagnosisPrice = {
  quote_id: number;
  amount: string;
  currency: string;
  quoted_at?: string;
};

export type Diagnosis = {
  id: number;
  image_id?: number;
  crop_name: string;
  sowing_date?: string;
  area_acres?: string;
  water_litres_per_acre?: string;
  water_warning: string;
  application_method?: ApplicationMethod | null;
  outcome: DiagnosisOutcome;
  summary: string;
  likely_conditions: LikelyCondition[];
  disease: Disease | null;
  observations: string[];
  severity?: string;
  confidence_label: string;
  farmer_message: string;
  /** Same result in English and Marathi; either may be missing on older records. */
  diagnosis_details: Record<DiagnosisLanguage, DiagnosisDetails | null>;
  disclaimer: string;
  contact_phone: string;
  price_status: PriceStatus;
  confirmation_status: ConfirmationStatus;
  price: DiagnosisPrice | null;
  created_at: string;
};

export type OfferStatus =
  | "pending"
  | "offer_available"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

export type Offer = {
  id: number;
  diagnosis_id: number;
  quote_id?: number;
  status: OfferStatus;
  offer_price: string;
  currency: string;
  expires_at?: string | null;
  created_at?: string;
};

export type DiagnosisRequest = {
  image_id: number;
  branch_id: number;
  crop_id: number;
  sowing_date: string;
  area_acres: string;
  water_litres_per_acre: string;
  application_method?: ApplicationMethod;
  symptoms?: string;
};

/** A local photo ready to upload. */
export type PickedPhoto = {
  uri: string;
  width?: number;
  height?: number;
};

export type TreatmentOrderInput = {
  address_id: number | string;
  note?: string;
};
