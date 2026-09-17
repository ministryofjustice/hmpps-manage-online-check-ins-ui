import { Route } from '../@types'
import getDataValue from '../utils/getDataValue'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from './renderError'
import { nextAfterEligibilityCheck, nextAfterPilotCheck, toSelections } from '../utils/eligibilityRules'

// pilot-check and is-eligible both depend on the eligibility answers (and, for is-eligible, the
// pilot-check answer) actually leading there - restrictPageAccess only checks that *some* answer
// was stored, not what it was, so a direct GET or POST with a session that merely looks complete
// can otherwise reach either page without having cleared the earlier gates. This re-derives the
// outcome from the stored answers and sends the practitioner to wherever that outcome actually
// leads, the same way the eligibility-check and pilot-check posts do.
const restrictEligibilityAccess = (page: 'pilot-check' | 'is-eligible'): Route<Promise<void>> => {
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

    const eligibility = nextAfterEligibilityCheck(band, toSelections(checkins.eligibility))

    if (eligibility.target === 'pilot-check') {
      if (page === 'pilot-check') {
        return next()
      }
      // is-eligible is only reachable once pilot-check has actually been answered.
      if (!checkins.pilotCheck) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/pilot-check`)
      }
      const pilotOutcome = nextAfterPilotCheck(band as 'AB' | 'C', String(checkins.pilotCheck))
      if (pilotOutcome.target !== 'is-eligible') {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/${pilotOutcome.target}`)
      }
      return next()
    }

    if (eligibility.target !== page) {
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/${eligibility.target}`)
    }
    return next()
  }
}

export default restrictEligibilityAccess
