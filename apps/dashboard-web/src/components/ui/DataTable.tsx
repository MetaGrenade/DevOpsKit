import { useRef, useState, type ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  width?: string;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  emptyMessage?: ReactNode;
  /** Force virtualization on/off. Defaults to auto when rows exceed the threshold. */
  virtualize?: boolean;
  /** Row count above which virtualization kicks in automatically. */
  virtualizeThreshold?: number;
  /** Fixed row height in px used for windowing math. */
  rowHeight?: number;
  /** Visible rows before the body scrolls (controls the scroll viewport height). */
  visibleRows?: number;
}

const OVERSCAN = 6;

function cellValue<T>(row: T, column: DataTableColumn<T>): ReactNode {
  if (column.render) {
    return column.render(row);
  }
  const value = (row as Record<string, unknown>)[column.key];
  return value === undefined || value === null || value === "" ? "—" : (value as ReactNode);
}

export default function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No rows to display.",
  virtualize,
  virtualizeThreshold = 60,
  rowHeight = 41,
  visibleRows = 12,
}: DataTableProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = virtualize ?? rows.length > virtualizeThreshold;

  if (rows.length === 0) {
    return <p className="panel-subtext">{emptyMessage}</p>;
  }

  const head = (
    <thead>
      <tr>
        {columns.map((column) => (
          <th
            key={column.key}
            style={{ width: column.width, textAlign: column.align }}
            className={column.className}
          >
            {column.header}
          </th>
        ))}
      </tr>
    </thead>
  );

  if (!shouldVirtualize) {
    return (
      <div className="data-table-wrap">
        <table className="data-table">
          {head}
          <tbody>
            {rows.map((row, index) => (
              <tr key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <td key={column.key} style={{ textAlign: column.align }} className={column.className}>
                    {cellValue(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const viewportHeight = visibleRows * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN,
  );
  const topPad = startIndex * rowHeight;
  const bottomPad = (rows.length - endIndex) * rowHeight;
  const visible = rows.slice(startIndex, endIndex);

  return (
    <div
      ref={scrollRef}
      className="data-table-wrap data-table-scroll"
      style={{ maxHeight: viewportHeight, overflowY: "auto" }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <table className="data-table">
        {head}
        <tbody>
          {topPad > 0 && (
            <tr aria-hidden="true" style={{ height: topPad }}>
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          )}
          {visible.map((row, index) => (
            <tr key={getRowKey(row, startIndex + index)} style={{ height: rowHeight }}>
              {columns.map((column) => (
                <td key={column.key} style={{ textAlign: column.align }} className={column.className}>
                  {cellValue(row, column)}
                </td>
              ))}
            </tr>
          ))}
          {bottomPad > 0 && (
            <tr aria-hidden="true" style={{ height: bottomPad }}>
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
