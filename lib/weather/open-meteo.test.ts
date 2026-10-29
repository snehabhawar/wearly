import { expect, test } from "vitest";
import { toForecast } from "./open-meteo";

test("toForecast rounds temperatures and groups weather codes", () => {
  const forecast = toForecast({
    time: ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29"],
    weather_code: [0, 45, 3, 61],
    temperature_2m_max: [24.1, 23.9, 18.5, 12.2],
    temperature_2m_min: [6.5, 6.3, 9.7, 4],
    precipitation_probability_max: [0, null, 70, 90],
  });
  expect(forecast).toEqual([
    { day: "2026-10-26", high_c: 24, low_c: 7, rain: false, condition: "clear", summary: "Sunny" },
    { day: "2026-10-27", high_c: 24, low_c: 6, rain: false, condition: "cloudy", summary: "Foggy" },
    { day: "2026-10-28", high_c: 19, low_c: 10, rain: true, condition: "cloudy", summary: "Cloudy, rain likely" },
    { day: "2026-10-29", high_c: 12, low_c: 4, rain: true, condition: "rain", summary: "Rain" },
  ]);
});
