export interface OffenderEligibility {
  accreditedProgramme: boolean
  tierA: boolean
  tierB: boolean
}

// TODO: backend not ready - replace with a real eligibility API call that looks up
// whether the person is on an accredited programme and which tier they're in.
// Until then, mockAccreditedProgrammeTiersABToggle can enable us to test these new routes
export async function getOffenderEligibility(
  crn: string,
  mockAccreditedProgrammeTiersABToggle = false,
): Promise<OffenderEligibility> {
  return {
    accreditedProgramme: mockAccreditedProgrammeTiersABToggle,
    tierA: mockAccreditedProgrammeTiersABToggle,
    tierB: mockAccreditedProgrammeTiersABToggle,
  }
}
