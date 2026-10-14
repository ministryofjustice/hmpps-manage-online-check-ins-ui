import httpMocks from 'node-mocks-http'
import { DateTime } from 'luxon'
import restrictScheduleCheckInAccess from './restrictScheduleCheckInAccess'
import mockAppResponse from '../controllers/mocks/appResponse'

const crn = 'X000001'
const id = 'f1654ea3-0abb-46eb-860b-654a96edbe20'
const manageUrl = `/case/${crn}/appointments/check-in/manage/${id}`

const buildReq = (scheduleCheckIn?: Record<string, unknown>) =>
  httpMocks.createRequest({
    params: { crn, id },
    session: { data: scheduleCheckIn ? { esupervision: { [crn]: { [id]: { scheduleCheckIn } } } } : {} },
  })

describe('middleware/restrictScheduleCheckInAccess', () => {
  let res: ReturnType<typeof mockAppResponse>
  let next: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    res = mockAppResponse()
    res.locals.offenderCheckinsByCRNResponse = {
      ...res.locals.offenderCheckinsByCRNResponse,
      mode: 'AD_HOC',
    }
    next = jest.fn()
  })

  describe('offender mode', () => {
    it.each(['SCHEDULED', undefined] as const)('redirects when mode is %s', async mode => {
      res.locals.offenderCheckinsByCRNResponse.mode = mode

      await restrictScheduleCheckInAccess()(buildReq(), res, next)

      expect(res.redirect).toHaveBeenCalledWith(manageUrl)
      expect(next).not.toHaveBeenCalled()
    })
  })

  it('allows an ad-hoc person without feature flags', async () => {
    await restrictScheduleCheckInAccess()(buildReq(), res, next)

    expect(next).toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  describe('requireDate', () => {
    it('sends the user back to pick a date when none has been chosen', async () => {
      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq(), res, next)

      expect(res.redirect).toHaveBeenCalledWith(`${manageUrl}/schedule-check-in`)
      expect(next).not.toHaveBeenCalled()
    })

    it('sends the user back when the journey was started but the date is blank', async () => {
      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq({ date: '' }), res, next)

      expect(res.redirect).toHaveBeenCalledWith(`${manageUrl}/schedule-check-in`)
    })

    it.each([
      ['malformed', 'not a date'],
      ['impossible', '31/2/2026'],
      ['in the past', DateTime.now().minus({ days: 1 }).toFormat('d/M/yyyy')],
    ])('sends the user back when the stored date is %s', async (_description, date) => {
      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq({ date }), res, next)

      expect(res.redirect).toHaveBeenCalledWith(`${manageUrl}/schedule-check-in`)
      expect(next).not.toHaveBeenCalled()
    })

    it('continues once a valid future date is in session', async () => {
      const date = DateTime.now().plus({ days: 1 }).toFormat('d/M/yyyy')

      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq({ date }), res, next)

      expect(next).toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()
    })

    it('does not require a date when the option is not set', async () => {
      await restrictScheduleCheckInAccess()(buildReq(), res, next)

      expect(next).toHaveBeenCalled()
    })

    it('tolerates a request with no session data', async () => {
      const req = httpMocks.createRequest({ params: { crn, id } })

      await restrictScheduleCheckInAccess({ requireDate: true })(req, res, next)

      expect(res.redirect).toHaveBeenCalledWith(`${manageUrl}/schedule-check-in`)
      expect(next).not.toHaveBeenCalled()
    })
  })
})
