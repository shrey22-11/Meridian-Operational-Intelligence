import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Empty } from "./UI";

export default function DataTable({
  columns,
  rows = [],
  caption,
  emptyTitle,
  emptyDescription,
  initialSort,
  rowKey,
  onRowSelect,
  selectedKey,
  compact = false,
  pageSize,
}) {
  const [sort, setSort] = useState(initialSort || null);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [rows.length, sort]);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    return [...rows].sort((a, b) => {
      const x = a[sort.key],
        y = b[sort.key];
      if (x == null) return y == null ? 0 : 1;
      if (y == null) return -1;
      const result =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), undefined, { numeric: true });
      return sort.direction === "asc" ? result : -result;
    });
  }, [rows, sort]);
  const pageCount = pageSize ? Math.ceil(sorted.length / pageSize) : 1;
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const start = pageSize ? currentPage * pageSize : 0;
  const visible = pageSize ? sorted.slice(start, start + pageSize) : sorted;
  if (!rows.length) return <Empty title={emptyTitle}>{emptyDescription}</Empty>;
  function toggle(key) {
    setSort((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }
  return (
    <>
      <div
        className={`table-scroll ${compact ? "compact-table" : ""} ${columns.length <= 2 ? "narrow-table" : ""}`}
        tabIndex={0}
        role="region"
        aria-label={caption}
      >
        <table>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.numeric ? "numeric" : ""}
                  aria-sort={
                    sort?.key === column.key
                      ? sort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : column.sortable === false
                        ? undefined
                        : "none"
                  }
                >
                  {column.sortable === false ? (
                    column.label
                  ) : (
                    <button
                      onClick={() => toggle(column.key)}
                      aria-label={`Sort by ${column.label}`}
                    >
                      {column.label}
                      {sort?.key === column.key ? (
                        sort.direction === "asc" ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        )
                      ) : (
                        <ArrowUpDown size={11} className="sort-idle" />
                      )}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => {
              const key = rowKey ? row[rowKey] : index;
              return (
                <tr
                  key={key}
                  className={selectedKey === key ? "row-selected" : ""}
                >
                  {columns.map((column, colIndex) => (
                    <td
                      key={column.key}
                      className={column.numeric ? "numeric" : ""}
                    >
                      {onRowSelect && colIndex === 0 ? (
                        <button
                          className="table-link"
                          onClick={() => onRowSelect(row)}
                          aria-label={`Inspect order ${key}`}
                        >
                          {column.render
                            ? column.render(row[column.key], row)
                            : row[column.key]}
                        </button>
                      ) : column.render ? (
                        column.render(row[column.key], row)
                      ) : (
                        (row[column.key] ?? "—")
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pageSize && (
        <div className="table-pagination">
          <span aria-live="polite">
            {start + 1}–{Math.min(start + pageSize, rows.length)} of{" "}
            {rows.length} records
          </span>
          <div>
            <button
              className="button quiet"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <span>
              Page {currentPage + 1} of {pageCount}
            </span>
            <button
              className="button quiet"
              disabled={currentPage + 1 >= pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
}
