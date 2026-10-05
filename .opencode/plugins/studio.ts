/**
 * studio — обёртка хуков плагина для OpenCode V2 + телеметрия токенов.
 *
 * Хуки (python-скрипты студии не переписаны: им подаются события
 * в исходном формате Claude Code):
 *
 *   ctx.tool.hook("execute.before")  → guard_git.py: bash/shell перед
 *     запуском; код 2 и stderr — throw = вызов инструмента заблокирован.
 *   ctx.session.hook("prompt")       → session_context.py: первый промпт
 *     сессии в проекте студии; additionalContext дописывается к промпту.
 *
 * Телеметрия токенов: на «session.usage.updated» (обновление расхода
 * сессии — проверено на живом сервере V2; события «session.idle» в V2
 * нет) и на первом промпте сессии — дельта-запись использования в
 * ../<проект>.wt/usage/studio-usage.jsonl: строка на каждый ответ модели
 * студии — {t, sid, parent, agent, model, in, out, cacheRead, cacheWrite,
 * reasoning, cost}. Агенты — основные и запасные «-any» (запасной
 * наследует модель чата и работает, пока основная недоступна — его
 * ответы не должны выпадать из журнала). Досмотр — от свежих сообщений
 * к старым с остановкой на первом записанном (не перечитывать всю
 * сессию на каждый шаг); известные id — последние 400 на сессию. Дедуп —
 * по id сообщений в ctx.storage; чужие проекты — мимо (фильтр по
 * projectID — поток событий общий на сервер). Тишина важнее полноты:
 * любая ошибка телеметрии не ломает работу.
 */
import { spawn } from "node:child_process"
import * as fs from "node:fs"
import * as path from "node:path"

const PY_TIMEOUT_MS = 10_000

const STUDIO_AGENTS = new Set([
  "studio", "executor-prep", "executor-code", "executor-finish",
  "reviewer", "reviewer-fast", "designer", "scout", "assets", "reference",
])

/** Агент студии: основной или запасной «-any» (наследует модель чата). */
function isStudioAgent(name) {
  return typeof name === "string" &&
    (STUDIO_AGENTS.has(name) ||
     (name.endsWith("-any") && STUDIO_AGENTS.has(name.slice(0, -4))))
}

function pluginData(ctx) {
  return `${ctx.location.directory}/.opencode/studio`
}

function usagePath(ctx) {
  const root = ctx.location.directory
  return path.join(path.dirname(root), path.basename(root) + ".wt",
                   "usage", "studio-usage.jsonl")
}

/** секунды или миллисекунды → ISO-строка. */
function isoTime(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return new Date().toISOString()
  return new Date(v > 1e12 ? v : v * 1000).toISOString()
}

function runPython(script, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload)
    const tryLaunch = (cmd, args) => {
      const child = spawn(cmd, [...args, "-X", "utf8", script], {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      })
      let stdout = "", stderr = "", done = false
      const finish = (code, out, err) => {
        if (done) return
        done = true
        clearTimeout(timer)
        resolve({ code, stdout: out, stderr: err })
      }
      const timer = setTimeout(() => {
        try { child.kill() } catch {}
        finish(1, stdout, stderr + "\nstudio: таймаут хука")
      }, PY_TIMEOUT_MS)
      child.stdout.on("data", (d) => (stdout += d.toString("utf-8")))
      child.stderr.on("data", (d) => (stderr += d.toString("utf-8")))
      child.on("error", () => finish(127, "", `studio: не удалось запустить ${cmd}`))
      child.on("close", (code) => finish(code ?? 1, stdout, stderr))
      child.stdin.on("error", () => {}) // скрипт мог закрыть stdin раньше
      child.stdin.end(body, "utf-8")
    }
    tryLaunch("python", [])
  })
}

export default {
  id: "studio",
  async setup(ctx) {
    const data = pluginData(ctx)
    const root = ctx.location.directory

    // ---- страж коммитов: до каждого вызова bash/shell -----------------
    await ctx.tool.hook("execute.before", async (event) => {
      if (event.tool !== "bash" && event.tool !== "shell") return
      const input = event.input ?? {}
      const command = input.command
      if (typeof command !== "string" || !command) return
      // формат события Claude — парсер guard_git.py не меняется
      const { code, stderr } = await runPython(`${data}/hooks/guard_git.py`, {
        tool_name: "Bash",
        tool_input: { command },
        cwd: input.cwd ?? root,
      })
      if (code === 2 && stderr.trim()) {
        throw new Error(stderr.trim()) // блок: текст уйдёт модели
      }
    })

    // ---- контекст сессии: первый промпт в проекте студии ---------------
    const seen = new Set()
    await ctx.session.hook("prompt", async (event) => {
      const sid = event.sessionID ?? "session"
      if (sid !== "session") void flushUsage(ctx, sid) // телеметрия: не ждём idle
      if (seen.has(sid)) return
      seen.add(sid)
      const { code, stdout } = await runPython(`${data}/hooks/session_context.py`, {
        cwd: root,
      })
      if (code !== 0 || !stdout.trim()) return
      try {
        const text = JSON.parse(stdout)?.hookSpecificOutput?.additionalContext
        if (typeof text === "string" && text.trim()) {
          event.prompt.text = `${event.prompt.text}\n\n${text}`
        }
      } catch {
        // не JSON — тишина: хук не должен мешать работе
      }
    })

    // ---- телеметрия токенов --------------------------------------------
    const controller = new AbortController()
    const throttle = new Map()
    void (async () => {
      try {
        for await (const ev of ctx.event.subscribe({ signal: controller.signal })) {
          try {
            if (String(ev?.type ?? "") !== "session.usage.updated") continue
            const sid = ev?.data?.sessionID ?? ev?.sessionID
            if (typeof sid !== "string") continue
            // не чаще раза в 10 с на сессию: событие идёт на каждый шаг,
            // а досмотр — не бесплатный (контекст сессии целиком)
            const now = Date.now()
            if ((throttle.get(sid) ?? 0) > now - 10_000) continue
            throttle.set(sid, now)
            void flushUsage(ctx, sid)
          } catch {}
        }
      } catch {
        // поток закрылся (перезагрузка) — тишина
      }
    })()
    return () => controller.abort()
  },
}

/** Дозаписать в studio-usage.jsonl новые ответы моделей этой сессии. */
async function flushUsage(ctx, sid) {
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
    fs.appendFileSync(file, fresh.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8")
  } catch {
    // телеметрия не должна ломать работу — тишина
  }
}
