import type { RequestHandler } from 'express'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import { ESupervisionCheckIn } from '../data/model/esupervision'

function systemIdCheckPass(checkIn: ESupervisionCheckIn): boolean {
  if (checkIn.livenessEnabled) {
    return checkIn.livenessResult === 'LIVE' && checkIn.autoIdCheck === 'MATCH'
  }
  return checkIn.autoIdCheck === 'MATCH'
}

export default {
  getReviewIdentity:
    ({ esupervisionService, auditService }: Pick<Services, 'esupervisionService' | 'auditService'>): RequestHandler =>
    async (req, res) => {
      const { crn, checkinId } = req.params as Record<string, string>
      const backLink = typeof req.query.back === 'string' ? req.query.back : undefined

      const checkIn = await esupervisionService.getCheckIn(checkinId, true)

      await auditService.logPageView(Page.REVIEW_CHECKIN_IDENTITY, {
        who: res.locals.user.username,
        subjectId: crn,
        subjectType: 'CRN',
        correlationId: req.id,
      })

      return res.render('pages/review/identity', {
        crn,
        checkinId,
        backLink,
        checkIn,
        systemIdCheckPass: systemIdCheckPass(checkIn),
      })
    },
}
