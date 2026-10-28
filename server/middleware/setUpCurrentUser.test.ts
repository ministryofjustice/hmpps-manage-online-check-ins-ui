import express, { Express } from 'express'
import request from 'supertest'
import setUpCurrentUser from './setUpCurrentUser'
import { HmppsUser } from '../interfaces/hmppsUser'

const createToken = (claims: Record<string, unknown>) =>
  `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`

const appWithToken = (token: string): Express => {
  const app = express()
  app.use((_req, res, next) => {
    res.locals.user = { token, username: 'user1', authSource: 'delius' } as HmppsUser
    next()
  })
  app.use(setUpCurrentUser())
  app.get('/', (_req, res) => res.json(res.locals.user))
  return app
}

describe('setUpCurrentUser', () => {
  it('populates userUuid from the user_uuid token claim', async () => {
    const token = createToken({ user_id: '123', user_uuid: '11111111-1111-1111-1111-111111111111' })

    const res = await request(appWithToken(token)).get('/')

    expect(res.body.userId).toBe('123')
    expect(res.body.userUuid).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('leaves userUuid undefined when the claim is absent', async () => {
    const res = await request(appWithToken(createToken({ user_id: '123' }))).get('/')

    expect(res.body.userUuid).toBeUndefined()
  })
})
