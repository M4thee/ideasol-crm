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
