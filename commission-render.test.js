import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COMMISSION_PEOPLE } from "./commission-logic.js";

const month = {
  monthKey: "2026-07",
  npbt: 159737.47,
  qualified: true,
  pool: 11916.43,
  readyTotal: 8224.18,
  readyPayroll: 8224.17,
  heldTotal: 3692.25,
  pendingTotal: 4057.32,
  paidTotal: 0,
  useDecision: true,
  entityBase: { my: 281670.73, sg: 237225.8 },
  people: [
    { key: "wilson", name: "Wilson Goh", full: 6107.66, held: 1892.43, readyToPay: 4215.23, pending: 3000, paid: 0, readyMy: 2288.14, readySg: 1927.09, paidMy: 0, paidSg: 0, paidEvents: [] },
    { key: "leon", name: "Leon Lim", full: 2371.22, held: 734.71, readyToPay: 1636.51, pending: 500, paid: 0, readyMy: 888.34, readySg: 748.17, paidMy: 0, paidSg: 0, paidEvents: [] },
    { key: "puteri", name: "Puteri Inez", full: 1947.99, held: 603.58, readyToPay: 1344.41, pending: 400, paid: 0, readyMy: 729.78, readySg: 614.63, paidMy: 0, paidSg: 0, paidEvents: [] },
    { key: "king", name: "King Quah", full: 1489.55, held: 461.53, readyToPay: 1028.02, pending: 157.32, paid: 0, readyMy: 558.04, readySg: 469.98, paidMy: 0, paidSg: 0, paidEvents: [] },
  ],
  deals: [
    { id: "nokia", aca_id: "S00359", project_name: "Nokia (Via Eventually)", entityShort: "MY", amount: 115923.48, collected: 0, outstanding: 115923.48, commission: 4057.32, status: "pending", statusLabel: "Pending — excluded until collected" },
    { id: "convo", aca_id: null, project_name: "UNIRAZAK Convo Kit [40%]", entityShort: "MY", amount: 33600, collected: 0, outstanding: 33600, commission: 1032, status: "held", statusLabel: "Held" },
    { id: "kommons", aca_id: "S00415", project_name: "Kommons", entityShort: "MY", amount: 26113.25, collected: 0, outstanding: 26113.25, commission: 2049.02, status: "held", statusLabel: "Held" },
    { id: "reorder", aca_id: null, project_name: "UNIRAZAK Reorder Items [40%]", entityShort: "MY", amount: 9630.4, collected: 0, outstanding: 9630.4, commission: 360.5, status: "held", statusLabel: "Held" },
    { id: "shirt", aca_id: null, project_name: "UNIRAZAK Corporate Shirt [40%]", entityShort: "MY", amount: 4680, collected: 0, outstanding: 4680, commission: 169.8, status: "held", statusLabel: "Held" },
    { id: "gutor", aca_id: "S00403", project_name: "Gutor Earbud", entityShort: "MY", amount: 1139.25, collected: 0, outstanding: 1139.25, commission: 80.93, status: "held", statusLabel: "Held" },
  ],
};

async function renderView(props, name) {
  const outfile = path.join(process.cwd(), `.commission-render-${name}.mjs`);
  await esbuild.build({
    entryPoints: [path.join(process.cwd(), "commissions-view.jsx")],
    bundle: true,
    format: "esm",
    outfile,
    jsx: "automatic",
    external: ["react", "react-dom", "react/jsx-runtime"],
  });
  const mod = await import(pathToFileURL(outfile).href);
  const html = renderToStaticMarkup(React.createElement(mod.CommissionsView, props));
  fs.rmSync(outfile, { force: true });
  return html;
}

test("admin sees July figures, held deals, and the payroll action", async () => {
  const html = await renderView({
    year: 2026,
    years: [2026],
    onYear: () => {},
    months: [month],
    monthKey: "2026-07",
    onMonth: () => {},
    canMarkPaid: true,
    tablesReady: true,
    migrationSql: "",
    audit: [],
    saving: false,
    loadError: "",
    actionError: "",
    onMarkPaid: async () => {},
    onExclude: () => {},
    onInclude: () => {},
  }, "admin");
  assert.match(html, /RM 11,916\.43/);
  assert.match(html, /RM 8,224\.18/);
  assert.match(html, /RM 3,692\.25/);
  assert.match(html, /RM 4,215\.23/);
  assert.match(html, /RM 1,636\.51/);
  assert.match(html, /RM 1,344\.41/);
  assert.match(html, /RM 1,028\.02/);
  assert.match(html, /Wilson Goh/);
  assert.match(html, /Leon Lim/);
  assert.match(html, /Puteri Inez/);
  assert.match(html, /King Quah/);
  assert.match(html, /S00359/);
  assert.match(html, /Pending — excluded until collected/);
  assert.match(html, /UNIRAZAK Convo Kit \[40%\]/);
  assert.match(html, /Kommons/);
  assert.match(html, /S00415/);
  assert.match(html, /Gutor Earbud/);
  assert.match(html, /S00403/);
  assert.match(html, /Mark batch paid/);
  assert.match(html, /commission-table/);
  assert.match(html, /white-space:nowrap/);
  assert.equal(/instructure/i.test(html), false);
  assert.equal(/under review/i.test(html), false);
  assert.equal(COMMISSION_PEOPLE.some(p => p.key === "justin"), false);
});

test("staff can read the tracker and cannot mark it paid", async () => {
  const html = await renderView({
    year: 2026,
    years: [2026],
    onYear: () => {},
    months: [month],
    monthKey: "2026-07",
    onMonth: () => {},
    canMarkPaid: false,
    tablesReady: false,
    migrationSql: "create table commission_payout_batches",
    audit: [],
    saving: false,
    loadError: "",
    actionError: "",
    onMarkPaid: async () => {},
    onExclude: () => {},
    onInclude: () => {},
  }, "staff");
  assert.match(html, /View only/);
  assert.match(html, /RM 4,215\.23/);
  assert.match(html, /One-time setup/);
  assert.equal(html.includes("Mark batch paid"), false);
  assert.equal(html.includes("Exclude until collected"), false);
});

test("phone css scrolls commission rows on one line", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src/mobile.css"), "utf8");
  const phone = css.slice(css.indexOf("@media (max-width: 768px)"));
  assert.match(phone, /\.commission-table th,\s*\.commission-table td\s*\{[^}]*white-space:\s*nowrap\s*!important/s);
  assert.match(phone, /\.table-scroll \.commission-table\s*\{[^}]*table-layout:\s*auto\s*!important/s);
  assert.match(phone, /\.commission-card-value\s*\{[^}]*white-space:\s*nowrap\s*!important/s);
  assert.match(phone, /\.bottom-tab-label\s*\{[^}]*white-space:\s*nowrap/s);
});
