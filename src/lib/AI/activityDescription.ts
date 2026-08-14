const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function generateActivityDescription(
  name: string
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY nije podešen u .env");
    return null;
  }

  const prompt = `Napiši kratak, opšti opis (2-3 rečenice) na srpskom jeziku koji objašnjava ŠTA PODRAZUMEVA aktivnost pod nazivom "${name}" - kao da objašnjavaš nekome ko ne zna šta ta aktivnost obično uključuje. NE piši u prvom licu i NE piši kao da se aktivnost već desila (izbegavaj npr. "Učestvovao sam", "Bio sam na", prošlo vreme iz ugla zaposlenog). Piši neutralno i opisno, npr. u stilu "Ova aktivnost obuhvata..." ili "Podrazumeva...". Ne dodaj naslov, navodnike, niti bilo kakve napomene - samo čist tekst opisa.`;
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Gemini API greška:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== "string" || !text.trim()) {
      return null;
    }

    return text.trim();
  } catch (err) {
    console.error("Gemini API poziv pao:", err);
    return null;
  }
}
