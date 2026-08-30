import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AccessReviewCampaign,
  AccessReviewDecision,
  BusinessAuditRow,
  CurrentSession,
  EmployeeAssignmentUpdate,
  EmployeeInvitation,
  EmployeeProfile,
  IdentityAssignmentOptions,
  IdentityInvitationReceipt,
  RealtimeBusinessRepository,
} from "@/platform/api/realtimeBusinessRepository";
import { csrfTokenFromCookies } from "@/platform/api/browserSession";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

type GovernanceView =
  "profile" | "organization" | "employees" | "reviews" | "audit";

interface IdentityGovernancePanelProps {
  identityManagementUrl?: string;
  initialView: GovernanceView;
  logoutUrl?: string;
  onClose: () => void;
  repository: RealtimeBusinessRepository;
  session: CurrentSession;
}

const emptyOptions: IdentityAssignmentOptions = {
  workUnits: [],
  roles: [],
  positions: [],
  regionCodes: [],
  regions: [],
};

function accountLabel(value: string): string {
  return (
    {
      ACTIVE: "账号正常",
      INVITED: "待激活",
      LOCKED: "已锁定",
      SUSPENDED: "已停用",
      REVOKED: "已撤销",
    }[value] ?? value
  );
}

function employmentLabel(value: string): string {
  return { ACTIVE: "在职", LEAVE: "休假", TERMINATED: "离职" }[value] ?? value;
}

function grantTypeLabel(value: string): string {
  return (
    { ROLE: "角色", POSITION: "历史授权", REGION: "责任地区" }[value] ?? value
  );
}

function roleLabel(value: string): string {
  return (
    {
      BUSINESS_OPERATOR: "填报员",
      BUSINESS_REVIEWER: "管理员",
      UNIT_MANAGER: "单位负责人",
      REPORT_OPERATOR: "报表业务员",
    }[value] ?? "已分配业务角色"
  );
}

function displayRegion(
  code: string,
  regionNames: ReadonlyMap<string, string>,
): string {
  const name = regionNames.get(code);
  return name ?? "责任地区名称待同步";
}

function regionScopeSummary(
  codes: readonly string[],
  regionNames: ReadonlyMap<string, string>,
): string {
  if (codes.length === 0) return "未分配责任地区";
  const namedRegions = codes.flatMap((code) => {
    const name = regionNames.get(code);
    return name ? [name] : [];
  });
  if (namedRegions.length === 0) return `已授权 ${codes.length} 个责任地区`;
  const visible = namedRegions.slice(0, 3);
  return codes.length > visible.length
    ? `${visible.join("、")} 等 ${codes.length} 个地区`
    : visible.join("、");
}

function auditObjectLabel(value: string): string {
  return (
    {
      SECURITY_USER: "员工账号",
      ACCESS_REVIEW: "权限复核",
      PRODUCTION_RECORD: "产情单据",
      MARKET_RECORD: "市场单据",
      LOGISTICS_RECORD: "物流单据",
      SUPPLY_ACCOUNT: "供需测算",
      REPORT: "业务报告",
      IMPORT_JOB: "批量导入",
    }[value] ?? "业务记录"
  );
}

function auditActionLabel(value: string): string {
  if (value.endsWith("_CREATED") || value.endsWith("_INVITED")) return "创建";
  if (value.endsWith("_UPDATED")) return "调整";
  if (value.endsWith("_SUBMITTED")) return "提交";
  if (value.endsWith("_APPROVED")) return "审核通过";
  if (value.endsWith("_RETURNED")) return "退回";
  if (value.endsWith("_VOIDED")) return "作废";
  if (value.endsWith("_COMPLETED")) return "完成";
  if (value.includes("REVOK")) return "撤销权限";
  return "业务操作";
}

function displayableAuditIdentifier(value: string): string | null {
  const normalized = value.trim();
  if (!normalized || /^(?:LOCAL(?:_DEV)?|DEV|TEST)$/i.test(normalized)) {
    return null;
  }
  return normalized;
}

function toggle(values: readonly string[], value: string): string[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

function businessError(error: unknown, fallback: string): string {
  return error instanceof RealtimeApiError && error.clientMessage
    ? error.clientMessage
    : fallback;
}

interface AssignmentDraft {
  idempotencyKey: string;
  subjectId: string;
  displayName: string;
  deliveryAddress: string;
  workUnitCode: string;
  accountStatus: string;
  employmentStatus: string;
  roleCodes: string[];
  regionCodes: string[];
  version: number;
}

function invitationDraft(session: CurrentSession): AssignmentDraft {
  return {
    idempotencyKey: `identity-invite-${globalThis.crypto.randomUUID()}`,
    subjectId: "",
    displayName: "",
    deliveryAddress: "",
    workUnitCode: session.workUnitCode,
    accountStatus: "INVITED",
    employmentStatus: "ACTIVE",
    roleCodes: [],
    regionCodes: [],
    version: 0,
  };
}

function employeeDraft(employee: EmployeeProfile): AssignmentDraft {
  return {
    idempotencyKey: "",
    subjectId: employee.subjectId,
    displayName: employee.displayName,
    deliveryAddress: "",
    workUnitCode: employee.workUnitCode,
    accountStatus: employee.accountStatus,
    employmentStatus: employee.employmentStatus,
    roleCodes: employee.roles.map(({ code }) => code),
    regionCodes: [...employee.regionCodes],
    version: employee.version,
  };
}

function invitationStatusLabel(
  value: IdentityInvitationReceipt["invitationStatus"],
): string {
  return {
    PENDING: "等待激活",
    ACTIVATED: "已激活",
    REVOKED: "已撤销",
    EXPIRED: "已过期",
  }[value];
}

function invitationDeliveryLabel(
  value: IdentityInvitationReceipt["deliveryStatus"],
): string {
  return {
    QUEUED: "已进入送达队列",
    DELIVERED: "已送达",
    FAILED: "送达失败",
  }[value];
}

function AssignmentEditor({
  draft,
  invite,
  options,
  onCancel,
  onChange,
  onWorkUnitChange,
  onSubmit,
  regionNames,
  saving,
  loadingOptions,
}: {
  draft: AssignmentDraft;
  invite: boolean;
  options: IdentityAssignmentOptions;
  onCancel: () => void;
  onChange: (draft: AssignmentDraft) => void;
  onWorkUnitChange: (workUnitCode: string) => void;
  onSubmit: () => void;
  regionNames: ReadonlyMap<string, string>;
  saving: boolean;
  loadingOptions: boolean;
}) {
  const [regionSearch, setRegionSearch] = useState("");
  const normalizedSearch = regionSearch.trim().toLocaleLowerCase("zh-CN");
  const visibleRegionCodes = options.regionCodes.filter((code) => {
    if (!normalizedSearch) return true;
    return `${displayRegion(code, regionNames)} ${code}`
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedSearch);
  });
  return (
    <section
      className="identity-governance-editor"
      aria-label={invite ? "邀请员工" : "调整员工授权"}
    >
      <header>
        <h3>
          {invite ? "邀请员工加入系统" : `调整 ${draft.displayName} 的授权`}
        </h3>
        <p>账号由管理员建档；员工首次完成企业身份认证后才能进入系统。</p>
      </header>
      <div className="identity-governance-form-grid">
        <label>
          员工账号
          <input
            aria-label="员工账号"
            disabled={!invite}
            value={draft.subjectId}
            onChange={(event) =>
              onChange({ ...draft, subjectId: event.target.value })
            }
          />
        </label>
        <label>
          员工姓名
          <input
            aria-label="员工姓名"
            value={draft.displayName}
            onChange={(event) =>
              onChange({ ...draft, displayName: event.target.value })
            }
          />
        </label>
        {invite && (
          <label>
            邀请送达邮箱
            <input
              aria-label="邀请送达邮箱"
              autoComplete="email"
              inputMode="email"
              value={draft.deliveryAddress}
              onChange={(event) =>
                onChange({ ...draft, deliveryAddress: event.target.value })
              }
            />
          </label>
        )}
        <label>
          工作单位
          <select
            aria-label="工作单位"
            value={draft.workUnitCode}
            onChange={(event) => onWorkUnitChange(event.target.value)}
          >
            {options.workUnits.map((option) => (
              <option key={option.code} value={option.code}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        {!invite && (
          <>
            <label>
              账号状态
              <select
                aria-label="账号状态"
                value={draft.accountStatus}
                onChange={(event) =>
                  onChange({ ...draft, accountStatus: event.target.value })
                }
              >
                <option value="INVITED">待激活</option>
                <option value="ACTIVE">正常</option>
                <option value="LOCKED">锁定</option>
                <option value="SUSPENDED">停用</option>
                <option value="REVOKED">撤销</option>
              </select>
            </label>
            <label>
              任职状态
              <select
                aria-label="任职状态"
                value={draft.employmentStatus}
                onChange={(event) =>
                  onChange({ ...draft, employmentStatus: event.target.value })
                }
              >
                <option value="ACTIVE">在职</option>
                <option value="LEAVE">休假</option>
                <option value="TERMINATED">离职</option>
              </select>
            </label>
          </>
        )}
      </div>
      <fieldset>
        <legend>业务角色</legend>
        <div className="identity-governance-choice-grid">
          {options.roles.map((option) => (
            <label key={option.code}>
              <input
                checked={draft.roleCodes.includes(option.code)}
                name="business-role"
                type="radio"
                onChange={() =>
                  onChange({
                    ...draft,
                    roleCodes: [option.code],
                  })
                }
              />
              {option.name}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>责任地区</legend>
        <div className="identity-region-picker">
          <label>
            搜索责任地区
            <input
              aria-label="搜索责任地区"
              placeholder="输入地区名称"
              value={regionSearch}
              onChange={(event) => setRegionSearch(event.target.value)}
            />
          </label>
          <strong className="identity-region-summary">
            已选择 {draft.regionCodes.length} 个责任地区
          </strong>
        </div>
        <div className="identity-governance-choice-grid identity-region-options">
          {visibleRegionCodes.map((code) => (
            <label key={code}>
              <input
                aria-label={`责任地区 ${code}`}
                checked={draft.regionCodes.includes(code)}
                type="checkbox"
                onChange={() =>
                  onChange({
                    ...draft,
                    regionCodes: toggle(draft.regionCodes, code),
                  })
                }
              />
              {displayRegion(code, regionNames)}
            </label>
          ))}
          {loadingOptions ? (
            <p>正在读取该单位的责任地区…</p>
          ) : (
            visibleRegionCodes.length === 0 && <p>没有匹配的责任地区。</p>
          )}
        </div>
      </fieldset>
      <footer>
        <button type="button" onClick={onCancel}>
          取消
        </button>
        <button
          className="is-primary"
          disabled={
            saving ||
            loadingOptions ||
            !draft.subjectId.trim() ||
            !draft.displayName.trim() ||
            (invite && !draft.deliveryAddress.trim())
          }
          type="button"
          onClick={onSubmit}
        >
          {invite ? "发送入职邀请" : "保存授权调整"}
        </button>
      </footer>
    </section>
  );
}

export function IdentityGovernancePanel({
  identityManagementUrl,
  initialView,
  logoutUrl,
  onClose,
  repository,
  session,
}: IdentityGovernancePanelProps) {
  const mayReadEmployees = session.permissions.includes("IDENTITY_READ");
  const mayAdminister = session.permissions.includes("IDENTITY_ADMIN");
  const mayReview = session.permissions.includes("ACCESS_REVIEW");
  const mayReadAudit = session.permissions.includes("AUDIT_READ");
  const [view, setView] = useState<GovernanceView>(initialView);
  const [employees, setEmployees] = useState<readonly EmployeeProfile[]>([]);
  const [options, setOptions] =
    useState<IdentityAssignmentOptions>(emptyOptions);
  const [regionNames, setRegionNames] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [editor, setEditor] = useState<{
    invite: boolean;
    draft: AssignmentDraft;
  } | null>(null);
  const [invitationEditor, setInvitationEditor] = useState<{
    employee: EmployeeProfile;
    receipt: IdentityInvitationReceipt | null;
    deliveryAddress: string;
    idempotencyKey: string;
  } | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(false);
  const [reviews, setReviews] = useState<readonly AccessReviewCampaign[]>([]);
  const [selectedReview, setSelectedReview] =
    useState<AccessReviewCampaign | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<
    Record<string, { decisionCode: "RETAIN" | "REVOKE"; reason: string }>
  >({});
  const [newReviewName, setNewReviewName] = useState("");
  const [newReviewDueAt, setNewReviewDueAt] = useState("");
  const [auditRows, setAuditRows] = useState<readonly BusinessAuditRow[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditType, setAuditType] = useState("");
  const [auditActor, setAuditActor] = useState("");
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAssignmentOptions, setLoadingAssignmentOptions] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const assignmentOptionsRequest = useRef(0);
  const invitationEditorSubject = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void repository
      .loadMasterData()
      .then((snapshot) => {
        if (!active) return;
        const byCode = new Map(
          snapshot.regions.map((region) => [region.code, region]),
        );
        setRegionNames(
          new Map(
            snapshot.regions.map((region) => {
              const names: string[] = [];
              const visited = new Set<string>();
              let current: (typeof snapshot.regions)[number] | undefined =
                region;
              while (current && !visited.has(current.code)) {
                names.unshift(current.name);
                visited.add(current.code);
                current = current.parentCode
                  ? byCode.get(current.parentCode)
                  : undefined;
              }
              return [region.code, names.join(" / ")];
            }),
          ),
        );
      })
      .catch(() => {
        // Authorization remains usable with codes when the read-only master-data
        // label service is temporarily unavailable.
      });
    return () => {
      active = false;
    };
  }, [repository]);
  const loadEmployees = async () => {
    const assignmentOptionsGeneration = assignmentOptionsRequest.current;
    setLoading(true);
    setError(null);
    try {
      const [nextEmployees, nextOptions] = await Promise.all([
        repository.listEmployees(),
        repository.loadAssignmentOptions(session.workUnitCode),
      ]);
      setEmployees(nextEmployees);
      if (
        assignmentOptionsRequest.current === assignmentOptionsGeneration &&
        !editor
      ) {
        setOptions(nextOptions);
      }
    } catch {
      setError("员工与授权信息读取失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };
  const loadReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await repository.listAccessReviews(session.workUnitCode));
    } catch {
      setError("权限复核信息读取失败，请稍后重试。");
    } finally {
      setLoading(false);
    }
  };
  const loadAuditEvents = async (pageNumber = 0) => {
    setLoading(true);
    setError(null);
    try {
      const page = await repository.listAuditEvents({
        workUnitCode: session.workUnitCode,
        aggregateType: auditType || undefined,
        actorSubjectId: auditActor.trim() || undefined,
        occurredFrom: auditFrom
          ? new Date(`${auditFrom}T00:00:00`).toISOString()
          : undefined,
        occurredTo: auditTo
          ? new Date(`${auditTo}T23:59:59.999`).toISOString()
          : undefined,
        page: pageNumber,
        pageSize: 50,
      });
      setAuditRows(page.items);
      setAuditTotal(page.totalElements);
      setAuditPage(page.pageNumber);
      setAuditTotalPages(page.totalPages);
    } catch {
      setError("审计记录读取失败，请检查查询范围后重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      if (view === "employees" && mayReadEmployees) void loadEmployees();
      if (view === "reviews" && mayReview) void loadReviews();
      if (view === "audit" && mayReadAudit) void loadAuditEvents();
    });
    // Repository/session identity changes intentionally restart the authoritative query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    view,
    mayReadEmployees,
    mayReview,
    mayReadAudit,
    repository,
    session.workUnitCode,
  ]);

  const pendingItems = useMemo(
    () =>
      selectedReview?.items.filter(
        ({ decisionCode, subjectId }) =>
          decisionCode === "PENDING" && subjectId !== session.subjectId,
      ) ?? [],
    [selectedReview, session.subjectId],
  );

  const requestAssignmentOptions = async (
    workUnitCode: string,
    requestedRegionCodes: readonly string[],
  ) => {
    const requestId = assignmentOptionsRequest.current + 1;
    assignmentOptionsRequest.current = requestId;
    setError(null);
    setLoadingAssignmentOptions(true);
    setOptions((current) => ({ ...current, regionCodes: [] }));
    try {
      const nextOptions = await repository.loadAssignmentOptions(workUnitCode);
      if (assignmentOptionsRequest.current === requestId) {
        const assignableRegions = new Set(nextOptions.regionCodes);
        setRegionNames((current) => {
          const merged = new Map(current);
          for (const region of nextOptions.regions) {
            if (!merged.has(region.code)) merged.set(region.code, region.name);
          }
          return merged;
        });
        setOptions(nextOptions);
        setEditor((current) =>
          current && current.draft.workUnitCode === workUnitCode
            ? {
                ...current,
                draft: {
                  ...current.draft,
                  regionCodes: requestedRegionCodes.filter((code) =>
                    assignableRegions.has(code),
                  ),
                },
              }
            : current,
        );
      }
    } catch {
      if (assignmentOptionsRequest.current === requestId) {
        setError("责任地区读取失败，请重新选择工作单位。");
      }
    } finally {
      if (assignmentOptionsRequest.current === requestId) {
        setLoadingAssignmentOptions(false);
      }
    }
  };

  const openAssignmentEditor = (invite: boolean, draft: AssignmentDraft) => {
    invitationEditorSubject.current = null;
    setLoadingInvitation(false);
    setInvitationEditor(null);
    setEditor({ invite, draft: { ...draft, regionCodes: [] } });
    void requestAssignmentOptions(draft.workUnitCode, draft.regionCodes);
  };

  const closeAssignmentEditor = () => {
    assignmentOptionsRequest.current += 1;
    setLoadingAssignmentOptions(false);
    setEditor(null);
  };

  const closeInvitationEditor = () => {
    invitationEditorSubject.current = null;
    setInvitationEditor(null);
    setLoadingInvitation(false);
  };

  const openInvitationEditor = async (employee: EmployeeProfile) => {
    closeAssignmentEditor();
    invitationEditorSubject.current = employee.subjectId;
    setMessage(null);
    setError(null);
    setLoadingInvitation(true);
    setInvitationEditor({
      employee,
      receipt: null,
      deliveryAddress: "",
      idempotencyKey: `identity-reinvite-${globalThis.crypto.randomUUID()}`,
    });
    try {
      const receipt = await repository.loadEmployeeInvitation(
        employee.subjectId,
      );
      if (invitationEditorSubject.current !== employee.subjectId) return;
      setInvitationEditor((current) =>
        current?.employee.subjectId === employee.subjectId
          ? { ...current, receipt }
          : current,
      );
    } catch (caught) {
      if (invitationEditorSubject.current === employee.subjectId) {
        setError(businessError(caught, "当前邀请读取失败，请稍后重试。"));
      }
    } finally {
      if (invitationEditorSubject.current === employee.subjectId) {
        setLoadingInvitation(false);
      }
    }
  };

  const revokeCurrentInvitation = async () => {
    if (!invitationEditor?.receipt) return;
    const subjectId = invitationEditor.employee.subjectId;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await repository.revokeInvitation(invitationEditor.receipt.invitationId);
      const receipt = await repository.loadEmployeeInvitation(subjectId);
      if (invitationEditorSubject.current !== subjectId) return;
      setInvitationEditor((current) =>
        current?.employee.subjectId === subjectId
          ? { ...current, receipt }
          : current,
      );
      setMessage("当前邀请已撤销。");
    } catch (caught) {
      if (invitationEditorSubject.current === subjectId) {
        setError(businessError(caught, "邀请撤销失败，请刷新状态后重试。"));
      }
    } finally {
      setSaving(false);
    }
  };

  const reissueCurrentInvitation = async () => {
    if (!invitationEditor?.deliveryAddress.trim()) return;
    const subjectId = invitationEditor.employee.subjectId;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await repository.reissueInvitation({
        idempotencyKey: invitationEditor.idempotencyKey,
        subjectId,
        deliveryAddress: invitationEditor.deliveryAddress.trim(),
      });
      const receipt = await repository.loadEmployeeInvitation(subjectId);
      if (invitationEditorSubject.current !== subjectId) return;
      setInvitationEditor((current) =>
        current?.employee.subjectId === subjectId
          ? {
              ...current,
              receipt,
              idempotencyKey: `identity-reinvite-${globalThis.crypto.randomUUID()}`,
            }
          : current,
      );
      setMessage(
        receipt.deliveryStatus === "DELIVERED"
          ? "邀请已重新送达。"
          : receipt.deliveryStatus === "FAILED"
            ? "邀请重新发送失败，请保留本次操作并稍后重试。"
            : "邀请已重新进入送达队列。",
      );
    } catch (caught) {
      if (invitationEditorSubject.current === subjectId) {
        setError(businessError(caught, "邀请重新发送失败，请稍后重试。"));
      }
    } finally {
      setSaving(false);
    }
  };

  const changeView = (nextView: GovernanceView) => {
    if (view === "employees" && nextView !== "employees") {
      closeAssignmentEditor();
      closeInvitationEditor();
    }
    setView(nextView);
  };

  const changeAssignmentWorkUnit = (workUnitCode: string) => {
    setEditor((current) =>
      current
        ? {
            ...current,
            draft: { ...current.draft, workUnitCode, regionCodes: [] },
          }
        : current,
    );
    void requestAssignmentOptions(workUnitCode, []);
  };

  const saveAssignment = async () => {
    if (!editor) return;
    const draft = editor.draft;
    if (draft.roleCodes.length !== 1) {
      setError("请选择一个业务角色。");
      return;
    }
    if (draft.regionCodes.length === 0) {
      setError("请至少选择一个责任地区。");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (editor.invite) {
        const input: EmployeeInvitation = {
          idempotencyKey: draft.idempotencyKey,
          subjectId: draft.subjectId.trim(),
          displayName: draft.displayName.trim(),
          deliveryAddress: draft.deliveryAddress.trim(),
          workUnitCode: draft.workUnitCode,
          positionCodes: [],
          roleCodes: draft.roleCodes,
          regionCodes: draft.regionCodes,
        };
        const receipt = await repository.inviteEmployee(input);
        setMessage(
          receipt.deliveryStatus === "DELIVERED"
            ? "邀请已送达，等待员工完成企业身份认证。"
            : receipt.deliveryStatus === "FAILED"
              ? "邀请尚未送达，请稍后使用重新发送功能。"
              : "邀请已进入送达队列，实际送达状态待服务确认。",
        );
      } else {
        const input: EmployeeAssignmentUpdate = {
          version: draft.version,
          displayName: draft.displayName.trim(),
          workUnitCode: draft.workUnitCode,
          accountStatus: draft.accountStatus,
          employmentStatus: draft.employmentStatus,
          positionCodes: [],
          roleCodes: draft.roleCodes,
          regionCodes: draft.regionCodes,
        };
        await repository.updateEmployee(draft.subjectId, input);
        setMessage("员工账号与授权已更新，下次请求立即按新权限执行。");
      }
      closeAssignmentEditor();
      await loadEmployees();
    } catch (caught) {
      setError(
        businessError(caught, "保存失败，请检查账号、角色和责任地区后重试。"),
      );
    } finally {
      setSaving(false);
    }
  };

  const createReview = async () => {
    if (!newReviewName.trim() || !newReviewDueAt) return;
    setSaving(true);
    setError(null);
    try {
      const created = await repository.createAccessReview({
        name: newReviewName.trim(),
        workUnitCode: session.workUnitCode,
        dueAt: new Date(newReviewDueAt).toISOString(),
      });
      setSelectedReview(created);
      setReviews((current) => [created, ...current]);
      setNewReviewName("");
      setNewReviewDueAt("");
      setMessage("权限复核已创建，请逐项确认保留或撤销。");
    } catch (caught) {
      setError(
        businessError(caught, "权限复核创建失败，请检查名称和截止时间。"),
      );
    } finally {
      setSaving(false);
    }
  };

  const submitReview = async () => {
    if (!selectedReview || pendingItems.length === 0) return;
    const decisions: AccessReviewDecision[] = [];
    for (const item of pendingItems) {
      const key = `${item.subjectId}:${item.grantType}:${item.grantKey}`;
      const decision = reviewDecisions[key];
      if (!decision?.reason.trim()) {
        setError("每一项权限都必须选择结论并填写复核说明。");
        return;
      }
      decisions.push({
        subjectId: item.subjectId,
        grantType: item.grantType,
        grantKey: item.grantKey,
        decisionCode: decision.decisionCode,
        reason: decision.reason.trim(),
      });
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await repository.decideAccessReview(
        selectedReview.reviewId,
        decisions,
      );
      setSelectedReview(updated);
      setReviews((current) =>
        current.map((review) =>
          review.reviewId === updated.reviewId ? updated : review,
        ),
      );
      setMessage(
        updated.statusCode === "COMPLETED" ? "复核已完成" : "复核结论已保存",
      );
    } catch (caught) {
      setError(
        businessError(
          caught,
          "复核结论提交失败，权限可能已被其他管理员调整，请刷新后重试。",
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="identity-governance-overlay">
      <section
        aria-label="账号与授权"
        aria-modal="true"
        className="identity-governance-panel"
        role="dialog"
      >
        <header className="identity-governance-header">
          <div>
            <small>企业身份与访问治理</small>
            <h2>账号与授权</h2>
          </div>
          <button aria-label="返回业务页面" type="button" onClick={onClose}>
            返回
          </button>
        </header>
        <nav aria-label="账号与授权功能">
          <button
            aria-current={view === "profile" ? "page" : undefined}
            type="button"
            onClick={() => changeView("profile")}
          >
            我的账号
          </button>
          <button
            aria-current={view === "organization" ? "page" : undefined}
            type="button"
            onClick={() => changeView("organization")}
          >
            当前单位
          </button>
          {mayReadEmployees && (
            <button
              aria-current={view === "employees" ? "page" : undefined}
              type="button"
              onClick={() => changeView("employees")}
            >
              员工与授权
            </button>
          )}
          {mayReview && (
            <button
              aria-current={view === "reviews" ? "page" : undefined}
              type="button"
              onClick={() => changeView("reviews")}
            >
              权限复核
            </button>
          )}
          {mayReadAudit && (
            <button
              aria-current={view === "audit" ? "page" : undefined}
              type="button"
              onClick={() => changeView("audit")}
            >
              审计追溯
            </button>
          )}
        </nav>
        <div className="identity-governance-content">
          {message && (
            <p className="identity-governance-success" role="status">
              {message}
            </p>
          )}
          {error && (
            <p className="identity-governance-error" role="alert">
              {error}
            </p>
          )}
          {view === "profile" && (
            <section
              aria-label="当前账号资料"
              className="identity-profile-view"
            >
              <header
                aria-label="账号状态摘要"
                className="identity-profile-hero"
                role="status"
              >
                <span aria-hidden="true" className="identity-profile-avatar">
                  {session.displayName.trim().slice(0, 1) || "员"}
                </span>
                <div>
                  <h3>{session.displayName}</h3>
                  <p>{session.workUnitName}</p>
                </div>
                <strong>
                  {employmentLabel(session.employmentStatus)} ·{" "}
                  {accountLabel(session.accountStatus)}
                </strong>
              </header>

              <section className="identity-profile-section">
                <h3>身份与任职</h3>
                <dl
                  aria-label="账号资料"
                  className="identity-account-summary"
                  data-layout="property-table"
                >
                  <div>
                    <dt>员工</dt>
                    <dd>
                      <strong>{session.displayName}</strong>
                      <small>企业员工身份已认证</small>
                    </dd>
                  </div>
                  <div>
                    <dt>工作单位</dt>
                    <dd>
                      <strong>{session.workUnitName}</strong>
                      <small>当前登录账号所属单位</small>
                    </dd>
                  </div>
                  <div>
                    <dt>账号状态</dt>
                    <dd>
                      <strong>
                        {employmentLabel(session.employmentStatus)} ·{" "}
                        {accountLabel(session.accountStatus)}
                      </strong>
                      <small>账号状态由企业身份和管理员共同控制</small>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="identity-profile-section">
                <h3>权限与责任范围</h3>
                <dl
                  aria-label="权限资料"
                  className="identity-account-summary"
                  data-layout="property-table"
                >
                  <div>
                    <dt>业务角色</dt>
                    <dd>
                      <strong>
                        {session.roleCodes.map(roleLabel).join("、") ||
                          "未分配业务角色"}
                      </strong>
                      <small>具体操作同时受责任地区和数据状态约束</small>
                    </dd>
                  </div>
                  <div>
                    <dt>责任地区</dt>
                    <dd>
                      <strong>
                        {regionScopeSummary(session.regionCodes, regionNames)}
                      </strong>
                      <small>
                        列表、填报、审核、分析、照片和导出均按此范围授权
                      </small>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="identity-profile-section">
                <h3>账号服务</h3>
                <dl
                  aria-label="账号服务"
                  className="identity-account-summary"
                  data-layout="property-table"
                >
                  <div>
                    <dt>登录安全</dt>
                    <dd className="identity-profile-actions">
                      {identityManagementUrl ? (
                        <a href={identityManagementUrl}>账号安全与登录设备</a>
                      ) : (
                        <small>
                          账号安全与登录设备由企业统一身份平台管理，当前入口尚未配置。
                        </small>
                      )}
                      {logoutUrl && (
                        <form action={logoutUrl} method="post">
                          <input
                            name="_csrf"
                            type="hidden"
                            value={csrfTokenFromCookies() ?? ""}
                          />
                          <button type="submit">退出登录</button>
                        </form>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </section>
          )}
          {view === "organization" && (
            <section
              aria-label="当前单位责任范围"
              className="identity-organization-view"
            >
              <div className="identity-governance-toolbar">
                <div>
                  <small>当前登录账号所属单位</small>
                  <h3>{session.workUnitName}</h3>
                  <p>
                    展示本单位业务角色与责任地区；所有业务操作均按当前账号的有效授权执行。
                  </p>
                </div>
                {mayReadEmployees && (
                  <button
                    className="is-primary"
                    type="button"
                    onClick={() => setView("employees")}
                  >
                    管理员工与授权
                  </button>
                )}
              </div>
              <dl className="identity-account-summary">
                <div>
                  <dt>当前员工</dt>
                  <dd>
                    <strong>{session.displayName}</strong>
                    <small>企业员工身份已认证</small>
                  </dd>
                </div>
                <div>
                  <dt>业务职责</dt>
                  <dd>
                    <strong>
                      {session.roleCodes.map(roleLabel).join("、") ||
                        "未分配业务职责"}
                    </strong>
                  </dd>
                </div>
                <div>
                  <dt>责任地区</dt>
                  <dd>
                    <strong>
                      {regionScopeSummary(session.regionCodes, regionNames)}
                    </strong>
                    <small>
                      填报、查询、审核、分析、照片和导出均受责任地区约束
                    </small>
                  </dd>
                </div>
              </dl>
            </section>
          )}
          {view === "employees" && mayReadEmployees && (
            <section aria-label="员工与授权">
              <div className="identity-governance-toolbar">
                <div>
                  <h3>员工与授权</h3>
                  <p>按员工维护单位、业务角色、责任地区和账号生命周期。</p>
                </div>
                {mayAdminister && (
                  <button
                    className="is-primary"
                    type="button"
                    onClick={() =>
                      openAssignmentEditor(true, invitationDraft(session))
                    }
                  >
                    邀请员工
                  </button>
                )}
              </div>
              {loading ? (
                <p>正在读取员工信息…</p>
              ) : (
                <div className="identity-data-table-scroll">
                  <table
                    aria-label="员工授权清单"
                    className="identity-data-table"
                  >
                    <thead>
                      <tr>
                        <th scope="col">员工</th>
                        <th scope="col">工作单位</th>
                        <th scope="col">角色与责任地区</th>
                        <th scope="col">账号状态</th>
                        <th scope="col">处理</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((employee) => (
                        <tr key={employee.subjectId}>
                          <th scope="row">
                            <strong>{employee.displayName}</strong>
                            <small>{employee.subjectId}</small>
                          </th>
                          <td>
                            <strong>{employee.workUnitName}</strong>
                          </td>
                          <td>
                            <strong>
                              {employee.roles
                                .map(({ name }) => name)
                                .join("、") || "未分配业务角色"}
                            </strong>
                            <small>
                              {regionScopeSummary(
                                employee.regionCodes,
                                regionNames,
                              )}
                            </small>
                          </td>
                          <td>
                            {employmentLabel(employee.employmentStatus)} ·{" "}
                            {accountLabel(employee.accountStatus)}
                          </td>
                          <td>
                            {employee.subjectId === session.subjectId ? (
                              <span>本人账号</span>
                            ) : mayAdminister ? (
                              <div className="identity-profile-actions">
                                <button
                                  aria-label={`管理${employee.displayName}的授权`}
                                  type="button"
                                  onClick={() =>
                                    openAssignmentEditor(
                                      false,
                                      employeeDraft(employee),
                                    )
                                  }
                                >
                                  管理授权
                                </button>
                                {employee.accountStatus === "INVITED" && (
                                  <button
                                    aria-label={`管理${employee.displayName}的邀请`}
                                    type="button"
                                    onClick={() =>
                                      void openInvitationEditor(employee)
                                    }
                                  >
                                    管理邀请
                                  </button>
                                )}
                              </div>
                            ) : (
                              "只读"
                            )}
                          </td>
                        </tr>
                      ))}
                      {employees.length === 0 && (
                        <tr>
                          <td colSpan={5}>当前单位暂无员工账号。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              {editor && (
                <AssignmentEditor
                  draft={editor.draft}
                  invite={editor.invite}
                  onCancel={closeAssignmentEditor}
                  onChange={(draft) => setEditor({ ...editor, draft })}
                  onWorkUnitChange={(workUnitCode) =>
                    void changeAssignmentWorkUnit(workUnitCode)
                  }
                  onSubmit={() => void saveAssignment()}
                  options={options}
                  regionNames={regionNames}
                  saving={saving}
                  loadingOptions={loadingAssignmentOptions}
                />
              )}
              {invitationEditor && (
                <section
                  aria-label={`管理${invitationEditor.employee.displayName}的邀请`}
                  className="identity-governance-editor"
                >
                  <header>
                    <h3>管理{invitationEditor.employee.displayName}的邀请</h3>
                    <p>查看服务端当前状态；撤销或重新发送后会再次读取确认。</p>
                  </header>
                  {loadingInvitation ? (
                    <p>正在读取当前邀请…</p>
                  ) : invitationEditor.receipt ? (
                    <strong>
                      {invitationStatusLabel(
                        invitationEditor.receipt.invitationStatus,
                      )}{" "}
                      ·{" "}
                      {invitationDeliveryLabel(
                        invitationEditor.receipt.deliveryStatus,
                      )}
                    </strong>
                  ) : (
                    <p>当前邀请状态不可用。</p>
                  )}
                  <label>
                    重新送达邮箱
                    <input
                      aria-label="重新送达邮箱"
                      autoComplete="email"
                      inputMode="email"
                      value={invitationEditor.deliveryAddress}
                      onChange={(event) =>
                        setInvitationEditor((current) =>
                          current
                            ? {
                                ...current,
                                deliveryAddress: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  <footer>
                    <button type="button" onClick={closeInvitationEditor}>
                      关闭邀请管理
                    </button>
                    <button
                      disabled={
                        saving ||
                        invitationEditor.receipt?.invitationStatus !== "PENDING"
                      }
                      type="button"
                      onClick={() => void revokeCurrentInvitation()}
                    >
                      撤销当前邀请
                    </button>
                    <button
                      className="is-primary"
                      disabled={
                        saving || !invitationEditor.deliveryAddress.trim()
                      }
                      type="button"
                      onClick={() => void reissueCurrentInvitation()}
                    >
                      重新发送邀请
                    </button>
                  </footer>
                </section>
              )}
            </section>
          )}
          {view === "reviews" && mayReview && (
            <section aria-label="权限复核">
              <div className="identity-governance-toolbar">
                <div>
                  <h3>权限复核</h3>
                  <p>
                    定期确认其他员工的角色和责任乡镇；本人权限由其他管理员复核，撤销结论立即生效。
                  </p>
                </div>
              </div>
              <div className="identity-review-create">
                <label>
                  复核名称
                  <input
                    aria-label="复核名称"
                    value={newReviewName}
                    onChange={(event) => setNewReviewName(event.target.value)}
                  />
                </label>
                <label>
                  完成时限
                  <input
                    aria-label="复核完成时限"
                    type="datetime-local"
                    value={newReviewDueAt}
                    onChange={(event) => setNewReviewDueAt(event.target.value)}
                  />
                </label>
                <button
                  disabled={saving || !newReviewName.trim() || !newReviewDueAt}
                  type="button"
                  onClick={() => void createReview()}
                >
                  创建权限复核
                </button>
              </div>
              <div className="identity-data-table-scroll">
                <table
                  aria-label="权限复核清单"
                  className="identity-data-table"
                >
                  <thead>
                    <tr>
                      <th scope="col">复核任务</th>
                      <th scope="col">完成时限</th>
                      <th scope="col">状态</th>
                      <th scope="col">处理</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((review) => (
                      <tr key={review.reviewId}>
                        <th scope="row">{review.name}</th>
                        <td>
                          {new Date(review.dueAt).toLocaleString("zh-CN")}
                        </td>
                        <td>
                          {review.statusCode === "COMPLETED"
                            ? "已完成"
                            : "进行中"}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReview(review);
                              setReviewDecisions({});
                            }}
                          >
                            {review.statusCode === "OPEN"
                              ? "处理复核"
                              : "查看结果"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!loading && reviews.length === 0 && (
                      <tr>
                        <td colSpan={4}>当前单位尚未建立权限复核。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {selectedReview && (
                <section
                  className="identity-review-detail"
                  aria-label={`${selectedReview.name}明细`}
                >
                  <header>
                    <h4>{selectedReview.name}</h4>
                    <button
                      type="button"
                      onClick={() => setSelectedReview(null)}
                    >
                      关闭明细
                    </button>
                  </header>
                  {selectedReview.items.map((item) => {
                    const key = `${item.subjectId}:${item.grantType}:${item.grantKey}`;
                    const draft = reviewDecisions[key] ?? {
                      decisionCode: "RETAIN" as const,
                      reason: "",
                    };
                    return (
                      <article key={key}>
                        <div>
                          <strong>{item.subjectId}</strong>
                          <span>
                            {grantTypeLabel(item.grantType)} · {item.grantKey}
                          </span>
                        </div>
                        {item.decisionCode === "PENDING" &&
                        item.subjectId === session.subjectId ? (
                          <span className="identity-review-delegated">
                            本人权限由其他管理员复核
                          </span>
                        ) : item.decisionCode === "PENDING" ? (
                          <>
                            <select
                              aria-label={`${item.grantKey} 的复核结论`}
                              value={draft.decisionCode}
                              onChange={(event) =>
                                setReviewDecisions((current) => ({
                                  ...current,
                                  [key]: {
                                    ...draft,
                                    decisionCode: event.target.value as
                                      "RETAIN" | "REVOKE",
                                  },
                                }))
                              }
                            >
                              <option value="RETAIN">保留</option>
                              <option value="REVOKE">撤销</option>
                            </select>
                            <input
                              aria-label={`${item.grantKey} 的复核说明`}
                              placeholder="填写复核依据"
                              value={draft.reason}
                              onChange={(event) =>
                                setReviewDecisions((current) => ({
                                  ...current,
                                  [key]: {
                                    ...draft,
                                    reason: event.target.value,
                                  },
                                }))
                              }
                            />
                          </>
                        ) : (
                          <span>
                            {item.decisionCode === "RETAIN"
                              ? "已保留"
                              : "已撤销"}{" "}
                            · {item.reason}
                          </span>
                        )}
                      </article>
                    );
                  })}
                  {pendingItems.length > 0 && (
                    <button
                      className="is-primary"
                      disabled={saving}
                      type="button"
                      onClick={() => void submitReview()}
                    >
                      提交复核结论
                    </button>
                  )}
                </section>
              )}
            </section>
          )}
          {view === "audit" && mayReadAudit && (
            <section aria-label="审计追溯">
              <div className="identity-governance-toolbar">
                <div>
                  <h3>审计追溯</h3>
                  <p>查询当前单位内不可篡改的账号、权限与业务操作记录。</p>
                </div>
              </div>
              <div className="identity-audit-filters">
                <label>
                  业务对象
                  <select
                    aria-label="审计业务对象"
                    value={auditType}
                    onChange={(event) => setAuditType(event.target.value)}
                  >
                    <option value="">全部业务对象</option>
                    <option value="SECURITY_USER">员工账号</option>
                    <option value="ACCESS_REVIEW">权限复核</option>
                    <option value="PRODUCTION_RECORD">产情单据</option>
                    <option value="MARKET_RECORD">市场单据</option>
                    <option value="LOGISTICS_RECORD">物流单据</option>
                    <option value="SUPPLY_ACCOUNT">供需测算</option>
                    <option value="REPORT">业务报告</option>
                    <option value="IMPORT_JOB">批量导入</option>
                  </select>
                </label>
                <label>
                  操作员工
                  <input
                    aria-label="审计操作员工"
                    placeholder="输入员工账号"
                    value={auditActor}
                    onChange={(event) => setAuditActor(event.target.value)}
                  />
                </label>
                <label>
                  开始日期
                  <input
                    aria-label="审计开始日期"
                    type="date"
                    value={auditFrom}
                    onChange={(event) => setAuditFrom(event.target.value)}
                  />
                </label>
                <label>
                  结束日期
                  <input
                    aria-label="审计结束日期"
                    type="date"
                    value={auditTo}
                    onChange={(event) => setAuditTo(event.target.value)}
                  />
                </label>
                <button
                  disabled={loading}
                  type="button"
                  onClick={() => void loadAuditEvents(0)}
                >
                  查询审计记录
                </button>
              </div>
              <p className="identity-audit-summary">
                共 {auditTotal} 条操作记录
              </p>
              <div className="identity-data-table-scroll">
                <table aria-label="审计记录" className="identity-data-table">
                  <thead>
                    <tr>
                      <th scope="col">操作时间</th>
                      <th scope="col">操作员工</th>
                      <th scope="col">所属单位</th>
                      <th scope="col">业务操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.map((row) => (
                      <tr key={row.eventId}>
                        <td>
                          <time dateTime={row.occurredAt}>
                            {new Date(row.occurredAt).toLocaleString("zh-CN")}
                          </time>
                        </td>
                        <td>
                          <strong>{row.actorDisplayName}</strong>
                          <small>{row.actorSubjectId}</small>
                        </td>
                        <td>{row.workUnitName}</td>
                        <td>
                          <strong>
                            {auditActionLabel(row.actionCode)}
                            {auditObjectLabel(row.aggregateType)}
                          </strong>
                          {displayableAuditIdentifier(row.aggregateId) && (
                            <small>
                              业务编号{" "}
                              {displayableAuditIdentifier(row.aggregateId)}
                            </small>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!loading && auditRows.length === 0 && (
                      <tr>
                        <td colSpan={4}>当前查询范围内暂无操作记录。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {auditTotalPages > 1 && (
                <nav aria-label="审计记录分页">
                  <button
                    disabled={loading || auditPage === 0}
                    onClick={() => void loadAuditEvents(auditPage - 1)}
                    type="button"
                  >
                    上一页
                  </button>
                  <span>
                    第 {auditPage + 1} / {auditTotalPages} 页
                  </span>
                  <button
                    disabled={loading || auditPage + 1 >= auditTotalPages}
                    onClick={() => void loadAuditEvents(auditPage + 1)}
                    type="button"
                  >
                    下一页
                  </button>
                </nav>
              )}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
