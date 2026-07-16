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
  mobileNumber?: string
  emailAddress?: string
}

export interface ProbationPractitioner {
  code: string
  name: Name
  unallocated: boolean
  username: string
  email?: string
}
