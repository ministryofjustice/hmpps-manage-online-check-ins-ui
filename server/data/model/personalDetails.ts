import { Practitioner } from './esupervision'

export interface Name {
  forename: string
  middleName?: string
  surname: string
}

export interface PersonalDetails {
  crn: string
  name: Name
  dateOfBirth?: string
  mobile?: string | null
  email?: string | null
  practitioner?: Practitioner
}

export interface PersonalDetailsUpdateRequest {
  [index: string]: string | boolean
  practitionerId: string
  mobile?: string
  email?: string
}

export interface ProbationPractitioner {
  code: string
  name: Name
  unallocated: boolean
  username: string
  email?: string
}

// export interface HeaderDetails {
//   crn: string
//   dateOfBirth: string
//   tierScore: string
//   tierDetailsLink: string
//   overallRisk: string
// }
