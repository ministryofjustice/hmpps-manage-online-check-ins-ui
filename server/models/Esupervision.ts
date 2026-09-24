import { Errors } from './Errors'
import { EsupervisionQuestionTemplatesList } from '../data/model/esupervision'

export interface ESupervisionSession {
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
  preferredComs?: string
  checkInMobile?: string
  checkInEmail?: string
  photoUploadOption?: string
  displayCommsOption?: string
  displayDay?: string
  contactUpdated?: boolean
  settingsUpdated?: boolean
  eligibility?: string[]
  // The ESUP supervision-package answers, recorded by the eligibility-check pages so that
  // restrictEligibilityAccess can re-derive the outcome without fetching them again.
  onSupervisionPackage?: boolean
  inFinalThird?: boolean
  inEarlyEngagement?: boolean
  eligibilityChoice?: 'REPLACE_F2F' | 'SUPPLEMENT_F2F'
  eligibilitySPOApproval?: any
  rationale?: string
}

export interface ManageQuestionsSession {
  availableTemplates?: EsupervisionQuestionTemplatesList[]
  questionTemplateAndInputs?: Record<string, string>
  draftQuestionInput?: string
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
  tierBand?: string
  questionId?: string
  question?: {
    prefix: string
    suffix: string
  }
  accreditedProgramme?: boolean
}
