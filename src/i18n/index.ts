/**
 * Internationalization configuration.
 *
 * Supports:
 * - English
 * - Marathi
 * - Hindi
 *
 * The selected language is stored locally and restored
 * when the application starts again.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import hi from "./locales/hi.json";
import mr from "./locales/mr.json";

const LANGUAGE_STORAGE_KEY = "@ashwamedhmart_language";

export const SUPPORTED_LANGUAGES = ["en", "mr", "hi"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const resources = {
  en: {
    translation: en,
  },
  mr: {
    translation: mr,
  },
  hi: {
    translation: hi,
  },
};

/**
 * Returns a supported language from a device locale.
 *
 * Unsupported languages fall back to English.
 */
function getDeviceLanguage(): SupportedLanguage {
  const deviceLanguage = Localization.getLocales()[0]?.languageCode;

  if (
    deviceLanguage &&
    SUPPORTED_LANGUAGES.includes(deviceLanguage as SupportedLanguage)
  ) {
    return deviceLanguage as SupportedLanguage;
  }

  return "en";
}

/**
 * Initialize i18next.
 *
 * English is used initially. The saved language is loaded
 * immediately after initialization.
 */
i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",

  interpolation: {
    escapeValue: false,
  },
});

/**
 * Load the saved language.
 *
 * If no language has been saved yet, the device language
 * is used.
 */
export async function initializeLanguage(): Promise<SupportedLanguage> {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

    const language: SupportedLanguage =
      savedLanguage &&
      SUPPORTED_LANGUAGES.includes(savedLanguage as SupportedLanguage)
        ? (savedLanguage as SupportedLanguage)
        : getDeviceLanguage();

    await i18n.changeLanguage(language);
    return language;
  } catch (error) {
    console.error("Failed to initialize language:", error);

    await i18n.changeLanguage("en");
    return "en";
  }
}

/**
 * Change and save the application language.
 */
export async function setLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);

  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
}

export default i18n;
