import { type Router } from 'express'
import type { Services } from '../services'
import validate from '../middleware/validation'
import autoStoreSessionData from '../middleware/autoStoreSessionData'
import controllers from '../controllers'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'
import getCheckIn from '../middleware/getCheckIn'
import config from '../config'

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
    controllers.checkIns.getStopCheckinPage(hmppsAuthClient),
  ])

  router.post(
    '/case/:crn/appointments/check-in/manage/:id/stop-checkin',
    autoStoreSessionData(hmppsAuthClient),
    validate.eSuperVision,
    controllers.checkIns.postManageStopCheckin(hmppsAuthClient),
  )

  router.get('/case/:crn/appointments/:id/check-in/review/identity', [
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewIdentityCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/identity', [
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewIdentityCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/notes', [
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewNotesCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/notes', [
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/review/expired', [
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getReviewExpiredCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/review/expired', [
    getCheckIn(hmppsAuthClient),
    validate.checkInReview,
    autoStoreSessionData(hmppsAuthClient),
    controllers.checkIns.postReviewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/update', [
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getUpdateCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/view', [
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getViewCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/view', [
    getCheckIn(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    validate.checkInReview,
    controllers.checkIns.postViewCheckIn(hmppsAuthClient),
  ])

  router.get('/case/:crn/appointments/:id/check-in/view-expired', [
    getCheckIn(hmppsAuthClient),
    controllers.checkIns.getViewExpiredCheckIn(hmppsAuthClient),
  ])

  router.post('/case/:crn/appointments/:id/check-in/view-expired', [
    getCheckIn(hmppsAuthClient),
    autoStoreSessionData(hmppsAuthClient),
    validate.checkInReview,
    controllers.checkIns.postViewCheckIn(hmppsAuthClient),
  ])
}
