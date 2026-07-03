/**
 * Catalogue des succès « The Park » (liste fournie par le client — juillet 2026).
 * Source de vérité unique : le seed et la synchro runtime (badge.service) upsertent
 * ces définitions et purgent tout badge absent de cette liste.
 */

export interface BadgeCategoryDef {
  code: string;
  label: string;
  icon: string;
}

export const BADGE_CATEGORIES: BadgeCategoryDef[] = [
  { code: "apprenti", label: "Permis Apprenti", icon: "🔰" },
  { code: "garage", label: "Le Garage Parfait", icon: "🔧" },
  { code: "shibuya", label: "Le Loup de Shibuya", icon: "💸" },
  { code: "roi", label: "Roi du Park", icon: "👑" },
  { code: "heritage", label: "L'Héritage de la 1ère Édition", icon: "🥇" },
  { code: "reedition", label: "Maître de la Réédition", icon: "🔄" },
  { code: "turbo", label: "Double Turbo", icon: "🪞" },
  { code: "special", label: "Les Succès Spéciaux du Set", icon: "🏁" },
];

export interface BadgeDef {
  code: string;
  label: string;
  description: string;
  icon: string;
  category: string;
}

export const BADGE_DEFINITIONS: BadgeDef[] = [
  // ── 🔰 Permis Apprenti ────────────────────────────────────────────────────
  {
    code: "apprenti_contact_mis",
    label: "Contact Mis",
    description: "Ajoute ta toute première carte dans ton classeur virtuel.",
    icon: "🔑",
    category: "apprenti",
  },
  {
    code: "apprenti_premier_run",
    label: "Premier Run",
    description: "Effectue ton premier achat sur le marketplace de The Park.",
    icon: "🏁",
    category: "apprenti",
  },
  {
    code: "apprenti_controle_technique",
    label: "Contrôle Technique Validé",
    description: "Remplis ton profil à 100 % (avatar, pseudo, description).",
    icon: "✅",
    category: "apprenti",
  },
  {
    code: "apprenti_appel_de_phares",
    label: "Appel de Phares",
    description: "Propose ton premier échange à un autre membre de la communauté.",
    icon: "💡",
    category: "apprenti",
  },

  // ── 🔧 Le Garage Parfait ──────────────────────────────────────────────────
  {
    code: "garage_puriste_du_bloc",
    label: "Puriste du Bloc",
    description: "Atteins 100 % de complétion sur le set de la Saison 1 « Moteur Forgé ».",
    icon: "🧱",
    category: "garage",
  },
  {
    code: "garage_tofu_delivery",
    label: "Tofu Delivery",
    description: "Ajoute la carte TOYOTA COROLLA AE86 TRUENO dans sa rareté maximale à ton classeur.",
    icon: "🚚",
    category: "garage",
  },
  {
    code: "garage_eveil_du_godzilla",
    label: "L'Éveil du Godzilla",
    description: "Rassemble toutes les versions d'une Skyline, comme la NISSAN SKYLINE GTR R35 ou la R34 TITANESQUE.",
    icon: "🦖",
    category: "garage",
  },
  {
    code: "garage_moteur_serre",
    label: "Moteur Serré",
    description: "Possède 100 cartes distinctes dans ta collection globale.",
    icon: "🔩",
    category: "garage",
  },
  {
    code: "garage_rotatif_hurlant",
    label: "Rotatif Hurlant",
    description: "Ajoute la MAZDA RX7 FD PRÉPARÉE à ton garage.",
    icon: "🌀",
    category: "garage",
  },

  // ── 💸 Le Loup de Shibuya ─────────────────────────────────────────────────
  {
    code: "shibuya_sniper_de_l_ombre",
    label: "Sniper de l'Ombre",
    description: "Remporte une enchère dans les 15 dernières secondes avant la fin du compte à rebours.",
    icon: "🎯",
    category: "shibuya",
  },
  {
    code: "shibuya_business_de_touge",
    label: "Business de Touge",
    description: "Conclus 10 échanges réussis avec d'autres collectionneurs.",
    icon: "⛰️",
    category: "shibuya",
  },
  {
    code: "shibuya_billet_violet",
    label: "Billet Violet",
    description: "Dépasse les 500 € de ventes cumulées via ton dashboard vendeur.",
    icon: "💴",
    category: "shibuya",
  },
  {
    code: "shibuya_gommards_neufs",
    label: "Gommards Neufs",
    description: "Achète une carte « Fraîchement listée » dans les 5 minutes suivant son apparition sur le marché.",
    icon: "🛞",
    category: "shibuya",
  },
  {
    code: "shibuya_flambeur_de_tokyo",
    label: "Flambeur de Tokyo",
    description: "Remporte une enchère très disputée (plus de 10 surenchères).",
    icon: "🎰",
    category: "shibuya",
  },

  // ── 👑 Roi du Park ────────────────────────────────────────────────────────
  {
    code: "roi_midnight_club",
    label: "Midnight Club",
    description: "Entre dans le Top 5 des « Top Collectionneurs » de la plateforme.",
    icon: "🌃",
    category: "roi",
  },
  {
    code: "roi_drift_king",
    label: "Drift King (D.K.)",
    description: "Atteins la 1ère place absolue du classement général.",
    icon: "🏆",
    category: "roi",
  },
  {
    code: "roi_saint_graal",
    label: "Le Saint Graal",
    description: "Obtiens l'une des très rares « Cartes Uniques » (1/1) du jeu.",
    icon: "🏵️",
    category: "roi",
  },
  {
    code: "roi_de_la_glisse",
    label: "Roi de la Glisse",
    description: "Maintiens ta position dans le Top 3 du leaderboard pendant 7 jours consécutifs.",
    icon: "👑",
    category: "roi",
  },

  // ── 🥇 L'Héritage de la 1ère Édition ──────────────────────────────────────
  {
    code: "heritage_pionnier_du_park",
    label: "Pionnier du Park",
    description: "Obtiens ta toute première carte « Moteur Forgé » avec le stamp 1st Edition.",
    icon: "🚩",
    category: "heritage",
  },
  {
    code: "heritage_archeologue_du_bitume",
    label: "Archéologue du Bitume",
    description: "Rassemble 10 cartes Communes différentes arborant le stamp 1st Edition.",
    icon: "⛏️",
    category: "heritage",
  },
  {
    code: "heritage_saint_graal_forge",
    label: "Saint Graal Forgé",
    description: "Obtiens une carte Légendaire (comme la DMC DELOREAN D'ALEXANDRE ou la NISSAN SKYLINE R33 MIDNIGHT) en version 1st Edition.",
    icon: "⚜️",
    category: "heritage",
  },
  {
    code: "heritage_age_d_or_du_drift",
    label: "L'Âge d'Or du Drift",
    description: "Ajoute l'une des deux cartes Gold (HONDA NSX TYPE-R NA1 ou TOYOTA COROLLA AE86 TRUENO) avec le stamp 1st Edition à ton coffre.",
    icon: "🥇",
    category: "heritage",
  },

  // ── 🔄 Maître de la Réédition ─────────────────────────────────────────────
  {
    code: "reedition_moteur_echange_standard",
    label: "Moteur Échange Standard",
    description: "Collectionne 50 cartes « Réédition » de la série Moteur Forgé.",
    icon: "🔄",
    category: "reedition",
  },
  {
    code: "reedition_flotte_complete",
    label: "Flotte Complète",
    description: "Possède l'intégralité des cartes Rares du set (de la NISSAN SKYLINE R31 à la CHEVROLET CAMARO 1969) en version Réédition.",
    icon: "🚛",
    category: "reedition",
  },
  {
    code: "reedition_seconde_jeunesse",
    label: "Seconde Jeunesse",
    description: "Atteins 100 % de complétion sur le set « Moteur Forgé » en n'utilisant que des cartes issues de la Réédition.",
    icon: "✨",
    category: "reedition",
  },

  // ── 🪞 Double Turbo ───────────────────────────────────────────────────────
  {
    code: "turbo_miroir_jdm",
    label: "Miroir JDM",
    description: "Possède la même carte exacte en version 1st Edition ET en version Réédition (ex : la MAZDA RX7 FD PRÉPARÉE Ultra Rare).",
    icon: "🪞",
    category: "turbo",
  },
  {
    code: "turbo_garage_bipolaire",
    label: "Garage Bipolaire",
    description: "Rassemble 15 paires de cartes (1st Edition + Réédition) dans ton classeur.",
    icon: "🎭",
    category: "turbo",
  },
  {
    code: "turbo_vision_peripherique",
    label: "Vision Périphérique",
    description: "Possède l'intégralité des cartes Ultra Rares en double : le set complet en 1st Edition ET le set complet en Réédition.",
    icon: "👁️",
    category: "turbo",
  },

  // ── 🏁 Les Succès Spéciaux du Set ─────────────────────────────────────────
  {
    code: "special_elu_du_touge",
    label: "L'Élu du Touge",
    description: "Sécurise l'une des 2 cartes Uniques du jeu, comme l'incroyable TOYOTA COROLLA AE86.",
    icon: "⚡",
    category: "special",
  },
  {
    code: "special_culture_de_l_ombre",
    label: "Culture de l'Ombre",
    description: "Ajoute une carte Promotionnelle à ta collection, comme la NISSAN LEOPARD F31 BOSOZOKU ou la NISSAN SKYLINE R34 TITANESQUE.",
    icon: "🌑",
    category: "special",
  },
];

const DEF_BY_CODE = new Map(BADGE_DEFINITIONS.map((b) => [b.code, b]));
const SORT_INDEX = new Map(BADGE_DEFINITIONS.map((b, i) => [b.code, i]));

export function badgeDefinition(code: string): BadgeDef | undefined {
  return DEF_BY_CODE.get(code);
}

/** Icône d'un badge (fallback pour d'éventuels codes hérités en base). */
export function badgeIcon(code: string): string {
  return DEF_BY_CODE.get(code)?.icon ?? "★";
}

/** Catégorie d'un badge (fallback : dernière catégorie). */
export function badgeCategory(code: string): BadgeCategoryDef {
  const catCode = DEF_BY_CODE.get(code)?.category;
  return BADGE_CATEGORIES.find((c) => c.code === catCode) ?? BADGE_CATEGORIES[BADGE_CATEGORIES.length - 1];
}

/** Ordre d'affichage officiel (ordre de la liste client). */
export function badgeSortIndex(code: string): number {
  return SORT_INDEX.get(code) ?? Number.MAX_SAFE_INTEGER;
}
