import config from '../config'
import { ProbationPractitioner } from '../data/model/personalDetails'

export interface ManagedByDetails {
  text: string
  href: string
}

// Staff contacts in MPOP is the source of truth for who manages a case, so the header links there
// whether or not a practitioner is currently allocated.
const staffContactsHref = (crn: string): string =>
  `${config.managePeopleOnProbation.link.replace(/\/$/, '')}/case/${crn}/personal-details/staff-contacts`

export const getManagedByDetails = (
  crn: string,
  practitioner: ProbationPractitioner | null | undefined,
): ManagedByDetails => {
  const href = staffContactsHref(crn)
  if (!practitioner || practitioner.unallocated) {
    return { text: 'Unallocated', href }
  }
  const name = `${practitioner.name.forename} ${practitioner.name.surname}`.trim()
  const pdu = practitioner.probationDeliveryUnit?.description
  return { text: pdu ? `${name} (${pdu})` : name, href }
}
