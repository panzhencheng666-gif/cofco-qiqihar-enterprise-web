import { useState } from "react";
import type { EmployeeProfile } from "@/platform/api/realtimeBusinessRepository";

/** A region index of recorded responsibilities, not an inventory of vacant regions. */
export function RegionResponsibilityDirectory({
  employees,
  regionNames,
  selectedRegion,
  canManage,
  onManage,
  onInspect,
}: {
  employees: readonly EmployeeProfile[];
  regionNames: ReadonlyMap<string, string>;
  selectedRegion: string;
  canManage: (employee: EmployeeProfile) => boolean;
  onManage: (employee: EmployeeProfile) => void;
  onInspect: (employee: EmployeeProfile) => void;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const rows = new Map<string, EmployeeProfile[]>();
  for (const employee of employees) {
    for (const code of new Set(employee.responsibilityRegionCodes ?? [])) {
      if (!selectedRegion || selectedRegion === code)
        rows.set(code, [...(rows.get(code) ?? []), employee]);
    }
  }
  const label = (code: string) => regionNames.get(code) ?? "地区名称待同步";
  const matched = [...rows]
    .filter(([code, owners]) =>
      `${label(code)} ${owners.map((e) => e.displayName).join(" ")}`.includes(
        search.trim(),
      ),
    )
    .sort(
      ([a], [b]) =>
        label(a).localeCompare(label(b), "zh-CN") || a.localeCompare(b),
    );
  const lastPage = Math.max(0, Math.ceil(matched.length / 10) - 1);
  const currentPage = Math.min(page, lastPage);
  const unassigned = employees.filter(
    (e) =>
      !e.responsibilityRegionCodes?.length &&
      e.displayName.includes(search.trim()),
  );
  return (
    <div className="identity-responsibility-directory">
      <div className="identity-region-overview">
        <div>
          <strong>{rows.size}</strong>
          <span>已记录分工地区</span>
        </div>
        <div>
          <strong>
            {new Set([...rows.values()].flat().map((e) => e.subjectId)).size}
          </strong>
          <span>涉及员工</span>
        </div>
        <p>
          按地区核对责任归属。查看明细可追溯员工涉及的样本；调整分工后需预览交接影响并保存。
        </p>
      </div>
      <label className="identity-region-directory-search">
        查找地区或负责人
        <input
          value={search}
          placeholder="输入地区或员工姓名"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </label>
      <div className="identity-data-table-scroll">
        <table
          className="identity-data-table identity-region-ledger"
          aria-label="地区责任清单"
        >
          <thead>
            <tr>
              <th>地区</th>
              <th>当前负责人 / 单位</th>
              <th>责任记录</th>
              <th>样本与分工</th>
            </tr>
          </thead>
          <tbody>
            {matched
              .slice(currentPage * 10, (currentPage + 1) * 10)
              .map(([code, owners]) => (
                <tr key={code}>
                  <th scope="row">{label(code)}</th>
                  <td>
                    {owners.map((owner) => (
                      <div
                        className="identity-region-owner"
                        key={owner.subjectId}
                      >
                        <strong>{owner.displayName}</strong>
                        <small>{owner.workUnitName}</small>
                      </div>
                    ))}
                  </td>
                  <td>
                    <span
                      className="identity-account-badge"
                      data-status={owners.length === 1 ? "ACTIVE" : "INVITED"}
                    >
                      {owners.length === 1
                        ? "已分工"
                        : `${owners.length} 位负责人记录`}
                    </span>
                  </td>
                  <td>
                    {owners.map((owner) => (
                      <div
                        key={owner.subjectId}
                        className="identity-region-owner-actions"
                      >
                        <button
                          type="button"
                          aria-label={`查看${owner.displayName}的样本责任`}
                          onClick={() => onInspect(owner)}
                        >
                          查看样本责任
                        </button>
                        {canManage(owner) && (
                          <button
                            type="button"
                            aria-label={`调整${owner.displayName}的负责地区`}
                            onClick={() => onManage(owner)}
                          >
                            调整负责地区
                          </button>
                        )}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            {matched.length === 0 && (
              <tr>
                <td colSpan={4}>当前范围没有匹配的地区责任记录。</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="identity-table-pagination">
        <span>共 {matched.length} 个地区 · 每页 10 个</span>
        <div>
          <button
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            上一页
          </button>
          <strong>
            {currentPage + 1} / {lastPage + 1}
          </strong>
          <button
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            下一页
          </button>
        </div>
      </footer>
      {!selectedRegion && (
        <section
          className="identity-unassigned-employees"
          aria-label="尚未分工员工"
        >
          <h3>
            尚未分工员工 <small>{unassigned.length} 位</small>
          </h3>
          <p>
            以下员工没有负责地区记录；是否可办理分工取决于账号状态及当前操作权限。
          </p>
          {unassigned.map((employee) => (
            <div className="identity-unassigned-row" key={employee.subjectId}>
              <div>
                <strong>{employee.displayName}</strong>
                <small>{employee.workUnitName}</small>
              </div>
              {canManage(employee) ? (
                <button type="button" onClick={() => onManage(employee)}>
                  设置负责地区
                </button>
              ) : (
                <span>当前不可调整</span>
              )}
            </div>
          ))}
          {!unassigned.length && <p>当前范围没有匹配的未分工员工。</p>}
        </section>
      )}
    </div>
  );
}
