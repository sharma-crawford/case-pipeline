// =============================================================================
// The client's address, as contracts use it
// =============================================================================
// Profiles has two address columns: Mailing Address (physical_address8__1,
// key `mailing_address`) and Physical Address (text_mkrkrsgj, synced into
// profiles.address). The Fee K's Address mirror shows MAILING, so contracts
// read Mailing first, then Physical, then the Fee K's own mirror — and the app
// writes Mailing (apps/api/src/contract-info.ts PROFILE_CONTACT). Decided
// 2026-11-05: before, the app read Physical first and they differed on 18 of
// 45 pending Fee Ks.
// =============================================================================

/** SQL for the profile's Mailing Address alone (trimmed; NULL when empty). */
export function profileMailingSql(profile = "p"): string {
  return `NULLIF(TRIM(json_extract(${profile}.raw_column_values, '$.mailing_address')), '')`;
}

/** SQL for the contract address: Mailing, else Physical, else the Fee K's mirror (`feeK` alias; omit for none). */
export function contractAddressSql(profile = "p", feeK?: string): string {
  const parts = [profileMailingSql(profile), `NULLIF(TRIM(${profile}.address), '')`];
  if (feeK) parts.push(`json_extract(${feeK}.raw_column_values, '$.address')`);
  return `COALESCE(${parts.join(", ")})`;
}
