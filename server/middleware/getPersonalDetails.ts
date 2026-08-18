import { AuthOptions, asUser } from '@ministryofjustice/hmpps-rest-client'
import { ArnsComponents } from '@ministryofjustice/hmpps-arns-frontend-components-lib'
import { Request, Response } from 'express'
import { Route } from '../@types'
import { HmppsAuthClient } from '../data'
import { CachedPersonalDetails } from '../data/Data'
import ESupervisionClient from '../data/eSupervisionClient'
import renderError from './renderError'
import { OffenderByCRNResponse } from '../data/model/esupervision'

type PartialOffenderByCRNResponse = Partial<OffenderByCRNResponse>

// Local dev sessions are long-lived, so a stale cache entry can hide API changes being worked on.
const shouldBypassCache = () => process.env.NODE_ENV === 'development'

function readCache(req: Request, crn: string): CachedPersonalDetails | undefined {
  return shouldBypassCache() ? undefined : req.session.data?.personalDetails?.[crn]
}

function writeCache(req: Request, crn: string, details: CachedPersonalDetails): void {
  req.session.data ??= {}
  req.session.data.personalDetails ??= {}
  req.session.data.personalDetails[crn] = details
}

async function fetchPersonalDetails(
  eSupervisionClient: ESupervisionClient,
  arnsComponents: ArnsComponents,
  authOptions: AuthOptions,
  crn: string,
): Promise<CachedPersonalDetails> {
  const [offenderDetails, headerDetails, riskData] = await Promise.all([
    eSupervisionClient.getOffenderByCRN(crn),
    eSupervisionClient.getOffenderHeaderByCRN(crn),
    arnsComponents.getRiskData(authOptions, 'crn', crn),
  ])
  return { offenderDetails, headerDetails, riskData }
}

// An offender record doesn't exist until setup is complete, so a missing record falls back
// to the personal-details-only endpoint rather than being treated as a 404 outright.
async function resolveOffenderDetails(
  eSupervisionClient: ESupervisionClient,
  crn: string,
  offenderDetails: PartialOffenderByCRNResponse | null,
): Promise<PartialOffenderByCRNResponse | null> {
  if (offenderDetails !== null) {
    return offenderDetails
  }
  const caseDetails = await eSupervisionClient.getPersonalDetails(crn)
  if (!caseDetails) {
    return null
  }
  return {
    details: {
      name: caseDetails.name,
      dateOfBirth: caseDetails.dateOfBirth,
      mobile: caseDetails.mobile,
      email: caseDetails.email,
    },
  }
}

// Every page renders the person's name/contact details in its heading via res.locals.case.
function applyHeaderLocals(res: Response, crn: string, details: CachedPersonalDetails): void {
  const { offenderDetails, headerDetails, riskData } = details
  res.locals.case = {
    crn,
    name: {
      forename: offenderDetails.details?.name?.forename ?? '',
      surname: offenderDetails.details?.name?.surname ?? '',
    },
    dateOfBirth: offenderDetails.details?.dateOfBirth ?? '',
    mobileNumber: offenderDetails.details?.mobile ?? '',
    email: offenderDetails.details?.email ?? '',
  }
  res.locals.riskData = riskData
  res.locals.headerPersonName = res.locals.case.name
  res.locals.headerCRN = crn
  res.locals.headerDob = res.locals.case.dateOfBirth
  res.locals.tierScore = headerDetails?.tierScore || ''
  res.locals.tierDetailsLink = headerDetails?.tierDetailsLink || ''
  res.locals.overallRisk = headerDetails?.overallRisk || ''
}

export const getPersonalDetails = (
  hmppsAuthClient: HmppsAuthClient,
  arnsComponents: ArnsComponents,
): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)

    let details = readCache(req, crn)
    if (!details) {
      const authOptions = asUser(res.locals.user.token)
      details = await fetchPersonalDetails(eSupervisionClient, arnsComponents, authOptions, crn)
      writeCache(req, crn, details)
    }

    const offenderDetails = await resolveOffenderDetails(eSupervisionClient, crn, details.offenderDetails)
    if (offenderDetails === null) {
      return renderError(404)(req, res)
    }

    applyHeaderLocals(res, crn, { ...details, offenderDetails })

    return next()
  }
}
