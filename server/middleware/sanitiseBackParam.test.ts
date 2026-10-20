import express from 'express'
import request from 'supertest'
import sanitiseBackParam from './sanitiseBackParam'

const app = express()
app.use(sanitiseBackParam)
app.get('/', (req, res) => res.json(req.query))

describe('sanitiseBackParam', () => {
  it('keeps a safe back param', async () => {
    const res = await request(app).get('/').query({ back: '/case/X123456/activity-log', other: '1' })
    expect(res.body).toEqual({ back: '/case/X123456/activity-log', other: '1' })
  })

  // eslint-disable-next-line no-script-url
  it.each(['https://evil.example.com', 'javascript:alert(1)'])('drops an unsafe back param %s', async back => {
    const res = await request(app).get('/').query({ back, other: '1' })
    expect(res.body).toEqual({ other: '1' })
  })
})
