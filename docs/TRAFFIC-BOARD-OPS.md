# Traffic Board — how we use it

This replaces the Excel YES/NO column and the COGS sheet we filled in later. One row per closed job. Money in and costs are separate lines, and every line has a date.

The month filter follows the **deal close date**, not the day the bank paid. A job closed in March and paid in April still sits in March. The collection date is stored on the collection line.

## Who does what

- **When the bank hits:** a supervisor (King, Wilson, or Puteri) opens the job and records a collection the same day. Put the date the money arrived and the amount that actually arrived. If only part of the invoice came in, enter that part.
- **When a cost is known:** a supervisor enters it. Pick the type: fabric/print, logistics, misc, or other. Put the date and the amount. If you only know one cost, enter that one. The margin stays **provisional** until the job is locked.
- **When the cost is final:** a supervisor locks costs. The margin switches from provisional to **final**. Unlock only if a real cost was missed.
- **Staff** can open the board and read it. Staff cannot add or edit.

## Click path

1. Sign in to Salty Squad Dash.
2. Open **Traffic Board** (or the Live Cash strip on the Dashboard).
3. Choose the month the deal closed, and Saltyskins MY or Saltycustoms SG. All shows both sections.
4. Click **Add closed deal**. Fill project name, ACA ID if we have one, entity, AC in charge, product, qty, close date, sales type, amount in MYR, payment terms, and the date we expect to collect. Lead owner is optional. You can link a Scoreboard "Sales Closed" row if that sale is already logged. Save.
5. **Bank hit:** open the deal, click **Mark collected**. Check the date (it starts as today) and the amount (it starts as whatever is still owed). Change the amount if the bank was short. Click **Save collection**.
6. **Cost known:** open the deal, click **Add cost**. Type, date, amount, short note. Save.
7. **Costs complete:** open the deal, click **Lock costs**. The gross profit label changes to Final.
8. Read the strip at the top: sales closed, collected, still owed, COGS entered, provisional GP, final GP, and overdue collections.

## What not to do

- Do not leave cost blank and read the job as full margin. If no cost is entered, the board says **cost pending**. That is deliberate. It is not 100% profit.
- Do not mark a job collected with a YES and no date. Every collection is a date plus an amount.
- Do not lock costs before at least one cost line is saved. Enter 0 only when you have confirmed the cost is really zero.
- Do not type a guessed balance. Only enter money that has arrived, or a cost you actually know.
- Do not create a second row for the same ACA ID. One job, one ACA ID. Add another collection or cost on that same job.

## How Partial and Overdue work

- **Open** — nothing collected yet, and the expected collection date is today, in the future, or blank.
- **Partial** — some money is in, some is still owed, and the expected date has not passed.
- **Overdue** — money is still owed and the expected collection date is before today. A partial payment becomes Overdue once that date passes.
- **Collected** — the collected amount covers the deal amount. If the bank paid extra, the row shows the extra. It does not become a new status.

Gross profit is deal amount minus the costs entered. **Provisional** means costs are started but not locked. **Final** means a supervisor locked them. Jobs with no cost lines are left out of both GP numbers and counted as cost pending.
