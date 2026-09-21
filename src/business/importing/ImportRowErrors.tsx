export interface ImportRowError {
  rowNumber: number;
  worksheet?: string | null;
  field: string;
  message: string;
}

export function ImportRowErrors({
  errors,
}: {
  errors?: readonly ImportRowError[];
}) {
  if (!errors?.length) return null;
  return (
    <table
      aria-label="实际导入错误"
      className="business-import-correction submission-field-error"
    >
      <thead>
        <tr>
          <th>文件行号</th>
          <th>字段</th>
          <th>具体原因</th>
        </tr>
      </thead>
      <tbody>
        {errors.map((error, index) => (
          <tr key={`${error.worksheet ?? ""}-${error.rowNumber}-${index}`}>
            <td>
              {error.worksheet ? `${error.worksheet} · ` : ""}
              {error.rowNumber}
            </td>
            <td>{error.field}</td>
            <td>{error.message}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
