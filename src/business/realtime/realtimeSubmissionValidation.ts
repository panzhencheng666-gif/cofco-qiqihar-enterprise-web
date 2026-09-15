import type { RealtimeFormField } from "./realtimeRecordFormModel";
import { RealtimeApiError } from "@/platform/api/realtimeApiClient";

export function validateSubmissionFields(
  fields: readonly RealtimeFormField[],
  values: Readonly<Record<string, string>>,
  options: (
    field: RealtimeFormField,
  ) => readonly { value: string; label: string }[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.readOnly) continue;
    const value = values[field.code]?.trim() ?? "";
    const region = field.type === "region";
    if (!value) {
      if (field.required || region)
        errors[field.code] =
          `请${field.type === "select" || region ? "选择" : "填写"}${field.label}。`;
      continue;
    }
    if (field.type === "select" || region) {
      if (!options(field).some((option) => option.value === value))
        errors[field.code] = `请从当前选项中重新选择${field.label}。`;
    } else if (field.type === "decimal") {
      if (
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value) ||
        !Number.isFinite(Number(value))
      ) {
        errors[field.code] =
          `${field.label}须填写数值，例如 100.5；单位请按栏目标题，不要写入数值。`;
        continue;
      }
      const [whole, fraction = ""] = value.replace(/^[+-]/u, "").split(".");
      const scale = field.scale;
      const precision = field.precision;
      if (scale != null && fraction.length > scale)
        errors[field.code] =
          `${field.label}最多保留 ${scale} 位小数，例如 ${scale === 0 ? "100" : "1." + "2".repeat(scale)}。`;
      if (
        precision != null &&
        scale != null &&
        whole.replace(/^0+/u, "").length > precision - scale
      )
        errors[field.code] =
          `${field.label}整数部分最多 ${precision - scale} 位，请核对数值和单位。`;
      if (
        field.code.endsWith("LATITUDE") &&
        (Number(value) < -90 || Number(value) > 90)
      )
        errors[field.code] = "纬度须在 -90 至 90 之间，例如 47.3543。";
      if (
        field.code.endsWith("LONGITUDE") &&
        (Number(value) < -180 || Number(value) > 180)
      )
        errors[field.code] = "经度须在 -180 至 180 之间，例如 123.9182。";
    } else if (
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      errors[field.code] = `${field.label}须为有效日期，例如 2026-09-15。`;
    }
  }
  return errors;
}

export function submissionFailure(
  error: unknown,
  fields: readonly RealtimeFormField[],
) {
  if (!(error instanceof RealtimeApiError))
    return {
      message: "尚未确认保存结果，请先刷新列表核对，避免重复提交。",
      fields: {},
    };
  if (error.status === 401)
    return { message: "登录已失效，请重新登录；填写内容已保留。", fields: {} };
  if (error.code === "API_TIMEOUT" || error.code === "API_NETWORK_ERROR")
    return {
      message: "连接中断，尚未确认保存结果，请先核对列表，避免重复提交。",
      fields: {},
    };
  const message =
    error.clientMessage ??
    (error.status === 403
      ? "当前账号或单据状态不允许此操作，请刷新后核对。"
      : error.status === 409
        ? "记录已发生变化，请刷新记录后核对再保存。"
        : "保存未通过校验，请核对必填项、数值范围及地区选项后重试。");
  const invalid = Object.fromEntries(
    fields
      .filter(
        (field) =>
          !field.readOnly &&
          (Boolean(error.clientMessage?.includes(field.label)) ||
            (error.status === 400 && error.message.includes(field.code))),
      )
      .map((field) => [
        field.code,
        error.clientMessage ??
          `${field.label}未通过服务端校验，请核对填写内容。`,
      ]),
  );
  return {
    message,
    fields: { ...invalid, ...serverFieldErrors(error, fields) },
  };
}

/** Only render reasons attached to fields in the current form contract. */
export function serverFieldErrors(
  error: unknown,
  fields: readonly { code: string; readOnly?: boolean }[],
): Record<string, string> {
  if (
    !(error instanceof RealtimeApiError) ||
    ![400, 422].includes(error.status)
  )
    return {};
  const details = error.details;
  if (!details || typeof details !== "object") return {};
  const values =
    (details as { fieldErrors?: unknown; errors?: unknown }).fieldErrors ??
    (details as { errors?: unknown }).errors;
  if (!values || typeof values !== "object" || Array.isArray(values)) return {};
  const allowed = new Set(
    fields.filter((field) => !field.readOnly).map((field) => field.code),
  );
  return Object.fromEntries(
    Object.entries(values).flatMap(([code, value]) => {
      if (!allowed.has(code)) return [];
      const reasons = (Array.isArray(value) ? value : [value])
        .filter((reason): reason is string => typeof reason === "string")
        .map(
          (message) =>
            new RealtimeApiError({
              status: 400,
              code: "FIELD_INVALID",
              message,
            }).clientMessage,
        )
        .filter(Boolean);
      return reasons.length ? [[code, reasons.join("；")]] : [];
    }),
  );
}
