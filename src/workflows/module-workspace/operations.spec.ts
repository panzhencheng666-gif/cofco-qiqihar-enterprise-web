import { describe, expect, it } from "vitest";
import type { ModuleWorkspaceRecord } from "./model";
import {
  buildWorkspaceCsv,
  filterWorkspaceRecords,
  listWorkspaceFilterOptions,
} from "./operations";

const records: readonly ModuleWorkspaceRecord[] = [
  {
    id: "one",
    businessObjectId: "enterprise:longjiang-fenghe",
    name: "龙江丰禾粮贸第一经营场所",
    category: "贸易与仓储",
    scope: "龙江县",
    period: "玉米市场日报",
    status: "区域复核中",
    quality: "1 条警告",
    owner: "王洋",
    timeLimit: "今天 12:00",
  },
  {
    id: "two",
    businessObjectId: "facility:nehe-rail-logistics",
    name: "讷河铁路物流节点",
    category: "铁路站点",
    scope: "讷河市",
    period: "运输事件核对",
    status: "等待修正",
    quality: "重复风险",
    owner: "赵晨",
    timeLimit: "今天 16:30",
  },
];

describe("module workspace operations", () => {
  it("filters records by business text, status and category", () => {
    expect(
      filterWorkspaceRecords(records, {
        search: "讷河",
        status: "等待修正",
        category: "铁路站点",
      }),
    ).toEqual([records[1]]);

    expect(
      filterWorkspaceRecords(records, {
        search: "王洋",
        status: "",
        category: "",
      }),
    ).toEqual([records[0]]);
  });

  it("lists stable unique filter options from the current workspace", () => {
    expect(listWorkspaceFilterOptions(records)).toEqual({
      categories: ["贸易与仓储", "铁路站点"],
      statuses: ["区域复核中", "等待修正"],
    });
  });

  it("exports the governed workspace using Chinese headings and safe csv escaping", () => {
    expect(
      buildWorkspaceCsv(records.slice(0, 1), {
        name: "业务对象",
        category: "对象类型",
        scope: "责任区域",
        period: "本期事项",
        status: "业务状态",
        quality: "质量状态",
        owner: "当前责任人",
        timeLimit: "时限",
      }),
    ).toContain(
      '"业务对象","对象类型","责任区域","本期事项","业务状态","质量状态","当前责任人","时限"',
    );
    expect(buildWorkspaceCsv(records.slice(0, 1))).toContain(
      '"龙江丰禾粮贸第一经营场所"',
    );
  });
});
