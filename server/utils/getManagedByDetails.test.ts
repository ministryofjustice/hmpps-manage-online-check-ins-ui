import { getManagedByDetails } from './getManagedByDetails'
import config from '../config'
import { ProbationPractitioner } from '../data/model/personalDetails'

const href = `${config.managePeopleOnProbation.link}/case/X000001/personal-details/staff-contacts`

const practitioner: ProbationPractitioner = {
  code: 'N99TST1',
  name: { forename: 'Test', surname: 'Practitioner' },
  unallocated: false,
  username: 'TestPractitioner',
  probationDeliveryUnit: { code: 'PDU001', description: 'London Probation Delivery Unit' },
}

describe('utils/getManagedByDetails', () => {
  it('shows the practitioner name with the PDU description in brackets', () => {
    expect(getManagedByDetails('X000001', practitioner)).toEqual({
      text: 'Test Practitioner (London Probation Delivery Unit)',
      href,
    })
  })

  it('omits the brackets when there is no PDU description', () => {
    expect(getManagedByDetails('X000001', { ...practitioner, probationDeliveryUnit: { code: 'PDU001' } }).text).toEqual(
      'Test Practitioner',
    )
    expect(getManagedByDetails('X000001', { ...practitioner, probationDeliveryUnit: undefined }).text).toEqual(
      'Test Practitioner',
    )
  })

  it.each([
    ['unallocated', { ...practitioner, unallocated: true }],
    ['not found', null],
    ['not fetched', undefined],
  ])('shows Unallocated with the staff contacts link when %s', (_, input) => {
    expect(getManagedByDetails('X000001', input)).toEqual({ text: 'Unallocated', href })
  })
})
