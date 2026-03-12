import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

export const runtime = 'nodejs'

export async function POST() {
  // Only allow on development to avoid starting child processes on prod
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not allowed in production' }, { status: 403 })
  }

  const socketUrl = process.env.SOCKET_PING_URL || 'http://localhost:3001/ping'
  try {
    const res = await fetch(socketUrl, { method: 'GET' })
    if (res.ok) {
      return NextResponse.json({ ok: true, running: true })
    }
  } catch (err) {
    // ignore
  }

  // Try to spawn the socket server in the repository root
  try {
    const cmd = process.execPath || 'node'
    const worker = spawn(cmd, ["socket-server.js"], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    })
    worker.unref()

    return NextResponse.json({ ok: true, started: true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
