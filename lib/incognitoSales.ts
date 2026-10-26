export const IDEASOL_STANDARD_BANK_ACCOUNT = "33 1140 2004 0000 3302 8689 3030";
export const IDEASOL_INCOGNITO_BANK_ACCOUNT = "39 1600 1462 1786 0938 0000 0001";
export const IDEASOL_INCOGNITO_BANK_NAME = "BNP Paribas Bank Polska S.A.";

export function buildIncognitoContractBankParagraph() {
  return `Klient dokonuje płatności zaliczki oraz wynagrodzenia końcowego bezpośrednio na rachunek bankowy wykonawcy prowadzony przez ${IDEASOL_INCOGNITO_BANK_NAME} o numerze ${IDEASOL_INCOGNITO_BANK_ACCOUNT}, każdorazowo w tytule przelewu podając numer umowy lub (w przypadku płatności końcowej) numer faktury.`;
}

export function buildIncognitoCustomPaymentBankClause() {
  return `Klient dokonuje płatności wszystkich transz wskazanych w harmonogramie bezpośrednio na rachunek bankowy Wykonawcy prowadzony przez ${IDEASOL_INCOGNITO_BANK_NAME} nr ${IDEASOL_INCOGNITO_BANK_ACCOUNT}, każdorazowo podając w tytule numer Umowy lub faktury.`;
}

export function deriveIncognitoOwnersCount(standardOwnersCount: number) {
  const normalized = Number.isFinite(standardOwnersCount) ? standardOwnersCount : 0;
  return Math.max(0, normalized - 1);
}

export function shouldSendTeamsForSale(isIncognito: boolean) {
  return !isIncognito;
}
