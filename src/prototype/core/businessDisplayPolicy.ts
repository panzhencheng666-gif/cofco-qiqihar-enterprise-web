const comparisonFallback = "比较数据暂不可用，请联系数据管理员核对统计口径";

export function businessComparisonReason(
  reason: string | null | undefined,
): string | null {
  const normalized = reason?.trim();
  if (!normalized) return null;
  if (/区划边界|行政区划边界/.test(normalized)) {
    return "各年度统计范围发生变化，暂不可直接比较";
  }
  if (/单位定义|单位.*(?:版本|转换)|批准转换/.test(normalized)) {
    return "各年度计量单位口径尚未完成换算确认";
  }
  if (/指标定义|桥接/.test(normalized)) {
    return "各年度统计口径尚未完成可比性确认";
  }
  if (/期间键|同期间|比较期间/.test(normalized)) return "比较期间不一致";
  if (/业务域坐标|业务坐标|同坐标/.test(normalized)) {
    return "指标所属业务范围不一致";
  }
  if (/数据层/.test(normalized)) return "各年度数据状态不一致";
  if (/合并矩阵|账户规范|规则可比|义务集合|规则版本/.test(normalized)) {
    return "各年度统计口径发生变化，暂不可直接比较";
  }
  if (
    /[A-Za-z_]/.test(normalized) ||
    /(?:METRIC|VERSION|BUILD|COMMIT|WORK|OBJ|RULE|CAPABILITY|PUB)-?/i.test(
      normalized,
    ) ||
    /版本|桥接|治理|坐标/.test(normalized)
  ) {
    return comparisonFallback;
  }
  return normalized;
}

export function businessDataBatchLabel(
  label: string | null | undefined,
  available: boolean,
): string {
  const normalized = label?.trim();
  if (
    normalized &&
    !/[A-Za-z_]/.test(normalized) &&
    !/(?:METRIC|VERSION|BUILD|COMMIT|WORK|OBJ|RULE|CAPABILITY|PUB)-?/i.test(
      normalized,
    )
  ) {
    return normalized;
  }
  return available ? "已核定数据（当前采用）" : "尚未形成可用数据";
}

export function chineseDateTime(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "时间待维护";
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      normalized,
    );
  if (!match) return "时间待维护";
  const [, year, month, day, hour, minute] = match;
  const date = `${year}年${Number(month)}月${Number(day)}日`;
  return hour && minute ? `${date} ${hour}:${minute}` : date;
}

export function chinesePeriodRange(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "有效期待维护";
  const range =
    /^(\d{4})-(\d{2})-(\d{2})\s*(?:至|到|—|~)\s*(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalized,
    );
  if (range) {
    const [, startYear, startMonth, startDay, endYear, endMonth, endDay] =
      range;
    return `${startYear}年${Number(startMonth)}月${Number(startDay)}日至${endYear}年${Number(endMonth)}月${Number(endDay)}日`;
  }
  if (!/[A-Za-z_]/.test(normalized) && /[年月日周季]/.test(normalized)) {
    return normalized;
  }
  return "有效期待维护";
}
