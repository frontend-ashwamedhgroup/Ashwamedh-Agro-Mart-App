// Picks the farmer-facing text of a diagnosis in one language from
// `diagnosis_details` (dignosisUpdate.md). English is the default. A field the
// server left empty falls back to English (`en`, then the English top-level
// field), so nothing the farmer saw before can disappear.
import {
  DEFAULT_DIAGNOSIS_LANGUAGE,
  type Diagnosis,
  type DiagnosisDetails,
  type DiagnosisLanguage,
} from "./types";

type ListKey = "symptoms" | "causes" | "preventive_measures";
type TextKey = Exclude<keyof DiagnosisDetails, ListKey>;

const other = (language: DiagnosisLanguage): DiagnosisLanguage => (language === "mr" ? "en" : "mr");

/** Languages this diagnosis has text for, default language first. */
export function availableLanguages(diagnosis: Pick<Diagnosis, "diagnosis_details">): DiagnosisLanguage[] {
  const first = DEFAULT_DIAGNOSIS_LANGUAGE;
  return [first, other(first)].filter((language) => diagnosis.diagnosis_details[language] !== null);
}

/** The language a result opens in: the default when the server sent it. */
export function initialLanguage(diagnosis: Pick<Diagnosis, "diagnosis_details">): DiagnosisLanguage {
  return availableLanguages(diagnosis)[0] ?? DEFAULT_DIAGNOSIS_LANGUAGE;
}

export function localizeDiagnosis(diagnosis: Diagnosis, language: DiagnosisLanguage): Diagnosis {
  const { en, mr } = diagnosis.diagnosis_details;
  if (!en && !mr) return diagnosis;

  // The top-level fields are English, so they rank right after `en`.
  const text = (key: TextKey, topLevel: string): string => {
    const english = en?.[key] || topLevel;
    return language === "mr" ? mr?.[key] || english : english || mr?.[key] || "";
  };
  const list = (key: ListKey, topLevel: string[]): string[] => {
    const english = en && en[key].length > 0 ? en[key] : topLevel;
    const marathi = mr?.[key] ?? [];
    if (language === "mr") return marathi.length > 0 ? marathi : english;
    return english.length > 0 ? english : marathi;
  };

  const { disease } = diagnosis;
  return {
    ...diagnosis,
    summary: text("summary", diagnosis.summary),
    confidence_label: text("confidence_label", diagnosis.confidence_label),
    farmer_message: text("farmer_message", diagnosis.farmer_message),
    // A disease card only exists when the server sent one; never invent it from details.
    disease: disease
      ? {
          ...disease,
          name: text("disease_name", disease.name),
          symptoms: list("symptoms", disease.symptoms),
          causes: list("causes", disease.causes),
          severity_label: text("severity_label", disease.severity_label ?? "") || undefined,
          preventive_measures: list("preventive_measures", disease.preventive_measures),
          recommended_treatment:
            text("recommended_treatment", disease.recommended_treatment ?? "") || undefined,
        }
      : null,
  };
}

/** Name shown on a history card: the localized disease, else the top likely condition. */
export function localizedConditionName(diagnosis: Diagnosis, language: DiagnosisLanguage): string {
  return (
    diagnosis.diagnosis_details[language]?.disease_name ||
    diagnosis.likely_conditions[0]?.name ||
    diagnosis.diagnosis_details[other(language)]?.disease_name ||
    ""
  );
}
