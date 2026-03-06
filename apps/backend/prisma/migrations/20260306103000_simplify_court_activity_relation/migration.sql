-- Backfill: si una cancha no tiene activityTypeId, usar una actividad existente de la tabla m2m.
-- En caso de múltiples actividades históricas, se toma la de menor id para mantener criterio determinístico.
UPDATE "Court" c
SET "activityTypeId" = m."activityTypeId"
FROM (
  SELECT rel."B" AS "courtId", MIN(rel."A") AS "activityTypeId"
  FROM "_ActivityTypeToCourt" rel
  GROUP BY rel."B"
) m
WHERE c."id" = m."courtId"
  AND c."activityTypeId" IS NULL;

-- Eliminar relación muchos-a-muchos en favor de Court.activityTypeId como única fuente de verdad.
DROP TABLE "_ActivityTypeToCourt";
