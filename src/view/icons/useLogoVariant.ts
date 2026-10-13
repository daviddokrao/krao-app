import {useKawaiiMode} from '#/state/preferences/kawaii'

export type LogoVariant = 'default' | 'kawaii'

export function useLogoVariant(allowVariants = true): LogoVariant {
  const kawaii = useKawaiiMode()

  if (!allowVariants) return 'default'
  // The kawaii artwork is Bluesky branded, so Krao always uses its own mark
  if (kawaii) return 'default'
  return 'default'
}
