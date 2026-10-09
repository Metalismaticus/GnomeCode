import fs from "node:fs"
import path from "node:path"
import { isStudioRole } from "./contracts.mjs"
const isStudioAgent = isStudioRole
const usagePath = (ctx) => path.join(path.dirname(ctx.location.directory), path.basename(ctx.location.directory) + ".wt", "usage", "studio-usage.jsonl")
function isoTime(v) { return new Date(typeof v === "number" && Number.isFinite(v) ? (v > 1e12 ? v : v * 1000) : Date.now()).toISOString() }

/** Дозаписать в studio-usage.jsonl новые ответы моделей этой сессии. */

const ROTATE_BYTES = 5 * 1024 * 1024

/** Больной журнал переименовывается в .1 (два поколения), текущий начинается заново. */
export function rotateIfNeeded(file, limit = ROTATE_BYTES) {
  try {
    if (fs.statSync(file).size <= limit) return false
    fs.renameSync(file, `${file}.1`)
    return true
  } catch { return false }
}

async function flushUsageInner(ctx, sid) {
  try {
    const info = await ctx.session.get({ sessionID: sid })
    if (!info || info.projectID !== ctx.location.project.id) return // чужое — мимо
    const messages = await ctx.session.context({ sessionID: sid })
    const seenMap = (await ctx.storage.get("usage-seen")) ?? {}
    const known = new Set(Array.isArray(seenMap[sid]) ? seenMap[sid] : [])
    const fresh = []
    const freshIds = []
    // от свежих к старым: за записанным ответы уже учтены — дальше не идём
    for (let i = (messages ?? []).length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m?.type !== "assistant" || !m?.tokens || !isStudioAgent(m?.agent)) continue
      if (known.has(m.id)) break
      known.add(m.id)
      freshIds.push(m.id)
      const t = m.tokens ?? {}
      fresh.push({
        t: isoTime(m.time?.completed ?? m.time?.created),
        sid,
        parent: info.parentID ?? null,
        agent: m.agent,
        model: m.model ? `${m.model.providerID}/${m.model.id}` : "?",
        in: t.input ?? 0,
        out: t.output ?? 0,
        cacheRead: t.cache?.read ?? 0,
        cacheWrite: t.cache?.write ?? 0,
        reasoning: t.reasoning ?? 0,
        cost: Number((m.cost ?? 0).toFixed(6)),
      })
    }
    if (!fresh.length) return
    fresh.reverse() // хронология: старые раньше
    // известные id — только последние: список не растёт вечно
    const prev = Array.isArray(seenMap[sid]) ? seenMap[sid] : []
    seenMap[sid] = [...freshIds.slice().reverse(), ...prev].slice(0, 400)
    const keys = Object.keys(seenMap)
    if (keys.length > 100) {
      for (const k of keys.slice(0, keys.length - 100)) delete seenMap[k]
    }
    await ctx.storage.set("usage-seen", seenMap)
    const file = usagePath(ctx)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    rotateIfNeeded(file)
    fs.appendFileSync(file, fresh.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8")
  } catch {
    // телеметрия не должна ломать работу — тишина
  }
}


let pending = Promise.resolve()
export function flushUsage(ctx, sid) {
  pending = pending.then(() => flushUsageInner(ctx, sid), () => flushUsageInner(ctx, sid))
  return pending
}
