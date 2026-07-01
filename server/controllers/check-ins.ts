import { DeactivateOffenderRequest, OffenderCheckinsByCRNResponse } from '../data/model/esupervision'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from '../middleware/renderError'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import ESupervisionClient from '../data/eSupervisionClients'
import { Controller } from '../@types/Controller.type'

const routes = ['getManageCheckinPage', 'postManageStopCheckin', 'getStopCheckinPage'] as const

// const offenderDetails = (crn: string, offender: TemporaryOffenderResponse['offender']) => [
//   {
//     label: 'CRN',
//     value: offender.crn ?? crn,
//   },
//   {
//     label: 'Status',
//     value: offender.status,
//   },
//   {
//     label: 'First check in',
//     value: offender.firstCheckin,
//   },
//   {
//     label: 'Check in interval',
//     value: offender.checkinInterval,
//   },
//   {
//     label: 'Contact preference',
//     value: offender.contactPreference,
//   },
// ]

const handleQuotes = (value?: string): string => value?.replace(/"/g, '\\"') ?? ''

const checkInsController: Controller<typeof routes, void> = {
  // getViewCase:
  //   ({ esupervisionService }: Pick<Services, 'esupervisionService'>): RequestHandler =>
  //   async (req, res) => {
  //     const { crn } = req.params as Record<string, string>

  //     const offenderResponse = await esupervisionService.getOffenderByCrn(crn)

  //     const { offender, tierCalculation, risksWidget, riskData, headerTierLink } = offenderResponse

  //     return res.render('pages/viewCase', {
  //       title: 'Appointments',

  //       popHeader: true,

  //       headerCRN: offender.crn ?? crn,
  //       headerDob: offender.dateOfBirth ?? '1980-01-01',
  //       headerPersonName: {
  //         forename: offender.forename ?? 'Joe',
  //         surname: offender.surname ?? 'Bloggs',
  //       },

  //       headerTierLink,
  //       tierCalculation,
  //       risksWidget,
  //       riskData,

  //       offenderDetails: offenderDetails(crn, offender),
  //     })
  //   },

  getManageCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn } = req.params as Record<string, string>
      const offenderCheckinsByCRNResponse = res.locals.offenderCheckinsByCRNResponse as OffenderCheckinsByCRNResponse

      return res.render('pages/check-in/index.njk', {
        crn,
        id: offenderCheckinsByCRNResponse.uuid,
        offenderCheckinsByCRNResponse,
      })
    }
  },
  getStopCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      // await sendAuditMessage(res, 'VIEW_MAS_MANAGE_STOP_CHECK_IN', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.render('pages/check-in/manage/stop-checkin.njk', {
        crn,
        id,
        case: {
          name: {
            forename: 'the person',
          },
        },
      })
    }
  },

  postManageStopCheckin: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }

      const reasonData = getDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin', 'stopCheckinReason'])

      let isSensitive = false
      const sensitiveData = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'manageCheckin',
        'stopCheckinSensitive',
      ])
      isSensitive = sensitiveData === 'true'

      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)

      const body: DeactivateOffenderRequest = {
        requestedBy: res.locals.user.username,
        reason: handleQuotes(reasonData),
        sensitive: isSensitive,
      }
      res.locals.offenderCheckinsByCRNResponse = await eSupervisionClient.postDeactivateOffender(id, body)
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], null)
      return res.redirect(`/case/${crn}/appointments/check-in/manage`)
    }
  },
}

export default checkInsController
