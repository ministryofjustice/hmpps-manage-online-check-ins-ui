export interface Name {
  forename: string
  middleName?: string
  surname: string
}

export interface PersonalDetails {
  crn: string
  name: Name
  dateOfBirth?: string
  mobile?: string
  email?: string
}

export interface ContactDetailsUpdateRequest {
  [index: string]: string | boolean
  practitionerId: string
  mobile?: string
  email?: string
}

export interface ContactDetailsUpdateResponse {
  crn: string
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
