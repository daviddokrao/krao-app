import {useEffect, useRef} from 'react'

import {createBridge} from '../../bridge'
import {type MiniAppFrameProps} from './types'

/**
 * The Mini App in a sandboxed iframe. `allow-same-origin` lets the app use
 * its own storage, which is safe only because the host has refused to run an
 * app on its own origin (see the screen). No top navigation, no popups, and
 * no browser features (camera, location, ...) are delegated to the frame.
 */
export function MiniAppFrame({
  url,
  origin,
  title,
  isApproved,
  permissions,
  handlers,
}: MiniAppFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const latest = useRef({isApproved, permissions, handlers})
  useEffect(() => {
    latest.current = {isApproved, permissions, handlers}
  })

  useEffect(() => {
    const bridge = createBridge({
      origin,
      frame: () => frameRef.current?.contentWindow ?? null,
      isApproved: () => latest.current.isApproved(),
      permissions: () => latest.current.permissions(),
      handlers: {
        getContext: () => latest.current.handlers.getContext(),
        requestWallet: () => latest.current.handlers.requestWallet(),
        signMessage: p => latest.current.handlers.signMessage(p),
        sendTransaction: p => latest.current.handlers.sendTransaction(p),
        close: () => latest.current.handlers.close(),
      },
      // Addressed to the manifest origin: a frame that went elsewhere gets nothing
      send: (message, targetOrigin) => {
        frameRef.current?.contentWindow?.postMessage(message, targetOrigin)
      },
    })
    const onMessage = (event: MessageEvent) => {
      void bridge.handleMessage({
        data: event.data,
        origin: event.origin,
        source: event.source,
      })
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      bridge.dispose()
    }
  }, [origin])

  return (
    <iframe
      ref={frameRef}
      src={url}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-forms"
      referrerPolicy="no-referrer"
      allow=""
      data-testid="miniAppFrame"
      style={{flex: 1, width: '100%', height: '100%', border: 0}}
    />
  )
}
