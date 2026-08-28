# Feature specifikacija — burnout/anomaly model

Ovaj dokument je "ugovor" između `ml/generate_synthetic_data.py` + `ml/train_model.py`
(Python) i `src/lib/ml/features.server.ts` (Node). Formule MORAJU biti identične na oba
mesta — ako se razmimoiđu, model dobija ulaze koji ne liče na ono na čemu je treniran.

## Definicije prozora

- **Analiza se radi na poslednjih 60 kalendarskih dana**, ne računajući današnji dan
  (isto pravilo kao i `seedAttendance.js` — današnji dan je nepotpun/u toku).
- Od tih 60 dana uzimaju se samo **radni dani** (pon–pet), vikendi se ignorišu.
- Radni dani se dele na:
  - **RECENT** = poslednjih 15 radnih dana (najbliži današnjem danu)
  - **BASELINE** = svi radni dani u prozoru koji nisu u RECENT (obično ~30ak dana)
- Ako user nema nijedan Attendance red u RECENT ili BASELINE periodu, taj period se
  tretira kao "nema podataka" — feature vrednosti koje zavise od tog perioda se
  postavljaju na 0 (ne null/NaN, da model uvek dobije broj).

## Lokalno vreme

Sva vremena (`startTime`, `endTime`) su u bazi zapisana kao UTC. Za feature-e koji
zavise od doba dana (dolazak, odlazak), konvertuje se u lokalno (Europe/Belgrade)
dodavanjem **+2h** (CEST, važi za ceo period jun–avgust 2026). Isto pravilo kao u
`seedAttendance.js`.

## Feature lista (redosled je bitan — ovo je i redosled u feature_schema.json)

| #   | Ime                           | Opis                                               | Formula                                                                                                                                        |
| --- | ----------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `avg_hours_recent`            | Prosečan broj radnih sati po danu, RECENT period   | prosek `(endTime - startTime)` u satima, samo za dane sa i startTime i endTime (isključuje ABSENT dane)                                        |
| 2   | `avg_hours_baseline`          | Isto, ali za BASELINE period                       | isto, na BASELINE danima                                                                                                                       |
| 3   | `hours_deviation`             | Koliko RECENT odstupa od BASELINE                  | `avg_hours_recent - avg_hours_baseline`                                                                                                        |
| 4   | `pct_late_recent`             | Udeo LATE dana u RECENT                            | broj dana sa statusId=LATE / ukupno RECENT radnih dana                                                                                         |
| 5   | `pct_absent_recent`           | Udeo ABSENT dana u RECENT                          | broj dana sa statusId=ABSENT / ukupno RECENT radnih dana                                                                                       |
| 6   | `avg_arrival_hour_recent`     | Prosečan sat dolaska (lokalno), RECENT             | prosek `startTime` (lokalni sat + decimalni minuti/60), samo dani sa startTime                                                                 |
| 7   | `arrival_time_std_dev_recent` | Koliko je dolazak nekonzistentan, RECENT           | standardna devijacija `avg_arrival_hour_recent` uzorka, u satima                                                                               |
| 8   | `trend_slope`                 | Da li se broj radnih sati poslednjih dana povećava | nagib linearne regresije (dan_indeks 0..14 → broj radnih sati tog dana) na RECENT periodu; dani bez podataka (ABSENT) se preskaču iz regresije |

## Label (samo za sintetički trening dataset, ne postoji za prave usere)

`label = 1` (at_risk) ako je sintetički zaposleni generisan sa "burnout" obrascem
(RECENT: rani dolasci, kasni odlasci, malo/nimalo odsustava — kao Vojislav u pravoj bazi).
`label = 0` (normal) inače.

## Edge case-ovi koje i Python i Node moraju isto da hendluju

- Nema nijedan radni dan u prozoru uopšte (potpuno nov user) → svi feature-i = 0,
  model će verovatno vratiti nizak risk score (nema signala je i dalje "nema signala").
- Samo jedan dan podataka u RECENT → `arrival_time_std_dev_recent` = 0 (std dev jednog
  broja je 0, ne NaN).
- `trend_slope` kad ima manje od 2 dana sa podacima u RECENT → 0 (nema dovoljno tačaka
  za regresiju).
