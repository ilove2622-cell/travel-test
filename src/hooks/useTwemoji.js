import { useEffect, useRef } from 'react'

export default function useTwemoji() {
  const ref = useRef(null)

  useEffect(() => {
    if (ref.current && window.twemoji) {
      window.twemoji.parse(ref.current, {
        folder: 'svg',
        ext: '.svg',
      })
    }
  })

  return ref
}
