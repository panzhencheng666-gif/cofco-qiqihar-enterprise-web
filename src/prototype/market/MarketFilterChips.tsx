export interface MarketFilterCondition {
  id: string;
  label: string;
  onClear: () => void;
}

export function MarketFilterChips({
  conditions,
  emptyLabel,
}: {
  conditions: readonly MarketFilterCondition[];
  emptyLabel: string;
}) {
  return (
    <div aria-label="当前查询条件" className="market-task6-active-filters">
      <strong>当前查询条件：</strong>
      {conditions.length === 0 ? (
        <span>{emptyLabel}</span>
      ) : (
        <div className="market-task6-filter-chips">
          {conditions.map((condition) => (
            <button
              aria-label={`清除条件：${condition.label}`}
              className="market-task6-filter-chip"
              key={condition.id}
              type="button"
              onClick={condition.onClear}
            >
              <span>{condition.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
