import { type Router } from 'express'
import type { Services } from '../services'
import validate from '../middleware/validation'
import autoStoreSessionData from '../middleware/autoStoreSessionData'
import controllers from '../controllers'
import getCheckIn from '../middleware/getCheckIn'
import validateCrnAndId from '../middleware/validateCrnAndId'
import { getCheckInQuestionsRedirect } from '../middleware/getCheckInQuestionsRedirect'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'

export default function eSuperVisionCheckInsRoutes(router: Router, { hmppsAuthClient }: Services) {
  router.get('/', async (req, res) => {
    // we should use this redirect for the root route when we're ready to deploy
    // const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
    // return res.redirect(mpopBaseUrl)
    res.render('pages/index')
  })

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
