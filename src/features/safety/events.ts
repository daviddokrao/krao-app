import {type LinkResult} from './api'
import {type SecretKind} from './secrets'

/*
 * Warnings raised from code with no UI of its own (opening a link, sending a
 * message) are shown by the dialogs SafetyHost mounts in the shell.
 */

export type UnsafeLinkRequest = {
  url: string
  result: LinkResult
  /** Opens the link after all, when the user chooses to */
  proceed: () => void
}

type Listener<T> = (value: T) => void

function createChannel<T>() {
  const listeners = new Set<Listener<T>>()
  return {
    emit: (value: T) => {
      for (const listener of listeners) listener(value)
    },
    listen: (listener: Listener<T>) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const unsafeLinks = createChannel<UnsafeLinkRequest>()
const secrets = createChannel<SecretKind[]>()

/** Asks the user whether to open a link that is on the scam list */
export const showUnsafeLinkWarning = unsafeLinks.emit
export const onUnsafeLinkWarning = unsafeLinks.listen

/** Tells the user a message holds a seed phrase or private key */
export const showSecretWarning = secrets.emit
export const onSecretWarning = secrets.listen
