/** One-line summary of a lab result row from the shared labresults collection. */
export function labSummary(lab: {
  testName?: string;
  resultValue?: string | null;
  unit?: string | null;
  interpretation?: string | null;
}): string {
  const value = (lab.resultValue || '').trim();
  const unit = (lab.unit || '').trim();
  const interp = (lab.interpretation || '').trim();
  const shownInterp = interp && interp !== 'unknown' ? interp : '';
  if (!value) return shownInterp;
  const core = [value, unit].filter(Boolean).join(' ');
  const head = lab.testName ? `${lab.testName}: ${core}` : core;
  return shownInterp ? `${head} (${shownInterp})` : head;
}
