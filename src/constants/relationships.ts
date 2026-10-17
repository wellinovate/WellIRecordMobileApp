// Who can be added to a family vault. Stored as text, so older entries
// ("Child", "Spouse", "Parent", "Other") stay valid.
export const FAMILY_RELATIONSHIPS = [
  'Child',
  'Spouse',
  'Parent',
  'Elderly parent',
  'Sibling',
  'Caregiver',
  'Other',
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number];

// What the add screen tells the person, by relationship.
export function addMemberIntro(relationship: string): string {
  switch (relationship) {
    case 'Caregiver':
      return 'Add someone who helps look after you or a family member, such as a nurse or relative. Adding a name does not give them access to your records.';
    case 'Elderly parent':
      return 'Add an elderly parent to manage their records, medicines and appointments on their behalf. Only do this with their agreement, or as their legal representative.';
    case 'Child':
      return 'Add a child to manage their clinical records, vitals and appointments as their parent or legal guardian.';
    default:
      return 'Add a family member to manage their records, vitals and appointments with their agreement, or as their legal representative.';
  }
}
