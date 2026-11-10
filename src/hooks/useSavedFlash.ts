import { useCallback, useEffect, useRef, useState } from 'react'

/** Shows a short-lived "Saved" indicator, cleaning its timer up on unmount. */
export function useSavedFlash(ms = 1800): [boolean, () => void] {
  const [saved, setSaved] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const flash = useCallback(() => {
    setSaved(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaved(false), ms)
  }, [ms])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return [saved, flash]
}
