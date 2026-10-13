import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { ComingSoonScreen } from "../../components/ComingSoonScreen";

export default function WishlistScreen() {
  const { t } = useTranslation();

  return (
    <ComingSoonScreen
      title={t("account.wishlistTitle")}
      description={t("account.wishlistDescription")}
      backLabel={t("account.backToAccount")}
      onBack={() => router.back()}
    />
  );
}
