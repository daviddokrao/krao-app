import {useEffect, useRef} from 'react'
import {WebView, type WebViewMessageEvent} from 'react-native-webview'

import {createBridge} from '../../bridge'
import {type MiniAppFrameProps} from './types'

/*
 * What a Mini App page sees as its host. The page speaks the same protocol
 * as on the web, through window.parent.postMessage; here that becomes the
 * WebView's own channel. Replies come back as message events.
 */
const BEFORE_LOAD = `
(function () {
  var host = {
    postMessage: function (message) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message))
    },
  }
  try {
    Object.defineProperty(window, 'parent', {value: host, configurable: true})
  } catch (e) {}
})();
true;
`

/** The one stand-in for the frame's window on native: only its own WebView calls in */
const FRAME = {}

/**
 * The Mini App in a WebView that can only show pages of its manifest's
 * origin; any navigation elsewhere is refused.
 */
export function MiniAppFrame({
  url,
  origin,
  title,
  isApproved,
  permissions,
  handlers,
}: MiniAppFrameProps) {
  const webViewRef = useRef<React.ComponentRef<typeof WebView>>(null)
  const latest = useRef({isApproved, permissions, handlers})
  useEffect(() => {
    latest.current = {isApproved, permissions, handlers}
  })
  const bridgeRef = useRef<ReturnType<typeof createBridge>>(undefined)

  useEffect(() => {
    const bridge = createBridge({
      origin,
      frame: () => FRAME,
      isApproved: () => latest.current.isApproved(),
      permissions: () => latest.current.permissions(),
      handlers: {
        getContext: () => latest.current.handlers.getContext(),
        requestWallet: () => latest.current.handlers.requestWallet(),
        signMessage: p => latest.current.handlers.signMessage(p),
        sendTransaction: p => latest.current.handlers.sendTransaction(p),
        close: () => latest.current.handlers.close(),
      },
      send: (message, targetOrigin) => {
        const data = JSON.stringify(message)
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new MessageEvent('message', {data: ${JSON.stringify(
            data,
          )}, origin: ${JSON.stringify(targetOrigin)}}));true;`,
        )
      },
    })
    bridgeRef.current = bridge
    return () => {
      bridge.dispose()
      bridgeRef.current = undefined
    }
  }, [origin])

  const onMessage = (event: WebViewMessageEvent) => {
    let pageOrigin = ''
    try {
      pageOrigin = new URL(event.nativeEvent.url).origin
    } catch {
      return
    }
    void bridgeRef.current?.handleMessage({
      data: event.nativeEvent.data,
      origin: pageOrigin,
      source: FRAME,
    })
  }

  const isAllowed = (target: string) => {
    try {
      return new URL(target).origin === origin
    } catch {
      return false
    }
  }

  return (
    <WebView
      ref={webViewRef}
      testID="miniAppFrame"
      accessibilityLabel={title}
      accessibilityHint={title}
      source={{uri: url}}
      originWhitelist={[`${origin}/*`, origin]}
      onShouldStartLoadWithRequest={request => isAllowed(request.url)}
      onMessage={onMessage}
      injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
      javaScriptEnabled
      domStorageEnabled
      incognito
      setSupportMultipleWindows={false}
      allowFileAccess={false}
      mixedContentMode="never"
      geolocationEnabled={false}
      javaScriptCanOpenWindowsAutomatically={false}
    />
  )
}
