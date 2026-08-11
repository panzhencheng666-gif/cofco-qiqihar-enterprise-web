import type { ReactNode } from "react";

export interface EnterpriseWorkTableColumn<Row extends object> {
  key: keyof Row & string;
  title: string;
  group?: string;
  frozen?: boolean;
  editable?: boolean;
  align?: "left" | "center" | "right";
  render?: (row: Row) => ReactNode;
}

export interface EnterpriseWorkTableProps<Row extends object> {
  ariaLabel: string;
  columns: readonly EnterpriseWorkTableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  emptyText: string;
  footer?: ReactNode;
}

interface GroupedHeader<Row extends object> {
  key: string;
  label: string | null;
  columns: EnterpriseWorkTableColumn<Row>[];
}

function groupHeaders<Row extends object>(
  columns: readonly EnterpriseWorkTableColumn<Row>[],
): readonly GroupedHeader<Row>[] {
  return columns.reduce<GroupedHeader<Row>[]>((segments, column, index) => {
    const previous = segments.at(-1);
    if (column.group && previous?.label === column.group) {
      previous.columns.push(column);
      return segments;
    }
    segments.push({
      key: column.group
        ? `group:${column.group}:${index}`
        : `column:${column.key}`,
      label: column.group ?? null,
      columns: [column],
    });
    return segments;
  }, []);
}

function cellValue<Row extends object>(
  row: Row,
  column: EnterpriseWorkTableColumn<Row>,
): ReactNode {
  if (column.render) return column.render(row);
  const value = row[column.key];
  return value == null ? "—" : String(value);
}

export function EnterpriseWorkTable<Row extends object>({
  ariaLabel,
  columns,
  rows,
  getRowId,
  emptyText,
  footer,
}: EnterpriseWorkTableProps<Row>) {
  const headerGroups = groupHeaders(columns);
  const hasGroupedColumns = headerGroups.some(({ label }) => label !== null);

  return (
    <section className="enterprise-work-table">
      <div className="enterprise-work-table__scroll" tabIndex={0}>
        <table aria-label={ariaLabel}>
          <thead>
            <tr>
              {headerGroups.map((header) =>
                header.label ? (
                  <th
                    colSpan={header.columns.length}
                    key={header.key}
                    scope="colgroup"
                  >
                    {header.label}
                  </th>
                ) : (
                  <th
                    className={
                      header.columns[0]?.frozen ? "is-frozen" : undefined
                    }
                    key={header.key}
                    rowSpan={hasGroupedColumns ? 2 : 1}
                    scope="col"
                  >
                    {header.columns[0]?.title}
                  </th>
                ),
              )}
            </tr>
            {hasGroupedColumns && (
              <tr>
                {headerGroups.flatMap((header) =>
                  header.label
                    ? header.columns.map((column) => (
                        <th key={`${header.key}:${column.key}`} scope="col">
                          {column.title}
                        </th>
                      ))
                    : [],
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={getRowId(row)}>
                  {columns.map((column) => {
                    const className = [
                      column.frozen ? "is-frozen" : "",
                      column.align ? `is-${column.align}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return column.frozen ? (
                      <th
                        className={className || undefined}
                        data-editable={column.editable ? "true" : undefined}
                        key={column.key}
                        scope="row"
                      >
                        {cellValue(row, column)}
                      </th>
                    ) : (
                      <td
                        className={className || undefined}
                        data-editable={column.editable ? "true" : undefined}
                        key={column.key}
                      >
                        {cellValue(row, column)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  className="enterprise-work-table__empty"
                  colSpan={columns.length}
                >
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
}
