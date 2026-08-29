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

-- Merge-gate fixtures are deliberately E2E_-named and live only in the
-- disposable qiqihar_enterprise_e2e database. They exercise the same formal
-- sample projections and domain writes as production without touching the
-- long-lived qiqihar_enterprise_dev catalog.
INSERT INTO overview.administrative_boundary(
  region_code, geometry, source_name, source_url, source_revision,
  source_license, source_feature_id, source_effective_on, geometry_sha256
)
VALUES (
  '230208',
  ST_Multi(ST_MakeEnvelope(123.0, 47.0, 123.5, 47.6, 4326)),
  'E2E_premerge formal-sample boundary fixture',
  'https://example.invalid/cofco-premerge-write-auth-boundary',
  'E2E_premerge-v1',
  'test fixture - not production geography',
  'E2E_premerge-230208',
  DATE '2026-08-29',
  repeat('e', 64)
)
ON CONFLICT(region_code) DO UPDATE
SET geometry = EXCLUDED.geometry,
    source_name = EXCLUDED.source_name,
    source_url = EXCLUDED.source_url,
    source_revision = EXCLUDED.source_revision,
    source_license = EXCLUDED.source_license,
    source_feature_id = EXCLUDED.source_feature_id,
    source_effective_on = EXCLUDED.source_effective_on,
    geometry_sha256 = EXCLUDED.geometry_sha256;

INSERT INTO registry.sample_point(
  sample_point_id, kind_code, canonical_name, region_code, approval_state,
  location_state, governed_point, effective_from, created_by, updated_by
)
VALUES (
  'e2e00000-0000-0000-0000-000000000001',
  'SURVEY_SITE',
  'E2E_合并前正式样本_齐齐哈尔',
  '230208',
  'APPROVED',
  'VALID',
  ST_SetSRID(ST_MakePoint(123.2, 47.3), 4326),
  DATE '2026-01-01',
  'e2e-operator-one',
  'e2e-operator-one'
);

INSERT INTO production.production_record(
  record_id, product_code, object_type_code, region_code, survey_date,
  reported_at, cultivated_area_mu, yield_per_mu_kg, status_code,
  last_modified_by, survey_year, survey_period_precision,
  survey_period_governance_state, sample_point_id
)
VALUES (
  'e2e00000-0000-0000-0000-000000000002',
  'CORN',
  'FARMER',
  '230208',
  DATE '2026-08-20',
  TIMESTAMPTZ '2026-08-20 09:30:00+08',
  100,
  500,
  'APPROVED',
  'e2e-operator-one',
  2026,
  'YEAR',
  'CONFIRMED',
  'e2e00000-0000-0000-0000-000000000001'
);

INSERT INTO production.production_record_submission_metadata(
  record_id, field_code, value
)
VALUES
  ('e2e00000-0000-0000-0000-000000000002', 'PROD_SAMPLE_NAME',
    'E2E_合并前正式样本_齐齐哈尔'),
  ('e2e00000-0000-0000-0000-000000000002', 'PROD_SAMPLE_CONTACT',
    '13800000000'),
  ('e2e00000-0000-0000-0000-000000000002', 'PROD_SAMPLE_LATITUDE',
    '47.3000000'),
  ('e2e00000-0000-0000-0000-000000000002', 'PROD_SAMPLE_LONGITUDE',
    '123.2000000');

INSERT INTO market.market_record(
  record_id, product_code, object_type_code, region_code, trade_date,
  reported_at, purchase_base_price, sale_base_price, trade_direction,
  carriage_board_amount, packaging_amount, freight_amount, packaging_form,
  status_code, last_modified_by, survey_year, survey_month,
  survey_period_precision, survey_period_governance_state, sample_point_id
)
VALUES (
  'e2e00000-0000-0000-0000-000000000003',
  'CORN',
  'TRADER',
  '230208',
  DATE '2026-08-20',
  TIMESTAMPTZ '2026-08-20 09:30:00+08',
  2300,
  2380,
  'BOTH',
  36,
  12,
  72,
  'BULK',
  'APPROVED',
  'e2e-operator-one',
  2026,
  8,
  'YEAR_MONTH',
  'CONFIRMED',
  'e2e00000-0000-0000-0000-000000000001'
);

INSERT INTO market.market_record_core_value(
  record_id, product_code, field_code, domain_binding, value
)
VALUES
  ('e2e00000-0000-0000-0000-000000000003', 'CORN', 'MKT_SAMPLE_NAME',
    'EXTENSION', 'E2E_合并前正式样本_齐齐哈尔'),
  ('e2e00000-0000-0000-0000-000000000003', 'CORN', 'MKT_SAMPLE_CONTACT',
    'EXTENSION', '13800000000'),
  ('e2e00000-0000-0000-0000-000000000003', 'CORN', 'MKT_SAMPLE_LATITUDE',
    'EXTENSION', '47.3000000'),
  ('e2e00000-0000-0000-0000-000000000003', 'CORN', 'MKT_SAMPLE_LONGITUDE',
    'EXTENSION', '123.2000000');

INSERT INTO logistics.route_event(
  event_id, product_code, collection_date, reported_at, origin_region_code,
  destination_region_code, transport_mode_code, direction_code,
  source_organization, reporter, status_code, version, created_by,
  last_modified_by, created_at, updated_at, business_region_code,
  sample_contact, sample_latitude, sample_longitude, survey_year, survey_month,
  survey_period_precision, survey_period_governance_state, sample_point_id
)
VALUES (
  'e2e00000-0000-0000-0000-000000000004',
  'CORN',
  DATE '2026-08-01',
  TIMESTAMPTZ '2026-08-20 09:30:00+08',
  '230208',
  '230208',
  'ROAD',
  'INFLOW',
  'E2E_合并前正式样本_齐齐哈尔',
  '验收填报员甲',
  'APPROVED',
  0,
  'e2e-operator-one',
  'e2e-operator-one',
  now(),
  now(),
  '230208',
  '13800000000',
  47.3,
  123.2,
  2026,
  8,
  'YEAR_MONTH',
  'CONFIRMED',
  'e2e00000-0000-0000-0000-000000000001'
);

INSERT INTO logistics.route_fact(event_id, fact_code, value, unit_code)
VALUES
  ('e2e00000-0000-0000-0000-000000000004', 'ROUTE_VOLUME', 10, 'TONNE'),
  ('e2e00000-0000-0000-0000-000000000004', 'FREIGHT_RATE', 80, 'CNY_PER_TONNE');

INSERT INTO production.regional_crop_annual_stat(
  region_code, data_year, product_code, planted_area_mu, yield_per_mu_kg,
  version, created_by, updated_by
)
VALUES
  ('230208', 2026, 'CORN', 80000, 500, 0,
    'e2e-operator-one', 'e2e-operator-one'),
  ('230208', 2025, 'SOYBEAN', 60000, 400, 0,
    'e2e-operator-one', 'e2e-operator-one'),
  ('230208', 2026, 'SOYBEAN', 70000, 450, 0,
    'e2e-operator-one', 'e2e-operator-one'),
  ('230208', 2025, 'RICE', 50000, 550, 0,
    'e2e-operator-one', 'e2e-operator-one'),
  ('230208', 2026, 'RICE', 55000, 560, 0,
    'e2e-operator-one', 'e2e-operator-one');

INSERT INTO production.supply_demand_balance(
  region_code, survey_year, product_code, manual_values, notes, version,
  created_by, updated_by
)
VALUES
  ('230208', 2026, 'CORN',
    '{"OPENING_INVENTORY":10,"RESERVE_AUCTION_SALES":1,"EXTERNAL_INFLOW":2,"IMPORTS":3,"DEEP_PROCESSING":4,"FEED_USE":5,"FOOD_SEED_LOSS":6,"RESERVE_AUCTION_BUYS":7,"RAIL_OUTFLOW":8,"ROAD_OUTFLOW":9,"RESERVE_PURCHASE":10}'::jsonb,
    '{"OPENING_INVENTORY":"E2E_合并前玉米供需基线"}'::jsonb,
    0, 'e2e-operator-one', 'e2e-operator-one'),
  ('230208', 2026, 'SOYBEAN',
    '{"OPENING_INVENTORY":20,"IMPORTS":1,"INFLOW":2,"FOOD_USE":3,"CRUSH_USE":4,"PROTEIN_PROCESSING":5,"POLICY_RESERVE":6,"RAIL_OUTFLOW":7,"ROAD_OUTFLOW":8}'::jsonb,
    '{"OPENING_INVENTORY":"E2E_低权限拒绝基线"}'::jsonb,
    0, 'e2e-operator-one', 'e2e-operator-one'),
  ('230208', 2025, 'RICE',
    '{"OPENING_INVENTORY":30,"FOOD_USE":2,"OTHER_USE":3,"POLICY_RESERVE":4,"RAIL_OUTFLOW":5,"ROAD_OUTFLOW":6}'::jsonb,
    '{"OPENING_INVENTORY":"E2E_延迟旧范围供需"}'::jsonb,
    0, 'e2e-operator-one', 'e2e-operator-one'),
  ('230208', 2026, 'RICE',
    '{"OPENING_INVENTORY":40,"FOOD_USE":3,"OTHER_USE":4,"POLICY_RESERVE":5,"RAIL_OUTFLOW":6,"ROAD_OUTFLOW":7}'::jsonb,
    '{"OPENING_INVENTORY":"E2E_延迟新范围供需"}'::jsonb,
    0, 'e2e-operator-one', 'e2e-operator-one');

COMMIT;
