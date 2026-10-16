import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {createQueryKey} from '#/state/queries/util'
import * as Toast from '#/components/Toast'
import {kraoComposer} from '#/features/community/composer/store'
import {getAppRequest} from './api'
import {hostOrigins} from './hostOrigins'
import {canRunApp, kraoMiniAppLinkUri} from './logic'

/**
 * Krao: what the composer does with a link it would turn into a link card,
 * for the first post of a new (non-reply) post. Returns true when the link
 * is handled here and must not become a link card:
 *
 * - a link to a Mini App on Krao becomes the post's Mini App embed (once
 *   the indexer says it is approved), never a link card as well;
 * - with a Mini App already attached, no link card is added: a post has
 *   one embed, and a card would only block posting.
 */
export function useComposerMiniAppLink() {
  const {t: l} = useLingui()
  const queryClient = useQueryClient()

  const attach = async (uri: string) => {
    try {
      const app = await queryClient.fetchQuery({
        queryKey: createQueryKey('krao-miniapp-link', {uri}),
        queryFn: () => getAppRequest(uri),
        staleTime: 0,
        retry: false,
      })
      if (!canRunApp(app)) {
        Toast.show(
          l`${app.name} has not been approved by Krao, so it can’t be added to a post.`,
          {type: 'error'},
        )
        return
      }
      kraoComposer.update({
        miniApp: {uri: app.uri, cid: app.cid, name: app.name},
      })
      Toast.show(l`Mini App added: ${app.name}`)
    } catch {
      Toast.show(l`Could not find that Mini App.`, {type: 'error'})
    }
  }

  return (url: string): boolean => {
    const uri = kraoMiniAppLinkUri(url, hostOrigins())
    if (uri) {
      void attach(uri)
      return true
    }
    return !!kraoComposer.get().miniApp
  }
}
