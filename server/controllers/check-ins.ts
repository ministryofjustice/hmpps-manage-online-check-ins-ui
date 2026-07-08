import { DeactivateOffenderRequest, OffenderByCRNResponse } from '../data/model/esupervision'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from '../middleware/renderError'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import ESupervisionClient from '../data/eSupervisionClient'
import { Controller } from '../@types/Controller.type'
import config from '../config'

const routes = ['getManageCheckinPage', 'postManageStopCheckin', 'getStopCheckinPage'] as const

const handleQuotes = (value?: string): string => value?.replace(/"/g, '\\"') ?? ''

const checkInsController: Controller<typeof routes, void> = {
  getManageCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn } = req.params as Record<string, string>

      const offenderDetails = res.locals.offenderByCRNResponse

      if (!offenderDetails) {
        return renderError(404)(req, res)
      }

      return res.render('pages/check-in/index.njk', {
        crn,
        id: offenderDetails.uuid,
        case: offenderDetails.details,
        offenderByCRNResponse: offenderDetails,
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
      const offenderDetails = res.locals.offenderByCRNResponse
      const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
      const redirectUrl = `${mpopBaseUrl}/case/${crn}`
      if (offenderDetails.status !== 'VERIFIED') {
        return res.redirect(303, redirectUrl)
      }
      return res.render('pages/check-in/manage/stop-checkin.njk', {
        crn: offenderDetails.crn,
        id: offenderDetails.uuid,
        case: offenderDetails.details,
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
      res.locals.offenderByCRNResponse = await eSupervisionClient.postDeactivateOffender(id, body)
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], null)
      const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
      const redirectUrl = `${mpopBaseUrl}/case/${crn}`
      return res.redirect(303, redirectUrl)
    }
  },
}

export default checkInsController
