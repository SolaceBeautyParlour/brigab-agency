// KNUST's academic year start shifts year to year and is announced by the
// university, not something safe to hardcode permanently — set it in .env
// and update it each year rather than editing this file.
//
// Confirmed for 2026/2027: KNUST returned to its pre-COVID calendar and
// begins the academic year on Tuesday, October 13, 2026.
// Source: KNUST College of Engineering's official calendar page, corroborated
// by KNUST's own notice as reported by MyJoyOnline (both, checked July 2026).
const DEFAULT_SEMESTER_START = "2026-10-13";

function getSemesterStart() {
  return new Date(process.env.SEMESTER_START_DATE || DEFAULT_SEMESTER_START);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Policy (agreed earlier): book 3+ months ahead of move-in and the balance
 * isn't due until 3 weeks before move-in — no reason to squeeze a student
 * for the full amount months in advance. Book closer than that, and the
 * balance is due right at move-in, no exception, since there's no more
 * runway to chase it once someone's already living there.
 */
export function computeBalanceDueDate(now = new Date()) {
  const semesterStart = getSemesterStart();
  const daysUntilSemester = (semesterStart - now) / MS_PER_DAY;

  let dueDate;
  if (daysUntilSemester >= 90) {
    dueDate = new Date(semesterStart.getTime() - 21 * MS_PER_DAY);
  } else {
    dueDate = new Date(semesterStart.getTime());
  }

  // Edge case: booking made after the semester has already started (someone
  // booking very late, or SEMESTER_START_DATE not yet updated for the new
  // year). A due date in the past isn't useful to anyone — fall back to a
  // short, explicit window instead of silently marking them overdue.
  const minimumDueDate = new Date(now.getTime() + 7 * MS_PER_DAY);
  if (dueDate < minimumDueDate) dueDate = minimumDueDate;

  return dueDate;
}
