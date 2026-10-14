import {useVideoPlayer, VideoView} from 'expo-video'

import {atoms as a} from '#/alf'
import {type GatedMedia} from '../queries'

/** A gated video, played from its signed URL */
export function GatedVideo({media}: {media: GatedMedia}) {
  const player = useVideoPlayer(media.url)
  const ratio = media.aspectRatio
    ? media.aspectRatio.width / media.aspectRatio.height
    : 16 / 9
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      accessibilityLabel={media.alt}
      accessibilityHint=""
      style={[a.w_full, a.rounded_sm, {aspectRatio: ratio, maxHeight: 480}]}
    />
  )
}
