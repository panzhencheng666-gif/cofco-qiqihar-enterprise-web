BEGIN;

-- The production geography package is governed separately from Flyway.  The
-- isolated E2E database carries one real four-level chain for each governed
-- prefecture so browser tests never depend on the long-lived development DB.
-- V107+ protects canonical regions behind the reviewed apply path and V111+
-- assigns that path to the NOLOGIN migration owner. The fresh-database
-- migration principal is a member of that role, so isolated E2E setup uses the
-- same audited change workflow instead of disabling or bypassing its trigger.
SET LOCAL ROLE qiqihar_migration_owner;

DO $$
DECLARE
  target record;
  existing platform.region%ROWTYPE;
  operation varchar;
BEGIN
  -- Apply parent townships before their villages. A set-valued SELECT does not
  -- guarantee function evaluation order and can violate the region parent FK.
  FOR target IN
    SELECT * FROM (VALUES
      ('230208101', '雅尔塞镇', '230208', 'TOWNSHIP', 920101),
      ('231102101', '西岗子镇', '231102', 'TOWNSHIP', 920102),
      ('150721100', '那吉镇', '150721', 'TOWNSHIP', 920103),
      ('230208101001', '音钦村', '230208101', 'VILLAGE', 920201),
      ('231102101001', '西岗子村', '231102101', 'VILLAGE', 920202),
      ('150721100001', '那吉村', '150721100', 'VILLAGE', 920203)
    ) AS seed(code, name, parent_code, administrative_level, sort_order)
    ORDER BY length(code), code
  LOOP
    SELECT * INTO existing FROM platform.region WHERE code = target.code;
    operation := CASE WHEN NOT FOUND THEN 'INSERT' ELSE 'UPDATE' END;
    IF operation = 'INSERT'
       OR (existing.name, existing.parent_code, existing.administrative_level, existing.sort_order)
          IS DISTINCT FROM
          (target.name, target.parent_code, target.administrative_level, target.sort_order) THEN
      PERFORM platform.govern_master_data_change(
        'REGION', target.code, operation,
        jsonb_build_object(
          'code', target.code,
          'name', target.name,
          'parent_code', target.parent_code,
          'administrative_level', target.administrative_level,
          'sort_order', target.sort_order
        ),
        clock_timestamp(),
        'e2e-seed-applicant',
        'e2e-seed-reviewer',
        'Isolated E2E geography seed reviewed before controlled apply'
      );
    END IF;
  END LOOP;
END
$$;

RESET ROLE;

INSERT INTO platform.monitoring_scope_region(scope_code, region_code, included)
VALUES
  ('FORMAL_BUSINESS', '230208101', true),
  ('FORMAL_BUSINESS', '230208101001', true),
  ('FORMAL_BUSINESS', '231102101', true),
  ('FORMAL_BUSINESS', '231102101001', true),
  ('FORMAL_BUSINESS', '150721100', true),
  ('FORMAL_BUSINESS', '150721100001', true)
ON CONFLICT (scope_code, region_code) DO UPDATE
SET included = true,
    exclusion_reason = NULL;

-- This is a deliberately synthetic, source-labelled boundary fixture for the
-- isolated local browser/load database only. It makes the real map-scope query
-- executable without representing itself as the separately governed production
-- geography package. Existing governed boundary rows are never overwritten.
WITH prefecture_fixture AS (
  SELECT region.code,
         ST_Multi(ST_Buffer(
           ST_SetSRID(ST_MakePoint(
             118 + row_number() OVER (ORDER BY region.code) * 0.35,
             44 + row_number() OVER (ORDER BY region.code) * 0.12
           ), 4326),
           0.05
         )) geometry
  FROM platform.monitoring_scope_region scoped
  JOIN platform.region region ON region.code = scoped.region_code
  WHERE scoped.scope_code = 'FORMAL_BUSINESS'
    AND scoped.included
    AND region.administrative_level = 'PREFECTURE'
)
INSERT INTO overview.administrative_boundary(
  region_code, geometry, source_name, source_url, source_revision,
  source_license, source_feature_id, source_effective_on, geometry_sha256
)
SELECT fixture.code,
       fixture.geometry,
       'isolated Stage 7 synthetic boundary fixture',
       'https://example.invalid/cofco-stage7-local-boundary',
       'stage7-local-v1',
       'test fixture - not production geography',
       'stage7-local-' || fixture.code,
       DATE '2026-08-13',
       encode(sha256(ST_AsEWKB(fixture.geometry)), 'hex')
FROM prefecture_fixture fixture
ON CONFLICT(region_code) DO NOTHING;

SELECT overview.refresh_administrative_boundary_render();
SELECT overview.refresh_monitoring_scope_boundary('FORMAL_BUSINESS');
SELECT overview.refresh_monitoring_scope_boundary_render('FORMAL_BUSINESS');

INSERT INTO platform.work_unit(code, name, sort_order)
VALUES
  ('E2E_QIQIHAR', '全功能验收齐齐哈尔业务组', 92010),
  ('E2E_HEIHE', '全功能验收黑河业务组', 92020)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    active = true;

DELETE FROM platform.work_unit_region_scope
WHERE work_unit_code IN ('E2E_QIQIHAR', 'E2E_HEIHE');

WITH RECURSIVE region_tree AS (
  SELECT code, parent_code
  FROM platform.region
  WHERE code = '230200'
  UNION ALL
  SELECT child.code, child.parent_code
  FROM platform.region child
  JOIN region_tree parent ON child.parent_code = parent.code
)
INSERT INTO platform.work_unit_region_scope(work_unit_code, region_code)
SELECT 'E2E_QIQIHAR', tree.code
FROM region_tree tree
JOIN platform.monitoring_scope_region scope
  ON scope.scope_code = 'FORMAL_BUSINESS'
 AND scope.region_code = tree.code
 AND scope.included;

WITH RECURSIVE region_tree AS (
  SELECT code, parent_code
  FROM platform.region
  WHERE code = '231100'
  UNION ALL
  SELECT child.code, child.parent_code
  FROM platform.region child
  JOIN region_tree parent ON child.parent_code = parent.code
)
INSERT INTO platform.work_unit_region_scope(work_unit_code, region_code)
SELECT 'E2E_HEIHE', tree.code
FROM region_tree tree
JOIN platform.monitoring_scope_region scope
  ON scope.scope_code = 'FORMAL_BUSINESS'
 AND scope.region_code = tree.code
 AND scope.included;

INSERT INTO platform.security_user(subject_id, display_name, work_unit_code, enabled)
VALUES
  ('e2e-operator-one', '验收填报员甲', 'E2E_QIQIHAR', true),
  ('e2e-operator-two', '验收填报员乙', 'E2E_QIQIHAR', true),
  ('e2e-reviewer', '验收审核员', 'E2E_QIQIHAR', true),
  ('e2e-reporter', '验收报告员', 'E2E_QIQIHAR', true),
  ('e2e-publisher', '验收发布员', 'E2E_QIQIHAR', true),
  ('e2e-outside-operator', '验收异地填报员', 'E2E_HEIHE', true)
ON CONFLICT (subject_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    work_unit_code = EXCLUDED.work_unit_code,
    enabled = true;

DELETE FROM platform.security_user_role
WHERE subject_id LIKE 'e2e-%';

INSERT INTO platform.security_user_role(subject_id, role_code)
VALUES
  ('e2e-operator-one', 'BUSINESS_OPERATOR'),
  ('e2e-operator-two', 'BUSINESS_OPERATOR'),
  ('e2e-reviewer', 'BUSINESS_REVIEWER'),
  ('e2e-reporter', 'REPORTER'),
  ('e2e-publisher', 'REPORT_PUBLISHER'),
  ('e2e-outside-operator', 'BUSINESS_OPERATOR');

DELETE FROM platform.security_user_region_scope
WHERE subject_id LIKE 'e2e-%';

INSERT INTO platform.security_user_region_scope(subject_id, region_code)
SELECT employee.subject_id, scope.region_code
FROM platform.security_user employee
JOIN platform.work_unit_region_scope scope
  ON scope.work_unit_code = employee.work_unit_code
WHERE employee.subject_id LIKE 'e2e-%';

INSERT INTO logistics.logistics_node(
  node_code, node_name, node_type_code, region_code, active
)
VALUES
  ('E2E_QQ_RAIL', '齐齐哈尔验收铁路站', 'RAIL_NODE', '230208101001', true),
  ('E2E_QQ_ROAD', '齐齐哈尔验收公路节点', 'ROAD_NODE', '230208101001', true)
ON CONFLICT (node_code) DO UPDATE
SET node_name = EXCLUDED.node_name,
    node_type_code = EXCLUDED.node_type_code,
    region_code = EXCLUDED.region_code,
    active = true;

COMMIT;
