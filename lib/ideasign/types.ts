export const IDEA_SIGN_STATUSES = [
  "przygotowana",
  "wysłana",
  "otwarta",
  "uwierzytelniona",
  "oczekuje_na_podpis_klienta",
  "częściowo_podpisana",
  "zawarta",
  "wygasła",
  "anulowana",
] as const;

export type IdeaSignStatus = (typeof IDEA_SIGN_STATUSES)[number];
export type IdeaSignOtpPurpose = "entry" | "signature";

export const IDEA_SIGN_CONTRACT_SIGNING_LOCATIONS = [
  "business_premises",
  "scheduled_home_visit",
  "unscheduled_home_visit",
  "distance",
] as const;

export type IdeaSignContractSigningLocation =
  (typeof IDEA_SIGN_CONTRACT_SIGNING_LOCATIONS)[number];

export function isIdeaSignContractSigningLocation(
  value: unknown
): value is IdeaSignContractSigningLocation {
  return IDEA_SIGN_CONTRACT_SIGNING_LOCATIONS.includes(
    value as IdeaSignContractSigningLocation
  );
}

export type IdeaSignDocumentDto = {
  id: string;
  title: string;
  fileName: string;
  kind: "agreement" | "attachment" | "consumer_information" | "withdrawal_form";
  sha256: string;
  byteSize: number;
  acceptanceRequired: boolean;
  previewUrl: string;
};

export type IdeaSignSessionDto = {
  transactionId: string;
  status: IdeaSignStatus;
  clientDisplayName: string;
  contractNumber: string;
  offeredAt: string;
  expiresAt: string;
  phoneSuffix: string;
  emailMasked: string;
  manifestSha256: string;
  offerorName: string;
  offerorCapacity: string;
  contractSigningLocation: IdeaSignContractSigningLocation;
  entryVerified: boolean;
  signerSigned: boolean;
  signerOrder: number;
  signerCount: number;
  signedSignerCount: number;
  openedDocumentIds: string[];
  documents: IdeaSignDocumentDto[];
};

export type IdeaSignFlowStep =
  | "loading"
  | "link"
  | "entry-otp"
  | "documents"
  | "signature-otp"
  | "completed"
  | "error";
