import { useEffect, useRef, useState } from "react";
import { EnterpriseModal } from "@/shared/enterprise-ui/EnterpriseModal";
import type {
  EmployeeProfile,
  IdentityAssignmentOptions,
  RealtimeBusinessRepository,
  RegionResponsibility,
} from "@/platform/api/realtimeBusinessRepository";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

export function SampleResponsibilityEditor({
  employee,
  repository,
  regionNames,
  onCancel,
  onSaved,
  readOnly = false,
}: {
  employee: EmployeeProfile;
  repository: RealtimeBusinessRepository;
  regionNames: ReadonlyMap<string, string>;
  onCancel: () => void;
  onSaved: () => Promise<void>;
  readOnly?: boolean;
}) {
  const [options, setOptions] = useState<IdentityAssignmentOptions | null>(
    null,
  );
  const [codes, setCodes] = useState<readonly string[]>([]);
  const [preview, setPreview] = useState<RegionResponsibility | null>(null);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const saveLock = useRef(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      repository.loadRegionResponsibility(employee.subjectId),
      readOnly
        ? Promise.resolve(null)
        : repository.loadAssignmentOptions(employee.workUnitCode),
    ])
      .then(async ([current, assignment]) => {
        if (!active) return;
        setOptions(assignment);
        setCodes(current.regionCodes);
        const result = readOnly
          ? current
          : await repository.previewRegionResponsibility(employee.subjectId, {
              regionCodes: current.regionCodes,
            });
        if (active) {
          setPreview(result);
          setInitialized(true);
        }
      })
      .catch(() => {
        if (active) setError("负责地区读取失败，请关闭窗口后重试。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      generation.current += 1;
    };
  }, [employee.subjectId, employee.workUnitCode, readOnly, repository]);

  const refreshPreview = async (
    nextCodes: readonly string[],
    conflict = false,
  ) => {
    const request = ++generation.current;
    setCodes(nextCodes);
    setPreview(null);
    setLoading(true);
    setError(
      conflict ? "地区或样本责任已变化，已重新预览，请核对后再次保存。" : null,
    );
    try {
      const result = await repository.previewRegionResponsibility(
        employee.subjectId,
        { regionCodes: nextCodes },
      );
      if (request === generation.current) {
        setPreview(result);
        setInitialized(true);
      }
    } catch {
      if (request === generation.current)
        setError("涉及样本读取失败，请重新预览后保存。");
    } finally {
      if (request === generation.current) setLoading(false);
    }
  };

  const save = async () => {
    if (saveLock.current || loading || !preview?.previewToken || !reason.trim())
      return;
    saveLock.current = true;
    setSaving(true);
    setError(null);
    try {
      await repository.saveRegionResponsibility(employee.subjectId, {
        regionCodes: codes,
        previewToken: preview.previewToken,
        reason: reason.trim(),
      });
    } catch (caught) {
      if (caught instanceof RealtimeApiError && caught.status === 409) {
        await refreshPreview(codes, true);
      } else {
        setError(
          caught instanceof RealtimeApiError && caught.clientMessage
            ? caught.clientMessage
            : "负责地区保存失败，请重试。",
        );
      }
      saveLock.current = false;
      setSaving(false);
      return;
    }
    await onSaved();
  };
  const label = (code: string) =>
    regionNames.get(code) ??
    options?.regions.find((region) => region.code === code)?.name ??
    "地区名称待同步";
  const groups = new Map<string, string[]>();
  for (const code of options?.regionCodes ?? []) {
    if (!label(code).includes(search.trim())) continue;
    const parentCode = options?.regions.find(
      (region) => region.code === code,
    )?.parentCode;
    const parentLabel =
      ((parentCode ? regionNames.get(parentCode) : undefined) ??
        label(code).split(" / ").slice(0, -1).join(" / ")) ||
      "可选地区";
    groups.set(parentLabel, [...(groups.get(parentLabel) ?? []), code]);
  }
  return (
    <EnterpriseModal
      open
      title={readOnly ? "样本责任明细" : "设置负责地区"}
      width={1120}
      className="identity-region-modal"
      onCancel={onCancel}
      closable={!saving}
      maskClosable={!saving}
      keyboard={!saving}
      footer={null}
    >
      <p className="identity-region-meta">
        员工：<strong>{employee.displayName}</strong> 单位：
        {employee.workUnitName} 角色：
        {employee.roles.map(({ name }) => name).join("、")}
      </p>
      {!readOnly && (
        <p className="identity-region-note">
          选择负责地区，系统同步办理对应样本的维护责任。产情、市场的填报入口和品种保持各自独立。
        </p>
      )}
      {error && (
        <p role="alert" className="identity-governance-error">
          {error}
        </p>
      )}
      <div className="identity-region-columns" data-readonly={readOnly}>
        {!readOnly && (
          <section className="identity-region-selection" aria-label="责任地区">
            <h4>责任地区</h4>
            <input
              aria-label="搜索县区或乡镇"
              placeholder="搜索县区 / 乡镇"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="identity-region-options">
              {[...groups].map(([parent, groupCodes]) => (
                <details key={parent} open>
                  <summary>{parent}</summary>
                  {groupCodes.map((code) => (
                    <label key={code}>
                      <input
                        type="checkbox"
                        checked={codes.includes(code)}
                        disabled={saving || !initialized}
                        onChange={(event) =>
                          void refreshPreview(
                            event.target.checked
                              ? [...codes, code]
                              : codes.filter((value) => value !== code),
                          )
                        }
                      />
                      {label(code)}
                    </label>
                  ))}
                </details>
              ))}
              {options?.regionCodes.length === 0 && (
                <p>该单位暂无可设置的责任地区。</p>
              )}
            </div>
          </section>
        )}
        <section className="identity-region-coverage" aria-label="涉及样本">
          <h4>
            {readOnly ? "负责样本" : "涉及样本"}
            {preview ? `（${preview.samples.length}）` : ""}
          </h4>
          {loading ? (
            <p role="status">正在读取涉及样本…</p>
          ) : (
            <div className="identity-data-table-scroll">
              <table
                className="identity-data-table"
                aria-label="地区样本责任清单"
              >
                <thead>
                  <tr>
                    <th>样本点</th>
                    <th>所属地区</th>
                    <th>{readOnly ? "负责人" : "原负责人"}</th>
                    {!readOnly && <th>保存后负责人</th>}
                  </tr>
                </thead>
                <tbody>
                  {preview?.samples.map((sample) => (
                    <tr key={sample.id}>
                      <th scope="row">{sample.canonicalName}</th>
                      <td>
                        {regionNames.get(sample.regionCode) ??
                          sample.regionName}
                      </td>
                      <td>
                        {sample.previousDisplayName ??
                          (sample.previousSubjectId
                            ? "负责人名称待同步"
                            : "未分配")}
                      </td>
                      {!readOnly && (
                        <td>
                          {sample.nextDisplayName ??
                            (sample.nextSubjectId
                              ? "负责人名称待同步"
                              : "解除责任")}
                        </td>
                      )}
                    </tr>
                  ))}
                  {preview?.samples.length === 0 && (
                    <tr>
                      <td colSpan={readOnly ? 3 : 4}>
                        当前地区没有涉及的有效样本。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!readOnly && (
            <p className="identity-region-note">
              已有负责人将办理交接；取消原负责地区将解除相应责任。样本随地区自动列出，无需逐个勾选，历史填报记录保留。
            </p>
          )}
        </section>
      </div>
      {!readOnly && (
        <label className="identity-region-reason">
          调整原因
          <textarea
            aria-label="调整原因"
            maxLength={500}
            rows={2}
            value={reason}
            disabled={saving}
            onChange={(event) => setReason(event.target.value)}
            placeholder="填写岗位分工或人员交接原因"
          />
        </label>
      )}
      <footer className="identity-region-footer">
        <span>{!readOnly && `已选择 ${codes.length} 个负责地区`}</span>
        <div>
          <button type="button" disabled={saving} onClick={onCancel}>
            {readOnly ? "关闭" : "取消"}
          </button>
          {!readOnly && (
            <>
              <button
                type="button"
                disabled={saving || loading || !options}
                onClick={() => void refreshPreview(codes)}
              >
                重新预览
              </button>
              <button
                className="is-primary"
                type="button"
                disabled={
                  saving || loading || !preview?.previewToken || !reason.trim()
                }
                onClick={() => void save()}
              >
                {saving ? "正在保存…" : "保存负责地区"}
              </button>
            </>
          )}
        </div>
      </footer>
    </EnterpriseModal>
  );
}
