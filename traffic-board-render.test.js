import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("board markup shows partial, overdue, collected, and cost pending — never 100% with no costs", async () => {
  const outfile = path.join(process.cwd(), ".traffic-board-render.mjs");
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), "traffic-board-view.jsx")],
    bundle: true,
    format: "esm",
    outfile,
    jsx: "automatic",
    external: ["react", "react-dom", "react/jsx-runtime"],
  });
  const mod = await import(pathToFileURL(outfile).href);
  const today = "2026-09-26";
  const deals = [
    { id: "open", project_name: "Pending jersey", aca_id: "ACA-1", entity: "saltyskins_my", ac_in_charge: "Angeline", amount_myr: 1000, deal_close_date: "2026-09-02", expected_collection_date: "2026-10-01", costs_locked: false },
    { id: "part", project_name: "Partial caps", aca_id: "ACA-2", entity: "saltyskins_my", ac_in_charge: "Leon", amount_myr: 1000, deal_close_date: "2026-09-04", expected_collection_date: "2026-10-01", costs_locked: false },
    { id: "late", project_name: "Late banner", aca_id: null, entity: "saltycustoms_sg", ac_in_charge: "Wilson", amount_myr: 500, deal_close_date: "2026-09-05", expected_collection_date: "2026-09-01", costs_locked: false },
    { id: "done", project_name: "Paid tote", aca_id: "ACA-4", entity: "saltycustoms_sg", ac_in_charge: "Puteri", amount_myr: 400, deal_close_date: "2026-09-06", expected_collection_date: "2026-09-01", costs_locked: true },
  ];
  const collections = [
    { id: "c1", deal_id: "part", collected_at: "2026-09-10", amount: 400, note: "deposit" },
    { id: "c2", deal_id: "done", collected_at: "2026-09-08", amount: 400, note: null },
  ];
  const costs = [
    { id: "k1", deal_id: "part", cost_date: "2026-09-03", cost_type: "fabric_print", amount: 100, note: null },
    { id: "k2", deal_id: "done", cost_date: "2026-09-03", cost_type: "logistics", amount: 100, note: null },
  ];
  const html = renderToStaticMarkup(React.createElement(mod.TrafficBoardView, {
    canWrite: true,
    today,
    initialMonth: "2026-09",
    deals,
    collections,
    costs,
    onCreateDeal: async () => ({ errors: [] }),
    onUpdateDeal: async () => ({ errors: [] }),
    onDeleteDeal: async () => {},
    onSaveCollection: async () => ({ errors: [] }),
    onDeleteCollection: async () => {},
    onSaveCost: async () => ({ errors: [] }),
    onDeleteCost: async () => {},
    onSetLocked: async () => ({ errors: [] }),
    initialExpanded: "done",
  }));
  assert.match(html, /Cost pending/);
  assert.match(html, /Partial/);
  assert.match(html, /Overdue/);
  assert.match(html, /Collected/);
  assert.match(html, /Provisional · RM 900\.00 · 90\.0%/);
  assert.match(html, /Final GP RM 300\.00 \(75\.0%\)/);
  const finalHits = html.match(/Final GP RM 300\.00 \(75\.0%\)/g) || [];
  assert.equal(finalHits.length, 2);
  assert.match(html, /Provisional GP<\/div><div style="[^"]*">RM 900\.00<\/div>/);
  assert.match(html, /Final GP<\/div><div style="[^"]*">RM 300\.00 \(75\.0%\)<\/div><div style="[^"]*">1 locked<\/div>/);
  assert.equal(html.includes("100.0%"), false);
  assert.match(html, /Add closed deal/);
  assert.match(html, /Saltyskins MY/);
  assert.match(html, /Saltycustoms SG/);
  assert.match(html, /data-margin="pending"/);
  assert.match(html, /table-layout:fixed/);
  assert.equal(html.includes("min-width:860"), false);
  assert.match(html, /overflow-wrap:anywhere/);

  const staff = renderToStaticMarkup(React.createElement(mod.TrafficBoardView, {
    canWrite: false,
    today,
    initialMonth: "all",
    deals,
    collections,
    costs,
  }));
  assert.equal(staff.includes("Add closed deal"), false);
  assert.match(staff, /View only/);
  fs.rmSync(outfile, { force: true });
});
