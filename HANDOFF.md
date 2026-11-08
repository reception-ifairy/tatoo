# HANDOFF — Ötzi Signal

> Pierwsza rzecz, którą czyta kolejna sesja Claude Code. Zasady pracy z kodem są w `CLAUDE.md`.

## Co to jest

Studio projektowania tatuaży z AI. Klient rozmawia z **Ötzim** (asystent AI) i dochodzi do projektu. Generator robi z niego **szablon PNG** (czarne linie, przezroczyste tło), **projekt kolorowy** i **podgląd na neutralnym szarym manekinie**. Osobna, prywatna i anonimowa usługa **zakrycia blizny** rysuje cover-up na wykadrowanym zdjęciu blizny. Konto **super admina** (właściciel studia) zarządza klientami i ich **pakietami**.

Zbudowane na szablonie `reception-ifairy/template`. Wiedza pochodzi z archiwum Ink Master (to repo przed listopadem 2026): persona, kompendium, biblioteka i silnik promptów. Stary kod Next.js i baza `t1000` zostały w historii git.

## Decyzje właściciela (8.11.2026)

| Temat | Decyzja |
|---|---|
| Repo | `reception-ifairy/tatoo`, nowa aplikacja na bazie szablonu |
| Język | Wszystko po angielsku. Tylko super admin ma przełącznik EN/PL (interfejs + odpowiedzi Ötziego). Artykuły i kompendium zostają po angielsku. |
| Konta | Super admin + klienci. Admin zakłada konta i przydziela pakiety; płatności w aplikacji nie ma |
| Pakiety | 3 startowe (Sketch, Studio, Full), edytowalne. Każdy pakiet pokazuje pełną listę: co zawiera i ile zostało |
| Wyniki generatora | Szablon PNG, projekt kolorowy, podgląd na manekinie |
| Ciało | Nic seksualnego ani odsłaniającego ciało. Podgląd tylko na bezpłciowym manekinie. Zdjęcia klienta wyłącznie w usłudze zakrycia blizn |
| Blizny | Zgoda, kadr do samej blizny, bez metadanych. Zdjęcie usuwane po zakończeniu projektu; admin widzi tylko kadr i alias zamiast nazwiska |
| Nazwa | Ötzi Signal; asystent Ötzi |
| Persona | Cała osobowość i historia Alexeia przeniesione do Ötziego. Biografia to prywatna pamięć, której nie opowiada klientowi |
| Hosting | Na razie lokalnie (`start.cmd` / `npm start`) |

## Stan na 8.11.2026

| Obszar | Stan |
|---|---|
| Konta: admin z `.env`, klienci, pakiety, limity z oddawaniem przy błędzie | gotowe |
| Konsultacja z Ötzim (6 faz, bez wyszukiwania w sieci, kompendium w kontekście, karta projektu → generator, studio brief) | gotowe |
| Generator: 8 grup opcji, szablon PNG z przezroczystością, kolor, manekin (z poprzednim projektem jako referencją) | gotowe |
| Moje projekty (lista, obrazy, pobieranie PNG, studio brief, zakończ/otwórz, usuń; admin widzi wszystkich) | gotowe |
| Atlas stylów (style, techniki, fuzje, fakty z etykietami dowodów, ostrzeżenia kulturowe) | gotowe |
| Historia i biblioteka (6 okresów, 4 perspektywy, 30 artykułów) | gotowe |
| Zakrycie blizny (zgoda, kadrowanie w przeglądarce, upload bez EXIF, cover-up + szablon, usuwanie) | gotowe |
| Klienci i pakiety (panel admina) | gotowe |
| Przełącznik EN/PL dla admina + słownik `src/i18n/pl.ts` | gotowe (`npm run i18n` = 0 brakujących) |
| Miniaturki opcji stylu/techniki/nastroju | do zrobienia przez admina: Generator → Miniaturki (płatne, z wyceną; model w Ustawienia → Obrazy). Do tego czasu pokazują ikonę |

## Co jest sprawdzone

- `npm run lint`, `npm run i18n` i `npm run build` przechodzą.
- API na atrapie Claude + Gemini:
  - logowanie admina i klienta; klient nie ma dostępu do ustawień;
  - konsultacja: `design_spec` zamieniony na opcje generatora, bez narzędzi sieciowych, persona w kontekście;
  - szablon PNG z kanałem alfa;
  - limit pakietu kończy się błędem 403, a nieudany obraz wraca do puli;
  - admin musi potwierdzić koszt;
  - manekin dostaje poprzedni projekt jako referencję;
  - blizna: bez zgody upload odrzucony; EXIF usunięty; zakończenie projektu kasuje zdjęcie i obrazy z niego; na liście admina jest alias.
- Playwright 1480×800 (admin: wszystkie widoki, okno opcji; klient) i 390×844 — strona się nie przewija, nic nie wychodzi w poziomie.

## Czego NIE sprawdzono

1. Prawdziwe wywołania z kluczami (jakość obrazów, zwłaszcza manekina i cover-upu; filtry bezpieczeństwa dostawców przy zdjęciach skóry).
2. Baza MariaDB (testy szły na magazynie plikowym). Kolumna `owner_id` w tabeli rozmów jest nowa; aplikacja ma nowy prefiks `otzi_`, więc tabele powstaną od zera.
3. `start.ps1` na prawdziwym Windows (nie był zmieniany; jego komunikaty są po polsku, bo instaluje admin).
4. Wiadomości głosowe i TTS — teraz tylko dla admina.

## Konfiguracja (`.env`)

| Zmienna | Opis |
|---|---|
| `OWNER_LOGIN` / `OWNER_PASSWORD` | Login super admina. Klienci dostają konta w aplikacji (Klienci i pakiety). |
| `SESSION_SECRET` | Podpis ciasteczka sesji. |
| Klucze AI | Najlepiej w aplikacji: Ustawienia → Klucze API. Konsultacja: Claude, GPT albo Gemini. Obrazy: domyślnie Gemini Flash Image; model edycji (manekin z referencją, blizny) musi być OpenAI albo Gemini. |
| `DB_*` | Opcjonalna baza. Bez niej konta, pakiety, projekty i rozmowy trafiają do `data/otzi-settings.json`, a obrazy do `data/projects/`. |

## Otwarte zadania i pomysły

- [ ] Wdrożenie na serwer publiczny (HTTPS, `HOST`, MariaDB), gdy klienci mają korzystać z internetu.
- [ ] Automatyczna kontrola zdjęcia blizny modelem wizyjnym przed zapisem (czy to tylko kadr skóry). Dziś są zgoda, kadr i filtry dostawcy.
- [ ] Eksport studio briefu do PDF.
- [ ] Głos dla klientów (dziś tylko admin).
- [ ] Płatności / samodzielna rejestracja (jeśli kiedyś potrzebne).
- [ ] `server/research.ts` i `server/engines/` to kod z szablonu, nieużywany przez żadną trasę. Zostawiony do przyszłych wywołań strukturalnych (np. kontrola zdjęcia).
