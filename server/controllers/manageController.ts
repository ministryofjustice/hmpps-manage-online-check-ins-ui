import type { RequestHandler } from 'express'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import { TemporaryOffenderResponse } from '../data/model/esupervision'

const offenderDetails = (crn: string, offender: TemporaryOffenderResponse['offender']) => [
  {
    label: 'CRN',
    value: offender.crn ?? crn,
  },
  {
    label: 'Status',
    value: offender.status,
  },
  {
    label: 'First check in',
    value: offender.firstCheckin,
  },
  {
    label: 'Check in interval',
    value: offender.checkinInterval,
  },
  {
    label: 'Contact preference',
    value: offender.contactPreference,
  },
]

export default {
  getViewCase:
    ({ esupervisionService }: Pick<Services, 'esupervisionService'>): RequestHandler =>
    async (req, res) => {
      const { crn } = req.params as Record<string, string>

      const offenderResponse = await esupervisionService.getOffenderByCrn(crn)

      const { offender, tierCalculation, risksWidget, riskData, headerTierLink } = offenderResponse

      return res.render('pages/viewCase', {
        title: 'Appointments',

        popHeader: true,

        headerCRN: offender.crn ?? crn,
        headerDob: offender.dateOfBirth ?? '1980-01-01',
        headerPersonName: {
          forename: offender.forename ?? 'Joe',
          surname: offender.surname ?? 'Bloggs',
        },

        headerTierLink,
        tierCalculation,
        risksWidget,
        riskData,

        offenderDetails: offenderDetails(crn, offender),
      })
    },
}
