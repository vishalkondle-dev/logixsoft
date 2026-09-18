-- Renumber orderNo per outlet so all outlets start their token sequence from #1
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "outletId" ORDER BY "createdAt" ASC) as new_no
  FROM "saleOrder"
)
UPDATE "saleOrder" so
SET "orderNo" = numbered.new_no
FROM numbered
WHERE so.id = numbered.id;
