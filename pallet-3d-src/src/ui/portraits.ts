import type { Portrait } from "../game/types";

const SAFE_COLOR = /^#[0-9a-fA-F]{6}$/;

export function portraitSvg(kind: Portrait, accent: string): string {
  const color = SAFE_COLOR.test(accent) ? accent : "#7d8c6a";
  if (kind === "bramblo") return bramblo(color);
  if (kind === "pebblit") return pebblit(color);
  return blob(color);
}

function bramblo(color: string): string {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
    <ellipse cx="60" cy="78" rx="34" ry="26" fill="${color}"/>
    <ellipse cx="60" cy="84" rx="18" ry="12" fill="#d8efc4"/>
    <path d="M40 58 L52 28 L60 52 Z" fill="#2f7a3a"/>
    <path d="M58 50 L70 18 L78 54 Z" fill="#3e9448"/>
    <path d="M74 60 L96 36 L86 66 Z" fill="#2a6b34"/>
    <circle cx="48" cy="74" r="5" fill="#fff"/>
    <circle cx="72" cy="74" r="5" fill="#fff"/>
    <circle cx="49" cy="75" r="2.2" fill="#243024"/>
    <circle cx="73" cy="75" r="2.2" fill="#243024"/>
    <path d="M52 86 Q60 92 68 86" fill="none" stroke="#243024" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function pebblit(color: string): string {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path d="M28 78 L40 42 L62 30 L92 48 L98 78 L78 96 L40 96 Z" fill="${color}"/>
    <path d="M48 48 L62 70 L54 78" fill="none" stroke="#6d5430" stroke-width="3" stroke-linecap="round"/>
    <path d="M70 44 L66 66" fill="none" stroke="#6d5430" stroke-width="3" stroke-linecap="round"/>
    <circle cx="52" cy="62" r="4.5" fill="#fff"/>
    <circle cx="74" cy="60" r="4.5" fill="#fff"/>
    <circle cx="53" cy="63" r="2" fill="#2c2418"/>
    <circle cx="75" cy="61" r="2" fill="#2c2418"/>
    <rect x="40" y="96" width="10" height="10" rx="2" fill="#8d7348"/>
    <rect x="70" y="96" width="10" height="10" rx="2" fill="#8d7348"/>
  </svg>`;
}

function blob(color: string): string {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
    <circle cx="60" cy="64" r="34" fill="${color}"/>
    <circle cx="48" cy="58" r="6" fill="#fff"/>
    <circle cx="74" cy="58" r="6" fill="#fff"/>
    <circle cx="49" cy="59" r="2.4" fill="#1d2430"/>
    <circle cx="75" cy="59" r="2.4" fill="#1d2430"/>
    <ellipse cx="60" cy="76" rx="10" ry="6" fill="#ffffff55"/>
  </svg>`;
}
