import {useCallback} from 'react'

import {webLinks} from '#/lib/constants'

export const SUPPORT_URL = webLinks.support

export enum SupportCode {
  AA_DID = 'AA_DID',
  AA_BIRTHDATE = 'AA_BIRTHDATE',
}

/**
 * Link to Krao's support page, tagged with a code naming the problem. Account
 * details (email, handle, DID) are deliberately not put in the URL, where
 * they would end up in server logs and browser history.
 */
export function useCreateSupportLink() {
  return useCallback(({code}: {code: SupportCode; email?: string}) => {
    const url = new URL(SUPPORT_URL)
    url.searchParams.set('code', code)
    return url.toString()
  }, [])
}
