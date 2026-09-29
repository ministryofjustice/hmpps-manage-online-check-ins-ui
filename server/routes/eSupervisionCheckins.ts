import { type Router } from 'express'
import type { Services } from '../services'
import config from '../config'
import validate from '../middleware/validation'
import autoStoreSessionData from '../middleware/autoStoreSessionData'
import controllers from '../controllers'
import getCheckIn from '../middleware/getCheckIn'
import validateCrnAndId from '../middleware/validateCrnAndId'

import { getPersonalDetails } from '../middleware/getPersonalDetails'
import restrictPageAccess from '../middleware/restrictPageAccess'
import postRedirectWizard from '../middleware/checkinCyaRedirect'

import { getCheckInQuestionsRedirect } from '../middleware/getCheckInQuestionsRedirect'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'
import validateOffenderCheckin from '../middleware/validateOffenderCheckin'
import restrictEligibilityAccess from '../middleware/restrictEligibilityAccess'
import { getSupervisionPackageStatus } from '../middleware/getSupervisionPackageStatus'

export default function eSuperVisionCheckInsRoutes(router: Router, { hmppsAuthClient, arnsComponents }: Services) {
  router.get('/', async (req, res) => {
    const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
    return res.redirect(mpopBaseUrl)
  })

  // The cases overview page lives in MPOP - redirect /case hits there
  router.get('/case', (req, res) => {
    const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
    return res.redirect(`${mpopBaseUrl}/case`)
  })

  // The case overview itself lives in MPOP, not this service - send bare /case/:crn hits there
  // rather than every view having to know MPOP's URL when it links back to the overview page.
  router.get('/case/:crn', (req, res) => {
    const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
    return res.redirect(`${mpopBaseUrl}/case/${encodeURIComponent(req.params.crn)}`)
  })

  // Setup flow: eligibility -> rationale -> schedule -> contact -> photo -> summary -> confirmation.
  // getPersonalDetails supplies res.locals.case, which every page renders in its heading.
  router.get('/case/:crn/appointments/check-in/eligibility-check', [controllers.checkIns.getStartSetup()])

  router.get('/case/:crn/appointments/:id/check-in/instructions', [
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getInstructionsPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/instructions',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postInstructionsPage(),
  )

  // The eligibility pages are one route each rather than one per tier - the controller picks
  // the template for the person's tier band, so the URLs stay stable across tiers and back
  // links, ?cya= links and restrictPageAccess don't need to know about bands.
  router.get('/case/:crn/appointments/:id/check-in/eligibility-check', [
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getSupervisionPackageStatus(hmppsAuthClient),
    controllers.checkIns.getEligibilityPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/eligibility-check',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getSupervisionPackageStatus(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postEligibilityPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/pilot-check', [
    restrictPageAccess({ requiredValues: ['eligibility'] }),
    restrictEligibilityAccess('pilot-check'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getPilotCheckPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/pilot-check',
    restrictEligibilityAccess('pilot-check'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postPilotCheckPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/is-eligible', [
    restrictPageAccess({ requiredValues: ['eligibility'] }),
    restrictEligibilityAccess('is-eligible'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getIsEligiblePage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/is-eligible',
    restrictEligibilityAccess('is-eligible'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postIsEligiblePage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/not-eligible', [
    restrictPageAccess(),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getNotEligiblePage(),
  ])
  router.post('/case/:crn/appointments/:id/check-in/not-eligible', controllers.checkIns.postNotEligiblePage())

  router.get('/case/:crn/appointments/:id/check-in/discuss-before-signup', [
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getDiscussBeforeSignupPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/discuss-before-signup',
    controllers.checkIns.postDiscussBeforeSignupPage(),
  )

  // From here to the summary the person must actually be eligible and their practitioner must have
  // confirmed they have had their discussion - restrictPageAccess alone would let a not-eligible case that has an
  // id in session deep-link past the eligibility gates and complete a setup.
  router.get('/case/:crn/appointments/:id/check-in/accredited-programme-approval', [
    restrictPageAccess({ requiredValues: ['id'] }),
    restrictEligibilityAccess('setup'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getAccreditedProgrammeApprovalPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/accredited-programme-approval',
    restrictEligibilityAccess('setup'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    postRedirectWizard(),
    controllers.checkIns.postAccreditedProgrammeApprovalPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/rationale', [
    restrictPageAccess({ requiredValues: ['id'] }),
    restrictEligibilityAccess('setup'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getRationalePage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/rationale',
    restrictEligibilityAccess('setup'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    postRedirectWizard(),
    controllers.checkIns.postRationalePage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/date-frequency', [
    restrictPageAccess({ requiredValues: ['id'] }),
    restrictEligibilityAccess('setup'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getDateFrequencyPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/date-frequency',
    restrictEligibilityAccess('setup'),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    postRedirectWizard(),
    controllers.checkIns.postDateFrequencyPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/contact-preference', [
    restrictPageAccess({ requiredValues: ['date', 'interval'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getContactPreferencePage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/contact-preference',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postContactPreferencePage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/confirm-contact-preference', [
    restrictPageAccess({ requiredValues: ['date', 'interval'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getConfirmContactPreferencePage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/confirm-contact-preference',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postConfirmContactPreferencePage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/edit-contact-preference', [
    restrictPageAccess({ requiredValues: ['date', 'interval'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getEditContactPrePage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/edit-contact-preference',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postEditContactPrePage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/:id/check-in/photo-options', [
    restrictPageAccess({ requiredValues: ['preferredComs', 'confirmPreferredComs'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getPhotoOptionsPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/photo-options',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postPhotoOptionsPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/take-a-photo', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getTakePhotoPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/take-a-photo',
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postTakeAPhotoPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/upload-a-photo', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getUploadPhotoPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/upload-a-photo',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postUploadaPhotoPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/photo-rules', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getPhotoRulesPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/photo-rules',
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postPhotoRulesPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/checkin-summary', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getCheckinSummaryPage(),
  ])

  // Called via fetch from assets/js/photo.js, which then PUTs the photo to the returned URL.
  router.post(
    '/case/:crn/appointments/:id/check-in/confirm-start',
    controllers.checkIns.postCheckinSummaryPage(hmppsAuthClient),
  )

  router.post('/case/:crn/appointments/:id/check-in/confirm-end', [
    controllers.checkIns.postConfirmEnd(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/confirm-end', [
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getConfirmationPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage', [
    getCheckinOffenderDetails(hmppsAuthClient),
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getManageCheckinPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getManageCheckinPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/stop-checkin', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getStopCheckinPage(hmppsAuthClient),
  ])

  router.post(
    '/case/:crn/appointments/check-in/manage/:id/stop-checkin',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    controllers.checkIns.postManageStopCheckin(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/settings', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getManageCheckinDatePage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/settings',
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageCheckinDatePage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/contact', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getManageContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/contact',
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/edit-contact', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getManageEditContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/edit-contact',
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageEditContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-checkin', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getRestartCheckinPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-checkin',
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartCheckinPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-contact', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getRestartContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-contact',
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-edit-contact', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getRestartEditContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-edit-contact',
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartEditContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-summary', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getRestartSummaryPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-summary',
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartSummaryPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-confirmation', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    controllers.checkIns.getRestartConfirmation(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/identity', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewIdentityCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/identity', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewIdentityCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/notes', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewNotesCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/notes', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/expired', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewExpiredCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/expired', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/update', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getUpdateCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/view', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getViewCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/view', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    validate.checkInReview,
    controllers.checkIns.postViewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/view-expired', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getViewExpiredCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/view-expired', [
    validateCrnAndId,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckIn(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    validate.checkInReview,
    controllers.checkIns.postViewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/start', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getStartQuestionsPage(hmppsAuthClient),
  ])
  router.post('/case/:crn/appointments/check-in/manage/:id/questions/start', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postStartQuestionsPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/add', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getAddQuestionsPage(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/check-in/manage/:id/questions/add', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postAddQuestionsPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/list', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getQuestionsListPage(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/check-in/manage/:id/questions/list', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postQuestionsListPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/:questionId/edit', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getEditQuestionPage(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/check-in/manage/:id/questions/:questionId/edit', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    validate.eSuperVision,
    controllers.checkIns.postEditQuestionPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/:templateId/select', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getSelectQuestionPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/:questionId/delete', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getDeleteQuestion(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/preview/feeling', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getPreviewFeelingPage(hmppsAuthClient),
  ])
  router.get('/case/:crn/appointments/check-in/manage/:id/questions/preview/support', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validateOffenderCheckin,
    getPersonalDetails(hmppsAuthClient, arnsComponents),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getPreviewSupportPage(hmppsAuthClient),
  ])
}
