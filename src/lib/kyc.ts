import { seeded } from "./utils";

/* -------------------------------------------------------------------------- */
/*  KYC model                                                                  */
/* -------------------------------------------------------------------------- */

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export type KycDocType =
  | "id-front"
  | "id-back"
  | "selfie"
  | "proof-of-address";

export const DOC_LABELS: Record<KycDocType, string> = {
  "id-front": "ID / passport — front",
  "id-back": "ID / passport — back",
  selfie: "Selfie with ID",
  "proof-of-address": "Proof of address",
};

export const REQUIRED_DOCS: KycDocType[] = [
  "id-front",
  "id-back",
  "selfie",
  "proof-of-address",
];

export type IdType = "National ID" | "Passport" | "Driving Licence";

/**
 * One uploaded document.
 *
 * We deliberately do NOT keep the file bytes — only metadata. Real identity
 * documents must be stored encrypted, server-side, with strict access control;
 * localStorage is never an acceptable home for them. `specimen` drives a
 * placeholder preview in the admin console so the review flow can be shown
 * without handling anyone's real ID.
 */
export type KycDocument = {
  type: KycDocType;
  fileName: string;
  fileSize: number;
  uploadedAt: number;
  specimen?: number; // 0–3, selects a placeholder preview style
};

export type KycProfile = {
  status: KycStatus;
  idType: IdType;
  /** Only the last characters are ever shown; full number is never displayed. */
  idNumberMasked: string;
  dateOfBirth: string;
  residentialAddress: string;
  documents: KycDocument[];
  submittedAt: number | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
};

export const STATUS_META: Record<
  KycStatus,
  { label: string; tone: "mint" | "amber" | "rose" | "slate"; blurb: string }
> = {
  unverified: {
    label: "Not verified",
    tone: "slate",
    blurb: "Identity check not started.",
  },
  pending: {
    label: "Under review",
    tone: "amber",
    blurb: "Documents submitted, awaiting a compliance decision.",
  },
  verified: {
    label: "Verified",
    tone: "mint",
    blurb: "Identity confirmed. Withdrawals are enabled.",
  },
  rejected: {
    label: "Rejected",
    tone: "rose",
    blurb: "Something was wrong with the submission — please re-submit.",
  },
};

/** Mask an id number so only the last four characters survive. */
export function maskId(value: string) {
  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return clean;
  return `${"•".repeat(clean.length - 4)}${clean.slice(-4)}`;
}

/* -------------------------------------------------------------------------- */
/*  Demo user directory (admin console)                                        */
/*                                                                             */
/*  Seeded so the admin table is populated and stable across renders. The      */
/*  real signed-in user is layered on top of this at runtime by the admin      */
/*  store, so an operator can approve their own live submission during a demo.  */
/* -------------------------------------------------------------------------- */

export type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  flag: string;
  accountType: "Standard" | "ECN" | "Pro" | "Swap-Free";
  balance: number;
  equity: number;
  deposits: number;
  withdrawals: number;
  openTrades: number;
  copying: number;
  joinedAt: number;
  lastActiveAt: number;
  flagged: boolean;
  kyc: KycProfile;
  /** Marks the row that mirrors the live signed-in session. */
  isCurrentSession?: boolean;
};

const FIRST = ["Brian", "Amina", "Joseph", "Grace", "David", "Fatima", "Peter", "Zainab", "Samuel", "Mercy", "Kevin", "Aisha", "Daniel", "Ngozi", "Emmanuel", "Chloe", "Victor", "Nadia", "Collins", "Ruth", "Ibrahim", "Wanjiku", "Tunde", "Priya", "Lucas", "Halima", "Otieno", "Sofia", "Kwame", "Leila"];
const LAST = ["Kimani", "Okafor", "Otieno", "Wanjiru", "Mwangi", "Hassan", "Njoroge", "Ali", "Mutua", "Achieng", "Omondi", "Yusuf", "Kamau", "Eze", "Ochieng", "Mensah", "Adeyemi", "Farah", "Kiptoo", "Nyong'o", "Diallo", "Bello", "Mwende", "Sharma", "Barnes", "Suleiman", "Kariuki", "Santos", "Boateng", "Haddad"];

const COUNTRIES: [string, string][] = [
  ["Kenya", "🇰🇪"], ["Nigeria", "🇳🇬"], ["South Africa", "🇿🇦"], ["Ghana", "🇬🇭"],
  ["Tanzania", "🇹🇿"], ["Uganda", "🇺🇬"], ["United Kingdom", "🇬🇧"], ["UAE", "🇦🇪"],
  ["India", "🇮🇳"], ["Egypt", "🇪🇬"],
];

const ID_TYPES: IdType[] = ["National ID", "Passport", "Driving Licence"];
const ACCOUNT_TYPES: AdminUser["accountType"][] = ["Standard", "ECN", "Pro", "Swap-Free"];
const CITIES = ["Nairobi", "Lagos", "Accra", "Kampala", "Dar es Salaam", "Mombasa", "Abuja", "Nakuru"];

const DAY = 86_400_000;

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

export function buildDemoUsers(count = 28): AdminUser[] {
  const rand = seeded(556677);
  const now = Date.now();
  const users: AdminUser[] = [];

  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)]!;
    const last = LAST[Math.floor(rand() * LAST.length)]!;
    const [country, flag] = COUNTRIES[Math.floor(rand() * COUNTRIES.length)]!;

    // Weight statuses toward a realistic operational mix: a queue of pending
    // reviews, a majority already verified, a few rejected and unstarted.
    const roll = rand();
    const status: KycStatus =
      roll < 0.28 ? "pending" : roll < 0.74 ? "verified" : roll < 0.88 ? "unverified" : "rejected";

    const idType = ID_TYPES[Math.floor(rand() * ID_TYPES.length)]!;
    const rawId =
      idType === "Passport"
        ? `A${pad(Math.floor(rand() * 9_999_999), 7)}`
        : pad(Math.floor(rand() * 99_999_999), 8);

    const joinedAt = now - Math.floor(rand() * 420 + 3) * DAY;
    const submitted =
      status === "unverified" ? null : joinedAt + Math.floor(rand() * 6 + 1) * DAY;
    const reviewed =
      status === "verified" || status === "rejected"
        ? (submitted ?? joinedAt) + Math.floor(rand() * 3 + 1) * DAY
        : null;

    const deposits = Math.round((rand() * 8000 + 120) / 10) * 10;
    const withdrawals = Math.round(deposits * rand() * 0.6);
    const balance = Math.max(0, Math.round((deposits - withdrawals + (rand() - 0.4) * 1500) * 100) / 100);

    const documents: KycDocument[] =
      status === "unverified"
        ? []
        : REQUIRED_DOCS.map((type, d) => ({
            type,
            fileName: `${type}_${first.toLowerCase()}.jpg`,
            fileSize: Math.round(rand() * 2_400_000 + 300_000),
            uploadedAt: (submitted ?? joinedAt) - d * 60_000,
            specimen: Math.floor(rand() * 4),
          }));

    users.push({
      id: `u-${pad(i + 1, 4)}`,
      firstName: first,
      lastName: last,
      email: `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, "")}@${pick(rand, ["gmail.com", "outlook.com", "yahoo.com", "proton.me"])}`,
      phone: `+254 7${pad(Math.floor(rand() * 99), 2)} ${pad(Math.floor(rand() * 999), 3)} ${pad(Math.floor(rand() * 999), 3)}`,
      country,
      flag,
      accountType: ACCOUNT_TYPES[Math.floor(rand() * ACCOUNT_TYPES.length)]!,
      balance,
      equity: Math.round((balance + (rand() - 0.5) * 600) * 100) / 100,
      deposits,
      withdrawals,
      openTrades: Math.floor(rand() * 9),
      copying: Math.floor(rand() * 6),
      joinedAt,
      lastActiveAt: now - Math.floor(rand() * 96) * 3_600_000,
      flagged: rand() < 0.09,
      kyc: {
        status,
        idType,
        idNumberMasked: maskId(rawId),
        dateOfBirth: `${1972 + Math.floor(rand() * 32)}-${pad(Math.floor(rand() * 12) + 1, 2)}-${pad(Math.floor(rand() * 28) + 1, 2)}`,
        residentialAddress: `${Math.floor(rand() * 400) + 1} ${pick(rand, ["Moi", "Kenyatta", "Ngong", "Waiyaki", "Uhuru", "Kimathi"])} Avenue, ${pick(rand, CITIES)}`,
        documents,
        submittedAt: submitted,
        reviewedAt: reviewed,
        reviewedBy: reviewed ? "compliance@primestone.com" : null,
        rejectionReason:
          status === "rejected"
            ? pick(rand, [
                "ID photo blurred — details not legible.",
                "Selfie does not match the ID document.",
                "Proof of address older than 3 months.",
                "Document appears to be expired.",
              ])
            : null,
      },
    });
  }

  // Newest submissions to the top of the review queue.
  return users.sort((a, b) => (b.kyc.submittedAt ?? 0) - (a.kyc.submittedAt ?? 0));
}

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

export function kycCounts(users: AdminUser[]) {
  return users.reduce(
    (acc, u) => {
      acc[u.kyc.status]++;
      return acc;
    },
    { unverified: 0, pending: 0, verified: 0, rejected: 0 } as Record<KycStatus, number>,
  );
}
