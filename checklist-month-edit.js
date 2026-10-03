// Staff and supervisors may edit their own previous checklist month through
// this day of the new month (inclusive). From the 8th, that month is view-only.
export const CHECKLIST_PREV_MONTH_GRACE_DAY = 7;

export function shiftMonthKey(monthKey, deltaMonths) {
  const [y, m] = String(monthKey).split("-").map(Number);
  const d = new Date(y, m - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Edit lock for one checklist month.
 * Admins edit any month. Everyone else edits only their own current month,
 * plus their own previous calendar month while today is on or before the grace day.
 *
 * @param {{ isAdmin: boolean, isOwn: boolean, selectedMonth: string, currentMonth: string, today: Date }} opts
 * @returns {{ canEdit: boolean, graceNote: boolean }}
 */
export function checklistMonthEditState({ isAdmin, isOwn, selectedMonth, currentMonth, today }) {
  const graceNote = !isAdmin
    && isOwn
    && selectedMonth === shiftMonthKey(currentMonth, -1)
    && today.getDate() <= CHECKLIST_PREV_MONTH_GRACE_DAY;
  const canEdit = isAdmin || (isOwn && selectedMonth === currentMonth) || graceNote;
  return { canEdit, graceNote };
}
