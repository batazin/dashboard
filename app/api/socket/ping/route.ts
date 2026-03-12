import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const socketUrl = process.env.SOCKET_PING_URL || 'http://localhost:3001/ping'
    const res = await fetch(socketUrl, { method: 'GET' })
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, statusText: res.statusText }, { status: 502 })
    }
    const text = await res.text().catch(() => '')
    return NextResponse.json({ ok: true, text }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 502 })
  }
}
