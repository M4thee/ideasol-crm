# Raport kandydatów do scalenia kart klientów

Stan danych: 2026-11-10, projekt Supabase `hquiuqkuonlpjiynqpkp`.

## Zasady bezpieczeństwa

- Raport nie wykonuje żadnego scalenia.
- Karta nadrzędna wymaga jawnej decyzji użytkownika.
- Automatyczne scalenie jest blokowane, gdy karty mają różnych doradców.
- Wszystkie relacje źródła zostaną przeniesione, a tagi połączone bez duplikowania.
- Na karcie nadrzędnej zostanie dodana notatka: `Potencjalny dubel, scalono różne UID.`
- Audyt techniczny zachowa źródłowy i docelowy UID, migawkę źródłowej karty, liczbę relacji przed scaleniem i liczbę przeniesionych relacji.

## Wynik kontroli

W bazie pozostaje 59 grup ze wspólnym znormalizowanym numerem telefonu (131 kart, 72 nadmiarowe). Poniżej znajduje się konserwatywna lista pięciu grup, w których nazwa, przypisany doradca, e-mail, adres i status są zgodne. Obejmuje ona sześć kart nadmiarowych. W żadnej z tych grup nie ma sprzedaży, dokumentów sprzedażowych, podpisu umowy, preaudytu ani polecenia partnerskiego.

| Klient | Doradca | Rekomendowana karta nadrzędna | Karty źródłowe | Uzasadnienie rekomendacji |
|---|---|---|---|---|
| Maciej Wojtasiewicz | Andrzej Albinowski | `#552` / `d3a17c5e-1290-4856-b854-6ad0705b415b` | `#490` / `0ed2f1e1-2101-4f8f-8fc7-106d76adf5a6`; `#558` / `48ff3fd0-b325-4609-a660-d16cdbd7ccf8` | Karta #552 skupia główną historię: 6 aktywności, 3 wydarzenia, 1 ofertę, 2 SMS-y i 2 zdarzenia Meta CAPI. Źródła mają łącznie 3 notatki, 2 aktywności i tagi do przeniesienia. |
| Jan Szczucki | Jan Osmenda | `#1349` / `63eaf322-2382-40a6-89ad-6789a0abc6f2` | `#1403` / `7f9eba07-4679-46f8-b278-93a4f3425b8b` | Karta #1349 ma 3 aktywności, 2 wydarzenia i 1 ofertę. Źródło ma notatkę, lead Meta, powiadomienie i tagi do przeniesienia. |
| Mieczysław Janik | Paweł Czupryński | `#1424` / `d2778409-0e97-44bc-be24-fdc9e0b2cf4c` | `#1452` / `7d0b5808-f9c9-4128-b3e6-f16aa70f4b54` | Karta #1424 ma 2 aktywności, wydarzenie i ofertę. Źródło ma notatkę, lead Meta, powiadomienie i tagi do przeniesienia. |
| Michał Brzeski | Mateusz Rapczewski | `#1174` / `d1e8dc55-588c-4cf3-8dfd-f82f441d4809` | `#1232` / `e8f6b37a-4fc3-4697-9adc-649867d0a59e` | Karta #1174 ma aktywność i wydarzenie. Źródło ma notatkę, lead Meta i tagi do przeniesienia. |
| K W | Paweł Czupryński | `#975` / `46de9ef3-dd44-42fe-b627-48dd9b85288c` | `#1478` / `aef1828c-3856-4b0b-9e75-ee18741bc40b` | Karta #975 ma 3 aktywności, wydarzenie i 2 oferty. Źródło ma notatkę, lead Meta, powiadomienie i tagi do przeniesienia. |

## Grupa Teodora — zablokowana

Grupa ma cztery karty i nie spełnia warunku bezpiecznego scalenia:

- `#197` / `d0099e2e-574c-4e34-9159-4b2065bbf0ee` — brak przypisanego doradcy;
- `#936` / `0c77e83c-5bab-4f5d-ba62-82d343343c96` — Janusz Uchwat;
- `#1170` / `b377348d-f3e3-4e88-a6e0-3bef228c1405` — Mateusz Rapczewski;
- `#1266` / `609fa9fe-d063-4716-a4b8-fb39ef33099b` — Mateusz Rapczewski.

Karty zawierają rozdzielone notatki, aktywności, wydarzenia, oferty, leady Meta i tagi. Scalenie wymaga odrębnej decyzji o karcie nadrzędnej i o zachowaniu docelowego doradcy; funkcja bazodanowa celowo odrzuci tę grupę bez takiej decyzji.

## Decyzja wymagana przed wykonaniem

Do wykonania sześciu scaleń wystarczy zatwierdzenie rekomendowanych kart nadrzędnych: `552`, `1349`, `1424`, `1174`, `975`. Bez takiego zatwierdzenia liczba scalonych kart pozostaje równa zero.
