import { HmppsAuthClient } from '../data'
import { Route } from '../@types'
import ESupervisionClient from '../data/eSupervisionClient'
import { OffenderSetupAnswers } from '../data/model/esupervision'
import { eligibilityAnswersFromSelections } from '../utils/eligibilityRules'
import logger from '../../logger'

export const postCheckinInComplete = (hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, res) => {
    const { crn, id } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)
    const savedUserDetails = req.session.data?.esupervision?.[crn]?.[id]?.checkins
    const answers: OffenderSetupAnswers = {
      rationale: savedUserDetails?.rationale,
      eligibilityAnswers: eligibilityAnswersFromSelections(savedUserDetails?.eligibility),
    }
    await eSupervisionClient.postOffenderSetupComplete(id, answers)
    logger.info('Checkin Registration completed successfully.')
  }
}
