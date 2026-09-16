# 📌 Evidencija zaposlenih

Web aplikacija za evidenciju aktivnosti zaposlenih, prisustva, rada od kuće (WFH), vremenskih uslova i državnih praznika.

Aplikacija implementira:

- Autentifikaciju i autorizaciju (RBAC)
- Google Social Login (OAuth)
- Upravljanje aktivnostima
- Evidenciju dolaska i odlaska
- WFH zahteve sa validacijom vremenskih uslova
- AI asistenta za WFH zahteve (LLM + vremenski podaci)
- AI generisanje opisa aktivnosti (Google Gemini API)
- ML detekciju burnout-a/anomalija u ponašanju zaposlenih
- Sinhronizaciju sa Google Calendar-om
- Notifikacije
- Integraciju sa eksternim API servisima
- Sigurnosne mehanizme (IDOR, CSRF, rate limiting)
- CI pipeline i Docker deploy

---

# 🧱 Tehnologije

## Frontend

- Next.js (App Router)
- React
- TypeScript

## Backend

- Next.js API Routes
- Prisma 7
- PostgreSQL

## AI / ML

- Google Gemini API (generisanje opisa aktivnosti, WFH asistent - intent parsing)
- Python + scikit-learn (trening modela za detekciju burnout-a/anomalija)
- ONNX (export modela) + onnxruntime-node (inferenca u Next.js)

## Autentifikacija

- NextAuth.js / Auth.js (Prisma adapter)
- Google OAuth (Social Login)

## Testiranje

- Vitest
- Integration testovi (API)

## DevOps

- Docker & Docker Compose
- GitHub Actions (CI)
- Render (deploy)

## Eksterni servisi

- Open-Meteo API (vremenski podaci)
- Nager.Date API (državni praznici)
- Google Calendar API (sinhronizacija)

---

# 🔐 Funkcionalnosti

## Autentifikacija

- Registracija
- Login (klasičan + Google Social Login)
- JWT (httpOnly cookie)
- Role-based access control:
  - ADMIN
  - MANAGER
  - EMPLOYEE

## Aktivnosti

- Kreiranje aktivnosti
- AI generisanje opisa aktivnosti (Google Gemini API)
- Izmena i brisanje (ADMIN/MANAGER)
- Dodela aktivnosti drugim korisnicima
- Filtriranje po datumu
- Ownership kontrola (IDOR zaštita)

## Prisustvo

- Check-in
- Check-out
- Ograničenje na sopstveni nalog

## WFH zahtevi

- Zaposleni podnosi zahtev za rad od kuće
- Validacija na osnovu vremenskih uslova (Open-Meteo)
- AI WFH asistent — kombinuje LLM intent parsing sa vremenskim uslovima za preporuku/podnošenje zahteva
- ADMIN odobrava ili odbija zahtev

## AI / ML funkcionalnosti

- **Detekcija burnout-a/anomalija**: model treniran u Python-u (scikit-learn), eksportovan u ONNX format, pokreće se u Next.js preko onnxruntime-node; admin stranica sa rezultatima
- **AI generisanje opisa aktivnosti**: automatsko generisanje opisa aktivnosti putem Google Gemini API-ja
- **AI WFH asistent**: LLM parsira nameru korisnika i kombinuje je sa live vremenskim podacima

## Google Calendar

- Sinhronizacija aktivnosti/prisustva sa Google Calendar-om

## Notifikacije

- Sistem notifikacija za relevantne događaje u aplikaciji

## Praznici

- Sinhronizacija državnih praznika
- Onemogućeno kreiranje aktivnosti na praznik

## Sigurnost

- IDOR zaštita (ownership provera)
- CSRF zaštita (Origin validacija)
- Rate limiting na login endpoint
- React XSS zaštita (escape mehanizam)

📊 Vizualizacija podataka

Aplikacija sadrži Google Charts vizualizaciju statistike prisustva.

Stranica: `/stats/attendance`

Vizualizacije uključuju:

- Donut chart (Udeo statusa: PRESENT, LATE, ABSENT)
- Grafički prikaz po mesecima (stacked column chart)
- Role-based filtriranje (ADMIN/MANAGER mogu filtrirati po korisniku)
- Filter po datumu (Od – Do opseg)

Podaci se dinamički učitavaju sa backend API-ja i agregiraju na osnovu odabranog perioda.

---

# ⚙️ Pokretanje aplikacije (lokalno)

## 1️⃣ Kloniranje repozitorijuma

```bash
git clone <https://github.com/damjanveselinovic/EMPLOYEE-ATTENDANCE-SYSTEM.git>
cd evidencija-zap
```

---

## 2️⃣ Instalacija zavisnosti

```bash
npm install
```

---

## 3️⃣ Kreiranje .env fajla

U root folderu kreirati `.env` fajl:

DATABASE_URL=postgresql://user:password@localhost:5432/attendance_app
JWT_SECRET=your_secret_key
APP_ORIGIN=http://localhost:3000
WEATHER_LAT=your_latitude
WEATHER_LON=your_longitude
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GEMINI_API_KEY=your_gemini_api_key

---

## 4️⃣ Pokretanje baze (Docker)

```bash
docker-compose up -d db
```

---

## 5️⃣ Migracije i seed

```bash
npx prisma migrate dev
node prisma/seed.js
```

---

## 6️⃣ Pokretanje aplikacije

```bash
npm run dev
```

Aplikacija je dostupna na:
http://localhost:3000

---

# 🧪 Pokretanje testova

Za test okruženje koristi se posebna baza.

```bash
npm run test
```

Testovi obuhvataju:

- RBAC validaciju
- API funkcionalnost
- Database reset izolaciju
- JWT autentifikaciju

---

# 🐳 Pokretanje kompletne aplikacije preko Docker-a

```bash
docker-compose up --build
```

Aplikacija je dostupna na:
http://localhost:3001

---

# 🚀 Deploy

Aplikacija je deploy-ovana na Render platformi.

Deploy proces uključuje:

- npm ci
- prisma generate
- prisma migrate deploy
- npm run build
- pokretanje servera
- pokretanje testova
- docker build

---

# 📂 Struktura projekta

src/
app/
api/
admin/
attendance/
calendar/
login/
my-requests/
register/
stats/
swagger/
components/
lib/
ml/
prisma/
tests/
.github/workflows/
docker-compose.yml
docker/entrypoint.sh
Dockerfile

# 📘 API dokumentacija (Swagger / OpenAPI)

Aplikacija sadrži OpenAPI 3.0 specifikaciju backend API-ja.

OpenAPI JSON specifikacija dostupna je na:
GET /api/openapi

Specifikacija obuhvata:

- Auth rute
- Users rute
- Activities rute
- Attendance rute
- ICS export
- Definisane request/response šeme
- Cookie-based autentifikaciju (auth_token)

OpenAPI dokument se može:

- Otvoriti direktno u browseru
- Importovati u Swagger Editor
- Importovati u Postman

Specifikacija je u skladu sa OpenAPI 3.0.3 standardom.

---

# 📌 Napomena

Seed skripta kreira inicijalnog ADMIN korisnika za testiranje.

Za produkcioni deploy potrebno je:

- Postaviti environment varijable na hosting platformi
- Omogućiti sigurnosne cookie opcije (Secure, SameSite)
- Konfigurisati bazu podataka
- Konfigurisati Google OAuth credentials i Gemini API key

---
