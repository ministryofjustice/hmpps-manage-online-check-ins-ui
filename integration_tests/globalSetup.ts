import type { FullConfig } from '@playwright/test'
import superagent from 'superagent'

const dependencies = [
  { name: 'wiremock', url: 'http://localhost:9091/__admin/mappings' },
  { name: 'feature server', url: 'http://localhost:3007/ping' },
]

async function waitForOk(name: string, url: string, timeoutMs = 120_000, intervalMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown

  /* eslint-disable no-await-in-loop */
  while (Date.now() < deadline) {
    try {
      await superagent.get(url).timeout({ deadline: 2_000 })
      return
    } catch (error) {
      lastError = error
    }
    await new Promise(resolve => {
      setTimeout(resolve, intervalMs)
    })
  }
  /* eslint-enable no-await-in-loop */
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${name} to be ready at ${url}: ${lastError}`)
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await Promise.all(dependencies.map(({ name, url }) => waitForOk(name, url)))
}
