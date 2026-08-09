BEGIN;

-- The production geography package is governed separately from Flyway.  The
-- isolated E2E database carries one real four-level chain for each governed
-- prefecture so browser tests never depend on the long-lived development DB.
INSERT INTO platform.region(code, name, parent_code, administrative_level, sort_order)
VALUES
  ('230208101', '雅尔塞镇', '230208', 'TOWNSHIP', 920101),
  ('231102101', '西岗子镇', '231102', 'TOWNSHIP', 920102),
  ('150721100', '那吉镇', '150721', 'TOWNSHIP', 920103)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_code = EXCLUDED.parent_code,
    administrative_level = EXCLUDED.administrative_level;

INSERT INTO platform.region(code, name, parent_code, administrative_level, sort_order)
VALUES
  ('230208101001', '音钦村', '230208101', 'VILLAGE', 920201),
  ('231102101001', '西岗子村', '231102101', 'VILLAGE', 920202),
  ('150721100001', '那吉村', '150721100', 'VILLAGE', 920203)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    parent_code = EXCLUDED.parent_code,
    administrative_level = EXCLUDED.administrative_level;

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
