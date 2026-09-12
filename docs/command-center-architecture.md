# IdeaSol Command Center — audyt i architektura MVP

## Zakres audytu

Audyt wykonano na podstawie bieżących zapytań aplikacji, typów TypeScript, migracji w repozytorium oraz schematu aktywnej bazy Supabase. Repo zostało połączone z projektem wskazanym przez `NEXT_PUBLIC_SUPABASE_URL`, a wszystkie pola używane przez agregaty potwierdzono bezpośrednio w schemacie. Implementacja nie zgaduje nazw tabel ani kolumn.

## Potwierdzone źródła danych CRM

| Obszar | Tabela | Pola używane przez Command Center | Znaczenie |
| --- | --- | --- | --- |
| Leady | `clients` | `id`, `created_at`, `status`, `lead_source`, `assigned_user_id` | Jeden rekord klienta jest obecnie używany przez raport zarządu jako nowy lead. |
| Aktywność | `client_activities` | `id`, `client_id`, `created_at` | Ręcznie zarejestrowane kontakty. Nie są billingiem telefonicznym. |
| Spotkania | `calendar_events` | `id`, `client_id`, `event_at`, `event_type`, `status`, `assigned_user_id` | Kalendarz spotkań i innych wydarzeń. |
| Oferty | `client_offers` | `id`, `client_id`, `created_at`, `created_by` | Etap oferty w lejku. |
| Sprzedaż | `sales` | `id`, `client_id`, `seller_id`, `sale_date`, `created_at`, `contract_value`, `status` | Liczba umów i wartość sprzedaży. |
| Użytkownicy | `profiles` | `id`, `display_name`, `email`, `role`, `manager_id` | Audyt potwierdził profil i relacje zespołowe; TV pobiera wyłącznie `id`, `display_name` i `role`. |

Istniejący `dashboard_layouts` jest prywatnym układem pulpitu CRM per użytkownik. Zapisuje ustawienia automatycznie, nie ma ekranów, urządzeń ani modelu draft/published. Pozostaje bez zmian.

## Definicje wiarygodnych metryk MVP

- Lead dzisiaj/tydzień/miesiąc: rekord `clients` według `created_at` w strefie urządzenia.
- Podjęty lead: lead z co najmniej jedną aktywnością `client_activities`. To nie oznacza odebranego połączenia.
- Czas reakcji: czas od `clients.created_at` do pierwszej późniejszej aktywności tego klienta; brak aktywności nie jest imputowany.
- Lejek miesiąca: kohorta leadów utworzonych w miesiącu, następnie unikalne `client_id` posiadające aktywność, spotkanie, ofertę i sprzedaż.
- Sprzedaż: rekordy bez statusów anulowanych/utraconych; wartość to suma `sales.contract_value`.
- Spotkanie: `calendar_events.event_type = 'meeting'`, z wyłączeniem statusów anulowanych.
- Ranking: leady przypisane przez `assigned_user_id`, sprzedaże przez `seller_id`.

Widżet wykonanych telefonów liczy wyłącznie ręcznie zapisane aktywności CRM typu `phone`. Command Center celowo nie przedstawia ich jako danych operatora: nie zna czasu rozmów, połączeń odebranych ani innych metryk call-center.

## Architektura

```text
CRM Supabase (system główny)
  clients / activities / calendar / offers / sales / profiles
                  │ odczyt agregatów
                  ▼
Next.js Route Handler (service role, tylko serwer)
                  │
        opublikowany snapshot + agregaty
                  ▼
TV / cienki wrapper WebView

Panel administratora ──draft──► cc_dashboards
          └── Zapisz i opublikuj ──► cc_dashboard_versions (immutable)
                                             │
                                      published_version_id
                                             │
                                          urządzenia
```

Logika układu i widżetów pozostaje w aplikacji webowej. Klient TV jest cienki: pobiera snapshot, renderuje planszę 1920×1080, skaluje ją proporcjonalnie oraz rotuje aktywne strony. Co 15 sekund sprawdza wersję i odświeża agregaty. Dzięki temu urządzenie nie otrzymuje publicznego dostępu do tabel konfiguracyjnych ani danych CRM.

Kanał zdarzeń live jest osobnym, lekkim endpointem odpytywanym co 4 sekundy. Zwraca wyłącznie identyfikator zdarzenia, jego typ, czas oraz opcjonalną wartość sprzedaży. Pierwsze wywołanie ustala punkt startowy, więc po uruchomieniu TV nie odtwarza starych komunikatów; po uśpieniu historia jest ograniczona do 10 minut. Zdarzenia są kolejkowane i pokazywane pojedynczo przez 4,4 sekundy z animowanym wejściem, wyjściem i krótkim sygnałem dźwiękowym.

Zapytania agregujące są stronicowane po 1000 rekordów, więc nie zaniżają wyników po przekroczeniu domyślnego limitu Data API. Osobna migracja dodaje indeksy po datach używanych przez pięć źródłowych tabel CRM; nie zmienia rekordów ani logiki zapisu.

## Schema Command Center

- `cc_dashboards`: nazwa, slug, domyślna rotacja, mutowalny `draft_snapshot`, wskaźnik opublikowanej wersji, archiwizacja.
- `cc_dashboard_versions`: niezmienne snapshoty z rosnącym numerem wersji i czasem publikacji.
- `cc_devices`: skrót SHA-256 tokenu, platforma, dashboard, tryb motywu, strefa czasowa, godziny auto, radio/głośność/autoplay, ostatnia aktywność.
- `cc_radio_stations`: administracyjna lista oficjalnych streamów HTTPS. Migracja nie seeduje niezweryfikowanych adresów.
- `cc_publish_dashboard`: transakcyjna funkcja `security invoker`, dostępna wyłącznie dla `service_role`; blokuje dashboard, tworzy wersję i przesuwa wskaźnik published.

Rollback w panelu odczytuje historyczny snapshot i publikuje go jako kolejną, niezmienną wersję. Dzięki temu historia pozostaje liniowa i nie jest nadpisywana.

Strony, widżety i layout są przechowywane w wersjonowanym snapshotcie JSONB (`schemaVersion: 1`). Jest to świadoma granica: publikacja i rollback dotyczą jednego niepodzielnego dokumentu, a dodanie nowego typu widżetu nie wymaga migracji tabel. Kod waliduje identyfikatory, typy, siatkę 12×8, zakres rotacji, nakładanie oraz obecność aktywnego ekranu.

## Bezpieczeństwo i prywatność

- Wszystkie cztery tabele mają RLS i nie przyznają dostępu `anon` ani `authenticated`.
- Panel administratora używa istniejącej weryfikacji tokenu i roli `admin` w `requireAdminRequest`.
- TV autoryzuje się długim losowym tokenem; baza przechowuje jedynie jego skrót.
- Odpowiedź urządzenia zawiera tylko agregaty i nazwy pracowników, bez rekordów oraz danych osobowych klientów.
- Powiadomienia live o nowym leadzie i sprzedaży nie zawierają nazwiska, telefonu, adresu ani innych danych klienta.
- Klucz `service_role` pozostaje wyłącznie po stronie serwera.

## Dodane i zmienione pliki

- `supabase/migrations/20260910082755_create_command_center_core.sql`
- `supabase/migrations/20260910093105_add_command_center_source_indexes.sql`
- `supabase/tests/command_center_rls.test.sql`
- `supabase/tests/command_center_publish.test.sql`
- `lib/command-center/{types,validation,widget-registry,metrics}.ts`
- `app/api/command-center/admin/route.ts`
- `app/api/command-center/device/[token]/route.ts`
- `app/command-center/{layout,admin/page,tv/[token]/page}.tsx`
- `app/command-center/demo/page.tsx` i `components/command-center/CommandCenterDemo.tsx` — anonimowy podgląd QA, zwracający 404 poza środowiskiem developerskim.
- `components/command-center/{CommandCenterAdmin,CommandCenterCanvas,CommandCenterTv}.tsx`
- `components/command-center/command-center.css`
- `app/components/AppHeader.tsx` — wejście do panelu dla administratora.
- `app/components/AppShell.tsx` — widok TV działa jako pełnoekranowy klient bez nagłówka CRM.

## Stan wdrożenia

Migracje Command Center i indeksów zostały wykonane na połączonym projekcie Supabase i oznaczone w historii migracji. Obecność wszystkich pięciu indeksów została potwierdzona zapytaniem do bazy. RLS oraz transakcyjna publikacja przeszły testy kończące się rollbackiem. Aktualny kod przeszedł lokalną kompilację produkcyjną, TypeScript, lint i pełny zestaw testów. Finalny preview Vercel przeszedł test API na rzeczywistych agregatach, po czym ten sam artefakt został wdrożony na produkcję. Produkcyjny ekran TV został sprawdzony wizualnie na `crm.ideasol.pl`; wszystkie rekordy techniczne testu usunięto i potwierdzono zerową liczbę pozostałości.

Android TV/Google TV powinien pozostać cienkim wrapperem wskazującym URL urządzenia. tvOS i Fire TV pozostają poza MVP. Przed włączeniem radia należy ręcznie zweryfikować oficjalny adres oraz warunki użycia streamu każdego nadawcy.
