import {type GatedMedia} from '../queries'

/**
 * A gated video, played by the browser straight from its signed URL (the
 * gate service answers byte ranges, so seeking works).
 */
export function GatedVideo({media}: {media: GatedMedia}) {
  const ratio = media.aspectRatio
    ? media.aspectRatio.width / media.aspectRatio.height
    : 16 / 9
  return (
    <video
      src={media.url}
      controls
      playsInline
      preload="metadata"
      aria-label={media.alt}
      style={{
        width: '100%',
        aspectRatio: ratio,
        maxHeight: 480,
        borderRadius: 8,
        backgroundColor: 'black',
      }}
    />
  )
}
