export type SmsApiSendMessageInput = {
  to: string;
  message: string;
  sender?: string;
};

export type SmsApiSendMessageResult = {
  providerMessageId?: string;
  intendedRecipientPhone: string;
  actualRecipientPhone: string;
  testMode: boolean;
  raw: unknown;
};

type SmsEnvironment = {
  SMSAPI_TOKEN?: string;
  SMSAPI_SENDER?: string;
  SMSAPI_BASE_URL?: string;
  SMS_TEST_MODE?: string;
  SMS_TEST_PHONE?: string;
  [key: string]: string | undefined;
};

const POLISH_DIACRITICS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
  Ą: "A",
  Ć: "C",
  Ę: "E",
  Ł: "L",
  Ń: "N",
  Ó: "O",
  Ś: "S",
  Ź: "Z",
  Ż: "Z",
};

export function removePolishDiacritics(value: unknown) {
  return String(value ?? "")
    .replace(
      /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g,
      (character) => POLISH_DIACRITICS[character] || character
    )
    .replace(/[\u00a0\u202f]/g, " ");
}

function getSmsApiConfig() {
  const token = process.env.SMSAPI_TOKEN;
  const sender = process.env.SMSAPI_SENDER?.trim() || "";
  const baseUrl = process.env.SMSAPI_BASE_URL || "https://api.smsapi.pl";

  if (!token) {
    throw new Error("Brak SMSAPI_TOKEN w konfiguracji środowiska.");
  }

  return {
    token,
    sender,
    baseUrl: baseUrl.replace(/\/$/, ""),
  };
}

export function normalizePolishPhoneNumber(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 9) {
    return `48${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("48")) {
    return digits;
  }

  return "";
}

export function isSmsTestMode(environment: SmsEnvironment = process.env) {
  return ["1", "true", "yes", "tak"].includes(
    String(environment.SMS_TEST_MODE || "").trim().toLowerCase()
  );
}

export function resolveSmsDelivery(
  intendedPhone: string,
  environment: SmsEnvironment = process.env
) {
  const intendedRecipientPhone = normalizePolishPhoneNumber(intendedPhone);

  if (!intendedRecipientPhone) {
    throw new Error("Nieprawidłowy polski numer telefonu odbiorcy SMS.");
  }

  const testMode = isSmsTestMode(environment);

  if (!testMode) {
    return {
      intendedRecipientPhone,
      actualRecipientPhone: intendedRecipientPhone,
      testMode: false,
    };
  }

  const actualRecipientPhone = normalizePolishPhoneNumber(
    String(environment.SMS_TEST_PHONE || "")
  );

  if (!actualRecipientPhone) {
    throw new Error("Tryb testowy SMS wymaga poprawnego SMS_TEST_PHONE.");
  }

  return {
    intendedRecipientPhone,
    actualRecipientPhone,
    testMode: true,
  };
}

export function canSendAutomaticSmsToRecipient(
  intendedPhone: string,
  environment: SmsEnvironment = process.env
) {
  const delivery = resolveSmsDelivery(intendedPhone, environment);

  return !delivery.testMode || delivery.intendedRecipientPhone === delivery.actualRecipientPhone;
}

export async function sendSmsApiMessage(input: SmsApiSendMessageInput): Promise<SmsApiSendMessageResult> {
  const config = getSmsApiConfig();
  const delivery = resolveSmsDelivery(input.to);
  const message = removePolishDiacritics(input.message).trim();
  const sender = String(input.sender || config.sender || "").trim();

  if (!message) {
    throw new Error("Brak treści wiadomości SMS.");
  }

  const params = new URLSearchParams();
  params.set("to", delivery.actualRecipientPhone);
  params.set(
    "message",
    delivery.testMode
      ? `[TEST, docelowo +${delivery.intendedRecipientPhone}] ${message}`
      : message
  );
  params.set("format", "json");
  params.set("encoding", "utf-8");

  if (sender) {
    params.set("from", sender);
  }

  const response = await fetch(`${config.baseUrl}/sms.do`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const responseText = await response.text();
  let responseBody: unknown = responseText;

  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = responseText;
  }

  if (!response.ok) {
    throw new Error(
      typeof responseBody === "string"
        ? responseBody
        : JSON.stringify(responseBody)
    );
  }

  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody
  ) {
    const errorBody = responseBody as { error?: unknown; message?: unknown };

    throw new Error(
      typeof errorBody.message === "string"
        ? `SMSAPI error ${String(errorBody.error || "")}: ${errorBody.message}`
        : JSON.stringify(responseBody)
    );
  }

  const providerMessageId =
    typeof responseBody === "object" &&
    responseBody !== null &&
    "list" in responseBody &&
    Array.isArray((responseBody as { list?: unknown }).list) &&
    (responseBody as { list: Array<{ id?: string }> }).list[0]?.id
      ? (responseBody as { list: Array<{ id?: string }> }).list[0].id
      : undefined;

  return {
    providerMessageId,
    ...delivery,
    raw: responseBody,
  };
}
