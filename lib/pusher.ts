import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

// Fix for "r.default is not a constructor" in Next.js Turbopack
const PusherServerConstructor = (PusherServer as any).default || PusherServer
const PusherClientConstructor = (PusherClient as any).default || (PusherClient as any).Pusher || PusherClient


// Instância para o Servidor (API Routes)
export const pusherServer = new PusherServerConstructor({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

/**
 * Instância para o Cliente (Browser)
 */
export const pusherClient = new PusherClientConstructor(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  }
)

