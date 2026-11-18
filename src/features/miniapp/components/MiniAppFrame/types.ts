import {type Handlers} from '../../bridge'
import {type Permission} from '../../logic'

export type MiniAppFrameProps = {
  /** The manifest URL: where the frame loads */
  url: string
  /** Its origin: the only one the host listens to and answers */
  origin: string
  /** For the frame's accessible name */
  title: string
  /** Read at each request */
  isApproved: () => boolean
  permissions: () => ReadonlySet<Permission>
  handlers: Handlers
}
