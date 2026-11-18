import {createContext, useContext} from 'react'

/*
 * Links in a conversation the viewer has not accepted (status "request") are
 * plain text: strangers use them to send scam sites.
 */
const LinksDisabledContext = createContext(false)
LinksDisabledContext.displayName = 'LinksDisabledContext'

export function LinksDisabledProvider({
  disabled,
  children,
}: {
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <LinksDisabledContext.Provider value={disabled}>
      {children}
    </LinksDisabledContext.Provider>
  )
}

export function useLinksDisabled() {
  return useContext(LinksDisabledContext)
}
