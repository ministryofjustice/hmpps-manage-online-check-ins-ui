import { asUser } from '@ministryofjustice/hmpps-rest-client'
import { ArnsComponents, RiskData } from '@ministryofjustice/hmpps-arns-frontend-components-lib'
import { Route } from '../@types'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClient'
import renderError from './renderError'
import { OffenderByCRNResponse, OffenderHeaderDetails } from '../data/model/esupervision'

export const getPersonalDetails = (
  hmppsAuthClient: HmppsAuthClient,
  arnsComponents: ArnsComponents,
): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)

    let offenderDetails: OffenderByCRNResponse
    let headerDetails: OffenderHeaderDetails
    let riskData : RiskData
    if (!req?.session?.data?.personalDetails?.[crn] || process.env.NODE_ENV === 'development') {
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const authOptions = asUser(res.locals.user.token)
      ;[offenderDetails, headerDetails, riskData] = await Promise.all([
        eSupervisionClient.getOffenderByCRN(crn),
        eSupervisionClient.getOffenderHeaderByCRN(crn),
        arnsComponents.getRiskData(authOptions, 'crn', crn),
      ])
      req.session.data = {
        ...(req?.session?.data ?? {}),
        personalDetails: {
          ...(req?.session?.data?.personalDetails ?? {}),
          [crn]: {
            offenderDetails,
            headerDetails,
            riskData,
          },
        },
      }
    } else {
      ;({ offenderDetails, headerDetails, riskData } = req.session.data.personalDetails[crn])
    }
    
    res.locals.case = await eSupervisionClient.getPersonalDetails(crn)

    if (!res.locals.case) {
      return renderError(404)(req, res)
    }

    res.locals.riskData = riskData
    res.locals.headerPersonName = { 
      forename: offenderDetails.details.name.forename, 
      surname: offenderDetails.details.name.surname,
    }
    res.locals.headerCRN = crn
    res.locals.headerDob = headerDetails.dateOfBirth
    res.locals.tierScore = headerDetails.tierScore
    res.locals.tierDetailsLink = headerDetails.tierDetailsLink
    res.locals.overallRisk = headerDetails.overallRisk
    
    return next()
  }
}
