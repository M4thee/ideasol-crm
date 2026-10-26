# Sprzedaż incognito — zasady i wdrożenie

Zakres obejmuje wyłącznie webowy CRM. Aplikacje mobilne i widoki TV nie korzystają jeszcze z tego trybu.

## Dostęp

- Administrator zawsze widzi sprzedaże incognito i jako jedyny nadaje lub odbiera indywidualne uprawnienie.
- Rola ownera sama w sobie nie daje dostępu. Przypisanie klienta, oferty ani sprzedaży także nie zastępuje uprawnienia incognito.
- Odebranie uprawnienia działa przy następnym zapytaniu do bazy lub API. Już wydany link podpisany do pliku może działać najwyżej 60 sekund.
- Użytkownik bez uprawnienia otrzymuje odpowiedź jak dla nieistniejącej sprzedaży; sprzedaż nie trafia do list, kart klienta, wyszukiwania, raportów ani agregatów opartych na RLS.

## Ceny

Kalkulator incognito jest niezależną kopią konfiguracji standardowej i jest dostępny tylko administratorowi. Początkowo używa tego samego algorytmu, lecz `owners_count` jest pomniejszony o 1 (nie mniej niż 0). Fundusz gwarancyjny i VAT są następnie liczone zwykłą ścieżką kalkulatora.

## Umowy i IdeaSign

- Umowa incognito korzysta z rachunku `39 1600 1462 1786 0938 0000 0001`, BNP Paribas Bank Polska S.A.
- Osobny szablon PDF nie zawiera standardowego rachunku także w warstwie tekstowej.
- Utworzenie dokumentu sprzedaży, sesji IdeaSign albo śladu wysyłki do Meta/Profit blokuje późniejszą zmianę trybu, aby nie mieszać wersji dokumentów, rachunków ani wcześniej ujawnionych danych.
- IdeaSign nadal dostarcza dokumenty klientowi i zapisuje je w CRM, ale nie publikuje na Teams informacji o zawarciu umowy incognito.

## Istniejące dane i audyt

- Wszystkie istniejące sprzedaże pozostają standardowe (`is_incognito = false`).
- Wszyscy istniejący użytkownicy zaczynają bez uprawnienia (`incognito_sales = false`); administrator ma dostęp z racji roli.
- Zmiana przypisania klienta nie ujawnia sprzedaży incognito ani nie przyznaje do niej dostępu.
- Zmiany sprzedaży, uprawnień i konfiguracji kalkulatora trafiają do istniejącego audytu bazy.

## Warunki publikacji

Numer przeszedł kontrolę sumy NRB, a numer rozliczeniowy `16001462` figuruje w rejestrze NBP jako BNP Paribas Bank Polska S.A. To nie potwierdza właściciela rachunku. Nie wdrażać migracji ani aplikacji na produkcję, dopóki finanse nie potwierdzą, że rachunek BNP jest autoryzowany i przypisany do IdeaSol. Przed migracją trzeba również rozwiązać rozbieżność między lokalną a zdalną historią migracji Supabase; nie należy naprawiać historii automatycznie bez przeglądu.
