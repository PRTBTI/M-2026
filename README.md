# KIPI Mundial 2026 Typer

Statyczna strona pod GitHub Pages z terminarzem Mundialu 2026, wpisywaniem wyników, typowaniem oraz rankingiem typerów.

## Uruchomienie lokalne

```powershell
python -m http.server 4173
```

Potem otwórz `http://localhost:4173`.

## Publikacja na GitHub Pages

1. W repozytorium `PRTBTI/M-2026` włącz GitHub Pages.
2. Źródło ustaw na branch główny i katalog root.
3. Strona będzie działać bez procesu build.

## Dane

Dane turnieju są w `data/worldcup-2026.json` i pochodzą z pliku `WorldCup_2026.xlsx`.

Wyniki, typy i lista typerów zapisują się w `localStorage` przeglądarki. Do przenoszenia danych między osobami służy sekcja `Dane` w aplikacji: eksport JSON i import JSON.

Regeneracja danych z Excela:

```powershell
python scripts/extract_worldcup_data.py "C:\Users\p.struski\Downloads\WorldCup_2026.xlsx"
```

Wspólne konta użytkowników i centralny zapis typów wymagają później backendu, np. Supabase, Firebase albo prostego API.
