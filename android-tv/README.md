# IdeaSol Command Center — Android TV

Minimalny natywny wrapper WebView dla Android TV i Google TV. Aplikacja otwiera przypisany adres urządzenia Command Center, utrzymuje ekran aktywny i wymusza tryb pełnoekranowy.

Adres urządzenia jest przekazywany wyłącznie przy budowaniu:

```bash
./gradlew :app:assembleDebug -PCOMMAND_CENTER_URL="https://crm.ideasol.pl/command-center/tv/TOKEN"
```

Token nie powinien być zapisywany w repozytorium. Przycisk MENU na pilocie przeładowuje dashboard; przycisk Wstecz również odświeża widok zamiast zamykać aplikację.
