import { type Router } from 'express'
import type { Services } from '../services'
import validate from '../middleware/validation'
import autoStoreSessionData from '../middleware/autoStoreSessionData'
import controllers from '../controllers'
import getCheckIn from '../middleware/getCheckIn'
import validateCrnAndId from '../middleware/validateCrnAndId'

import getPersonalDetails from '../middleware/getPersonalDetails'
import restrictPageAccess from '../middleware/restrictPageAccess'
import postRedirectWizard from '../middleware/checkinCyaRedirect'

import { getCheckInQuestionsRedirect } from '../middleware/getCheckInQuestionsRedirect'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'

export default function eSuperVisionCheckInsRoutes(router: Router, { hmppsAuthClient }: Services) {
  router.get('/', async (req, res) => {
    // we should use this redirect for the root route when we're ready to deploy
    // const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
    // return res.redirect(mpopBaseUrl)
    res.render('pages/index')
  })

  // Setup flow: eligibility -> rationale -> schedule -> contact -> photo -> summary -> confirmation.
  // getPersonalDetails supplies res.locals.case, which every page renders in its heading.
  router.get('/case/:crn/appointments/check-in/eligibility-check', [controllers.checkIns.getStartSetup()])

  router.get('/case/:crn/appointments/:id/check-in/eligibility-check', [
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getEligibilityPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/eligibility-check',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postEligibilityPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/denied-eligibility', [
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getEligibilityDeniedPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/denied-eligibility',
    controllers.checkIns.postEligibilityDeniedPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/full-eligibility', [
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getFullEligibilityPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/full-eligibility',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postFullEligibilityPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/supplementary-eligibility', [
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getSupplementaryEligibilityPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/supplementary-eligibility',
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postSupplementaryEligibilityPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/spo-approval', [
    restrictPageAccess({ requiredValues: ['eligibility', 'eligibilityChoice'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getSPOApprovalPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/spo-approval',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    postRedirectWizard(),
    controllers.checkIns.postSPOApprovalPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/rationale', [
    restrictPageAccess({ requiredValues: ['id'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getRationalePage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/rationale',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    postRedirectWizard(),
    controllers.checkIns.postRationalePage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/date-frequency', [
    restrictPageAccess({ requiredValues: ['id'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getDateFrequencyPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/date-frequency',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    postRedirectWizard(),
    controllers.checkIns.postDateFrequencyPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/contact-preference', [
    restrictPageAccess({ requiredValues: ['date', 'interval'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getContactPreferencePage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/contact-preference',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    postRedirectWizard(),
    controllers.checkIns.postContactPreferencePage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/edit-contact-preference', [
    restrictPageAccess({ requiredValues: ['date', 'interval'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getEditContactPrePage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/edit-contact-preference',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postEditContactPrePage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/:id/check-in/photo-options', [
    restrictPageAccess({ requiredValues: ['preferredComs'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getPhotoOptionsPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/photo-options',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postPhotoOptionsPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/take-a-photo', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getTakePhotoPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/take-a-photo',
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postTakeAPhotoPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/upload-a-photo', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getUploadPhotoPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/upload-a-photo',
    getPersonalDetails(hmppsAuthClient),
    validate.eSuperVision,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postUploadaPhotoPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/photo-rules', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getPhotoRulesPage(),
  ])
  router.post(
    '/case/:crn/appointments/:id/check-in/photo-rules',
    getPersonalDetails(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postPhotoRulesPage(),
  )

  router.get('/case/:crn/appointments/:id/check-in/checkin-summary', [
    restrictPageAccess({ requiredValues: ['photoUploadOption'] }),
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getCheckinSummaryPage(),
  ])

  // Called via fetch from assets/js/photo.js, which then PUTs the photo to the returned URL.
  router.post(
    '/case/:crn/appointments/:id/check-in/confirm-start',
    controllers.checkIns.postCheckinSummaryPage(hmppsAuthClient),
  )

  router.post('/case/:crn/appointments/:id/check-in/confirm-end', [
    getPersonalDetails(hmppsAuthClient),
    controllers.checkIns.getConfirmationPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage', [
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getManageCheckinPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id', [
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getManageCheckinPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/stop-checkin', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getStopCheckinPage(hmppsAuthClient),
  ])

  router.post(
    '/case/:crn/appointments/check-in/manage/:id/stop-checkin',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    getCheckinOffenderDetails(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageStopCheckin(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/settings', [
    validateCrnAndId,
    controllers.checkIns.getManageCheckinDatePage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/settings',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageCheckinDatePage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/contact', [
    validateCrnAndId,
    controllers.checkIns.getManageContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/contact',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/edit-contact', [
    validateCrnAndId,
    controllers.checkIns.getManageEditContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/edit-contact',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageEditContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-checkin', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getRestartCheckinPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-checkin',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartCheckinPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-contact', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getRestartContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-contact',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-edit-contact', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getRestartEditContactPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-edit-contact',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartEditContactPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-summary', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getRestartSummaryPage(hmppsAuthClient),
  ])
  router.post(
    '/case/:crn/appointments/check-in/manage/:id/restart-summary',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postRestartSummaryPage(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/check-in/manage/:id/restart-confirmation', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getRestartConfirmation(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/identity', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewIdentityCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/identity', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewIdentityCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/notes', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewNotesCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/notes', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/expired', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewExpiredCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/expired', [
    validateCrnAndId,
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
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getViewCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/view', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    validate.checkInReview,
    controllers.checkIns.postViewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/view-expired', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getViewExpiredCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/view-expired', [
    validateCrnAndId,
    getCheckIn(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    validate.checkInReview,
    controllers.checkIns.postViewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/start', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getStartQuestionsPage(hmppsAuthClient),
  ])
  router.post('/case/:crn/appointments/check-in/manage/:id/questions/start', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postStartQuestionsPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/add', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getAddQuestionsPage(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/check-in/manage/:id/questions/add', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postAddQuestionsPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/list', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getQuestionsListPage(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/check-in/manage/:id/questions/list', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postQuestionsListPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/:questionId/edit', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getEditQuestionPage(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/check-in/manage/:id/questions/:questionId/edit', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postEditQuestionPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/:templateId/select', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getSelectQuestionPage(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/:questionId/delete', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getDeleteQuestion(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/check-in/manage/:id/questions/preview/feeling', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getPreviewFeelingPage(hmppsAuthClient),
  ])
  router.get('/case/:crn/appointments/check-in/manage/:id/questions/preview/support', [
    validateCrnAndId,
    getCheckinOffenderDetails(hmppsAuthClient),
    getCheckInQuestionsRedirect(hmppsAuthClient),
    controllers.checkIns.getPreviewSupportPage(hmppsAuthClient),
  ])
}
