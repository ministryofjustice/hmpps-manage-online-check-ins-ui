export interface OffenderEligibility {
  accreditedProgramme: boolean
  tierA: boolean
  tierB: boolean
}

// TODO: backend not ready - replace with a real API call that looks up
// whether the person is on an accredited programme and which tier they're in
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getOffenderEligibility(crn: string): Promise<OffenderEligibility> {
  return {
    accreditedProgramme: true,
    tierA: true,
    tierB: true,
  }
}
