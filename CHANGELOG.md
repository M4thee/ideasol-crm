# Changelog

## Unreleased

### Added

- Webowy tryb „Sprzedaż incognito” z indywidualnym uprawnieniem nadawanym przez administratora.
- Niezależna konfiguracja kalkulatora incognito, startowo z marżą o jednego ownera niższą.
- Odrębny szablon umowy i komunikaty płatnicze dla rachunku BNP Paribas Bank Polska S.A.
- Testy reguł dostępu, kalkulacji, blokady Teams i rachunku na dokumentach.

### Security

- Serwerowe filtrowanie sprzedaży incognito i danych powiązanych, w tym dokumentów w Storage.
- Ukrycie sprzedaży incognito przed ownerem bez indywidualnego uprawnienia oraz zabezpieczenie endpointów administracyjnych.
- Wyłączenie powiadomień Teams i integracji raportowych dla transakcji incognito.

### Deployment notes

- Migracja ustawia domyślnie `false` dla istniejących użytkowników i sprzedaży.
- Przed wdrożeniem produkcyjnym trzeba potwierdzić w finansach, że rachunek `39 1600 1462 1786 0938 0000 0001` jest autoryzowany i przypisany do IdeaSol.
- Wdrożenie migracji wymaga wcześniejszego uzgodnienia historii migracji lokalnej z historią projektu Supabase.
