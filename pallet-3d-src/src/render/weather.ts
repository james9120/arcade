export type WeatherName = "clear" | "clouds" | "light" | "heavy";

export interface WeatherSample {
  name: WeatherName;
  label: string;
  /** 0 is dry air, 1 is a downpour. */
  rain: number;
  /** 0 is a clear sky, 1 is overcast. */
  cloud: number;
}

/** One full clear → cloud → rain → clear pass, in seconds. */
export const WEATHER_PERIOD = 28;
/** Route 1 sits this far ahead of Pallet Town on the same clock. */
export const ROUTE_OFFSET = 14;

const KEYS: Array<{ t: number; rain: number; cloud: number }> = [
  { t: 0, rain: 0, cloud: 0 },
  { t: 5, rain: 0, cloud: 0 },
  { t: 9, rain: 0, cloud: 1 },
  { t: 14, rain: 0.55, cloud: 1 },
  { t: 20, rain: 1, cloud: 1 },
  { t: 23, rain: 1, cloud: 1 },
  { t: 28, rain: 0, cloud: 0 },
];

const FORCED: Record<WeatherName, WeatherSample> = {
  clear: { name: "clear", label: "Clear", rain: 0, cloud: 0 },
  clouds: { name: "clouds", label: "Clouds", rain: 0, cloud: 1 },
  light: { name: "light", label: "Light rain", rain: 0.48, cloud: 1 },
  heavy: { name: "heavy", label: "Heavy rain", rain: 1, cloud: 1 },
};

export function readWeatherOverride(search: string): WeatherName | null {
  const value = new URLSearchParams(search).get("weather");
  if (value === "rain" || value === "heavy") return "heavy";
  if (value === "light") return "light";
  if (value === "clouds" || value === "cloudy") return "clouds";
  if (value === "clear") return "clear";
  return null;
}

export function sampleWeather(time: number, area: "pallet" | "route", forced: WeatherName | null): WeatherSample {
  if (forced) return FORCED[forced];
  const shifted = time + (area === "route" ? ROUTE_OFFSET : 0);
  const local = mod(shifted, WEATHER_PERIOD);
  const blended = lerpKeys(local);
  return describe(blended.rain, blended.cloud);
}

/** Blend the two area forecasts across the Pallet / Route 1 seam. */
export function blendWeather(time: number, y: number, northRows: number, forced: WeatherName | null): WeatherSample {
  const pallet = sampleWeather(time, "pallet", forced);
  const route = sampleWeather(time, "route", forced);
  const weight = routeWeight(y, northRows);
  return describe(lerp(pallet.rain, route.rain, weight), lerp(pallet.cloud, route.cloud, weight));
}

/**
 * Wetness chases the rain amount. It soaks in faster than it dries, so puddles
 * linger after the sky clears.
 */
export function approachWetness(current: number, rain: number, dt: number): number {
  const rate = rain > current ? 0.85 : 0.16;
  const next = current + (rain - current) * (1 - Math.exp(-Math.max(0, dt) * rate));
  return clamp01(next);
}

function lerpKeys(time: number): { rain: number; cloud: number } {
  let previous = KEYS[0];
  for (let index = 1; index < KEYS.length; index++) {
    const next = KEYS[index];
    if (time <= next.t) {
      const span = next.t - previous.t;
      const raw = span <= 0 ? 1 : (time - previous.t) / span;
      const t = raw * raw * (3 - 2 * raw);
      return {
        rain: lerp(previous.rain, next.rain, t),
        cloud: lerp(previous.cloud, next.cloud, t),
      };
    }
    previous = next;
  }
  return { rain: 0, cloud: 0 };
}

function describe(rain: number, cloud: number): WeatherSample {
  const wet = clamp01(rain);
  const cover = clamp01(cloud);
  if (wet >= 0.72) return { name: "heavy", label: "Heavy rain", rain: wet, cloud: cover };
  if (wet >= 0.18) return { name: "light", label: "Light rain", rain: wet, cloud: cover };
  if (cover >= 0.45) return { name: "clouds", label: "Clouds", rain: wet, cloud: cover };
  return { name: "clear", label: "Clear", rain: wet, cloud: cover };
}

function routeWeight(y: number, northRows: number): number {
  const t = (northRows - y) / 4;
  const clamped = clamp01(t);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mod(value: number, period: number): number {
  return ((value % period) + period) % period;
}
