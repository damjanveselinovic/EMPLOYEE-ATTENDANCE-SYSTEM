type OpenMeteoDailyResponse = {
  daily?: {
    time?: string[]; // "YYYY-MM-DD"
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    wind_speed_10m_max?: number[];
    weathercode?: number[];
  };
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function fetchDailyWeatherArchive(from: string, to: string) {
  const lat = mustEnv("WEATHER_LAT");
  const lon = mustEnv("WEATHER_LON");
  const tz = process.env.WEATHER_TZ ?? "Europe/Belgrade";

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  url.searchParams.set("timezone", tz);

  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max",
      "weathercode",
    ].join(",")
  );

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Open-Meteo error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as OpenMeteoDailyResponse;

  const d = data.daily;
  if (!d?.time?.length) return [];

  const out = d.time.map((day, i) => ({
    day, // "YYYY-MM-DD"
    tempMax: d.temperature_2m_max?.[i] ?? null,
    tempMin: d.temperature_2m_min?.[i] ?? null,
    precipSum: d.precipitation_sum?.[i] ?? null,
    windMax: d.wind_speed_10m_max?.[i] ?? null,
    weatherCode: d.weathercode?.[i] ?? null,
  }));

  return out;
}
export async function fetchDailyWeatherForecast(from: string, to: string) {
  const lat = mustEnv("WEATHER_LAT");
  const lon = mustEnv("WEATHER_LON");
  const tz = process.env.WEATHER_TZ ?? "Europe/Belgrade";

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lon);
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  url.searchParams.set("timezone", tz);

  url.searchParams.set(
    "daily",
    [
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "wind_speed_10m_max",
      "weathercode",
    ].join(",")
  );

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Open-Meteo forecast error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as OpenMeteoDailyResponse;
  const d = data.daily;
  if (!d?.time?.length) return [];

  return d.time.map((day, i) => ({
    day,
    tempMax: d.temperature_2m_max?.[i] ?? null,
    tempMin: d.temperature_2m_min?.[i] ?? null,
    precipSum: d.precipitation_sum?.[i] ?? null,
    windMax: d.wind_speed_10m_max?.[i] ?? null,
    weatherCode: d.weathercode?.[i] ?? null,
  }));
}
