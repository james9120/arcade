import { describe, expect, it } from "vitest";
import {
  approachWetness,
  blendWeather,
  readWeatherOverride,
  sampleWeather,
} from "../src/render/weather";

describe("weather cycle", () => {
  it("starts Pallet Town clear and brings in clouds, then rain", () => {
    expect(sampleWeather(0, "pallet", null)).toMatchObject({ name: "clear", rain: 0 });
    expect(sampleWeather(7, "pallet", null).name).toBe("clouds");
    expect(sampleWeather(12, "pallet", null).rain).toBeGreaterThan(0.2);
    expect(sampleWeather(12, "pallet", null).name).toBe("light");
    expect(sampleWeather(17, "pallet", null).rain).toBeGreaterThan(0.7);
    expect(sampleWeather(17, "pallet", null).name).toBe("heavy");
    expect(sampleWeather(28, "pallet", null).rain).toBeLessThan(0.05);
  });

  it("keeps Route 1 on a different part of the same cycle", () => {
    const pallet = sampleWeather(0, "pallet", null);
    const route = sampleWeather(0, "route", null);
    expect(route.rain).toBeGreaterThan(pallet.rain);
    expect(route.name).not.toBe(pallet.name);
  });

  it("fades instead of stepping between keys", () => {
    const early = sampleWeather(9.2, "pallet", null).rain;
    const later = sampleWeather(10.2, "pallet", null).rain;
    expect(later).toBeGreaterThan(early);
    expect(later - early).toBeLessThan(0.25);
  });

  it("blends across the map seam and honors a forced forecast", () => {
    const south = blendWeather(0, 50, 40, null);
    const north = blendWeather(0, 10, 40, null);
    expect(south.name).toBe("clear");
    expect(north.rain).toBeGreaterThan(south.rain);
    expect(blendWeather(0, 50, 40, "heavy")).toMatchObject({ name: "heavy", rain: 1 });
    expect(readWeatherOverride("?weather=rain")).toBe("heavy");
    expect(readWeatherOverride("")).toBeNull();
  });

  it("soaks the ground faster than it dries", () => {
    const soaked = approachWetness(0, 1, 1);
    expect(soaked).toBeGreaterThan(0.5);
    const dried = soaked - approachWetness(soaked, 0, 1);
    expect(dried).toBeLessThan(soaked);
    expect(approachWetness(soaked, 0, 1)).toBeGreaterThan(0.2);
  });
});
