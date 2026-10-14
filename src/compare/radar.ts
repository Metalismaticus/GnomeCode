// Оси радара сравнения (усиление сравнения моделей, как на
// opencode.ai/data/compare): Reasoning, Coding, Tool use, Multimodal,
// Cost efficiency. Источник — те же данные каталога: бенчмарки классифицируются
// по имени в оси, проценты нормируются к 0–100, цены — обратная лог-шкала
// внутри сравниваемой пары (дешевле — выше). Точка без данных за осью рисуется
// «полой» (hollow) по флагу возможности — так же, как на сайте («Hollow points
// use fallbacks»).

import type { CompareModel } from "../compare";

export const RADAR_AXES = ["Reasoning", "Coding", "Tool use", "Multimodal", "Cost efficiency"] as const;

export type RadarPoint = { value: number; real: boolean };
export type RadarSeries = { name: string; points: RadarPoint[] };

/** Классификация бенчмарка по имени — первая подошедшая ось. Порядок важен:
 *  «SWE-MM» и «MiMo VisualCoding» — мультимодальные, хотя содержат «code». */
const MULTIMODAL_RE = /vision|image|video|mmmu|multimodal|omnidoc|chart|screen|charxiv|-mm\b|\bmm\b|jfbench/i;
const CODING_RE = /swe[- ]?bench|swe[- ]?marathon|swe[- ]?atlas|terminal[- ]?bench|aider|frontiercode|cursorbench|livecodebench|codeforces|scicode|nl2repo|program\s?bench|qwencoder|qwenswebench|coding|\bcode\b|commit|kimi code|mimo code|cyber|exploit|sec-bench|sre-bench/i;
const TOOL_RE = /tool|tau[²³23]?\s?-?bench|mcp\b|osworld|webarena|android|browse|claw|automation|agent|workbench|skills|jobbench/i;
const REASONING_RE = /gpqa|mmlu|arc-agi|aime|usamo|hmmt|\bimo\b|math|phybench|zerobench|humanit|\bhle\b|frontier\s?science|reasoning|science|ifbench|simpleqa|omniscience|health|finance|legal|gdp|search|long\s?context|mrcr|forte|translation|cti-realm|genebench/i;

function axisOf(benchmark: string): (typeof RADAR_AXES)[number] | null {
  const name = benchmark.toLowerCase();
  if (MULTIMODAL_RE.test(name)) {
    return "Multimodal";
  }
  if (CODING_RE.test(name)) {
    return "Coding";
  }
  if (TOOL_RE.test(name)) {
    return "Tool use";
  }
  if (REASONING_RE.test(name)) {
    return "Reasoning";
  }
  return null;
}

/** Проценты к 0–100: доли (≤ 1) умножаются, Elo/рейтинги в оси не идут. */
function percentOf(score: number, metric: string): number | null {
  const m = metric.toLowerCase();
  if (m.includes("elo") || m.includes("rating") || m.includes("win")) {
    return null;
  }
  const value = score <= 1 ? score * 100 : score;
  return Math.max(0, Math.min(100, value));
}

/** Среднее процентных бенчмарков оси: нет подходящих — null (точка будет полой). */
function axisMean(model: CompareModel, axis: (typeof RADAR_AXES)[number]): number | null {
  const scores: number[] = [];
  for (const benchmark of model.benchmarks) {
    if (axisOf(benchmark.name) === axis) {
      const value = percentOf(benchmark.score, benchmark.metric);
      if (value !== null) {
        scores.push(value);
      }
    }
  }
  if (!scores.length) {
    return null;
  }
  return Math.round(scores.reduce((sum, one) => sum + one, 0) / scores.length);
}

/** Смешанная цена за 1 млн: вывод важнее ввода (реальная нагрузка чата). */
function blendedPrice(model: CompareModel): number | null {
  if (model.input === null && model.output === null) {
    return null;
  }
  return (model.input ?? 0) * 0.3 + (model.output ?? 0) * 0.7;
}

/** Стоимость внутри пары (обратная лог-шкала): дешевле — выше ось; у бесплатной
 *  — 100; цены равны — обе 50; нет цены — null (полая точка на нуле). */
function costScore(model: CompareModel, other: CompareModel): number | null {
  const mine = blendedPrice(model);
  const theirs = blendedPrice(other);
  if (mine === null) {
    return null;
  }
  if (theirs === null || mine === theirs) {
    return 50;
  }
  // Доля на шкале «дешевле → дороже» между ценами пары: чем ближе к дорогой,
  // тем ниже ось (дешёвая модель получает 100, дорогая — 0).
  const lo = Math.log(Math.min(mine, theirs) + 0.01);
  const hi = Math.log(Math.max(mine, theirs) + 0.01);
  const share = (Math.log(mine + 0.01) - lo) / (hi - lo);
  const score = Math.round((1 - share) * 100);
  return Math.max(0, Math.min(100, score));
}

/** Фолбэк оси по флагу возможности: 30 — «заявлено, бенчмарков нет»; 0 —
 *  «не заявлено». Точка в любом случае рисуется полой. */
function fallbackOf(model: CompareModel, axis: (typeof RADAR_AXES)[number]): number {
  if (axis === "Reasoning") {
    return model.reasoning ? 30 : 0;
  }
  if (axis === "Tool use") {
    return model.toolCall ? 30 : 0;
  }
  if (axis === "Multimodal") {
    return model.imageOutput ? 30 : 0;
  }
  return 0;
}

/** Пять осей модели против второй модели пары: реальные значения — по
 *  бенчмаркам и ценам, без данных — фолбэк с пометкой (полая точка). */
export function radarSeries(model: CompareModel, other: CompareModel): RadarSeries {
  const points = RADAR_AXES.map((axis): RadarPoint => {
    if (axis === "Cost efficiency") {
      const value = costScore(model, other);
      return value === null ? { value: 0, real: false } : { value, real: true };
    }
    const value = axisMean(model, axis);
    return value === null ? { value: fallbackOf(model, axis), real: false } : { value, real: true };
  });
  return { name: model.name, points };
}
