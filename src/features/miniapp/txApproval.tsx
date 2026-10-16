import {useEffect, useRef, useState} from 'react'

import {TxPreviewPanel} from './components/TxPreviewPanel'
import {type PreviewRequest} from './preview'

/**
 * Asks the user to accept a transaction after seeing its preview, from code
 * that is in the middle of a payment (a tip, a membership).
 *
 * `approve(request)` resolves true once the user accepts and false when they
 * cancel. `panel` is the preview to render in place of the form while a
 * request waits, inside the dialog that started the payment: a second sheet
 * on top of it would not open on iOS. If the dialog goes away with a request
 * waiting, the request is answered "no", so nothing is left half-done.
 */
export function useTxApproval() {
  const [pending, setPending] = useState<{request: PreviewRequest}>()
  const resolver = useRef<(approved: boolean) => void>(undefined)

  useEffect(
    () => () => {
      resolver.current?.(false)
      resolver.current = undefined
    },
    [],
  )

  const approve = (request: PreviewRequest) =>
    new Promise<boolean>(resolve => {
      // Only one at a time: an earlier one that is still waiting is cancelled
      resolver.current?.(false)
      resolver.current = resolve
      setPending({request})
    })

  const decide = (approved: boolean) => {
    const resolve = resolver.current
    resolver.current = undefined
    setPending(undefined)
    resolve?.(approved)
  }

  return {
    approve,
    panel: pending ? (
      <TxPreviewPanel request={pending.request} onDecision={decide} />
    ) : null,
  }
}
