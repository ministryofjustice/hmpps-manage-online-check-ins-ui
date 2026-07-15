import { type Router } from 'express'
import type { Services } from '../services'
import validate from '../middleware/validation'
import autoStoreSessionData from '../middleware/autoStoreSessionData'
import controllers from '../controllers'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'
import getCheckIn from '../middleware/getCheckIn'
import config from '../config'
import getOffenderDetails from '../middleware/getOffenderDetails'
import validateCrnAndId from '../middleware/validateCrnAndId'

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
    getOffenderDetails(hmppsAuthClient),
    controllers.checkIns.getStopCheckinPage(hmppsAuthClient),
  ])

  router.post(
    '/case/:crn/appointments/check-in/manage/:id/stop-checkin',
    validateCrnAndId,
    autoStoreSessionData(hmppsAuthClient),
    getOffenderDetails(hmppsAuthClient),
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
}
