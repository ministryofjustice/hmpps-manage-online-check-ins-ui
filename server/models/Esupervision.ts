import { Errors } from './Errors'
import { EsupervisionQuestionTemplatesList, SupervisionPackageStatus } from '../data/model/esupervision'

export interface ESupervisionSession {
  // Server-owned response from the supervision-package endpoint. The access guard uses it to
  // re-derive the outcome without fetching the endpoint again. See SERVER_OWNED_KEYS in
  // middleware/autoStoreSessionData.
  supervisionPackageStatus?: SupervisionPackageStatus
  checkins?: CheckinUserDetails
  manageCheckin?: CheckinUserDetails
  restartCheckin?: CheckinUserDetails
  manageQuestions?: ManageQuestionsSession
  // Server-owned: recorded by the controllers, never posted. See SERVER_OWNED_KEYS in
  // middleware/autoStoreSessionData.
  questionsAdded?: boolean
  setupStartedAt?: string
}

export interface CheckinUserDetails {
  uuid?: string
  date?: string
  dateDt?: Date
  interval?: string
  isAdHoc?: boolean
  preferredComs?: string
  checkInMobile?: string
  checkInEmail?: string
  photoUploadOption?: string
  displayCommsOption?: string
  displayDay?: string
  contactUpdated?: boolean
  settingsUpdated?: boolean
  eligibility?: string[]
  eligibilityChoice?: 'REPLACE_F2F' | 'SUPPLEMENT_F2F'
  eligibilitySPOApproval?: any
  rationale?: string
}

export interface ManageQuestionsSession {
  availableTemplates?: EsupervisionQuestionTemplatesList[]
  questionTemplateAndInputs?: Record<string, string>
  draftQuestionInput?: string
  // What was typed into "Write your own question" on the choose-a-question page
  bespokeQuestionInput?: string
  expectedCheckinDate?: string
}
export interface LocalParams {
  crn: string
  id: string
  errors?: Errors
  body?: Record<string, string | string[]>
  checkInMinDate?: string
  back?: string
  backLink?: string
  change?: string
  cya?: string
  checkInMobile?: string
  checkInEmail?: string
  contactSaved?: string
  editCheckInMobile?: string
  editCheckInEmail?: string
  preferredComs?: string
  contactPreference?: string
  contactValue?: string
  hasContactDetails?: boolean
  isAdHoc?: boolean
  tierBand?: string
  questionId?: string
  question?: {
    prefix: string
    suffix: string
    example?: string
  }
  // The question being edited was written by the practitioner rather than built from a template
  isBespoke?: boolean
  // Re-rendering the choose-a-question page with errors needs its templates
  templatesList?: { templates: Record<string, unknown>[] }
  accreditedProgramme?: boolean
}
