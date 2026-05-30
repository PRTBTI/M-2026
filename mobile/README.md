# KIPI Mundial 2026 — Aplikacja mobilna

Aplikacja Expo (React Native) na iOS i Android. Zawiera te same funkcje co wersja web: terminarz, grupy, typowanie, ranking, konta z rolami admin/klient.

## Szybki start

```bash
cd mobile
npm install
npx expo start
```

Zeskanuj kod QR w aplikacji **Expo Go** (iOS/App Store lub Android/Google Play).

## Instalacja natywna (plik .apk / .ipa)

```bash
npm install -g eas-cli
eas login
eas build --platform android   # plik .apk / .aab
eas build --platform ios        # wymaga konta Apple Developer
```

## Struktura

```
mobile/
├── App.js                          # punkt wejścia
├── src/
│   ├── context/AppContext.js       # cała logika (auth, wyniki, typy, ranking)
│   ├── navigation/AppNavigator.js  # nawigacja (stack + bottom tabs)
│   ├── screens/
│   │   ├── AuthScreen.js           # logowanie / rejestracja / weryfikacja tokenu
│   │   ├── DashboardScreen.js      # start: najbliższy mecz, metryki, top 3
│   │   ├── MatchesScreen.js        # terminarz z filtrem fazy i grupy
│   │   ├── GroupsScreen.js         # tabele grup A–L
│   │   ├── PredictionsScreen.js    # karta typera z punktacją
│   │   ├── RankingScreen.js        # tabela typerów
│   │   └── AccountScreen.js        # profil, ustawienia, panel admina
│   ├── data/worldcup-2026.json     # dane turnieju (zsynchronizowane z /data/)
│   └── theme.js                    # kolory, odstępy, typografia
```

## Rejestracja i weryfikacja (wersja statyczna)

Aplikacja mobilna nie wysyła maili (tak samo jak wersja web). Przepływ:

1. Utwórz konto w zakładce **Rejestracja** → skopiuj wygenerowany token.
2. Przejdź do zakładki **Weryfikacja** → wklej token → Potwierdź konto.
3. Pierwsze konto automatycznie dostaje rolę **administratora**.

## Dane

Wyniki i typy przechowywane są w `AsyncStorage` (odpowiednik `localStorage` z web). Każda instalacja aplikacji ma oddzielne dane — brak synchronizacji między urządzeniami (ograniczenie wersji bez backendu).

Administrator może eksportować/importować dane JSON przez sekcję Konto → opcje (możliwe do dodania jako rozszerzenie).
