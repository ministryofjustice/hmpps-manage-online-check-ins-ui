import httpMocks from 'node-mocks-http'
import requireShownCheckin from './requireShownCheckin'
import mockAppResponse from '../controllers/mocks/appResponse'

const crn = 'X000001'
const id = '3fa85f64-5717-4562-b3fc-2c963f66afa7'
const shownUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const overviewPage = `/case/${crn}/appointments/check-in/manage/${id}`

describe('requireShownCheckin', () => {
  let res: ReturnType<typeof mockAppResponse>
  let next: jest.Mock

  const post = (body: Record<string, unknown>) =>
    httpMocks.createRequest({
      method: 'POST',
      params: { crn, id },
      body,
      session: { data: { esupervision: { [crn]: { [id]: { manageCheckin: { cancelCheckinReason: 'Reason' } } } } } },
    })

  const expectRefused = (req: ReturnType<typeof post>) => {
    expect(next).not.toHaveBeenCalled()
    expect(req.session.data.esupervision[crn][id].checkInCancelRefused).toBe(true)
    expect(req.session.data.esupervision[crn][id].manageCheckin).toBeNull()
    expect(res.redirect).toHaveBeenCalledWith(303, overviewPage)
  }

  beforeEach(() => {
    res = mockAppResponse()
    res.redirect = jest.fn()
    res.locals.cancellableCheckin = { uuid: shownUuid }
    next = jest.fn()
  })

  it('lets the post through when it is for the upcoming check in', () => {
    const req = post({ checkinUuid: shownUuid })
    requireShownCheckin(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(req.session.data.esupervision[crn][id].checkInCancelRefused).toBeUndefined()
  })

  // The check in the page showed was submitted, missed or cancelled, and the next one is now upcoming.
  it('refuses a post for a different check in from the upcoming one', () => {
    const req = post({ checkinUuid: '3fa85f64-5717-4562-b3fc-000000000000' })
    requireShownCheckin(req, res, next)
    expectRefused(req)
  })

  it('refuses when there is no upcoming check in any more', () => {
    res.locals.cancellableCheckin = null
    const req = post({ checkinUuid: shownUuid })
    requireShownCheckin(req, res, next)
    expectRefused(req)
  })

  it('refuses when the page did not say which check in', () => {
    const req = post({})
    requireShownCheckin(req, res, next)
    expectRefused(req)
  })

  it('refuses a uuid that is not a string', () => {
    const req = post({ checkinUuid: [shownUuid] })
    requireShownCheckin(req, res, next)
    expectRefused(req)
  })
})
