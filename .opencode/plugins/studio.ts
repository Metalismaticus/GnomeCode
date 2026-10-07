/** studio: OpenCode V2 adapter; workflow, policy, telemetry and Python hooks are separate modules. */
import path from "node:path"
import { Engine } from "../studio/runtime/engine.mjs"
import { isStudioRole } from "../studio/runtime/contracts.mjs"
import { workflowSchema } from "../studio/runtime/schema.mjs"
import { editAllowed, shellAllowed } from "../studio/runtime/policy.mjs"
import { runPython } from "../studio/runtime/python.mjs"
import { flushUsage } from "../studio/runtime/telemetry.mjs"
import { checkModel } from "../studio/runtime/models.mjs"

export default {
  id: "studio",
  async setup(ctx) {
    const root = ctx.location.directory
    const engine = new Engine(root)
    const data = path.join(root, ".opencode", "studio")
    const knownAgents = new Map()
    const actor = async (sessionID, hint) => {
      if (typeof sessionID !== "string") throw new Error("studio: OpenCode did not supply sessionID")
      const info = await ctx.session.get({ sessionID })
      const agent = hint ?? info?.agent ?? knownAgents.get(sessionID)
      if (!info || info.projectID !== ctx.location.project.id || !agent) throw new Error("studio: session identity unavailable or belongs to another project")
      return { sessionID, agent, parentID: info.parentID }
    }

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "studio_workflow",
        description: "Read task state or advance a studio task through role-checked implementation, independent review, real verification and owner acceptance. Bind concept/development once; get the task card before work.",
        input: workflowSchema,
        execute: async (input, context) => {
          const result = await engine.execute(input, await actor(context.sessionID), context.signal)
          return { content: JSON.stringify(result) }
        },
      })
    })

    // Real permission evaluation, including tools invoked through Code Mode.
    // Shell remains host-authority; this is a workflow guard, not an OS sandbox.
    await ctx.permission.hook("evaluate", async (event) => {
      const identity = await actor(event.sessionID, event.agent)
      if (!isStudioRole(identity.agent)) return
      if (event.action === "edit" && !editAllowed(engine, identity, event.resources)) {
        event.effect = "deny"
        event.message = "studio: this role/mode cannot edit these files; use the assigned task scope or the concept document workflow"
      }
      if ((event.action === "shell" || event.action === "bash") && event.resources.some((command) => !shellAllowed(engine, identity, command))) {
        event.effect = "deny"
        event.message = "studio: concept/design role cannot launch the product or execute this command"
      }
    })

    // Keep the original commit guard. A broken/missing guard blocks execution
    // rather than silently treating its failure as permission to run git.
    const questionIntents = new Map()
    await ctx.tool.hook("execute.before", async (event) => {
      if (event.tool === "question") {
        const question = JSON.stringify(event.input ?? {})
        if (/принима|так и есть/i.test(question)) questionIntents.set(event.sessionID, "acceptance")
        else questionIntents.delete(event.sessionID)
        return
      }
      if (event.tool !== "bash" && event.tool !== "shell") return
      const input = event.input ?? {}
      if (typeof input.command !== "string" || !input.command) return
      const { code, stderr } = await runPython(path.join(data, "hooks", "guard_git.py"), {
        tool_name: "Bash", tool_input: { command: input.command }, cwd: input.workdir ?? input.cwd ?? root,
      })
      if (code !== 0) throw new Error(stderr.trim() || "studio: guard_git.py failed; shell call blocked")
    })

    const seen = new Set()
    await ctx.session.hook("prompt", async (event) => {
      // A brand-new Session may resolve its default agent only at context time.
      let identity
      try { identity = await actor(event.sessionID) } catch { return }
      if (!isStudioRole(identity.agent)) return
      void flushUsage(ctx, event.sessionID)
      // The raw user request is recorded before additionalContext is appended.
      if (identity.agent === "studio" && !identity.parentID && typeof event.prompt?.text === "string") {
        engine.observeOwner(event.sessionID, event.prompt.text, "prompt")
      }
      if (seen.has(event.sessionID)) return
      seen.add(event.sessionID)
      const { code, stdout } = await runPython(path.join(data, "hooks", "session_context.py"), { cwd: root })
      if (code !== 0 || !stdout.trim()) return
      try {
        const text = JSON.parse(stdout)?.hookSpecificOutput?.additionalContext
        if (typeof text === "string" && text.trim()) event.prompt.text += `\n\n${text}`
      } catch {} // informational context must not make the session unusable
    })

    // Re-inject a small stage summary on every model request, also after compaction.
    await ctx.session.hook("context", (event) => {
      knownAgents.set(event.sessionID, event.agent)
      if (!isStudioRole(event.agent)) return
      checkModel(root, event.agent, event.model)
      const summary = engine.summary()
      const relevant = summary.tasks.filter((task) => !["accepted", "rejected"].includes(task.status)).slice(-16)
      event.system.push({ type: "text", text: "studio durable state (not acceptance): " + JSON.stringify(relevant) + "\nLoad only the current stage skill/chapters. Use studio_workflow get for your task; never infer DONE from a green check." })
    })

    // A successful question result is user input, not a model-created quote.
    await ctx.tool.hook("execute.after", async (event) => {
      if (event.tool !== "question" || event.status !== "completed") return
      const identity = await actor(event.sessionID)
      if (identity.agent !== "studio" || identity.parentID) return
      const result = event.result
      if (result) engine.observeOwner(event.sessionID, typeof result.content === "string" ? result.content : JSON.stringify(result), "question", questionIntents.get(event.sessionID) ?? null)
      questionIntents.delete(event.sessionID)
    })

    const controller = new AbortController()
    const throttle = new Map()
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          if (String(event?.type ?? "") !== "session.usage.updated") continue
          const sid = event?.data?.sessionID ?? event?.sessionID
          if (typeof sid !== "string") continue
          const now = Date.now()
          if ((throttle.get(sid) ?? 0) > now - 10_000) continue
          throttle.set(sid, now)
          void flushUsage(ctx, sid)
        }
      } catch {} // telemetry never blocks development
    })()
    return () => controller.abort()
  },
}
