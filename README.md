# KIPI Mundial 2026 Typer

Statyczna strona pod GitHub Pages z terminarzem Mundialu 2026, wpisywaniem wyników, typowaniem i rankingiem typerów.

## Uruchomienie lokalne

```powershell
python -m http.server 4173
```

Potem otwórz `http://localhost:4173`.

> Uwaga: aplikacja ładuje plik JSON przez `fetch`, więc wymaga serwera HTTP. Otwarcie `index.html` bezpośrednio z dysku (protokół `file://`) nie zadziała — przeglądarka zablokuje żądanie CORS.

## Publikacja na GitHub Pages

1. W repozytorium `PRTBTI/M-2026` włącz GitHub Pages.
2. Źródło ustaw na branch `main` i katalog root.
3. Strona działa bez procesu build — nie ma żadnego bundlera.

## Struktura plików

```
index.html              — cała struktura HTML aplikacji
assets/
  app.js                — logika aplikacji (ES module)
  styles.css            — design system (KIPI branding, ciemny/jasny motyw)
data/
  worldcup-2026.json    — dane turnieju (grupy, mecze, scoring)
scripts/
  extract_worldcup_data.py  — generuje JSON z pliku Excel
```

## Dane turnieju

Dane są w `data/worldcup-2026.json` i pochodzą z pliku `WorldCup_2026.xlsx`.

Aby wygenerować plik JSON na nowo po zmianie Excela:

```powershell
python scripts/extract_worldcup_data.py "C:\ścieżka\do\WorldCup_2026.xlsx"
```

## Dane w przeglądarce

Wyniki, typy i lista typerów zapisują się w `localStorage` przeglądarki (klucze `kipi-m2026-state-v1` i `kipi-m2026-accounts-v1`). Do przenoszenia danych między osobami służy sekcja **Dane** w aplikacji: eksport JSON i import JSON.

## Konta i role

| Rola | Co widzi i może robić |
|---|---|
| Klient | Rejestracja, typowanie własnych wyników, panel konta, ustawienia motywu |
| Administrator | Wszystko j.w. + wpisywanie wyników meczów, zarządzanie użytkownikami |

- Rejestracja zbiera: imię, nazwisko, e-mail, opcjonalny pseudonim, hasło (min. 8 znaków).
- Nazwa wyświetlana to pseudonim (jeśli podany) albo imię i nazwisko — nigdy e-mail.
- Hasła są hashowane (SHA-256 + sól) po stronie przeglądarki i przechowywane w `localStorage`.
- Link potwierdzający e-mail jest generowany lokalnie i pokazywany po rejestracji (brak prawdziwej wysyłki w wersji statycznej).
- Pierwsze konto w systemie automatycznie dostaje rolę administratora.
- Administrator nie może usunąć ani odebrać roli ostatniemu adminowi.

## Ograniczenia wersji statycznej (GitHub Pages)

- **Brak wysyłki maili** — link weryfikacyjny jest wyświetlany w UI zamiast wysyłany mailem.
- **Brak prawdziwych sesji** — dane kont i typów żyją wyłącznie w `localStorage` danej przeglądarki; wylogowanie i wyczyszczenie danych kasuje wszystko.
- **Brak wspólnej bazy** — każdy użytkownik widzi tylko własne `localStorage`; dane nie synchronizują się między komputerami.
- **SHA-256 po stronie klienta to nie jest bezpieczne uwierzytelnienie produkcyjne** — nadaje się tylko do prototypu.

## Rekomendacja: backend dla produkcji

Aby uzyskać prawdziwe konta, synchronizację i bezpieczeństwo, podłącz jeden z poniższych serwisów:

| Opcja | Zalety |
|---|---|
| **Supabase** | PostgreSQL + Auth + Row Level Security, darmowy tier |
| **Firebase** | Realtime DB + Auth Google, łatwa integracja |
| **Auth0** | Gotowy provider auth, free tier do 7500 użytkowników |
| **Własne API** | Pełna kontrola, wymaga serwera (Node, Python, etc.) |

Frontend jest zaprojektowany tak, żeby podpięcie backendu wymagało zmiany tylko warstwy danych w `app.js` — ekrany i logika UI zostają bez zmian.
