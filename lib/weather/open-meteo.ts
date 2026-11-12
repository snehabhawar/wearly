import { Forecast, type ForecastDay } from "@/lib/api";

/*
 * Open-Meteo daily forecast (free, no key) for a closet's coordinates, shaped as the Forecast
 * schema that plans.forecast stores (docs/api.md, Plan).
 */

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
/** Above this chance of rain, the day counts as rainy even if the weather code is dry */
const RAIN_CHANCE_PCT = 50;

export type OpenMeteoDaily = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: (number | null)[];
};

/** WMO weather codes (open-meteo.com/en/docs) grouped into the app's four conditions, with a label */
function describe(code: number): { condition: ForecastDay["condition"]; label: string } {
  if (code <= 1) return { condition: "clear", label: "Sunny" };
  if (code <= 3) return { condition: "cloudy", label: "Cloudy" };
  if (code === 45 || code === 48) return { condition: "cloudy", label: "Foggy" };
  if (code >= 51 && code <= 57) return { condition: "rain", label: "Drizzle" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: "snow", label: "Snow" };
  if (code >= 95) return { condition: "rain", label: "Thunderstorms" };
  return { condition: "rain", label: "Rain" };
}

export function toForecast(daily: OpenMeteoDaily): Forecast {
  return daily.time.map((day, i) => {
    const { condition, label } = describe(daily.weather_code[i]);
    const chance = daily.precipitation_probability_max[i] ?? 0;
    const rain = condition === "rain" || chance >= RAIN_CHANCE_PCT;
    return {
      day,
      high_c: Math.round(daily.temperature_2m_max[i]),
      low_c: Math.round(daily.temperature_2m_min[i]),
      rain,
      condition,
      summary: rain && condition !== "rain" ? `${label}, rain likely` : label,
    };
  });
}

/** The 7 days from `start`, or null when Open-Meteo can't be reached (the planner then plans without weather) */
export async function fetchForecast(input: {
  latitude: number;
  longitude: number;
  timeZone: string;
  start: string;
  end: string;
}): Promise<Forecast | null> {
  const params = new URLSearchParams({
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: input.timeZone,
    start_date: input.start,
    end_date: input.end,
  });
  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: OpenMeteoDaily };
    return json.daily ? Forecast.parse(toForecast(json.daily)) : null;
  } catch {
    return null;
  }
}
