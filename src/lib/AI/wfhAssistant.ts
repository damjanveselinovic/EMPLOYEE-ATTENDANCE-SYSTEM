const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type DayWeatherFact = {
  date: string; // YYYY-MM-DD
  dayName: string;
  tempMin: number | null;
  tempMax: number | null;
  precipSum: number | null;
  windMax: number | null;
  weatherCode: number | null;
  meetsWfhCriteria: boolean;
};

export type WfhAssistantResult = {
  reply: string;
  suggestedDate: string | null;
};

export async function askWfhAssistant(
  question: string,
  days: DayWeatherFact[]
): Promise<WfhAssistantResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      reply: "AI asistent trenutno nije dostupan (nedostaje konfiguracija).",
      suggestedDate: null,
    };
  }

  const factsText = days
    .map((d) => {
      if (d.tempMin === null && d.tempMax === null && d.weatherCode === null) {
        return `${d.dayName} (${d.date}): nema podataka o vremenu.`;
      }
      return `${d.dayName} (${d.date}): min ${d.tempMin}°C, max ${
        d.tempMax
      }°C, padavine ${d.precipSum}mm, vetar ${
        d.windMax
      }km/h, ispunjava uslove za WFH: ${d.meetsWfhCriteria ? "DA" : "NE"}.`;
    })
    .join("\n");

  const prompt = `Ti si asistent u aplikaciji za evidenciju zaposlenih. Pomažeš zaposlenom da odluči da li i kog dana da pošalje zahtev za rad od kuće (WFH), isključivo na osnovu vremenske prognoze. Podaci za trenutnu radnu nedelju:

${factsText}

Pravilo: zahtev za WFH je moguć SAMO za dan označen sa "DA". Nikad ne predlaži dan koji nije označen sa "DA", čak i ako korisnik insistira ili pita baš za taj dan - u tom slučaju mu objasni da taj dan ne ispunjava uslove.

Korisnik pita: "${question}"

Odgovori kratko (2-3 rečenice), na srpskom, prijateljski ali direktno, isključivo na osnovu podataka iznad - ne izmišljaj podatke koje nemaš. Ako nijedan dan ne ispunjava uslove, iskreno to reci.

Odgovori ISKLJUČIVO u JSON formatu, bez markdown ograda, bez ikakvog dodatnog teksta pre ili posle:
{"reply": "tvoj odgovor ovde", "suggestedDate": "YYYY-MM-DD ili null"}`;

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Gemini API greška (WFH asistent):", res.status, errText);
      return {
        reply: "AI asistent trenutno nije dostupan, pokušaj ponovo kasnije.",
        suggestedDate: null,
      };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== "string" || !text.trim()) {
      return {
        reply: "AI asistent nije uspeo da generiše odgovor.",
        suggestedDate: null,
      };
    }

    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```$/, "");
    const parsed = JSON.parse(cleaned);

    const reply =
      typeof parsed.reply === "string" ? parsed.reply : "Nema odgovora.";
    const rawSuggestion =
      typeof parsed.suggestedDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.suggestedDate)
        ? parsed.suggestedDate
        : null;

    // sigurnosna provera: predlog mora da odg danu koji stv ispunjava uslove
    const isValid =
      rawSuggestion &&
      days.some((d) => d.date === rawSuggestion && d.meetsWfhCriteria);

    return { reply, suggestedDate: isValid ? rawSuggestion : null };
  } catch (err) {
    console.error("Gemini API poziv pao (WFH asistent):", err);
    return {
      reply: "Došlo je do greške pri komunikaciji sa AI asistentom.",
      suggestedDate: null,
    };
  }
}
