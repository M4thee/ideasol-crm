# IdeaSol Command Center — Android TV

Minimalny natywny wrapper WebView dla Android TV i Google TV. Jeden uniwersalny APK otwiera ekran parowania Command Center, utrzymuje ekran aktywny i wymusza tryb pełnoekranowy. Po jednorazowym wpisaniu kodu z panelu administratora sesja urządzenia jest zachowywana w trwałym magazynie cookies WebView.

Domyślnie aplikacja otwiera produkcyjny ekran parowania. Inny host można podać wyłącznie na potrzeby testów:

```bash
./gradlew :app:assembleDebug -PCOMMAND_CENTER_URL="https://test.example.com/command-center/tv"
```

APK nie zawiera tokenu żadnego urządzenia. Przycisk MENU na pilocie przeładowuje dashboard; przycisk Wstecz również odświeża widok zamiast zamykać aplikację.

Plik do dystrybucji jest publikowany pod krótkim adresem `https://crm.ideasol.pl/cc.apk`. Wersję 2.0 można zainstalować jako aktualizację poprzedniej aplikacji IdeaSol. Po tej jednorazowej aktualizacji kolejne ekrany używają tego samego APK, a przypisanie dashboardu odbywa się kodem z zakładki Urządzenia.
