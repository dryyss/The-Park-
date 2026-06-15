export interface FaqItem {
  id: string;
  category: "collection" | "marketplace" | "exchanges" | "shop" | "account";
  questionKey: string;
  answerKey: string;
}

export const HELP_FAQ: FaqItem[] = [
  { id: "c1", category: "collection", questionKey: "qCollectionVersions", answerKey: "aCollectionVersions" },
  { id: "c2", category: "collection", questionKey: "qCollectionMissing", answerKey: "aCollectionMissing" },
  { id: "m1", category: "marketplace", questionKey: "qMarketplacePayment", answerKey: "aMarketplacePayment" },
  { id: "m2", category: "marketplace", questionKey: "qMarketplacePrice", answerKey: "aMarketplacePrice" },
  { id: "e1", category: "exchanges", questionKey: "qExchangeValidation", answerKey: "aExchangeValidation" },
  { id: "e2", category: "exchanges", questionKey: "qExchangeSecured", answerKey: "aExchangeSecured" },
  { id: "s1", category: "shop", questionKey: "qShopOfficial", answerKey: "aShopOfficial" },
  { id: "s2", category: "shop", questionKey: "qShopShipping", answerKey: "aShopShipping" },
  { id: "a1", category: "account", questionKey: "qAccountMinor", answerKey: "aAccountMinor" },
  { id: "a2", category: "account", questionKey: "qAccountData", answerKey: "aAccountData" },
];
