import httpMocks from 'node-mocks-http'
import { DateTime } from 'luxon'
import controllers from '.'

import { CheckinScheduleResponse, OffenderByCRNResponse } from '../data/model/esupervision'
import ESupervisionClient from '../data/eSupervisionClient'
import mockAppResponse from './mocks/appResponse'
import HmppsAuthClient from '../data/hmppsAuthClient'
import renderError from '../middleware/renderError'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import setDataValue from '../utils/setDataValue'
import { PersonalDetails } from '../data/model/personalDetails'
import { SubjectType } from '../middleware/sendAuditMessage'
import { checkSendAuditMessage } from './testutils'

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

const mockMiddlewareFn = jest.fn()

jest.mock('../middleware/renderError', () => jest.fn(() => mockMiddlewareFn))
jest.mock('../utils/isValidCrn', () => jest.fn())
jest.mock('../utils/isValidUUID', () => jest.fn())
jest.mock('../utils/setDataValue', () => jest.fn())
jest.mock('../data/eSupervisionClient')
jest.mock('@ministryofjustice/hmpps-audit-client')

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemClientToken: jest.fn().mockResolvedValue('token-1'),
  }))
})

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

jest.mock('../config', () => {
  const actualConfig = jest.requireActual('../config').default

  return {
    ...actualConfig,
    managePeopleOnProbation: {
      ...actualConfig.managePeopleOnProbation,
      link: 'https://localhost:9091/manage-people-on-probation',
    },
  }
})

const mockPersonalDetails = {} as PersonalDetails

const getPersonalDetailsSpy = jest
  .spyOn(ESupervisionClient.prototype, 'getPersonalDetails')
  .mockImplementation(() => Promise.resolve(mockPersonalDetails))

const updatePersonalDetailsSpy = jest
  .spyOn(ESupervisionClient.prototype, 'updatePersonalDetailsContact')
  .mockImplementation(() => Promise.resolve({ crn } as PersonalDetails))

const postDeactivateOffender = jest
  .spyOn(ESupervisionClient.prototype, 'postDeactivateOffender')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const postReactivateOffenderSpy = jest
  .spyOn(ESupervisionClient.prototype, 'postReactivateOffender')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const postScheduleAdHocCheckinSpy = jest
  .spyOn(ESupervisionClient.prototype, 'postScheduleAdHocCheckin')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const postUpdateOffenderDetailsSpy = jest
  .spyOn(ESupervisionClient.prototype, 'postUpdateOffenderDetails')
  .mockImplementation(() => Promise.resolve({ crn } as CheckinScheduleResponse))

jest.spyOn(ESupervisionClient.prototype, 'getOffenderByCRN').mockImplementation(async () => null)

const mockIsValidCrn = isValidCrn as jest.MockedFunction<typeof isValidCrn>
const mockIsValidUUID = isValidUUID as jest.MockedFunction<typeof isValidUUID>
const mockRenderError = renderError as jest.MockedFunction<typeof renderError>
const mockSetDataValue = setDataValue as jest.MockedFunction<typeof setDataValue>

const crn = 'X000001'
const uuid = 'f1654ea3-0abb-46eb-860b-654a96edbe20'
const cya = false

// How the client surfaces the API's 404 for a person with no check in booked.
const noUpcomingCheckin = () => Object.assign(new Error('Not Found'), { status: 404 })

const offenderCheckinsByCRNResponse = {
  uuid,
  crn,
  status: 'VERIFIED',
  firstCheckin: '2025-11-03',
  checkinInterval: 'WEEKLY',
  contactPreference: 'PHONE',
  photoUrl: '/assets/images/placeholder.png',
  details: {
    name: {
      forename: 'Joe',
      surname: 'Bloggs',
    },
  },
} as OffenderByCRNResponse

const baseReq = (data?: any) =>
  httpMocks.createRequest({
    params: { crn, id: uuid },
    session: { data },
    query: {
      back: 'string',
    },
    url: 'url',
  })

const res = mockAppResponse()
res.locals.offenderCheckinsByCRNResponse = offenderCheckinsByCRNResponse

const renderSpy = jest.spyOn(res, 'render')
const redirectSpy = jest.spyOn(res, 'redirect')
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

describe('checkInsController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    res.locals.offenderCheckinsByCRNResponse = offenderCheckinsByCRNResponse
  })

  describe('postDatePage', () => {
    const withInterval = (interval: string) =>
      baseReq({ esupervision: { [crn]: { [uuid]: { checkins: { interval, date: '1/8/2026' } } } } })

    it('moves a scheduled setup on to contact preference', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      await controllers.checkIns.postDatePage()(withInterval('WEEKLY'), res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/contact-preference`)
    })

    // A stale date page tab submitted after ad-hoc was chosen must not leave a date in session.
    it('drops the date and returns to the frequency page when the setup is ad-hoc', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = withInterval('AD_HOC')
      req.query = { cya: 'true' }

      await controllers.checkIns.postDatePage()(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(
        expect.anything(),
        ['esupervision', crn, uuid, 'checkins', 'date'],
        undefined,
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/check-in-frequency?cya=true`)
    })
  })

  describe('getManageCheckinPage', () => {
    it('renders the manage check in page', async () => {
      ;(ESupervisionClient.prototype.getOffenderByCRN as jest.Mock).mockResolvedValueOnce(offenderCheckinsByCRNResponse)

      const req = httpMocks.createRequest({
        params: { crn, id: uuid },
        session: { data: {} },
      })

      await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalled()
      const [template, context] = (renderSpy as jest.Mock).mock.calls.pop()

      expect(template).toBe('pages/check-in/manage/manage-checkin.njk')
      expect(context.crn).toBe(crn)
      expect(context.id).toBe(uuid)
      expect(context.case).toEqual(offenderCheckinsByCRNResponse.details)

      expect(context.offenderCheckinsByCRNResponse).toEqual(offenderCheckinsByCRNResponse)
      expect(context.checkinFrequency).toBe('WEEKLY')
      checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN', crn, SubjectType.CRN)
    })

    it('shows an ad-hoc person as the ad-hoc frequency rather than their empty interval', async () => {
      res.locals.offenderCheckinsByCRNResponse = {
        ...offenderCheckinsByCRNResponse,
        mode: 'AD_HOC',
        checkinInterval: null,
      }

      const req = httpMocks.createRequest({
        params: { crn, id: uuid },
        session: { data: {} },
      })

      await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

      const [, context] = (renderSpy as jest.Mock).mock.calls.pop()
      expect(context.checkinFrequency).toBe('AD_HOC')
    })

    describe('whether the next check in date can be changed', () => {
      const manageReq = () => httpMocks.createRequest({ params: { crn, id: uuid }, session: { data: {} } })
      const upcomingOn = (date: string) =>
        jest
          .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
          .mockResolvedValueOnce({ expectedCheckinDate: `${date}T10:00:00+01:00`, questions: [] } as any)
      const rendered = () => (renderSpy as jest.Mock).mock.calls.at(-1)[1]
      const canChangeDate = () => rendered().canChangeDate
      const today = DateTime.now().toISODate()
      const tomorrow = DateTime.now().plus({ days: 1 }).toISODate()
      const daysFromToday = (days: number) => DateTime.now().plus({ days }).toISODate()

      it('allows it while the upcoming check in is still to come', async () => {
        upcomingOn(tomorrow)
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(canChangeDate()).toBe(true)
      })

      // Once the check in is active the API refuses to move it.
      it('refuses it once the upcoming check in is due today', async () => {
        upcomingOn(today)
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(canChangeDate()).toBe(false)
      })

      it('shows the upcoming check in date on the card', async () => {
        upcomingOn(tomorrow)
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(rendered().nextCheckinDate).toBe(`${tomorrow}T10:00:00+01:00`)
      })

      it('shows a scheduled person’s saved date while nothing is booked and it is still to come', async () => {
        res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: tomorrow }
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(rendered().nextCheckinDate).toBe(tomorrow)
        expect(canChangeDate()).toBe(true)
      })

      // The saved first date is where the schedule started, which may be long past: the card shows
      // the next day the weekly schedule falls on instead, which can still be changed.
      it('shows the next day of a scheduled person’s saved schedule once its first date has passed', async () => {
        res.locals.offenderCheckinsByCRNResponse = {
          ...offenderCheckinsByCRNResponse,
          firstCheckin: daysFromToday(-10),
        }
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(rendered().nextCheckinDate).toBe(daysFromToday(4))
        expect(canChangeDate()).toBe(true)
      })

      // With nothing upcoming, a check in due today has already been dealt with, so the card moves on.
      it('skips today when the saved schedule falls on it and nothing is upcoming', async () => {
        res.locals.offenderCheckinsByCRNResponse = {
          ...offenderCheckinsByCRNResponse,
          firstCheckin: daysFromToday(-7),
        }
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(rendered().nextCheckinDate).toBe(daysFromToday(7))
        expect(canChangeDate()).toBe(true)
      })

      // An ad-hoc person's saved date is the booking just made or a past one, never a future schedule.
      it('ignores an ad-hoc person’s saved date when nothing is booked', async () => {
        res.locals.offenderCheckinsByCRNResponse = {
          ...offenderCheckinsByCRNResponse,
          mode: 'AD_HOC',
          checkinInterval: null,
          firstCheckin: tomorrow,
        }
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(rendered().nextCheckinDate).toBeUndefined()
        expect(canChangeDate()).toBe(false)
      })

      it('refuses it once check ins are stopped', async () => {
        res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, status: 'INACTIVE' }
        upcomingOn(tomorrow)
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(manageReq(), res)
        expect(canChangeDate()).toBe(false)
      })
    })

    it('returns 404 when offender details are missing', async () => {
      const req = httpMocks.createRequest({
        params: { crn },
      })

      res.locals.offenderCheckinsByCRNResponse = undefined

      await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

      expect(mockRenderError).toHaveBeenCalledWith(404)
      expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
    })
  })

  describe('getStopCheckinPage', () => {
    it('renders stop-check in page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = httpMocks.createRequest({
        params: { crn, id: uuid },
      })

      await controllers.checkIns.getStopCheckinPage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalled()
      const [template, context] = (renderSpy as jest.Mock).mock.calls.pop()

      expect(template).toBe('pages/check-in/manage/stop-checkin.njk')
      expect(context.crn).toBe(crn)
      expect(context.id).toBe(uuid)
      expect(context.case).toEqual(offenderCheckinsByCRNResponse.details)
      checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_STOP_CHECK_IN', crn, SubjectType.CRN)
    })
  })

  describe('postManageStopCheckin', () => {
    it('redirects to manage people on probation case page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({
        esupervision: {
          [crn]: {
            [uuid]: {
              manageCheckin: {
                stopCheckinReason: 'Reason for stopping check in',
                stopCheckinSensitive: 'false',
              },
            },
          },
        },
      })

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(303, `/case/${crn}/appointments/check-in/manage/${uuid}`)
    })

    it('stops check in, clears session data and redirects', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data: any = {
        esupervision: {
          [crn]: {
            [uuid]: {
              manageCheckin: {
                stopCheckinReason: 'Reason for stopping check in',
                stopCheckinSensitive: 'true',
              },
            },
          },
        },
      }

      const req = baseReq(data)

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(hmppsAuthClient.getSystemClientToken).toHaveBeenCalledWith('user-1')

      expect(postDeactivateOffender).toHaveBeenCalledWith(uuid, {
        requestedBy: 'user-1',
        reason: 'Reason for stopping check in',
        sensitive: true,
      })

      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'manageCheckin'],
        null,
      )

      expect(redirectSpy).toHaveBeenCalledWith(303, `/case/${crn}/appointments/check-in/manage/${uuid}`)
    })

    it('escapes double quotes in the reason', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({
        esupervision: {
          [crn]: {
            [uuid]: {
              manageCheckin: {
                stopCheckinReason: 'Reason with "quotes"',
                stopCheckinSensitive: 'false',
              },
            },
          },
        },
      })

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(postDeactivateOffender).toHaveBeenCalledWith(uuid, {
        requestedBy: 'user-1',
        reason: 'Reason with \\"quotes\\"',
        sensitive: false,
      })
    })
  })

  describe('getSettingsFrequencyPage', () => {
    it('seeds session from the live API values and renders the frequency page', async () => {
      const req = baseReq({})

      await controllers.checkIns.getSettingsFrequencyPage()(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, ['esupervision', crn, uuid, 'manageCheckin'], {
        date: offenderCheckinsByCRNResponse.firstCheckin,
        interval: offenderCheckinsByCRNResponse.checkinInterval,
      })

      expect(renderSpy).toHaveBeenCalledWith('pages/check-in/manage/checkin-settings-frequency.njk', {
        crn,
        id: uuid,
        case: offenderCheckinsByCRNResponse.details,
      })
      checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN_SETTINGS', crn, SubjectType.CRN)
    })

    // The API reports ad-hoc as a mode with no interval; the radios need it as the selected interval.
    // Their firstCheckin is the last booked ad-hoc check in (possibly past), so no date is seeded:
    // moving to a scheduled interval must start from an empty date page.
    it('seeds the ad-hoc option, and no date, when the API reports the ad-hoc mode', async () => {
      res.locals.offenderCheckinsByCRNResponse = {
        ...offenderCheckinsByCRNResponse,
        mode: 'AD_HOC',
        checkinInterval: null,
        firstCheckin: '2020-01-01',
      }
      const req = baseReq({})

      await controllers.checkIns.getSettingsFrequencyPage()(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, ['esupervision', crn, uuid, 'manageCheckin'], {
        date: undefined,
        interval: 'AD_HOC',
      })
    })
  })

  describe('postSettingsFrequencyPage', () => {
    const adHocPerson = {
      ...offenderCheckinsByCRNResponse,
      mode: 'AD_HOC',
      checkinInterval: null,
    } as OffenderByCRNResponse
    const withInterval = (interval: string) =>
      baseReq({ esupervision: { [crn]: { [uuid]: { manageCheckin: { date: '2025-11-03', interval } } } } })

    // Only this move needs a date: an ad-hoc person has no schedule to carry forward.
    it('sends an ad-hoc person moving to an interval on to the date page without submitting', async () => {
      res.locals.offenderCheckinsByCRNResponse = adHocPerson

      await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('WEEKLY'), res)

      expect(postUpdateOffenderDetailsSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/settings-date`)
    })

    // The upcoming check in carries a time (see the WireMock stub); the update API takes a date only.
    it('submits a change of interval straight away, keeping the next check in date', async () => {
      jest
        .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
        .mockResolvedValueOnce({ expectedCheckinDate: '2099-01-05T10:00:00+01:00', questions: [] })

      await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('TWO_WEEKS'), res)

      expect(postUpdateOffenderDetailsSpy).toHaveBeenCalledWith(uuid, {
        checkinSchedule: {
          requestedBy: 'user-1',
          firstCheckin: '2099-01-05',
          mode: 'SCHEDULED',
          checkinInterval: 'TWO_WEEKS',
        },
      })
      expect(mockSetDataValue).toHaveBeenCalledWith(
        expect.anything(),
        ['esupervision', crn, uuid, 'manageCheckin', 'settingsUpdated'],
        true,
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    })

    it('falls back to the saved first check in date when there is no upcoming check in', async () => {
      jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions').mockRejectedValueOnce(noUpcomingCheckin())
      res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: '2099-03-01' }

      await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('TWO_WEEKS'), res)

      expect(postUpdateOffenderDetailsSpy).toHaveBeenCalledWith(uuid, {
        checkinSchedule: {
          requestedBy: 'user-1',
          firstCheckin: '2099-03-01',
          mode: 'SCHEDULED',
          checkinInterval: 'TWO_WEEKS',
        },
      })
    })

    // The API rejects a first check in in the past, so a stale saved date is never sent: the saved
    // weekly schedule is repeated to find the next check in day instead of asking for a date.
    it('works out the next check in day from a saved schedule that started in the past', async () => {
      jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions').mockRejectedValueOnce(noUpcomingCheckin())
      res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: '2020-01-01' }
      const today = DateTime.now().startOf('day')
      // The first weekly repeat strictly after today: today's own check in, if any, is already done.
      const weeksSince = Math.floor(Math.round(today.diff(DateTime.fromISO('2020-01-01'), 'days').days) / 7) + 1
      const nextWeeklyDay = DateTime.fromISO('2020-01-01').plus({ weeks: weeksSince }).toISODate()

      await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('TWO_WEEKS'), res)

      expect(postUpdateOffenderDetailsSpy).toHaveBeenCalledWith(uuid, {
        checkinSchedule: {
          requestedBy: 'user-1',
          firstCheckin: nextWeeklyDay,
          mode: 'SCHEDULED',
          checkinInterval: 'TWO_WEEKS',
        },
      })
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    })

    // With nothing upcoming, a check in due today has already been dealt with. The card shows the
    // next repeat, and the frequency change must send that same day, not today.
    it('skips a saved first check in date of today when there is no upcoming check in', async () => {
      jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions').mockRejectedValueOnce(noUpcomingCheckin())
      const today = DateTime.now().startOf('day')
      res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: today.toISODate() }

      await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('TWO_WEEKS'), res)

      expect(postUpdateOffenderDetailsSpy).toHaveBeenCalledWith(uuid, {
        checkinSchedule: {
          requestedBy: 'user-1',
          firstCheckin: today.plus({ weeks: 1 }).toISODate(),
          mode: 'SCHEDULED',
          checkinInterval: 'TWO_WEEKS',
        },
      })
    })

    // A scheduled record always carries a date and interval; this guards against a broken one.
    it('asks for a date only when the record has no schedule to work from', async () => {
      jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions').mockRejectedValueOnce(noUpcomingCheckin())
      res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: null }

      await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('TWO_WEEKS'), res)

      expect(postUpdateOffenderDetailsSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/settings-date`)
    })

    // Only a 404 means there is no check in booked; an outage must not be read the same way, as the
    // fallback could move the person's check ins to the wrong date.
    it('fails rather than guessing the date when the upcoming check in cannot be fetched', async () => {
      const outage = Object.assign(new Error('Service unavailable'), { status: 503 })
      jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions').mockRejectedValueOnce(outage)
      res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: '2099-03-01' }

      await expect(
        controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('TWO_WEEKS'), res),
      ).rejects.toBe(outage)

      expect(postUpdateOffenderDetailsSpy).not.toHaveBeenCalled()
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    describe('an unchanged frequency', () => {
      // The record (WEEKLY) is what the frequency page seeded, so re-submitting it is a no-op.
      it('returns to the manage page without calling the API or showing the saved banner', async () => {
        const getUpcoming = jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')

        await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('WEEKLY'), res)

        expect(getUpcoming).not.toHaveBeenCalled()
        expect(postUpdateOffenderDetailsSpy).not.toHaveBeenCalled()
        expect(mockSetDataValue).not.toHaveBeenCalledWith(
          expect.anything(),
          ['esupervision', crn, uuid, 'manageCheckin', 'settingsUpdated'],
          true,
        )
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
      })

      it('treats ad-hoc re-submitted for an ad-hoc person the same way', async () => {
        res.locals.offenderCheckinsByCRNResponse = adHocPerson

        await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('AD_HOC'), res)

        expect(postUpdateOffenderDetailsSpy).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
      })
    })

    // The API takes ad-hoc as a mode with no interval and no date.
    it('submits a move to ad-hoc straight away, with no interval or date', async () => {
      await controllers.checkIns.postSettingsFrequencyPage(hmppsAuthClient)(withInterval('AD_HOC'), res)

      expect(postUpdateOffenderDetailsSpy).toHaveBeenCalledWith(uuid, {
        checkinSchedule: {
          requestedBy: 'user-1',
          mode: 'AD_HOC',
        },
      })
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    })
  })

  describe('getSettingsDatePage', () => {
    const managePage = `/case/${crn}/appointments/check-in/manage/${uuid}`
    const adHocPerson = {
      ...offenderCheckinsByCRNResponse,
      mode: 'AD_HOC',
      checkinInterval: null,
    } as OffenderByCRNResponse
    const withInterval = (interval?: string) =>
      baseReq({ esupervision: { [crn]: { [uuid]: { manageCheckin: { date: '2025-11-03', interval } } } } })

    // A scheduled person reaches the page from the manage card to move their next check in. The
    // upcoming check in carries a time (see the WireMock stub); the picker wants d/M/yyyy.
    it('lets a scheduled person change their date directly, pre-filled with their next check in', async () => {
      jest
        .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
        .mockResolvedValueOnce({ expectedCheckinDate: '2099-01-05T10:00:00+01:00', questions: [] })
      const req = baseReq({})

      await controllers.checkIns.getSettingsDatePage(hmppsAuthClient)(req, res)

      expect(redirectSpy).not.toHaveBeenCalled()
      expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, ['esupervision', crn, uuid, 'manageCheckin'], {
        interval: 'WEEKLY',
        date: '5/1/2099',
      })
      const [template, context] = (renderSpy as jest.Mock).mock.calls.pop()
      expect(template).toBe('pages/check-in/manage/checkin-settings-date.njk')
      expect(context.crn).toBe(crn)
      expect(context.id).toBe(uuid)
      expect(context.checkInMinDate).toBeTruthy()
      expect(context.backLink).toBe(managePage)
      checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN_SETTINGS', crn, SubjectType.CRN)
    })

    // With no upcoming check in, the next check in day is worked out from the saved schedule.
    it('pre-fills the next day of a saved schedule when there is no upcoming check in', async () => {
      jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions').mockRejectedValueOnce(noUpcomingCheckin())
      const start = DateTime.now().startOf('day').minus({ weeks: 3 })
      res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: start.toISODate() }
      const req = baseReq({})

      await controllers.checkIns.getSettingsDatePage(hmppsAuthClient)(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, ['esupervision', crn, uuid, 'manageCheckin'], {
        interval: 'WEEKLY',
        date: DateTime.now().plus({ weeks: 1 }).toFormat('d/M/yyyy'),
      })
      expect(renderSpy).toHaveBeenCalled()
    })

    it('leaves the date empty when the record has no schedule to work from', async () => {
      jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions').mockRejectedValueOnce(noUpcomingCheckin())
      res.locals.offenderCheckinsByCRNResponse = { ...offenderCheckinsByCRNResponse, firstCheckin: null }
      const req = baseReq({})

      await controllers.checkIns.getSettingsDatePage(hmppsAuthClient)(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, ['esupervision', crn, uuid, 'manageCheckin'], {
        interval: 'WEEKLY',
        date: undefined,
      })
      expect(renderSpy).toHaveBeenCalled()
    })

    // An ad-hoc person only reaches the page from the frequency page, which seeds the chosen interval.
    it('renders the date page for an ad-hoc person who has chosen an interval, going back to the frequency page', async () => {
      res.locals.offenderCheckinsByCRNResponse = adHocPerson

      await controllers.checkIns.getSettingsDatePage(hmppsAuthClient)(withInterval('WEEKLY'), res)

      expect(redirectSpy).not.toHaveBeenCalled()
      const [template, context] = (renderSpy as jest.Mock).mock.calls.pop()
      expect(template).toBe('pages/check-in/manage/checkin-settings-date.njk')
      expect(context.backLink).toBe(`${managePage}/settings`)
    })

    it('sends an ad-hoc person back to the frequency page when no interval is in session', async () => {
      res.locals.offenderCheckinsByCRNResponse = adHocPerson

      await controllers.checkIns.getSettingsDatePage(hmppsAuthClient)(baseReq({}), res)

      expect(renderSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`${managePage}/settings`)
    })

    it('sends an ad-hoc person back to the frequency page when they chose ad-hoc, which has no date to collect', async () => {
      res.locals.offenderCheckinsByCRNResponse = adHocPerson

      await controllers.checkIns.getSettingsDatePage(hmppsAuthClient)(withInterval('AD_HOC'), res)

      expect(renderSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`${managePage}/settings`)
    })
  })

  describe('postSettingsDatePage', () => {
    it('submits the chosen date and interval, then redirects to the manage page', async () => {
      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { manageCheckin: { date: '1/8/2026', interval: 'WEEKLY' } } } },
      })

      await controllers.checkIns.postSettingsDatePage(hmppsAuthClient)(req, res)

      expect(postUpdateOffenderDetailsSpy).toHaveBeenCalledWith(uuid, {
        checkinSchedule: {
          requestedBy: 'user-1',
          firstCheckin: '2026/8/01',
          mode: 'SCHEDULED',
          checkinInterval: 'WEEKLY',
        },
      })
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    })

    it('redirects back to the frequency page without submitting when the interval is missing from session', async () => {
      const req = baseReq({ esupervision: { [crn]: { [uuid]: { manageCheckin: { date: '1/8/2026' } } } } })

      await controllers.checkIns.postSettingsDatePage(hmppsAuthClient)(req, res)

      expect(postUpdateOffenderDetailsSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/settings`)
    })
  })

  describe('getRestartCheckinPage', () => {
    it('sets session values and renders restart date page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      res.locals.offenderCheckinsByCRNResponse = {
        ...offenderCheckinsByCRNResponse,
        status: 'INACTIVE',
        firstCheckin: '01/01/2026',
        checkinInterval: 'WEEKLY',
        contactPreference: 'EMAIL',
      }
      const req = baseReq({})

      await controllers.checkIns.getRestartCheckinPage(hmppsAuthClient)(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'id'],
        uuid,
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'interval'],
        'WEEKLY',
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'preferredComs'],
        'EMAIL',
      )
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-frequency.njk',
        expect.objectContaining({
          crn,
          id: uuid,
          cya,
        }),
      )
    })

    it.each([
      [true, 'restart-rationale'],
      [false, 'restart-is-eligible'],
    ])('goes Back to the previous eligibility step (accredited programme %s)', async (accreditedProgramme, page) => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { id: uuid, accreditedProgramme } } } },
      })

      await controllers.checkIns.getRestartCheckinPage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-frequency.njk',
        expect.objectContaining({ backLink: `/case/${crn}/appointments/check-in/manage/${uuid}/${page}` }),
      )
    })
  })

  describe('postRestartCheckinPage', () => {
    it('redirects to the restart date page for a standard interval', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({ esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY' } } } } })
      await controllers.checkIns.postRestartCheckinPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin-date`)
    })

    it('returns to the summary during a check-your-answers edit when a date is already saved', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY', date: '1/1/2030' } } } },
      })
      req.query = { cya: 'true' }
      await controllers.checkIns.postRestartCheckinPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-summary`)
    })

    it('still collects a date, preserving cya, when switching from ad-hoc to a standard interval', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({ esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY' } } } } })
      req.query = { cya: 'true' }
      await controllers.checkIns.postRestartCheckinPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(
        `/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin-date?cya=true`,
      )
    })

    // As in the setup journey, an ad-hoc restart schedules no first check in, so the date page is skipped.
    it('skips the date page and clears any saved date when ad-hoc is selected', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'AD_HOC', date: '19/2/2026' } } } },
      })
      await controllers.checkIns.postRestartCheckinPage(hmppsAuthClient)(req, res)
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'date'],
        undefined,
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-contact`)
    })

    it('returns straight to the summary when ad-hoc is selected during a check-your-answers edit', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({ esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'AD_HOC' } } } } })
      req.query = { cya: 'true' }
      await controllers.checkIns.postRestartCheckinPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-summary`)
    })
  })

  describe('getRestartCheckinDatePage', () => {
    it('renders the restart date page for a standard interval', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      getPersonalDetailsSpy.mockResolvedValueOnce({ crn } as PersonalDetails)
      const req = baseReq({ esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY' } } } } })
      await controllers.checkIns.getRestartCheckinDatePage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-date.njk',
        expect.objectContaining({ crn, id: uuid }),
      )
      expect(redirectSpy).not.toHaveBeenCalled()
    })

    it('sends Back to the summary during a check-your-answers edit when a date is already saved', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      getPersonalDetailsSpy.mockResolvedValueOnce({ crn } as PersonalDetails)
      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY', date: '1/1/2030' } } } },
      })
      req.query = { cya: 'true' }
      await controllers.checkIns.getRestartCheckinDatePage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-date.njk',
        expect.objectContaining({ backLink: `/case/${crn}/appointments/check-in/manage/${uuid}/restart-summary` }),
      )
    })

    it('sends Back to the frequency page, keeping cya, when the frequency was just switched from ad-hoc', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      getPersonalDetailsSpy.mockResolvedValueOnce({ crn } as PersonalDetails)
      const req = baseReq({ esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY' } } } } })
      req.query = { cya: 'true' }
      await controllers.checkIns.getRestartCheckinDatePage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-date.njk',
        expect.objectContaining({
          backLink: `/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin?cya=true`,
        }),
      )
    })

    it('sends a restart with no interval in session back to the frequency page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      await controllers.checkIns.getRestartCheckinDatePage(hmppsAuthClient)(baseReq({}), res)
      expect(renderSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin`)
    })

    it('sends an ad-hoc restart back to the frequency page instead of rendering, preserving cya', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({ esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'AD_HOC' } } } } })
      req.query = { cya: 'true' }
      await controllers.checkIns.getRestartCheckinDatePage(hmppsAuthClient)(req, res)
      expect(renderSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(
        `/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin?cya=true`,
      )
    })
  })

  describe('getConfirmContactPreferencePage', () => {
    it('renders the confirm page with the live MAS values for the preferred method', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      getPersonalDetailsSpy.mockResolvedValueOnce({
        crn,
        mobile: '07700900000',
        email: 'test@example.com',
      } as PersonalDetails)

      const data = { esupervision: { [crn]: { [uuid]: { checkins: { preferredComs: 'PHONE' } } } } }
      const req = baseReq(data)
      req.query = { cya: 'true' }

      await controllers.checkIns.getConfirmContactPreferencePage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalledWith('pages/check-in/confirm-contact-preference.njk', {
        crn,
        id: uuid,
        checkInMobile: '07700900000',
        checkInEmail: 'test@example.com',
        preferredComs: 'PHONE',
        contactPreference: 'mobile number',
        contactValue: '07700900000',
        cya: 'true',
      })
      expect(mockSetDataValue).toHaveBeenCalledWith(
        data,
        ['esupervision', crn, uuid, 'checkins', 'editCheckInMobile'],
        '07700900000',
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        data,
        ['esupervision', crn, uuid, 'checkins', 'editCheckInEmail'],
        'test@example.com',
      )
    })
  })

  describe('postConfirmContactPreferencePage', () => {
    it('redirects to edit-contact-preference when the answer is No, preserving cya', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: { [uuid]: { checkins: { preferredComs: 'PHONE', confirmPreferredComs: 'NO' } } },
        },
      }
      const req = baseReq(data)
      req.query = { cya: 'true' }

      await controllers.checkIns.postConfirmContactPreferencePage()(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(
        `/case/${crn}/appointments/${uuid}/check-in/edit-contact-preference?change=mobile&cya=true`,
      )
    })

    it('redirects to checkin-summary when the answer is Yes and cya is true', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: { [uuid]: { checkins: { preferredComs: 'EMAIL', confirmPreferredComs: 'YES' } } },
        },
      }
      const req = baseReq(data)
      req.query = { cya: 'true' }

      await controllers.checkIns.postConfirmContactPreferencePage()(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/checkin-summary`)
    })

    it('redirects to photo-options when the answer is Yes and there is no cya', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: { [uuid]: { checkins: { preferredComs: 'EMAIL', confirmPreferredComs: 'YES' } } },
        },
      }
      const req = baseReq(data)
      req.query = {}

      await controllers.checkIns.postConfirmContactPreferencePage()(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/photo-options`)
    })
  })

  describe('getEditContactPrePage', () => {
    it('reports hasContactDetails true when the preferred method already has a value on file', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: { checkins: { preferredComs: 'PHONE', editCheckInMobile: '07700900000' } },
          },
        },
      }
      const req = baseReq(data)
      req.query = { change: 'mobile', cya: 'true' }

      await controllers.checkIns.getEditContactPrePage()(req, res)

      expect(renderSpy).toHaveBeenCalledWith('pages/check-in/edit-contact-preference.njk', {
        crn,
        id: uuid,
        change: 'mobile',
        cya: 'true',
        preferredComs: 'PHONE',
        contactPreference: 'mobile number',
        hasContactDetails: true,
        previousMobile: '07700900000',
        previousEmail: undefined,
        backLink: `/case/${crn}/appointments/${uuid}/check-in/checkin-summary`,
      })
    })

    it('reports hasContactDetails false when there is nothing on file for the preferred method', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: { [crn]: { [uuid]: { checkins: { preferredComs: 'EMAIL' } } } },
      }
      const req = baseReq(data)
      req.query = { change: 'email' }

      await controllers.checkIns.getEditContactPrePage()(req, res)

      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/edit-contact-preference.njk',
        expect.objectContaining({ hasContactDetails: false }),
      )
    })

    describe('back link', () => {
      const backLinkFor = async (
        preferredComs: string,
        editValue: string | undefined,
        query: Record<string, string>,
      ) => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const editField = preferredComs === 'PHONE' ? 'editCheckInMobile' : 'editCheckInEmail'
        const data = {
          esupervision: {
            [crn]: { [uuid]: { checkins: { preferredComs, [editField]: editValue } } },
          },
        }
        const req = baseReq(data)
        req.query = query

        await controllers.checkIns.getEditContactPrePage()(req, res)

        return ((renderSpy as jest.Mock).mock.calls[0][1] as Record<string, unknown>).backLink
      }

      it('goes to confirm-contact-preference when there is already a value and this is not a change-your-answers link', async () => {
        expect(await backLinkFor('EMAIL', 'name@example.com', {})).toBe(
          `/case/${crn}/appointments/${uuid}/check-in/confirm-contact-preference`,
        )
      })

      it('goes to contact-preference when there is no value and this is not a change-your-answers link', async () => {
        expect(await backLinkFor('PHONE', undefined, {})).toBe(
          `/case/${crn}/appointments/${uuid}/check-in/contact-preference`,
        )
      })

      it('goes to checkin-summary when there is already a value and this is a change-your-answers link', async () => {
        expect(await backLinkFor('EMAIL', 'name@example.com', { cya: 'true' })).toBe(
          `/case/${crn}/appointments/${uuid}/check-in/checkin-summary`,
        )
      })

      it('goes to contact-preference, retaining cya, when there is no value and this is a change-your-answers link', async () => {
        // Regression check: checkin-summary's guard redirects straight back here whenever the
        // newly-selected preference has no value on file, so sending Back to checkin-summary in
        // this case would just bounce the user between the two pages.
        expect(await backLinkFor('PHONE', undefined, { cya: 'true' })).toBe(
          `/case/${crn}/appointments/${uuid}/check-in/contact-preference?cya=true`,
        )
      })
    })
  })

  describe('postEditContactPrePage', () => {
    it('saves to MAS, syncs checkInMobile/checkInEmail and confirms the preference, then continues to photo', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      updatePersonalDetailsSpy.mockResolvedValueOnce({
        crn,
        mobile: '07711223344',
        email: 'updated@example.com',
      } as PersonalDetails)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              checkins: { editCheckInMobile: '07711223344', editCheckInEmail: 'updated@example.com' },
            },
          },
        },
      }
      const req = baseReq(data)
      req.query = {}

      await controllers.checkIns.postEditContactPrePage(hmppsAuthClient)(req, res)

      expect(updatePersonalDetailsSpy).toHaveBeenCalledWith(crn, {
        email: 'updated@example.com',
        mobile: '07711223344',
        practitionerId: res.locals.user.username,
      })
      expect(mockSetDataValue).toHaveBeenCalledWith(
        data,
        ['esupervision', crn, uuid, 'checkins', 'checkInMobile'],
        '07711223344',
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        data,
        ['esupervision', crn, uuid, 'checkins', 'checkInEmail'],
        'updated@example.com',
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        data,
        ['esupervision', crn, uuid, 'checkins', 'confirmPreferredComs'],
        'YES',
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/photo-options`)
    })

    it('redirects to checkin-summary when cya is true', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      updatePersonalDetailsSpy.mockResolvedValueOnce({ crn } as PersonalDetails)

      const data = {
        esupervision: { [crn]: { [uuid]: { checkins: {} } } },
      }
      const req = baseReq(data)
      req.query = { cya: 'true' }

      await controllers.checkIns.postEditContactPrePage(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/checkin-summary`)
    })

    it('does not save or set the success banner when the value submitted matches what was on the page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              checkins: { editCheckInMobile: '07711223344', editCheckInEmail: 'name@example.com' },
            },
          },
        },
      }
      const req = baseReq(data)
      req.query = {}
      req.body = { previousMobile: '07711223344', previousEmail: 'name@example.com' }

      await controllers.checkIns.postEditContactPrePage(hmppsAuthClient)(req, res)

      expect(updatePersonalDetailsSpy).not.toHaveBeenCalled()
      expect(mockSetDataValue).not.toHaveBeenCalledWith(
        data,
        ['esupervision', crn, uuid, 'checkins', 'contactUpdated'],
        true,
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/photo-options`)
    })
  })

  describe('postRestartCheckinDatePage', () => {
    it('returns to the check your answers page when reached from a change link', async () => {
      const req = baseReq()
      req.query = { cya: 'true' }
      await controllers.checkIns.postRestartCheckinDatePage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(
        `/case/${crn}/appointments/check-in/manage/${uuid}/restart-summary?cya=true`,
      )
    })

    it('continues to the contact page otherwise', async () => {
      const req = baseReq()
      await controllers.checkIns.postRestartCheckinDatePage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-contact`)
    })
  })

  describe('getRestartContactPage', () => {
    it('renders restart contact page and stores edit values in session', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      res.locals.offenderCheckinsByCRNResponse = {
        ...offenderCheckinsByCRNResponse,
        details: { ...offenderCheckinsByCRNResponse.details, mobile: '07700900000', email: 'test@example.com' },
      }

      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { preferredComs: 'EMAIL' } } } },
      })

      await controllers.checkIns.getRestartContactPage(hmppsAuthClient)(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'editCheckInMobile'],
        '07700900000',
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'editCheckInEmail'],
        'test@example.com',
      )
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-contact-preference.njk',
        expect.objectContaining({
          crn,
          id: uuid,
          checkInMobile: '07700900000',
          checkInEmail: 'test@example.com',
          preferredComs: 'EMAIL',
          isAdHoc: false,
        }),
      )
    })

    it('flags an ad-hoc restart so the page can send Back to the frequency page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      res.locals.offenderCheckinsByCRNResponse = offenderCheckinsByCRNResponse

      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'AD_HOC' } } } },
      })

      await controllers.checkIns.getRestartContactPage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-contact-preference.njk',
        expect.objectContaining({ isAdHoc: true }),
      )
    })
  })

  describe('postRestartContactPage', () => {
    it('redirects to summary when change is main', async () => {
      const req = baseReq()
      req.body = { change: 'main' }
      await controllers.checkIns.postRestartContactPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-summary`)
    })
  })

  describe('getRestartEditContactPage', () => {
    it('renders restart edit contact page with session values', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                editCheckInMobile: '07123456789',
                editCheckInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      req.query = { change: 'email', cya: 'false' }

      await controllers.checkIns.getRestartEditContactPage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith('pages/check-in/manage/restart-edit-contact.njk', {
        crn,
        id: uuid,
        case: {
          name: {
            forename: 'Joe',
            surname: 'Bloggs',
          },
        },
        change: 'email',
        cya: 'false',
        checkInMobile: '07123456789',
        checkInEmail: 'test@example.com',
      })
    })

    it('sets success flag when contactUpdated is true in session', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: { [crn]: { [uuid]: { restartCheckin: { contactUpdated: true } } } },
      }
      const req = baseReq(data)
      await controllers.checkIns.getRestartEditContactPage(hmppsAuthClient)(req, res)
      expect(res.locals.success).toBe(true)
    })
  })

  describe('postRestartEditContactPage', () => {
    it('updates MAS when values have changed', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                editCheckInMobile: '07123456789',
                editCheckInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      req.body = { previousMobile: '07000000000', previousEmail: 'old@example.com' }

      await controllers.checkIns.postRestartEditContactPage(hmppsAuthClient)(req, res)

      expect(updatePersonalDetailsSpy).toHaveBeenCalledWith(crn, {
        email: 'test@example.com',
        mobile: '07123456789',
        practitionerId: res.locals.user.username,
      })
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-contact`)
    })

    it('skips contact details update when values are identical to previous', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                editCheckInMobile: '07700900111',
                editCheckInEmail: 'same@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      req.body = { previousMobile: '07700900111', previousEmail: 'same@example.com' }

      await controllers.checkIns.postRestartEditContactPage(hmppsAuthClient)(req, res)

      expect(updatePersonalDetailsSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-contact`)
    })
  })

  describe('getRestartSummaryPage', () => {
    // Reached from the summary's change link: ad-hoc was changed to an interval, then the date
    // page was backed out of, so the interval was never given a date.
    it('reverts an interval with no date to ad-hoc, since that is the answer being abandoned', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY', preferredComs: 'EMAIL' } } } },
      })
      await controllers.checkIns.getRestartSummaryPage(hmppsAuthClient)(req, res)
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'interval'],
        'AD_HOC',
      )
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-summary.njk',
        expect.objectContaining({
          userDetails: expect.objectContaining({ isAdHoc: true, interval: "I'll schedule them one at a time" }),
        }),
      )
    })

    it('renders restart summary with transformed userDetails', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                interval: 'WEEKLY',
                preferredComs: 'EMAIL',
                checkInEmail: 'test@example.com',
                date: '19/2/2026',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      await controllers.checkIns.getRestartSummaryPage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-summary.njk',
        expect.objectContaining({
          crn,
          userDetails: expect.objectContaining({
            interval: 'Every week',
            preferredComs: 'Email',
          }),
        }),
      )
    })

    it('flags an ad-hoc restart so the summary can hide the date row', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                interval: 'AD_HOC',
                preferredComs: 'EMAIL',
                checkInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      await controllers.checkIns.getRestartSummaryPage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-summary.njk',
        expect.objectContaining({
          crn,
          userDetails: expect.objectContaining({ interval: "I'll schedule them one at a time", isAdHoc: true }),
        }),
      )
    })

    it('does not flag a standard interval as ad-hoc', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'WEEKLY', date: '19/2/2026' } } } },
      }
      const req = baseReq(data)
      await controllers.checkIns.getRestartSummaryPage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-summary.njk',
        expect.objectContaining({ userDetails: expect.objectContaining({ isAdHoc: false }) }),
      )
    })
  })

  describe('postRestartSummaryPage', () => {
    it('sends an incomplete scheduled restart back to the frequency page instead of submitting', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { date: '19/2/2026', preferredComs: 'EMAIL' } } } },
      })
      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(postReactivateOffenderSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin`)
    })

    it('calls reactivate API with ISO date and redirects to confirmation', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                date: '19/2/2026',
                interval: 'WEEKLY',
                preferredComs: 'EMAIL',
                eligibility: ['accreditedProgramme', 'youthSentence'],
                pilotCheck: 'true',
                rationale: 'Discussed with the programme treatment manager',
                reason: 'Back on supervision',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(postReactivateOffenderSpy).toHaveBeenCalledWith(
        uuid,
        expect.objectContaining({
          requestedBy: res.locals.user.username,
          reason: 'Discussed with the programme treatment manager',
          checkinSchedule: expect.objectContaining({
            requestedBy: res.locals.user.username,
            firstCheckin: '2026-02-19',
          }),
          contactPreference: expect.objectContaining({
            requestedBy: res.locals.user.username,
            contactPreference: 'EMAIL',
          }),
          pilotCheck: 'true',
        }),
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-confirmation`)
    })
    // The API takes ad-hoc as a mode with no interval, and there is no first check in to schedule.
    it('submits an ad-hoc restart as the mode, with no first check in and no interval', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: { [crn]: { [uuid]: { restartCheckin: { interval: 'AD_HOC', preferredComs: 'EMAIL' } } } },
      }
      const req = baseReq(data)
      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(postReactivateOffenderSpy).toHaveBeenCalledWith(
        uuid,
        expect.objectContaining({
          reason: 'Reactivated via UI',
          checkinSchedule: { requestedBy: res.locals.user.username, mode: 'AD_HOC' },
        }),
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-confirmation`)
    })

    it('redirects to restart start page if session data is missing', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({})
      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin`)
    })

    it('renders 500 error page if reactivate API call fails', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: { [crn]: { [uuid]: { restartCheckin: { date: '19/2/2026', interval: 'WEEKLY' } } } },
      }
      const req = baseReq(data)

      postReactivateOffenderSpy.mockRejectedValueOnce(new Error('API failure'))

      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(mockRenderError).toHaveBeenCalledWith(500)
      expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
    })
  })

  describe('getRestartConfirmation', () => {
    it('renders restart confirmation and clears session data', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                date: '19/2/2026',
                interval: 'WEEKLY',
                preferredComs: 'EMAIL',
                checkInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)

      await controllers.checkIns.getRestartConfirmation(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-confirmation.njk',
        expect.objectContaining({
          userDetails: expect.objectContaining({
            displayDay: 'Thursday',
          }),
        }),
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin'],
        undefined,
      )
    })
    it('redirects to manage page if saved restart details are missing', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({})
      await controllers.checkIns.getRestartConfirmation(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    })

    const restartWithDate = (date: string) =>
      baseReq({
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: { date, interval: 'WEEKLY', preferredComs: 'EMAIL', checkInEmail: 'test@example.com' },
            },
          },
        },
      })

    it('offers to add questions when the next check in is after today', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = restartWithDate(DateTime.now().plus({ days: 2 }).toFormat('d/M/yyyy'))

      await controllers.checkIns.getRestartConfirmation(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-confirmation.njk',
        expect.objectContaining({ isFutureCheckinDate: true }),
      )
    })

    // Questions close at 23:59 the day before, so a restart dated today has nothing to add to.
    it('does not offer to add questions when the next check in is today', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = restartWithDate(DateTime.now().toFormat('d/M/yyyy'))

      await controllers.checkIns.getRestartConfirmation(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-confirmation.njk',
        expect.objectContaining({ isFutureCheckinDate: false }),
      )
    })

    it('flags an ad-hoc restart, which has no date and so no day to show', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                interval: 'AD_HOC',
                preferredComs: 'EMAIL',
                checkInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)

      await controllers.checkIns.getRestartConfirmation(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-confirmation.njk',
        expect.objectContaining({
          userDetails: expect.objectContaining({
            isAdHoc: true,
            displayDay: undefined,
          }),
        }),
      )
    })
  })

  describe('Additional questions for online check ins journey', () => {
    describe('getAddQuestionsPage', () => {
      it('shows a bespoke question as its whole text', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612': 'Have you managed to speak to your landlord?',
                  },
                },
              },
            },
          },
        })

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [
              {
                id: 'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612',
                fullText: 'Have you managed to speak to your landlord?',
              },
            ],
          }),
        )
      })

      it('restores a saved bespoke question from the upcoming check in items', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockResolvedValue({
          upcoming: {
            expectedCheckinDate: '2026-11-03',
            items: [
              {
                template: {
                  id: 99,
                  template: 'Have you managed to speak to your landlord?',
                  responseFormat: 'TEXT',
                  responseSpec: { hint: 'Add as much detail as you feel comfortable with', placeholders: [] },
                  policy: 'CUSTOMISABLE',
                  policy$hmpps_esupervision_api: 'CUSTOMISABLE',
                },
                params: { placeholders: {} },
              },
            ],
          },
        } as any)

        const req = baseReq({})

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [{ id: `bespoke-${uuid}`, fullText: 'Have you managed to speak to your landlord?' }],
          }),
        )
      })

      beforeEach(() => {
        jest.spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates').mockResolvedValue({
          templates: [
            {
              id: 1,
              template: 'How has {{thing}} been going recently?',
              example: 'unpaid work, college course, work, apprenticeship, university course, sentence plan, training',
              responseFormat: 'TEXT',
              responseSpec: {
                hint: 'Hint for the question about the {{thing}}',
                placeholders: ['thing'],
              },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
            {
              id: 2,
              template: 'How have things been feeling {{thing}} recently? ',
              example:
                'home, work, relationships with family, appointments with other bodies, physical or mental health, recovery journey',
              responseFormat: 'TEXT',
              responseSpec: {
                hint: 'Hint for the question about the {{thing}}',
                placeholders: ['thing'],
              },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
          ],
        } as any)
      })

      it('renders add questions page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockResolvedValue({
          upcoming: {
            items: [],
          },
        } as any)

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/add-questions.njk',
          expect.objectContaining({
            crn,
            id,
            case: offenderCheckinsByCRNResponse.details,
            addedQuestions: [],
            data: req.session.data,
          }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_ADD_QUESTIONS', crn, SubjectType.CRN)
      })

      it('safely extracts text from nested placeholders object from the API', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates').mockResolvedValue({
          templates: [
            {
              id: 5,
              template: 'How is {{thing}}?',
              responseSpec: { placeholders: ['thing'] },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
          ],
        } as any)

        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockResolvedValue({
          upcoming: {
            items: [
              {
                template: { id: 5 },
                params: {
                  placeholders: { thing: 'work going' },
                },
              },
            ],
          },
        } as any)

        const req = baseReq()

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'manageQuestions', 'questionTemplateAndInputs'],
          expect.any(Object),
        )

        const setDataCall = mockSetDataValue.mock.calls.find(call => call[1].includes('questionTemplateAndInputs'))
        const savedData = setDataCall?.[2]

        expect(Object.values(savedData)).toContain('work going')
      })

      it('skips fetching upcoming questions if they already exist in the session', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: { '1-uuid': 'existing answer' },
                  availableTemplates: [
                    {
                      id: '1',
                      template: 'How is {{thing}}?',
                      responseSpec: { placeholders: ['thing'] },
                      policy$hmpps_esupervision_api: 'CUSTOMISABLE',
                    },
                  ],
                },
              },
            },
          },
        })

        const getUpcomingSpy = jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems')

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(getUpcomingSpy).not.toHaveBeenCalled()
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [{ id: '1-uuid', fullText: 'How is existing answer?' }],
          }),
        )
      })

      it('does not add a second question mark when the answer already ends with one', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: { '1-uuid': 'work going?' },
                  availableTemplates: [
                    {
                      id: '1',
                      template: 'How is {{thing}}?',
                      responseSpec: { placeholders: ['thing'] },
                      policy$hmpps_esupervision_api: 'CUSTOMISABLE',
                    },
                  ],
                },
              },
            },
          },
        })

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [{ id: '1-uuid', fullText: 'How is work going?' }],
          }),
        )
      })

      it('renders 500 error page if fetching upcoming questions fails with non-404', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockRejectedValue({ status: 500 })

        const req = baseReq()

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(500)
      })
    })

    describe('postAddQuestionsPage', () => {
      beforeEach(() => {
        jest.spyOn(ESupervisionClient.prototype, 'putAssignQuestionsToCheckIn').mockResolvedValue({} as any)
        jest.spyOn(ESupervisionClient.prototype, 'deleteAssignedQuestionsFromCheckIn').mockResolvedValue({} as any)
      })

      it('sends a bespoke question as text', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [],
                  questionTemplateAndInputs: {
                    'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612': 'Have you managed to speak to your landlord?',
                  },
                },
              },
            },
          },
        })

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(ESupervisionClient.prototype.putAssignQuestionsToCheckIn).toHaveBeenCalledWith(crn, {
          questions: [{ text: 'Have you managed to speak to your landlord?', params: { placeholders: {} } }],
          language: 'en-GB',
          author: 'user-1',
        })
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
      })

      it('maps session data to payload and redirects to manage page on success', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [
                    {
                      id: '1',
                      template: 'How has {{thing}} been going recently?',
                      responseFormat: 'TEXT',
                      responseSpec: { placeholders: ['thing'] },
                    },
                  ],
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'the housing service?',
                  },
                },
              },
            },
          },
        })

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(hmppsAuthClient.getSystemClientToken).toHaveBeenCalled()
        expect(ESupervisionClient.prototype.putAssignQuestionsToCheckIn).toHaveBeenCalledWith(crn, {
          questions: [
            {
              id: 1,
              params: {
                placeholders: {
                  thing: 'the housing service',
                },
                responseFormat: 'TEXT',
              },
            },
          ],
          language: 'en-GB',
          author: 'user-1',
        })
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
      })

      it('handles completely empty session data by redirecting to manage page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({})

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
      })

      it('calls DELETE endpoint when there are no custom questions to save', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {},
                  availableTemplates: [{ id: '3', responseSpec: { placeholders: ['thing'] } }],
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(ESupervisionClient.prototype.deleteAssignedQuestionsFromCheckIn).toHaveBeenCalledWith(crn)
        expect(ESupervisionClient.prototype.putAssignQuestionsToCheckIn).not.toHaveBeenCalled()

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, id, 'questionsAdded'],
          false,
        )
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
      })

      it('renders 500 error page if saving questions to the API fails', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: { '1-some-uuid': 'answer' },
                  availableTemplates: [{ id: '1', responseSpec: { placeholders: ['text'] }, responseFormat: 'TEXT' }],
                },
              },
            },
          },
        })

        jest.spyOn(ESupervisionClient.prototype, 'putAssignQuestionsToCheckIn').mockRejectedValue({ status: 500 })

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(500)
        expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
      })
    })

    describe('getPreviewFeelingPage', () => {
      it('renders feeling preview page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({ mockData: 'value' })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getPreviewFeelingPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith('pages/check-in/questions/preview/feeling.njk', {
          crn,
          id,
          back: req.query.back,
          data: req.session.data,
        })
        expect(mockRenderError).not.toHaveBeenCalled()
        checkSendAuditMessage(
          res,
          'VIEW_MANAGE_ONLINE_CHECK_INS_PREVIEW_FEELING_CHECK_IN_QUESTIONS',
          crn,
          SubjectType.CRN,
        )
      })
    })

    describe('getPreviewSupportPage', () => {
      it('renders support preview page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({ mockData: 'value' })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getPreviewSupportPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith('pages/check-in/questions/preview/support.njk', {
          crn,
          id,
          back: req.query.back,
          data: req.session.data,
        })
        expect(mockRenderError).not.toHaveBeenCalled()
        checkSendAuditMessage(
          res,
          'VIEW_MANAGE_ONLINE_CHECK_INS_PREVIEW_SUPPORT_CHECK_IN_QUESTIONS',
          crn,
          SubjectType.CRN,
        )
      })
    })

    describe('getQuestionsListPage', () => {
      it('renders list questions page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const getQuestionsListSpy = jest
          .spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates')
          .mockImplementation(() =>
            Promise.resolve({
              templates: [
                {
                  id: '1',
                  template: 'Have you heard back from {{thing}}?',
                  responseSpec: { placeholders: ['thing'] },
                  policy$hmpps_esupervision_api: 'CUSTOMISABLE',
                },
              ],
            } as any),
          )

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getQuestionsListPage(hmppsAuthClient)(req, res)

        expect(getQuestionsListSpy).toHaveBeenCalledWith('en-GB')
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, id, 'manageQuestions', 'availableTemplates'],
          [
            {
              id: '1',
              template: 'Have you heard back from {{thing}}?',
              responseSpec: { placeholders: ['thing'] },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
          ],
        )
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/list-questions.njk',
          expect.objectContaining({
            crn,
            id,
            back: req.query.back,
            case: offenderCheckinsByCRNResponse.details,
            data: req.session.data,
          }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_LIST_CHECK_IN_LIST_QUESTIONS', crn, SubjectType.CRN)
      })

      it('lists only the CUSTOMISABLE templates', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates').mockImplementation(() =>
          Promise.resolve({
            templates: [
              {
                id: '1',
                template: 'Have you heard back from {{thing}}?',
                responseSpec: { placeholders: ['thing'] },
                policy$hmpps_esupervision_api: 'CUSTOMISABLE',
              },
              {
                id: '3',
                template: 'A fixed question?',
                responseSpec: { placeholders: [] },
                policy$hmpps_esupervision_api: 'STANDARD',
              },
            ],
          } as any),
        )

        await controllers.checkIns.getQuestionsListPage(hmppsAuthClient)(baseReq(), res)

        const [, context] = (renderSpy as jest.Mock).mock.calls.at(-1)
        expect(context.templatesList.templates.map((t: any) => t.id)).toEqual(['1'])
      })

      it('redirects to add questions page if 3 or more questions are already saved', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates').mockImplementation(() =>
          Promise.resolve({
            templates: [],
          } as any),
        )

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'work',
                    '2-a81bc81b-dead-4e5d-abff-90865d1e13b1': 'the housing service',
                    '3-c91350a4-37a4-4422-92e1-7d121bc1e612': 'your landlord',
                  },
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getQuestionsListPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('postQuestionsListPage', () => {
      const bespokeBody = (text: string) => ({
        esupervision: { [crn]: { [uuid]: { manageQuestions: { bespokeQuestionInput: text } } } },
      })

      it('redirects to add questions page when nothing was written', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.postQuestionsListPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })

      it('stores the bespoke question, adding a question mark, and returns to the add page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({})
        req.body = bespokeBody('  Have you managed to speak to your   landlord ')

        await controllers.checkIns.postQuestionsListPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'manageQuestions', 'questionTemplateAndInputs', `bespoke-${uuid}`],
          'Have you managed to speak to your landlord?',
        )
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/questions/add`)
      })

      it('keeps a question mark the practitioner typed', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({})
        req.body = bespokeBody('Is work going ok?')

        await controllers.checkIns.postQuestionsListPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          expect.arrayContaining(['questionTemplateAndInputs']),
          'Is work going ok?',
        )
      })

      it('does not add a fourth question', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'work',
                    '2-a81bc81b-dead-4e5d-abff-90865d1e13b1': 'the housing service',
                    'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612': 'Have you been to the gym?',
                  },
                },
              },
            },
          },
        })
        req.body = bespokeBody('One more question')

        await controllers.checkIns.postQuestionsListPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/questions/add`)
      })
    })

    describe('getEditQuestionPage', () => {
      it('renders a bespoke question for editing without a template', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [{ id: '1', template: 'Have you heard back from {{thing}}?' }],
                  questionTemplateAndInputs: {
                    'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612': 'Have you managed to speak to your landlord?',
                  },
                },
              },
            },
          },
        })
        req.params.questionId = 'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/edit-question.njk',
          expect.objectContaining({
            questionId: 'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612',
            isBespoke: true,
            question: null,
          }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
      })

      it('returns 404 for a bespoke question id that is not in the session', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [{ id: '1', template: 'Have you heard back from {{thing}}?' }],
                  questionTemplateAndInputs: {},
                },
              },
            },
          },
        })
        req.params.questionId = 'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
        expect(renderSpy).not.toHaveBeenCalled()
      })

      it('renders edit question page when CRN, id, and question template are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [
                    {
                      id: '1',
                      template: 'Have you heard back from {{thing}}?',
                      responseSpec: { placeholders: ['thing'] },
                    },
                  ],
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/edit-question.njk',
          expect.objectContaining({
            crn,
            id,
            questionId: '1-f47ac10b-58cc-4372-a567-0e02b2c3d479',
            case: offenderCheckinsByCRNResponse.details,
            question: expect.objectContaining({
              prefix: 'Have you heard back from ',
              suffix: '?',
              placeholderWord: 'thing',
            }),
            data: req.session.data,
          }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_EDIT', crn, SubjectType.CRN)
      })

      it('fetches templates from API and saves to session if none are in session data', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const getQuestionsListSpy = jest
          .spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates')
          .mockResolvedValue({
            templates: [
              {
                id: '1',
                template: 'Have you heard back from {{thing}}?',
                responseSpec: { placeholders: ['thing'] },
                policy$hmpps_esupervision_api: 'CUSTOMISABLE',
              },
            ],
          } as any)

        const req = baseReq()
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(getQuestionsListSpy).toHaveBeenCalledWith('en-GB')

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, id, 'manageQuestions', 'availableTemplates'],
          expect.any(Array),
        )

        expect(renderSpy).toHaveBeenCalled()
      })

      it('returns 404 when templateId cannot be parsed/found', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [{ id: '1', template: 'Have you heard back from {{thing}}?' }],
                },
              },
            },
          },
        })
        req.params.questionId = 'error-id'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
        expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
      })
    })

    describe('postEditQuestionPage', () => {
      it('saves an edited bespoke question with a question mark added', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612': 'Have you spoken to your landlord?',
                  },
                },
              },
            },
          },
        })
        req.params.questionId = 'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612'
        req.body = {
          esupervision: {
            [crn]: {
              [uuid]: { manageQuestions: { draftQuestionInput: 'Have you managed to speak to your landlord' } },
            },
          },
        }

        await controllers.checkIns.postEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          [
            'esupervision',
            crn,
            uuid,
            'manageQuestions',
            'questionTemplateAndInputs',
            'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612',
          ],
          'Have you managed to speak to your landlord?',
        )
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/questions/add`)
      })

      it('saves nothing for a bespoke question id that is not in the session', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({})
        req.params.questionId = 'bespoke-c91350a4-37a4-4422-92e1-7d121bc1e612'
        req.body = {
          esupervision: {
            [crn]: {
              [uuid]: { manageQuestions: { draftQuestionInput: 'Have you managed to speak to your landlord' } },
            },
          },
        }

        await controllers.checkIns.postEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/questions/add`)
      })

      it('saves answer to session and redirects to add questions page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  draftQuestionInput: 'the housing service',
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'
        req.body = {
          esupervision: {
            [crn]: {
              [id]: {
                manageQuestions: {
                  draftQuestionInput: 'the housing service',
                },
              },
            },
          },
        }

        await controllers.checkIns.postEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          [
            'esupervision',
            crn,
            id,
            'manageQuestions',
            'questionTemplateAndInputs',
            '1-f47ac10b-58cc-4372-a567-0e02b2c3d479',
          ],
          'the housing service',
        )
        expect(req.session.data.esupervision[crn][id].manageQuestions.draftQuestionInput).toBeUndefined()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })

      it('does not save to session if input is empty or whitespace, but still redirects', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        req.body = {
          esupervision: {
            [crn]: {
              [id]: {
                manageQuestions: {
                  draftQuestionInput: '   ',
                },
              },
            },
          },
        }

        await controllers.checkIns.postEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('getSelectQuestionPage', () => {
      it('redirects to edit question page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>
        req.params.templateId = '1'

        await controllers.checkIns.getSelectQuestionPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(
          `/case/${crn}/appointments/check-in/manage/${id}/questions/1-f1654ea3-0abb-46eb-860b-654a96edbe20/edit`,
        )
      })

      it('redirects to add questions page if 3 or more questions are already saved', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'work',
                    '2-a81bc81b-dead-4e5d-abff-90865d1e13b1': 'the housing service',
                    '3-c91350a4-37a4-4422-92e1-7d121bc1e612': 'your landlord',
                  },
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.templateId = '1'

        await controllers.checkIns.getSelectQuestionPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('getDeleteQuestion', () => {
      it('removes question from session and redirects to add questions page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'work',
                    '2-a81bc81b-dead-4e5d-abff-90865d1e13b1': 'the housing service',
                    '3-c91350a4-37a4-4422-92e1-7d121bc1e612': 'your landlord',
                  },
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        await controllers.checkIns.getDeleteQuestion(hmppsAuthClient)(req, res)

        expect(
          req.session.data.esupervision[crn][id].manageQuestions.questionTemplateAndInputs[
            '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'
          ],
        ).toBeUndefined()
        expect(
          req.session.data.esupervision[crn][id].manageQuestions.questionTemplateAndInputs[
            '2-a81bc81b-dead-4e5d-abff-90865d1e13b1'
          ],
        ).toBeDefined()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_DELETE', crn, SubjectType.CRN)
      })
    })
  })

  describe('Ad hoc (schedule) check in journey', () => {
    const scheduleUrl = `/case/${crn}/appointments/check-in/manage/${uuid}/schedule-check-in`
    const manageUrl = `/case/${crn}/appointments/check-in/manage/${uuid}`

    const questionTemplates = [
      {
        id: 1,
        template: 'Have you been able to {{text}}?',
        responseSpec: { placeholders: ['text'] },
        policy$hmpps_esupervision_api: 'CUSTOMISABLE',
      },
      {
        id: 2,
        template: 'How has {{text}} been going recently?',
        responseSpec: { placeholders: ['text'] },
        policy$hmpps_esupervision_api: 'CUSTOMISABLE',
      },
    ]

    let getTemplatesSpy: jest.SpyInstance

    beforeEach(() => {
      getTemplatesSpy = jest
        .spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates')
        .mockResolvedValue({ templates: questionTemplates } as any)
      // Only an ad-hoc person can reach this journey; their record has no schedule to repeat.
      res.locals.offenderCheckinsByCRNResponse = {
        ...offenderCheckinsByCRNResponse,
        mode: 'AD_HOC',
        checkinInterval: null,
        firstCheckin: null,
      }
    })

    const sessionWith = (scheduleCheckIn: Record<string, unknown>) => ({
      esupervision: { [crn]: { [uuid]: { scheduleCheckIn } } },
    })

    describe('getScheduleCheckInDate', () => {
      const datePath = ['esupervision', crn, uuid, 'scheduleCheckIn', 'date']
      const bookedDatePath = ['esupervision', crn, uuid, 'scheduleCheckIn', 'bookedDate']
      const bookedFor = (date: string) =>
        jest
          .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
          .mockResolvedValueOnce({ expectedCheckinDate: `${date}T10:00:00+01:00`, questions: [] } as any)
      const minDate = (daysAhead: number) => {
        const day = DateTime.now().plus({ days: daysAhead })
        return day.toFormat(day.day > 9 ? 'dd/M/yyyy' : 'd/M/yyyy')
      }

      it('renders the date page with nothing to pre-fill for a fresh booking, allowing today', async () => {
        jest
          .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
          .mockRejectedValueOnce(noUpcomingCheckin())
        const req = baseReq({})

        await controllers.checkIns.getScheduleCheckInDate(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/date.njk',
          expect.objectContaining({
            crn,
            id: uuid,
            case: offenderCheckinsByCRNResponse.details,
            checkInMinDate: minDate(0),
          }),
        )
        expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, bookedDatePath, undefined)
        expect(mockSetDataValue).not.toHaveBeenCalledWith(expect.anything(), datePath, expect.anything())
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_DATE', crn, SubjectType.CRN)
      })

      // Booking again is how a booked ad-hoc check in is moved, so the picker starts on that date,
      // and the booking is recorded so the validator insists the new date is after today.
      it('pre-fills the date of the booked check in and only allows dates after today', async () => {
        bookedFor('2099-01-05')
        const req = baseReq({})

        await controllers.checkIns.getScheduleCheckInDate(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, bookedDatePath, '2099-01-05')
        expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, datePath, '5/1/2099')
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/date.njk',
          expect.objectContaining({ checkInMinDate: minDate(1) }),
        )
      })

      // Each visit starts from the live booking, so a date left behind by an abandoned visit is not shown.
      it('replaces a date left in the session by an earlier visit with the booked date', async () => {
        bookedFor('2099-01-05')
        const req = baseReq(sessionWith({ date: '7/2/2099' }))

        await controllers.checkIns.getScheduleCheckInDate(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, bookedDatePath, '2099-01-05')
        expect(mockSetDataValue).toHaveBeenCalledWith(req.session.data, datePath, '5/1/2099')
      })

      // A check in due today is active: it cannot be moved, and nothing can be booked over it.
      it('sends the practitioner back to the manage page while a check in is active today', async () => {
        bookedFor(DateTime.now().toISODate())

        await controllers.checkIns.getScheduleCheckInDate(hmppsAuthClient)(baseReq({}), res)

        expect(redirectSpy).toHaveBeenCalledWith(manageUrl)
        expect(renderSpy).not.toHaveBeenCalled()
        expect(mockSetDataValue).not.toHaveBeenCalled()
      })

      it('returns 404 when offender details are missing', async () => {
        res.locals.offenderCheckinsByCRNResponse = undefined

        await controllers.checkIns.getScheduleCheckInDate(hmppsAuthClient)(baseReq({}), res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
      })
    })

    describe('postScheduleCheckInDate', () => {
      const bookedFor = (date: string) =>
        jest
          .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
          .mockResolvedValueOnce({ expectedCheckinDate: `${date}T10:00:00+01:00`, questions: [] } as any)

      it('continues to the add questions page for a new booking', async () => {
        jest
          .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
          .mockRejectedValueOnce(noUpcomingCheckin())

        await controllers.checkIns.postScheduleCheckInDate(hmppsAuthClient)(
          baseReq(sessionWith({ date: '1/2/2099' })),
          res,
        )

        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
        expect(postScheduleAdHocCheckinSpy).not.toHaveBeenCalled()
      })

      // Moving a booked check in only changes its date: the API keeps the questions already assigned.
      it('moves a booked check in straight away and returns to the manage page', async () => {
        bookedFor('2099-01-05')
        const req = baseReq(sessionWith({ date: '7/2/2099' }))

        await controllers.checkIns.postScheduleCheckInDate(hmppsAuthClient)(req, res)

        expect(postScheduleAdHocCheckinSpy).toHaveBeenCalledWith(crn, {
          requestedBy: res.locals.user.username,
          firstCheckin: '2099-02-07',
        })
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn'],
          undefined,
        )
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckInMoved'],
          '7/2/2099',
        )
        expect(redirectSpy).toHaveBeenCalledWith(manageUrl)
      })

      // A check in due today is active: it cannot be moved, and nothing can be booked over it.
      it('sends the practitioner back to the manage page while a check in is active today', async () => {
        bookedFor(DateTime.now().toISODate())

        await controllers.checkIns.postScheduleCheckInDate(hmppsAuthClient)(
          baseReq(sessionWith({ date: '1/2/2099' })),
          res,
        )

        expect(redirectSpy).toHaveBeenCalledWith(manageUrl)
        expect(postScheduleAdHocCheckinSpy).not.toHaveBeenCalled()
      })

      // The validator only knows about the booking from the session; if that is missing or stale a
      // date of today gets through, so the handler shows the same error rather than redirecting.
      it('shows the future-date error itself when a booked check in would be moved to today', async () => {
        bookedFor('2099-01-05')
        const req = baseReq(sessionWith({ date: DateTime.now().toFormat('d/M/yyyy') }))

        await controllers.checkIns.postScheduleCheckInDate(hmppsAuthClient)(req, res)

        expect(postScheduleAdHocCheckinSpy).not.toHaveBeenCalled()
        expect(redirectSpy).not.toHaveBeenCalled()
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'bookedDate'],
          '2099-01-05',
        )
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/date.njk',
          expect.objectContaining({
            errorMessages: {
              [`esupervision-${crn}-${uuid}-scheduleCheckIn-date`]:
                'The next online check in date must be in the future',
            },
            case: offenderCheckinsByCRNResponse.details,
          }),
        )
      })

      it('shows the format error itself when the date in session cannot be parsed', async () => {
        bookedFor('2099-01-05')

        await controllers.checkIns.postScheduleCheckInDate(hmppsAuthClient)(baseReq(sessionWith({ date: 'soon' })), res)

        expect(postScheduleAdHocCheckinSpy).not.toHaveBeenCalled()
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/date.njk',
          expect.objectContaining({
            errorMessages: {
              [`esupervision-${crn}-${uuid}-scheduleCheckIn-date`]:
                'Enter a date in the correct format, for example 17/5/2024',
            },
          }),
        )
      })

      it('renders the API error and keeps the date when the move fails', async () => {
        bookedFor('2099-01-05')
        postScheduleAdHocCheckinSpy.mockRejectedValueOnce(Object.assign(new Error('Too late'), { status: 422 }))

        await controllers.checkIns.postScheduleCheckInDate(hmppsAuthClient)(
          baseReq(sessionWith({ date: '7/2/2099' })),
          res,
        )

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(mockRenderError).toHaveBeenCalledWith(422)
      })
    })

    describe('getScheduleCheckInAddQuestions', () => {
      it('fetches the CUSTOMISABLE templates and renders the added questions', async () => {
        const req = baseReq(sessionWith({ date: '1/2/2026', questionTemplateAndInputs: { '2-uuid': 'work' } }))

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(getTemplatesSpy).toHaveBeenCalledWith('en-GB')
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'availableTemplates'],
          [questionTemplates[0], questionTemplates[1]],
        )
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/add-questions.njk',
          expect.objectContaining({
            crn,
            id: uuid,
            case: offenderCheckinsByCRNResponse.details,
            addedQuestions: [{ id: '2-uuid', fullText: 'How has work been going recently?' }],
            expectedCheckinDate: '1/2/2026',
          }),
        )
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_ADD_QUESTIONS', crn, SubjectType.CRN)
      })

      it('reuses templates already held in the session rather than calling the API again', async () => {
        const req = baseReq(
          sessionWith({ availableTemplates: questionTemplates.slice(0, 1), questionTemplateAndInputs: {} }),
        )

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(getTemplatesSpy).not.toHaveBeenCalled()
      })

      it('does not add a second question mark when the answer already ends with one', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: { '1-uuid': 'call your keyworker?' } }))

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [{ id: '1-uuid', fullText: 'Have you been able to call your keyworker?' }],
          }),
        )
      })

      it('removes a trailing question mark when the template suffix ends with one', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: { '2-uuid': 'work?' } }))

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [{ id: '2-uuid', fullText: 'How has work been going recently?' }],
          }),
        )
      })

      it('skips blank answers and unknown templates', async () => {
        const req = baseReq(
          sessionWith({
            questionTemplateAndInputs: { '1-uuid': '   ', '2-uuid': 'work', '99-uuid': 'no such template' },
          }),
        )

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        const [, context] = (renderSpy as jest.Mock).mock.calls.at(-1)
        expect(context.addedQuestions).toEqual([{ id: '2-uuid', fullText: 'How has work been going recently?' }])
      })

      // Questions added to a recurring check in stay assigned after a switch to ad-hoc.
      it('shows questions still assigned from before the switch to ad-hoc', async () => {
        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockResolvedValueOnce({
          upcoming: { items: [{ template: { id: 2 }, params: { placeholders: { text: 'work' } } }] },
        } as any)
        const req = baseReq(sessionWith({ date: '1/2/2026' }))

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        const draftId = '2-f1654ea3-0abb-46eb-860b-654a96edbe20'
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'questionTemplateAndInputs'],
          { [draftId]: 'work' },
        )
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'hasSavedQuestions'],
          true,
        )
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [{ id: draftId, fullText: 'How has work been going recently?' }],
          }),
        )
      })

      it('shows a question the practitioner wrote, restored from the assigned items', async () => {
        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockResolvedValueOnce({
          upcoming: {
            items: [
              {
                template: {
                  id: 77,
                  template: 'Have you been to the gym?',
                  responseSpec: { placeholders: [] },
                  policy$hmpps_esupervision_api: 'CUSTOMISABLE',
                },
                params: { placeholders: {} },
              },
            ],
          },
        } as any)
        const req = baseReq(sessionWith({ date: '1/2/2026' }))

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        const draftId = 'bespoke-f1654ea3-0abb-46eb-860b-654a96edbe20'
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'questionTemplateAndInputs'],
          { [draftId]: 'Have you been to the gym?' },
        )
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/add-questions.njk',
          expect.objectContaining({ addedQuestions: [{ id: draftId, fullText: 'Have you been to the gym?' }] }),
        )
      })

      it('lists a bespoke question held in the session by its whole text', async () => {
        const req = baseReq(
          sessionWith({
            date: '1/2/2026',
            availableTemplates: questionTemplates,
            questionTemplateAndInputs: { '2-uuid': 'work', 'bespoke-uuid': ' Have you been to the gym? ' },
          }),
        )

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [
              { id: '2-uuid', fullText: 'How has work been going recently?' },
              { id: 'bespoke-uuid', fullText: 'Have you been to the gym?' },
            ],
          }),
        )
      })

      it.each([{ status: 404 }, { status: 422, data: { developerMessage: 'Offender status is INACTIVE' } }])(
        'shows no questions for an expected no-questions response: %j',
        async error => {
          jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockRejectedValueOnce(error)
          const req = baseReq(sessionWith({ date: '1/2/2026' }))

          await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

          expect(mockSetDataValue).toHaveBeenCalledWith(
            req.session.data,
            ['esupervision', crn, uuid, 'scheduleCheckIn', 'hasSavedQuestions'],
            false,
          )
          expect(renderSpy).toHaveBeenCalledWith(
            'pages/check-in/schedule-check-in/add-questions.njk',
            expect.objectContaining({ addedQuestions: [] }),
          )
        },
      )

      it.each([
        { error: { status: 500 }, expectedStatus: 500 },
        { error: { response: { status: 503 } }, expectedStatus: 503 },
        { error: new Error('Request timed out'), expectedStatus: 500 },
        { error: { status: 422, data: { developerMessage: 'Unexpected failure' } }, expectedStatus: 422 },
      ])('leaves the draft unset after an unexpected fetch failure: %j', async ({ error, expectedStatus }) => {
        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockRejectedValueOnce(error)
        const req = baseReq(sessionWith({ availableTemplates: questionTemplates }))

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(expectedStatus)
        expect(renderSpy).not.toHaveBeenCalled()
        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(req.session.data.esupervision[crn][uuid].scheduleCheckIn.questionTemplateAndInputs).toBeUndefined()
        expect(req.session.data.esupervision[crn][uuid].scheduleCheckIn.hasSavedQuestions).toBeUndefined()
      })

      it('does not fetch assigned questions once the draft is in the session', async () => {
        const getItemsSpy = jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems')

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(
          baseReq(sessionWith({ questionTemplateAndInputs: {} })),
          res,
        )

        expect(getItemsSpy).not.toHaveBeenCalled()
      })

      it('returns 404 when offender details are missing', async () => {
        res.locals.offenderCheckinsByCRNResponse = undefined

        await controllers.checkIns.getScheduleCheckInAddQuestions(hmppsAuthClient)(baseReq({}), res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
      })
    })

    describe('postScheduleCheckInAddQuestions', () => {
      it('sends a question the practitioner wrote as its text rather than a template', async () => {
        const req = baseReq(
          sessionWith({
            date: '1/2/2026',
            availableTemplates: questionTemplates,
            questionTemplateAndInputs: { '2-uuid': 'work', 'bespoke-uuid': 'Have you been to the gym?' },
          }),
        )

        await controllers.checkIns.postScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(postScheduleAdHocCheckinSpy).toHaveBeenCalledWith(
          crn,
          expect.objectContaining({
            questions: expect.objectContaining({
              questions: [
                { id: 2, params: { placeholders: { text: 'work' }, responseFormat: 'TEXT' } },
                { text: 'Have you been to the gym?', params: { placeholders: {} } },
              ],
            }),
          }),
        )
      })

      it('schedules the check-in with the selected date and formatted questions', async () => {
        const req = baseReq(
          sessionWith({
            date: '1/2/2026',
            availableTemplates: questionTemplates,
            questionTemplateAndInputs: { '1-uuid': '   ', '2-uuid': '  work?  ' },
          }),
        )

        await controllers.checkIns.postScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(postScheduleAdHocCheckinSpy).toHaveBeenCalledWith(crn, {
          requestedBy: res.locals.user.username,
          firstCheckin: '2026-02-01',
          questions: {
            questions: [
              {
                id: 2,
                params: {
                  placeholders: { text: 'work' },
                  responseFormat: 'TEXT',
                },
              },
            ],
            language: 'en-GB',
            author: res.locals.user.username,
          },
        })

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn'],
          undefined,
        )
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckInCreated'],
          '1/2/2026',
        )
        expect(redirectSpy).toHaveBeenCalledWith(manageUrl)
      })

      it('clears assigned questions the practitioner removed before booking', async () => {
        const deleteSpy = jest
          .spyOn(ESupervisionClient.prototype, 'deleteAssignedQuestionsFromCheckIn')
          .mockResolvedValueOnce({ message: 'ok' })
        const req = baseReq(sessionWith({ date: '1/2/2026', hasSavedQuestions: true, questionTemplateAndInputs: {} }))

        await controllers.checkIns.postScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(deleteSpy).toHaveBeenCalledWith(crn)
        expect(postScheduleAdHocCheckinSpy).toHaveBeenCalledWith(crn, {
          requestedBy: res.locals.user.username,
          firstCheckin: '2026-02-01',
        })
        expect(redirectSpy).toHaveBeenCalledWith(manageUrl)
      })

      it('does not clear questions when none were assigned', async () => {
        const deleteSpy = jest.spyOn(ESupervisionClient.prototype, 'deleteAssignedQuestionsFromCheckIn')
        const req = baseReq(sessionWith({ date: '1/2/2026', questionTemplateAndInputs: {} }))

        await controllers.checkIns.postScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(deleteSpy).not.toHaveBeenCalled()
        expect(postScheduleAdHocCheckinSpy).toHaveBeenCalled()
      })

      it('preserves the draft and renders an error when scheduling fails', async () => {
        postScheduleAdHocCheckinSpy.mockRejectedValueOnce(new Error('API failure'))
        const req = baseReq(sessionWith({ date: '1/2/2026', questionTemplateAndInputs: {} }))

        await controllers.checkIns.postScheduleCheckInAddQuestions(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(mockRenderError).toHaveBeenCalledWith(500)
      })
    })

    describe('getScheduleCheckInQuestionsList', () => {
      it('lists only CUSTOMISABLE templates with their placeholders replaced for display', async () => {
        const nonCustomisableTemplate = {
          id: 3,
          template: 'A fixed question?',
          responseSpec: { placeholders: [] as string[] },
          policy$hmpps_esupervision_api: 'STANDARD',
        }
        getTemplatesSpy.mockResolvedValueOnce({ templates: [...questionTemplates, nonCustomisableTemplate] } as any)
        const req = baseReq(sessionWith({ questionTemplateAndInputs: {} }))

        await controllers.checkIns.getScheduleCheckInQuestionsList(hmppsAuthClient)(req, res)

        const [template, context] = (renderSpy as jest.Mock).mock.calls.at(-1)
        expect(template).toBe('pages/check-in/schedule-check-in/list-questions.njk')
        expect(context.templatesList.templates.map((t: any) => t.id)).toEqual([1, 2])
        expect(context.templatesList.templates.map((t: any) => t.displayTemplate)).toEqual([
          'Have you been able to [insert text]?',
          'How has [insert text] been going recently?',
        ])
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'availableTemplates'],
          questionTemplates,
        )
        checkSendAuditMessage(
          res,
          'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_LIST_QUESTIONS',
          crn,
          SubjectType.CRN,
        )
      })

      it('saves only the CUSTOMISABLE templates to the session', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: {} }))

        await controllers.checkIns.getScheduleCheckInQuestionsList(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'availableTemplates'],
          [questionTemplates[0], questionTemplates[1]],
        )
      })

      it('redirects back to add questions once 3 questions have been added', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: { '1-a': 'one', '2-b': 'two', '1-c': 'three' } }))

        await controllers.checkIns.getScheduleCheckInQuestionsList(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
        expect(renderSpy).not.toHaveBeenCalled()
      })

      it('returns 404 when offender details are missing', async () => {
        res.locals.offenderCheckinsByCRNResponse = undefined

        await controllers.checkIns.getScheduleCheckInQuestionsList(hmppsAuthClient)(baseReq({}), res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
      })
    })

    describe('postScheduleCheckInQuestionsList', () => {
      const bespokeReq = (text: string, scheduleCheckIn: Record<string, unknown> = {}) => {
        const req = baseReq(sessionWith(scheduleCheckIn))
        req.body = { esupervision: { [crn]: { [uuid]: { scheduleCheckIn: { bespokeQuestionInput: text } } } } }
        return req
      }

      it('returns to the add questions page without saving when nothing was written', async () => {
        await controllers.checkIns.postScheduleCheckInQuestionsList()(baseReq({}), res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })

      it('stores the written question under the ad hoc group, adding a question mark', async () => {
        const req = bespokeReq('  Have you managed to speak to your   landlord ')

        await controllers.checkIns.postScheduleCheckInQuestionsList()(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'questionTemplateAndInputs', `bespoke-${uuid}`],
          'Have you managed to speak to your landlord?',
        )
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })

      it('keeps a question mark the practitioner typed', async () => {
        const req = bespokeReq('Is work going ok?')

        await controllers.checkIns.postScheduleCheckInQuestionsList()(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          expect.arrayContaining(['scheduleCheckIn', 'questionTemplateAndInputs']),
          'Is work going ok?',
        )
      })

      it('does not add a fourth question', async () => {
        const req = bespokeReq('One more question', {
          questionTemplateAndInputs: { '1-a': 'work', '2-b': 'the housing service', 'bespoke-c': 'Been to the gym?' },
        })

        await controllers.checkIns.postScheduleCheckInQuestionsList()(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })
    })

    describe('getScheduleCheckInEditQuestion', () => {
      it('renders a bespoke question for editing without a template', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: { 'bespoke-uuid': 'Have you been to the gym?' } }))
        req.params.questionId = 'bespoke-uuid'

        await controllers.checkIns.getScheduleCheckInEditQuestion(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/edit-question.njk',
          expect.objectContaining({ questionId: 'bespoke-uuid', isBespoke: true, question: null }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
      })

      it('returns 404 for a bespoke question id that is not in the session', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: {} }))
        req.params.questionId = 'bespoke-uuid'

        await controllers.checkIns.getScheduleCheckInEditQuestion(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
        expect(renderSpy).not.toHaveBeenCalled()
      })

      it('renders the question matching the template id embedded in the question id', async () => {
        const req = baseReq({})
        req.params.questionId = '2-uuid'

        await controllers.checkIns.getScheduleCheckInEditQuestion(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/schedule-check-in/edit-question.njk',
          expect.objectContaining({
            crn,
            id: uuid,
            questionId: '2-uuid',
            question: expect.objectContaining({
              id: 2,
              prefix: 'How has ',
              suffix: ' been going recently?',
              placeholderWord: 'text',
            }),
          }),
        )
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_EDIT_QUESTION', crn, SubjectType.CRN)
      })

      it('returns 404 for a template id that does not exist', async () => {
        const req = baseReq({})
        req.params.questionId = '99-uuid'

        await controllers.checkIns.getScheduleCheckInEditQuestion(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
      })

      it('returns 404 when offender details are missing', async () => {
        res.locals.offenderCheckinsByCRNResponse = undefined
        const req = baseReq({})
        req.params.questionId = '1-uuid'

        await controllers.checkIns.getScheduleCheckInEditQuestion(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
      })
    })

    describe('postScheduleCheckInEditQuestion', () => {
      const editReq = (draftQuestionInput?: string) =>
        httpMocks.createRequest({
          params: { crn, id: uuid, questionId: '1-uuid' },
          session: { data: sessionWith({ draftQuestionInput }) },
          body: { esupervision: { [crn]: { [uuid]: { scheduleCheckIn: { draftQuestionInput } } } } },
        })

      it('saves the trimmed answer against the question id', async () => {
        const req = editReq('  call your keyworker  ')

        await controllers.checkIns.postScheduleCheckInEditQuestion()(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'questionTemplateAndInputs', '1-uuid'],
          'call your keyworker',
        )
        expect(req.session.data.esupervision[crn][uuid].scheduleCheckIn.draftQuestionInput).toBeUndefined()
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })

      it('saves an edited bespoke question with a question mark added', async () => {
        const req = editReq('Have you managed to speak to your landlord')
        req.params.questionId = 'bespoke-uuid'
        req.session.data = sessionWith({ questionTemplateAndInputs: { 'bespoke-uuid': 'Have you been to the gym?' } })

        await controllers.checkIns.postScheduleCheckInEditQuestion()(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckIn', 'questionTemplateAndInputs', 'bespoke-uuid'],
          'Have you managed to speak to your landlord?',
        )
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })

      it('saves nothing for a bespoke question id that is not in the session', async () => {
        const req = editReq('Have you managed to speak to your landlord')
        req.params.questionId = 'bespoke-uuid'

        await controllers.checkIns.postScheduleCheckInEditQuestion()(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })

      it('saves nothing when the answer is blank', async () => {
        await controllers.checkIns.postScheduleCheckInEditQuestion()(editReq('   '), res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })
    })

    describe('getScheduleCheckInSelectQuestion', () => {
      it('creates a draft question id and sends the user to edit it', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: {} }))
        req.params.templateId = '2'

        await controllers.checkIns.getScheduleCheckInSelectQuestion()(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/2-${uuid}/edit`)
        checkSendAuditMessage(
          res,
          'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_SELECT_QUESTION',
          crn,
          SubjectType.CRN,
        )
      })

      it('refuses to add a fourth question', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: { '1-a': 'one', '2-b': 'two', '1-c': 'three' } }))
        req.params.templateId = '2'

        await controllers.checkIns.getScheduleCheckInSelectQuestion()(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })
    })

    describe('getScheduleCheckInDeleteQuestion', () => {
      it('removes only the chosen question from the session', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: { '1-a': 'one', '2-b': 'two' } }))
        req.params.questionId = '1-a'

        await controllers.checkIns.getScheduleCheckInDeleteQuestion()(req, res)

        const saved = req.session.data.esupervision[crn][uuid].scheduleCheckIn.questionTemplateAndInputs
        expect(saved['1-a']).toBeUndefined()
        expect(saved['2-b']).toBe('two')
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
        checkSendAuditMessage(
          res,
          'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_DELETE_QUESTION',
          crn,
          SubjectType.CRN,
        )
      })

      it('is a no-op when the question is not in the session', async () => {
        const req = baseReq(sessionWith({ questionTemplateAndInputs: { '2-b': 'two' } }))
        req.params.questionId = '1-a'

        await controllers.checkIns.getScheduleCheckInDeleteQuestion()(req, res)

        expect(req.session.data.esupervision[crn][uuid].scheduleCheckIn.questionTemplateAndInputs['2-b']).toBe('two')
        expect(redirectSpy).toHaveBeenCalledWith(`${scheduleUrl}/questions/add`)
      })
    })

    describe('preview pages', () => {
      it.each([
        [
          'getScheduleCheckInPreviewFeeling',
          'pages/check-in/schedule-check-in/preview/feeling.njk',
          'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_PREVIEW_FEELING_QUESTIONS',
        ],
        [
          'getScheduleCheckInPreviewSupport',
          'pages/check-in/schedule-check-in/preview/support.njk',
          'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_PREVIEW_SUPPORT_QUESTIONS',
        ],
      ])('%s renders its preview', async (method, view, auditAction) => {
        await (controllers.checkIns as any)[method]()(baseReq({}), res)

        expect(renderSpy).toHaveBeenCalledWith(view, expect.objectContaining({ crn, id: uuid }))
        checkSendAuditMessage(res, auditAction, crn, SubjectType.CRN)
      })
    })

    describe('manage page success banner', () => {
      const bannerReq = (scheduleCheckInCreated?: string) =>
        httpMocks.createRequest({
          params: { crn, id: uuid },
          session: { data: { esupervision: { [crn]: { [uuid]: { scheduleCheckInCreated } } } } },
        })

      const renderedBanner = () => {
        const [, context] = (renderSpy as jest.Mock).mock.calls.at(-1)
        return context.successMessageHtml as string
      }

      beforeEach(() => {
        res.locals.success = undefined
      })

      it('names the person and the check in date', async () => {
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(bannerReq('1/2/2026'), res)

        expect(res.locals.success).toBe(true)
        const banner = renderedBanner()
        expect(banner).toContain('Single online check in for Joe has been created for 1 February 2026')
        expect(banner).toContain(
          'Joe will get a notification with a link to complete their online check in on 1 February 2026.',
        )
      })

      it('clears the flag so the banner only shows once', async () => {
        const req = bannerReq('1/2/2026')

        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckInCreated'],
          undefined,
        )
      })

      it('says a moved check in has been moved, and shows that banner only once', async () => {
        const req = httpMocks.createRequest({
          params: { crn, id: uuid },
          session: { data: { esupervision: { [crn]: { [uuid]: { scheduleCheckInMoved: '7/2/2026' } } } } },
        })

        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

        expect(res.locals.success).toBe(true)
        const banner = renderedBanner()
        expect(banner).toContain('Single online check in for Joe has been moved to 7 February 2026')
        expect(banner).toContain(
          'Joe will get a notification with a link to complete their online check in on 7 February 2026.',
        )
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'scheduleCheckInMoved'],
          undefined,
        )
      })

      it('falls back to the raw value when the date cannot be parsed', async () => {
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(bannerReq('not a date'), res)

        expect(renderedBanner()).toContain('has been created for not a date')
      })

      it('shows no banner when no ad hoc check in was created', async () => {
        await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(bannerReq(undefined), res)

        expect(res.locals.success).toBeUndefined()
        expect(renderedBanner()).toBeUndefined()
      })
    })
  })

  describe('back query param on check-in review redirects', () => {
    const mpopBack = 'https://localhost:9091/manage-people-on-probation/case/X000001/activity-log?page=1&view=default'

    afterEach(() => {
      delete res.locals.checkIn
    })

    it('keeps every query param of an absolute back URL when redirecting to the update page', async () => {
      res.locals.checkIn = { status: 'EXPIRED' }
      const req = httpMocks.createRequest({
        params: { crn, id: uuid },
        session: { data: {} },
        query: { back: mpopBack },
      })
      await controllers.checkIns.getReviewIdentityCheckIn(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(
        `/case/${crn}/appointments/${uuid}/check-in/update?back=${encodeURIComponent(mpopBack)}`,
      )
    })

    it('does not redirect to an off-site back URL from the notes page', async () => {
      res.locals.checkIn = { status: 'SUBMITTED' }
      const req = httpMocks.createRequest({
        params: { crn, id: uuid },
        session: { data: {} },
        query: { back: 'https://evil.example.com' },
      })
      await controllers.checkIns.getReviewNotesCheckIn(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/${uuid}/check-in/review/identity`)
    })

    it.each([
      ['/case/:crn/appointments/:id/check-in/view-expired', '/VIEW-EXPIRED/', 'view-expired'],
      ['/case/:crn/appointments/:id/check-in/view', '/View/', 'view'],
    ])('redirects to the matched route %s after saving a note', async (routePath, pathSuffix, page) => {
      jest.spyOn(ESupervisionClient.prototype, 'postOffenderCheckInNote').mockResolvedValueOnce(undefined)
      const req = httpMocks.createRequest({
        method: 'POST',
        url: `/case/${crn}/appointments/${uuid}/check-in${pathSuffix}`,
        params: { crn, id: uuid },
        session: { data: {} },
        query: { back: mpopBack },
      })
      req.route = { path: routePath }
      await controllers.checkIns.postViewCheckIn(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(
        `/case/${crn}/appointments/${uuid}/check-in/${page}?back=${encodeURIComponent(mpopBack)}`,
      )
    })
  })
})
