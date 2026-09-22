import { Route } from '../@types'
import getDataValue from '../utils/getDataValue'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from './renderError'
import {
  hasCompletedDiscussion,
  nextAfterEligibilityCheck,
  nextAfterPilotCheck,
  toSelections,
} from '../utils/eligibilityRules'

// Every page from pilot-check onwards depends on the eligibility answers (and, where there is one,
// the pilot-check answer) actually leading there - restrictPageAccess only checks that *some*
// answer was stored, not what it was, so a direct GET or POST with a session that merely looks
// complete can otherwise reach a page without having cleared the earlier gates. This re-derives the
// outcome from the stored answers and sends the practitioner to wherever that outcome actually
// leads, the same way the eligibility-check and pilot-check posts do.
//
// 'setup' covers the pages after is-eligible, which are only reachable by a person the rules
// found eligible *and* whose practitioner has confirmed the discussion; without it a not-eligible
// case could carry on from /date-frequency and complete a setup it was ruled out of.
const restrictEligibilityAccess = (page: 'pilot-check' | 'is-eligible' | 'setup'): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn, id } = req.params as Record<string, string>
    if (!isValidCrn(crn) || !isValidUUID(id)) {
      return renderError(404)(req, res)
    }

    const { data } = req.session
    const checkins = getDataValue(data, ['esupervision', crn, id, 'checkins'])
    const band = checkins?.tierBand

    if (!checkins || !band) {
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
    }

    // Recorded by postEligibilityPage from the ESUP call, since that answer is not fetched again on
    // the later pages this guards.
    const eligibility = nextAfterEligibilityCheck(
      band,
      Boolean(checkins.onSupervisionPackage),
      toSelections(checkins.eligibility),
    )
    let outcome = eligibility.target

    if (eligibility.target === 'pilot-check') {
      if (page === 'pilot-check') {
        return next()
      }
      // Anything past pilot-check is only reachable once it has actually been answered.
      if (!checkins.pilotCheck) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/pilot-check`)
      }
      outcome = nextAfterPilotCheck(band as 'AB' | 'C', String(checkins.pilotCheck)).target
    } else if (page === 'pilot-check') {
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/${eligibility.target}`)
    }

    if (outcome !== 'is-eligible') {
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/${outcome}`)
    }
    // The discussion checkboxes are answered on is-eligible, so that is where an unconfirmed
    // discussion goes back to rather than the discuss-before-signup dead end.
    const accreditedProgramme = Boolean(checkins.accreditedProgramme)
    if (page === 'setup' && !hasCompletedDiscussion(checkins.discussion, { accreditedProgramme })) {
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/is-eligible`)
    }
    return next()
  }
}

export default restrictEligibilityAccess
