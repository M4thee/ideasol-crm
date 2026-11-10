# Raport wykonanych scaleń kart klientów

Stan danych: 2026-11-10, projekt Supabase `hquiuqkuonlpjiynqpkp`.

## Zasady bezpieczeństwa

- Scalenia wykonano dopiero po decyzji użytkownika o zasadzie wyboru doradcy.
- Przy różnych doradcach zachowywany jest doradca z najwcześniej utworzonej karty w grupie, która miała przypisanego doradcę.
- Wszystkie relacje źródła są przenoszone, a tagi łączone bez duplikowania.
- Na karcie nadrzędnej dodawana jest notatka: `Potencjalny dubel, scalono różne UID.`
- Audyt techniczny zachowuje źródłowy i docelowy UID, migawkę źródłowej karty, liczbę relacji przed scaleniem i liczbę przeniesionych relacji.
- Audyt zapisuje także doradcę źródłowego, doradcę karty nadrzędnej przed scaleniem i doradcę wybranego przez regułę.

## Wynik kontroli

Przed operacją baza zawierała 59 grup ze wspólnym znormalizowanym numerem telefonu, 131 kart w tych grupach i 72 karty nadmiarowe. Wykonano scalenie pięciu wcześniej zweryfikowanych grup oraz grupy Teodora. Łącznie scalono 9 kart źródłowych do 6 kart nadrzędnych.

| Klient | Zachowany doradca | Karta nadrzędna | Scalono karty źródłowe | Wynik |
|---|---|---|---|---|
| Maciej Wojtasiewicz | Andrzej Albinowski | `#552` / `d3a17c5e-1290-4856-b854-6ad0705b415b` | `#490` / `0ed2f1e1-2101-4f8f-8fc7-106d76adf5a6`; `#558` / `48ff3fd0-b325-4609-a660-d16cdbd7ccf8` | Wykonano; wszystkie relacje przeniesione. |
| Jan Szczucki | Jan Osmenda | `#1349` / `63eaf322-2382-40a6-89ad-6789a0abc6f2` | `#1403` / `7f9eba07-4679-46f8-b278-93a4f3425b8b` | Wykonano; wszystkie relacje przeniesione. |
| Mieczysław Janik | Paweł Czupryński | `#1424` / `d2778409-0e97-44bc-be24-fdc9e0b2cf4c` | `#1452` / `7d0b5808-f9c9-4128-b3e6-f16aa70f4b54` | Wykonano; wszystkie relacje przeniesione. |
| Michał Brzeski | Mateusz Rapczewski | `#1174` / `d1e8dc55-588c-4cf3-8dfd-f82f441d4809` | `#1232` / `e8f6b37a-4fc3-4697-9adc-649867d0a59e` | Wykonano; wszystkie relacje przeniesione. |
| K W | Paweł Czupryński | `#975` / `46de9ef3-dd44-42fe-b627-48dd9b85288c` | `#1478` / `aef1828c-3856-4b0b-9e75-ee18741bc40b` | Wykonano; wszystkie relacje przeniesione. |
| Teodor | Janusz Uchwat | `#936` / `0c77e83c-5bab-4f5d-ba62-82d343343c96` | `#197` / `d0099e2e-574c-4e34-9159-4b2065bbf0ee`; `#1170` / `b377348d-f3e3-4e88-a6e0-3bef228c1405`; `#1266` / `609fa9fe-d063-4716-a4b8-fb39ef33099b` | Wykonano; zachowano pierwszego przypisanego doradcę. |

## Weryfikacja po scaleniu

- Liczba klientów: 1214 (spadek o dokładnie 9 kart źródłowych).
- Źródłowe karty pozostałe w `clients`: 0.
- Karty nadrzędne obecne w `clients`: 6 z 6.
- Wpisy `client_merge_audit`: 9.
- Automatyczne notatki o scaleniu: 9.
- Wszystkie liczniki przeniesionych relacji są zgodne z licznikami sprzed operacji.
- Grupy wspólnego znormalizowanego telefonu: 53; 116 kart w grupach; 63 karty nadmiarowe pozostają do odrębnej weryfikacji.
