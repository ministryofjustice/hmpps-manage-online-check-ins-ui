import { type Router } from 'express'
import type { Services } from '../services'
import validate from '../middleware/validation'
import autoStoreSessionData from '../middleware/autoStoreSessionData'
import controllers from '../controllers'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'
import getCheckIn from '../middleware/getCheckIn'


export default function eSuperVisionCheckInsRoutes(router: Router, { hmppsAuthClient }: Services) {
  router.get('/', async (req, res) => {
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
}
