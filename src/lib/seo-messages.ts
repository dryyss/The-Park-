import type { Locale } from "@/i18n/routing";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

type SeoCopy = { title: string; description: string };

const PAGES = {
  home: {
    fr: {
      title: "The Park — Collection & marketplace TCG drift/JDM",
      description:
        "Collectionnez, échangez et vendez vos cartes The Park. Boutique officielle, marketplace C2C, enchères et classements communautaires.",
    },
    en: {
      title: "The Park — Drift/JDM TCG collection & marketplace",
      description:
        "Collect, trade and sell The Park cards. Official shop, C2C marketplace, auctions and community rankings.",
    },
    ja: {
      title: "The Park — ドリフト/JDM TCG コレクション＆マーケット",
      description:
        "The Park のカードをコレクション・交換・販売。公式ショップ、C2C マーケット、オークション、ランキング。",
    },
  },
  boutique: {
    fr: {
      title: "Boutique officielle — Boosters, displays & merch",
      description: "Achetez les produits officiels The Park : boosters, displays, decks et merchandising JDM.",
    },
    en: {
      title: "Official shop — Boosters, displays & merch",
      description: "Buy official The Park products: boosters, displays, decks and JDM merch.",
    },
    ja: {
      title: "公式ショップ — ブースター・ディスプレイ・グッズ",
      description: "The Park 公式商品：ブースター、ディスプレイ、デッキ、JDM グッズ。",
    },
  },
  marketplace: {
    fr: {
      title: "Marketplace — Achetez & vendez des cartes",
      description:
        "Marketplace communautaire The Park : annonces entre collectionneurs, filtres par rareté, état et version.",
    },
    en: {
      title: "Marketplace — Buy & sell cards",
      description: "The Park community marketplace: collector listings with rarity, condition and version filters.",
    },
    ja: {
      title: "マーケットプレイス — カードの売買",
      description: "The Park コミュニティマーケット：レアリティ・状態・版で絞り込み。",
    },
  },
  collection: {
    fr: {
      title: "Catalogue des cartes — Saison 1 & hors-série",
      description: "Explorez le catalogue complet The Park : raretés, holo, éditions limitées et cartes iconiques JDM.",
    },
    en: {
      title: "Card catalog — Season 1 & special editions",
      description: "Browse the full The Park catalog: rarities, holo finishes and limited JDM editions.",
    },
    ja: {
      title: "カードカタログ — シーズン1＆限定版",
      description: "The Park 全カタログ：レアリティ、ホロ、限定 JDM エディション。",
    },
  },
  encheres: {
    fr: {
      title: "Enchères — Cartes rares & pièces uniques",
      description: "Enchérissez sur des cartes rares et uniques du TCG The Park. Enchères sécurisées avec escrow.",
    },
    en: {
      title: "Auctions — Rare & unique cards",
      description: "Bid on rare and unique The Park TCG cards. Secure auctions with escrow.",
    },
    ja: {
      title: "オークション — レア＆ユニークカード",
      description: "The Park のレア・ユニークカードに入札。エスクロー付き安全オークション。",
    },
  },
  echanges: {
    fr: {
      title: "Échanges sécurisés entre collectionneurs",
      description: "Proposez et suivez des échanges de cartes The Park avec protection modération et garanties.",
    },
    en: {
      title: "Secure collector trades",
      description: "Propose and track The Park card trades with moderation and buyer/seller protections.",
    },
    ja: {
      title: "安全なコレクター間トレード",
      description: "The Park カードの交換を提案・追跡。モデレーションと保護付き。",
    },
  },
  saison1: {
    fr: {
      title: "Saison 1 — Univers drift & JDM",
      description: "Découvrez la Saison 1 de The Park : Trueno, DeLorean et l'univers street racing japonais.",
    },
    en: {
      title: "Season 1 — Drift & JDM universe",
      description: "Discover The Park Season 1: Trueno, DeLorean and Japanese street racing lore.",
    },
    ja: {
      title: "シーズン1 — ドリフト＆JDM 世界観",
      description: "The Park シーズン1：トゥルーノ、デロリアン、日本のストリートレース世界。",
    },
  },
  classements: {
    fr: {
      title: "Classements des collectionneurs",
      description: "Top collectionneurs The Park : complétion, raretés et activité communautaire.",
    },
    en: {
      title: "Collector rankings",
      description: "Top The Park collectors by completion, rarities and community activity.",
    },
    ja: {
      title: "コレクターランキング",
      description: "The Park トップコレクター：コンプ率、レアリティ、コミュニティ活動。",
    },
  },
  aide: {
    fr: {
      title: "Centre d'aide — Sécurité & règles",
      description: "Guides The Park : envoi sécurisé, déballage, litiges, garanties et bonnes pratiques d'échange.",
    },
    en: {
      title: "Help center — Safety & rules",
      description: "The Park guides: secure shipping, unboxing, disputes, guarantees and trade best practices.",
    },
    ja: {
      title: "ヘルプセンター — 安全とルール",
      description: "The Park ガイド：安全発送、開封、紛争、保証、交換のベストプラクティス。",
    },
  },
  saison2: {
    fr: {
      title: "Saison 2 — Bientôt disponible",
      description: "La Saison 2 de The Park arrive bientôt. Suivez les annonces de drop et préparez votre collection.",
    },
    en: {
      title: "Season 2 — Coming soon",
      description: "The Park Season 2 is coming soon. Follow drop announcements and prepare your collection.",
    },
    ja: {
      title: "シーズン2 — 近日公開",
      description: "The Park シーズン2が近日公開。ドロップ情報をフォローしてコレクションを準備。",
    },
  },
  horsSerie: {
    fr: {
      title: "Hors-série — Cartes spéciales & collaborations",
      description: "Explorez les cartes hors-série The Park : éditions limitées, collaborations et pièces iconiques.",
    },
    en: {
      title: "Special editions — Limited & collaboration cards",
      description: "Explore The Park special edition cards: limited runs, collaborations and iconic pieces.",
    },
    ja: {
      title: "外伝 — 限定＆コラボカード",
      description: "The Park の外伝カード：限定版、コラボ、象徴的なカードを探索。",
    },
  },
  drop: {
    fr: {
      title: "Prochains drops — Nouveautés TCG",
      description: "Découvrez les prochains drops The Park : boosters, displays et éditions limitées à venir.",
    },
    en: {
      title: "Upcoming drops — New TCG releases",
      description: "Discover upcoming The Park drops: boosters, displays and limited editions on the way.",
    },
    ja: {
      title: "次回ドロップ — 新商品情報",
      description: "The Park の次回ドロップ：ブースター、ディスプレイ、限定版の情報。",
    },
  },
  trophees: {
    fr: {
      title: "Trophées & badges collectionneurs",
      description: "Débloquez des trophées The Park : complétion, raretés, activité marketplace et défis communautaires.",
    },
    en: {
      title: "Trophies & collector badges",
      description: "Unlock The Park trophies: completion, rarities, marketplace activity and community challenges.",
    },
    ja: {
      title: "トロフィー＆コレクターバッジ",
      description: "The Park のトロフィーを解除：コンプ率、レアリティ、マーケット活動、コミュニティチャレンジ。",
    },
  },
  recherche: {
    fr: {
      title: "Recherche de cartes — Catalogue TCG",
      description: "Recherchez des cartes The Park par nom, rareté ou version. Catalogue complet du TCG drift/JDM.",
    },
    en: {
      title: "Card search — TCG catalog",
      description: "Search The Park cards by name, rarity or version. Full drift/JDM TCG catalog.",
    },
    ja: {
      title: "カード検索 — TCG カタログ",
      description: "名前・レアリティ・版で The Park カードを検索。ドリフト/JDM TCG 全カタログ。",
    },
  },
} as const satisfies Record<string, Record<Locale, SeoCopy>>;

export type SeoPageKey = keyof typeof PAGES;

export function getSeoCopy(page: SeoPageKey, locale: string): SeoCopy {
  const entry = PAGES[page];
  const loc = (locale in entry ? locale : "fr") as Locale;
  return entry[loc];
}

export function localePageMetadata(page: SeoPageKey, locale: string, pathSuffix: string): Metadata {
  const copy = getSeoCopy(page, locale);
  return pageMetadata({
    title: copy.title,
    description: copy.description,
    path: `/${locale}${pathSuffix}`,
    locale,
  });
}

/** Page de recherche avec requête : noindex pour éviter le contenu dupliqué. */
export function searchPageMetadata(locale: string, hasQuery: boolean): Metadata {
  const base = localePageMetadata("recherche", locale, "/recherche");
  if (!hasQuery) return base;
  return {
    ...base,
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  };
}

export const PRIVATE_METADATA: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};
