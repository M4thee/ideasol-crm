import assert from "node:assert/strict";
import test from "node:test";

import {
  getPhotoGalleryDocuments,
  getSaleDocumentGroupKey,
} from "../lib/saleDocumentGrouping.ts";

test("rozpoznaje wszystkie aktualne kontenery po kluczu i polskiej nazwie", () => {
  const cases = [
    ["contracts", "Umowa wraz z załącznikami"],
    ["technical_audit", "Audyt techniczny"],
    ["photos", "Zdjęcia"],
    ["osd_invoice", "Faktura OSD"],
    ["zm_power_of_attorney", "Pełnomocnictwo ZM"],
    ["ppoz", "PPOŻ"],
    ["pme_grant", "Dotacja PME"],
    ["other", "Inne"],
  ];

  for (const [expected, documentType] of cases) {
    assert.equal(
      getSaleDocumentGroupKey({ document_type: documentType }),
      expected,
    );
  }
});

test("typ dokumentu ma pierwszeństwo przed formatem pliku", () => {
  assert.equal(
    getSaleDocumentGroupKey({
      document_type: "Faktura OSD",
      file_name: "faktura.jpg",
      file_type: "image/jpeg",
    }),
    "osd_invoice",
  );
  assert.equal(
    getSaleDocumentGroupKey({
      document_type: "Audyt techniczny",
      file_name: "dach.png",
      file_type: "image/png",
    }),
    "technical_audit",
  );
});

test("obsługuje opisowe historyczne typy dokumentów", () => {
  assert.equal(
    getSaleDocumentGroupKey({
      document_type: "Dokumenty do zgłoszenia mikroinstalacji",
    }),
    "zm_power_of_attorney",
  );
  assert.equal(
    getSaleDocumentGroupKey({
      document_type: "Pełnomocnictwo do straży pożarnej",
    }),
    "ppoz",
  );
  assert.equal(
    getSaleDocumentGroupKey({
      document_type: "Schemat i dokumentacja techniczna",
    }),
    "technical_audit",
  );
});

test("dla rekordu bez typu korzysta z nazwy, a potem z formatu zdjęcia", () => {
  assert.equal(
    getSaleDocumentGroupKey({
      file_name: "faktura_osd.jpg",
      file_type: "image/jpeg",
    }),
    "osd_invoice",
  );
  assert.equal(
    getSaleDocumentGroupKey({ file_name: "IMG_2034.HEIC", file_type: null }),
    "photos",
  );
  assert.equal(
    getSaleDocumentGroupKey({ file_name: "upload", file_type: "image/jpeg" }),
    "photos",
  );
  assert.equal(
    getSaleDocumentGroupKey({
      file_name: "dokument.pdf",
      file_type: "application/pdf",
    }),
    "other",
  );
});

test("galeria zawiera wyłącznie dokumenty przypisane do zdjęć", () => {
  const documents = [
    {
      id: "photo",
      document_type: "Zdjęcia",
      file_name: "dach.jpg",
      file_type: "image/jpeg",
    },
    {
      id: "invoice",
      document_type: "Faktura OSD",
      file_name: "faktura.jpg",
      file_type: "image/jpeg",
    },
    {
      id: "legacy",
      document_type: null,
      file_name: "IMG_1.png",
      file_type: "image/png",
    },
  ];

  assert.deepEqual(
    getPhotoGalleryDocuments(documents).map((document) => document.id),
    ["photo", "legacy"],
  );
});
