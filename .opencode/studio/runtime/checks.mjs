import { spawn } from 'node:child_process'

// No model-provided exit codes: these results come from processes we launch.
export async function runChecks(worktree, checks, signal) {
  const results = []
  for (const check of checks) {
    if (signal?.aborted) throw new Error('studio: verification cancelled')
    results.push(await new Promise((resolve) => {
      const child = spawn(check.command, [], { cwd: worktree, shell: true, windowsHide: true, signal, stdio: ['ignore', 'pipe', 'pipe'] })
      let stdout = '', stderr = '', settled = false, timedOut = false
      const finish = (exit_code, error) => {
        if (settled) return
        settled = true; clearTimeout(timer)
        resolve({ name: check.name, command: check.command, exit_code, timed_out: timedOut, stdout, stderr, error: error ?? null })
      }
      const timer = setTimeout(() => { timedOut = true; child.kill(); finish(null, 'timeout') }, check.timeout_ms)
      child.stdout.on('data', (data) => { stdout = (stdout + data.toString()).slice(-16_000) })
      child.stderr.on('data', (data) => { stderr = (stderr + data.toString()).slice(-16_000) })
      child.on('error', (error) => finish(null, error.message))
      child.on('close', (code) => finish(code, null))
    }))
    if (results.at(-1).exit_code !== 0) break
  }
  return results
}
