import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  initializeLanguage,
  setLanguage as persistLanguage,
  SupportedLanguage,
} from "../i18n";

type LanguageContextType = {
  language: SupportedLanguage;
  changeLanguage: (language: SupportedLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<SupportedLanguage | null>(null);

  useEffect(() => {
    let isMounted = true;

    initializeLanguage().then((initialLanguage) => {
      if (isMounted) {
        setLanguage(initialLanguage);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const changeLanguage = async (nextLanguage: SupportedLanguage) => {
    await persistLanguage(nextLanguage);
    setLanguage(nextLanguage);
  };

  if (!language) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}
