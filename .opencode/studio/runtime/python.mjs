import { spawn } from 'node:child_process'

export async function runPython(script, payload, timeout = 10_000) {
  const candidates = process.platform === 'win32' ? [['python', []], ['py', ['-3']]] : [['python3', []], ['python', []]]
  for (const [command, prefix] of candidates) {
    const result = await new Promise((resolve) => {
      const child = spawn(command, [...prefix, '-X', 'utf8', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] })
      let stdout = '', stderr = '', settled = false
      const finish = (code, error) => {
        if (settled) return
        settled = true; clearTimeout(timer)
        resolve({ code, stdout, stderr, missing: error?.code === 'ENOENT' })
      }
      const timer = setTimeout(() => { child.kill(); stderr += '\nstudio: hook timed out'; finish(1) }, timeout)
      child.stdout.on('data', (data) => { stdout = (stdout + data.toString('utf8')).slice(-64_000) })
      child.stderr.on('data', (data) => { stderr = (stderr + data.toString('utf8')).slice(-64_000) })
      child.on('error', (error) => { stderr += error.message; finish(127, error) })
      child.on('close', (code) => finish(code ?? 1))
      child.stdin.on('error', () => {})
      child.stdin.end(JSON.stringify(payload), 'utf8')
    })
    if (!result.missing) return result
  }
  return { code: 127, stdout: '', stderr: 'studio: Python 3 not found; install Python before development' }
}
