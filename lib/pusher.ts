import PusherServer from 'pusher'
import PusherClient from 'pusher-js'

// Fix for "r.default is not a constructor" in Next.js Turbopack
const PusherServerConstructor = (PusherServer as any).default || PusherServer
const PusherClientConstructor = (PusherClient as any).default || (PusherClient as any).Pusher || PusherClient

const appId = process.env.PUSHER_APP_ID
const key = process.env.NEXT_PUBLIC_PUSHER_KEY
const secret = process.env.PUSHER_SECRET
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

// Instância para o Servidor (API Routes)
export const pusherServer = (appId && key && secret && cluster)
  ? new PusherServerConstructor({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    })
  : null as any

/**
 * Instância para o Cliente (Browser)
 */
export const pusherClient = (typeof window !== 'undefined' && key && cluster)
  ? new PusherClientConstructor(key, { cluster })
  : {
      subscribe: (channel: string) => ({
        bind: (event: string, callback: Function) => {},
        unbind: (event: string, callback: Function) => {},
      }),
      unsubscribe: (channel: string) => {},
      bind: (event: string, callback: Function) => {},
      unbind: (event: string, callback: Function) => {},
    } as any


