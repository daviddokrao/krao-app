/*
 * This is a reimplementation of what exists in our HTML template files
 * already. Once the React tree mounts, this is what gets rendered first, until
 * the app is ready to go.
 */

import {useEffect, useRef, useState} from 'react'
import Svg, {Path} from 'react-native-svg'

import {atoms as a, flattenToCSS} from '#/alf'

const size = 100
const ratio = 57 / 64

export function Splash({
  isReady,
  children,
}: React.PropsWithChildren<{
  isReady: boolean
}>) {
  const [isAnimationComplete, setIsAnimationComplete] = useState(false)
  const splashRef = useRef<HTMLDivElement>(null)

  // hide the static one that's baked into the HTML - gets replaced by our React version below
  useEffect(() => {
    // double rAF ensures that the React version gets painted first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const splash = document.getElementById('splash')
        if (splash) {
          splash.remove()
        }
      })
    })
  }, [])

  // when ready, we fade/scale out
  useEffect(() => {
    if (!isReady) return

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches
    const node = splashRef.current
    if (!node || reduceMotion) {
      setIsAnimationComplete(true)
      return
    }

    const animation = node.animate(
      [
        {opacity: 1, transform: 'scale(1)'},
        {opacity: 0, transform: 'scale(1.5)'},
      ],
      {
        duration: 300,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards',
      },
    )
    animation.onfinish = () => setIsAnimationComplete(true)

    return () => {
      animation.cancel()
    }
  }, [isReady])

  return (
    <>
      {isReady && children}

      {!isAnimationComplete && (
        <div
          ref={splashRef}
          style={flattenToCSS([
            a.fixed,
            a.inset_0,
            a.flex,
            a.align_center,
            a.justify_center,
            // to compensate for the `top: -50px` below
            {transformOrigin: 'center calc(50% - 50px)'},
          ])}>
          <Svg
            fill="none"
            viewBox="0 0 64 57"
            style={[a.relative, {width: size, height: size * ratio, top: -50}]}>
            <Path
              fill="#7B3FF2"
              fillRule="evenodd"
              d="M16 0h32l16 28.5L48 57H16L0 28.5 16 0Zm6 13v31h7V32l9 12h8.5L35 28.5 46.5 13H38l-9 12V13h-7Z"
            />
          </Svg>
        </div>
      )}
    </>
  )
}
