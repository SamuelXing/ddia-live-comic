import { useState } from 'react'

/** Copy a link to exactly this scenario.
 *
 *  The page's central claim is that it is a pure function of its inputs. That
 *  was true and unusable: you could reason about a verdict but not hand it to
 *  anyone. The clipboard API needs a user gesture and a secure context, and it
 *  rejects rather than throwing, so the failure path selects the URL instead of
 *  silently doing nothing. */
export function ShareBtn({ query }: { query: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'manual'>('idle')
  const url =
    typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname + (query ? '?' + query : '')
  return (
    <button
      className={'reset-btn share-btn' + (state === 'ok' ? ' ok' : '')}
      title={state === 'manual' ? url : 'Copy a link that reopens this exact scenario'}
      onClick={() => {
        navigator.clipboard?.writeText(url).then(
          () => {
            setState('ok')
            window.setTimeout(() => setState('idle'), 1600)
          },
          () => setState('manual'),
        ) ?? setState('manual')
      }}
    >
      {state === 'ok' ? 'Link copied' : state === 'manual' ? 'Copy from the address bar' : 'Copy link'}
    </button>
  )
}
