# Discount And Professor Policy

## 1. Separation of concerns

- `Professor duration override` is an operational booking rule.
- `Discounts` are economic rules and must be defined via `DiscountPolicy`.
- Legacy fields `professorDiscountEnabled` and `professorDiscountPercent` are deprecated for pricing.

## 2. Operational rule (professor override)

- Controlled by club settings:
- `professorDurationOverrideEnabled` (bool)
- `professorDurationOverrideMinutes` (int, default 60)
- If override is requested and disabled, booking is rejected with `PROFESSOR_DURATION_OVERRIDE_DISABLED`.

## 3. Economic precedence (DiscountPolicy)

- Order of evaluation:
- lower `priority` number first
- tie-break by `policy.id` ascending
- then assignment `createdAt`
- Stacking:
- if a selected policy is non-stackable, no further policies are applied
- if stackable, next policy applies over the current net amount

## 4. Professor + general promotions

- There is no implicit “professor discount” in booking price calculation.
- Any professor-related discount must be represented as a regular `DiscountPolicy` and assigned to the client.
- Combination with other promotions is defined by `priority` and `isStackable`.

## 5. Governance and audit

- Manual professor override can only be requested by admin/owner flows.
- Manual override requires `professorOverrideReason` (min 10 chars).
- Audit events are mandatory:
- `BOOKING_PROFESSOR_OVERRIDE`
- `FIXED_BOOKING_PROFESSOR_OVERRIDE`

