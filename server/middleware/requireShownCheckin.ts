import { Route } from '../@types'
import logger from '../../logger'
import escapeForLog from '../utils/escapeForLog'
import setDataValue from '../utils/setDataValue'

// The cancel page posts the uuid of the check-in it showed. Only that one may be cancelled: if it was
// submitted, missed or cancelled since, or check-ins stopped, the person's upcoming check-in may now
// be a different one, or there may be none. Such a post goes back to the overview, which explains.
//
// Runs before validation, so a post with errors can't re-render the page bound to a newer check-in.
// Assumes getCancellableCheckin has already set res.locals.cancellableCheckin.
const requireShownCheckin: Route<void> = (req, res, next) => {
  const { crn, id } = req.params as Record<string, string>
  const shownUuid = typeof req.body?.checkinUuid === 'string' ? req.body.checkinUuid : undefined
  const checkIn = res.locals.cancellableCheckin
  if (checkIn && checkIn.uuid === shownUuid) {
    return next()
  }
  logger.info(`Not cancelling check in ${escapeForLog(shownUuid)} for ${crn}: it is no longer the upcoming one`)
  setDataValue(req.session.data, ['esupervision', crn, id, 'checkInCancelRefused'], true)
  setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], null)
  return res.redirect(303, `/case/${crn}/appointments/check-in/manage/${id}`)
}

export default requireShownCheckin
