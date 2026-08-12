export interface Name {
  forename: string
  middleName?: string
  surname: string
}

export interface PersonalDetails {
  crn: string
  name: Name
  dateOfBirth?: string
  mobileNumber?: string
  telephoneNumber?: string
  email?: string
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
