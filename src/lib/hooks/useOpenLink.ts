import {useCallback} from 'react'
import {Linking} from 'react-native'
import * as WebBrowser from 'expo-web-browser'

import {
  createBskyAppAbsoluteUrl,
  createProxiedUrl,
  isBskyAppUrl,
  isBskyRSSUrl,
  isRelativeUrl,
  toNiceDomain,
} from '#/lib/strings/url-helpers'
import {logger} from '#/logger'
import {useInAppBrowser} from '#/state/preferences/in-app-browser'
import {useTheme} from '#/alf'
import {useDialogContext} from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import {useAnalytics} from '#/analytics'
import {IS_NATIVE} from '#/env'
import {openLinkIfSafe, showAfterClosing} from '#/features/safety/guard'

export function useOpenLink() {
  const ax = useAnalytics()
  const enabled = useInAppBrowser()
  const t = useTheme()
  const dialogContext = useDialogContext()
  const {inAppBrowserConsentControl} = useGlobalDialogsControlContext()

  const openLinkUnchecked = useCallback(
    (
      url: string,
      override?: boolean,
      shouldProxy?: boolean,
      tab?: Window | null,
    ) => {
      if (isBskyRSSUrl(url) && isRelativeUrl(url)) {
        url = createBskyAppAbsoluteUrl(url)
      }

      if (!isBskyAppUrl(url)) {
        ax.metric('link:clicked', {
          domain: toNiceDomain(url),
          url,
        })

        if (shouldProxy) {
          url = createProxiedUrl(url)
        }
      }

      if (IS_NATIVE && !url.startsWith('mailto:')) {
        if (override === undefined && enabled === undefined) {
          // consent dialog is a global dialog, and while it's possible to nest dialogs,
          // the actual components need to be nested. sibling dialogs on iOS are not supported.
          // thus, check if we're in a dialog, and if so, close the existing dialog before opening the
          // consent dialog -sfn
          if (dialogContext.isWithinDialog) {
            dialogContext.close(() => {
              inAppBrowserConsentControl.open(url)
            })
          } else {
            inAppBrowserConsentControl.open(url)
          }
          return
        } else if (override ?? enabled) {
          WebBrowser.openBrowserAsync(url, {
            presentationStyle:
              WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            toolbarColor: t.atoms.bg.backgroundColor,
            controlsColor: t.palette.primary_500,
            createTask: false,
          }).catch(err => {
            if (__DEV__)
              logger.error('Could not open web browser', {message: err})
            void Linking.openURL(url)
          })
          return
        }
      }
      if (tab) {
        // Krao: the tab opened ahead while the link was checked (web)
        tab.location.href = url
        return
      }
      void Linking.openURL(url)
    },
    [ax, enabled, inAppBrowserConsentControl, t, dialogContext],
  )

  // Krao: a link on the scam list asks first (see features/safety)
  const openLink = useCallback(
    (url: string, override?: boolean, shouldProxy?: boolean) => {
      openLinkIfSafe(
        url,
        tab => openLinkUnchecked(url, override, shouldProxy, tab),
        show => showAfterClosing(dialogContext, show),
        {aheadTab: true},
      )
    },
    [openLinkUnchecked, dialogContext],
  )

  return openLink
}
