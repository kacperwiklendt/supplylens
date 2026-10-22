# SupplyLens — prezentacja na rozmowie

„Zbudowałem z pomocą AI narzędzie do sprawdzania ofert dostawców: porównuje specyfikacje, wskazuje rozbieżności, liczy koszt zamówienia i przygotowuje pytania.”

## Demo w 90 sekund

1. Otwórz FIELD i pokaż dwie oferty. Tańsza ma więcej rozbieżności; droższa przekracza limit ceny.
2. Zmień zamek oferty A z SBS na YKK. Liczba zgodnych pól rośnie natychmiast.
3. Uruchom porównanie. Wyjaśnij, dlaczego 1.02 kg przekracza 950 g.
4. Dodaj notatkę, zaznacz sprawdzone wymaganie i przygotuj wiadomość.
5. Zapisz rewizję, zmień wagę, zobacz różnice i przywróć poprzednią wersję.
6. Pokaż MOQ i koszt: sama cena jednostkowa nie wystarcza do decyzji.

## Co warto rozumieć

Nie wszystko wymaga LLM: liczby, jednostki i daty porównuje przewidywalny silnik. Osobna ścieżka AI analizuje swobodny tekst przez API po konfiguracji serwera. Cytat istniejący w źródle nie dowodzi poprawnej interpretacji. Decyzję podejmuje człowiek.

Testy obejmują jednostki, daty, koszty, import, różnice rewizji, eksport i backend. Nie wykonano w tej iteracji płatnego wywołania modelu; odpowiedzi dostawcy są mockowane w testach. Brak kont, synchronizacji, OCR/PDF i weryfikacji certyfikatów. Kalkulator nie obejmuje podatków ani kursów walut.

## Przed wysłaniem

- Uruchom projekt i testy samodzielnie.
- Przeczytaj compareRow, number i walidację cytatów; dodaj własny produkt oraz jeden test.
- Opublikuj źródła we własnym repozytorium bez kluczy i prywatnych dokumentów.
- Sprawdź stronę na telefonie i działanie własnego klucza lokalnie.
- Sprawdź dostęp rekrutera: prywatny podgląd nie zastępuje publicznego portfolio.

O użyciu AI: „Korzystałem z AI przy implementacji i iteracjach interfejsu. Rozumiem działanie projektu, potrafię wyjaśnić testy i świadomie oddzieliłem reguły biznesowe od analizy modelowej.”
