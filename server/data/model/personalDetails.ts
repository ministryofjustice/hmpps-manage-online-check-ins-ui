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
  events?: NdeliusEvents
}

export interface PersonalDetailsUpdateRequest {
  [index: string]: string | boolean
  practitionerId: string
  mobile?: string
  email?: string
}

export interface PDU {
  code: string
  description?: string
}

export interface ProbationPractitioner {
  code: string
  name: Name
  unallocated: boolean
  username: string
  email?: string
  probationDeliveryUnit?: PDU
}

export interface NdeliusEvents {
  events: NdeliusEvent[]
}

export interface NdeliusEvent {
  number: number
  mainOffence: CodedDescription
  sentence: Sentence | null
}

export interface CodedDescription {
  code: string
  description: string
}

export interface Sentence {
  date: string
  description: string
  expectedEndDate: string | null
  length: number | null
  lengthUnit: string | null
}
