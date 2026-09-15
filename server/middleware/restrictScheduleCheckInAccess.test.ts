import httpMocks from 'node-mocks-http'
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
    next = jest.fn()
  })

  describe('feature flag', () => {
    it('redirects to the manage page when the flag is off', async () => {
      res.locals.flags = { enableAdHocCheckIns: false }

      await restrictScheduleCheckInAccess()(buildReq(), res, next)

      expect(res.redirect).toHaveBeenCalledWith(manageUrl)
      expect(next).not.toHaveBeenCalled()
    })

    it('redirects when no flags have been evaluated at all', async () => {
      await restrictScheduleCheckInAccess()(buildReq(), res, next)

      expect(res.redirect).toHaveBeenCalledWith(manageUrl)
      expect(next).not.toHaveBeenCalled()
    })

    it('takes precedence over the date check, so a missing date does not leak the flag state', async () => {
      res.locals.flags = { enableAdHocCheckIns: false }

      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq(), res, next)

      expect(res.redirect).toHaveBeenCalledWith(manageUrl)
    })

    it('continues when the flag is on', async () => {
      res.locals.flags = { enableAdHocCheckIns: true }

      await restrictScheduleCheckInAccess()(buildReq(), res, next)

      expect(next).toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()
    })
  })

  describe('requireDate', () => {
    beforeEach(() => {
      res.locals.flags = { enableAdHocCheckIns: true }
    })

    it('sends the user back to pick a date when none has been chosen', async () => {
      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq(), res, next)

      expect(res.redirect).toHaveBeenCalledWith(`${manageUrl}/schedule-check-in`)
      expect(next).not.toHaveBeenCalled()
    })

    it('sends the user back when the journey was started but the date is blank', async () => {
      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq({ date: '' }), res, next)

      expect(res.redirect).toHaveBeenCalledWith(`${manageUrl}/schedule-check-in`)
    })

    it('continues once a date is in session', async () => {
      await restrictScheduleCheckInAccess({ requireDate: true })(buildReq({ date: '1/2/2026' }), res, next)

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
