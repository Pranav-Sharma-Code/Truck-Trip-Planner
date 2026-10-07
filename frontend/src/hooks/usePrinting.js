import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

/**
 * True while the browser is preparing to print. The log sheets use it to mount every day's sheet
 * only when printing, since drawing all of them on each keystroke is wasted work.
 */
export function usePrinting() {
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    // flushSync so the extra sheets exist before the browser lays out the page for printing.
    const before = () => flushSync(() => setPrinting(true))
    const after = () => setPrinting(false)
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [])

  return printing
}
