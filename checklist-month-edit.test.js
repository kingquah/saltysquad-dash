import test from "node:test";
import assert from "node:assert/strict";
import { CHECKLIST_PREV_MONTH_GRACE_DAY, checklistMonthEditState } from "./checklist-month-edit.js";

const staff = { isAdmin: false, isOwn: true };

function on(year, month, day) {
  return new Date(year, month - 1, day);
}

test("grace day is the 7th", () => {
  assert.equal(CHECKLIST_PREV_MONTH_GRACE_DAY, 7);
});

test("own current month stays editable", () => {
  const state = checklistMonthEditState({
    ...staff,
    selectedMonth: "2026-10",
    currentMonth: "2026-10",
    today: on(2026, 10, 3),
  });
  assert.equal(state.canEdit, true);
  assert.equal(state.graceNote, false);
});

test("own previous month is editable through the 7th", () => {
  for (const day of [1, 3, 7]) {
    const state = checklistMonthEditState({
      ...staff,
      selectedMonth: "2026-09",
      currentMonth: "2026-10",
      today: on(2026, 10, day),
    });
    assert.equal(state.canEdit, true, `day ${day}`);
    assert.equal(state.graceNote, true, `day ${day}`);
  }
});

test("own previous month is view only from the 8th", () => {
  const state = checklistMonthEditState({
    ...staff,
    selectedMonth: "2026-09",
    currentMonth: "2026-10",
    today: on(2026, 10, 8),
  });
  assert.equal(state.canEdit, false);
  assert.equal(state.graceNote, false);
});

test("months older than the previous one stay view only during grace", () => {
  const state = checklistMonthEditState({
    ...staff,
    selectedMonth: "2026-08",
    currentMonth: "2026-10",
    today: on(2026, 10, 3),
  });
  assert.equal(state.canEdit, false);
  assert.equal(state.graceNote, false);
});

test("someone else's month is view only", () => {
  const state = checklistMonthEditState({
    isAdmin: false,
    isOwn: false,
    selectedMonth: "2026-09",
    currentMonth: "2026-10",
    today: on(2026, 10, 3),
  });
  assert.equal(state.canEdit, false);
  assert.equal(state.graceNote, false);
});

test("admin can still edit any month, without the grace note", () => {
  const state = checklistMonthEditState({
    isAdmin: true,
    isOwn: false,
    selectedMonth: "2026-08",
    currentMonth: "2026-10",
    today: on(2026, 10, 8),
  });
  assert.equal(state.canEdit, true);
  assert.equal(state.graceNote, false);
});

test("grace window crosses the year boundary", () => {
  const open = checklistMonthEditState({
    ...staff,
    selectedMonth: "2025-12",
    currentMonth: "2026-01",
    today: on(2026, 1, 7),
  });
  assert.equal(open.canEdit, true);
  const locked = checklistMonthEditState({
    ...staff,
    selectedMonth: "2025-11",
    currentMonth: "2026-01",
    today: on(2026, 1, 3),
  });
  assert.equal(locked.canEdit, false);
});
