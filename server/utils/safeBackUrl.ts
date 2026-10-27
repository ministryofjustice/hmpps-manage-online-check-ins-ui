import config from '../config'

const LOCAL_BASE = 'http://localhost.invalid'

const allowedOrigins = (): string[] =>
  [config.managePeopleOnProbation.link, config.ingressUrl].flatMap(url => {
    try {
      return [new URL(url).origin]
    } catch {
      return []
    }
  })

/**
 * Returns `back` if it is safe to use as a redirect target or link href, otherwise undefined.
 * Allowed: relative paths within this service (e.g. `/case/X123/activity-log` or `appointments`)
 * and absolute URLs on this service or Manage People on Probation, which sends absolute back links.
 * Rejected: other origins, protocol-relative URLs (`//evil.com`), `javascript:` etc.
 */
const safeBackUrl = (back: unknown): string | undefined => {
  if (typeof back !== 'string' || back === '') {
    return undefined
  }
  // Browsers treat `\` as `/` and strip tabs/newlines, so `/\evil.com` or `/\t/evil.com` would be protocol-relative
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]|^\s/.test(back) || back.startsWith('//')) {
    return undefined
  }
  let parsed: URL
  try {
    parsed = new URL(back, LOCAL_BASE)
  } catch {
    return undefined
  }
  // Anything with a scheme must be a full http(s) URL on an allowed origin. Scheme-relative forms such as
  // `http:evil.com` resolve locally against an http base here, but off-site from an https page in a browser.
  if (/^[a-z][a-z0-9+.-]*:/i.test(back)) {
    return /^https?:\/\//i.test(back) && allowedOrigins().includes(parsed.origin) ? back : undefined
  }
  return parsed.origin === LOCAL_BASE ? back : undefined
}

export default safeBackUrl
