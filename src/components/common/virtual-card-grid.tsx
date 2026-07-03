"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  getColumnCount,
  gridClassFromColumnConfig,
  type ColumnBreakpointConfig,
} from "@/lib/responsive-columns";

const VIRTUALIZE_THRESHOLD = 24;
const DEFAULT_GAP_PX = 18;
const CARD_ASPECT = 7 / 5;

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export function VirtualCardGrid<T>({
  items,
  columnConfig,
  getItemKey,
  renderItem,
  estimateExtraHeight = 96,
  gapPx = DEFAULT_GAP_PX,
}: {
  items: T[];
  columnConfig: ColumnBreakpointConfig;
  getItemKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Hauteur sous la carte (titre, actions…) en px */
  estimateExtraHeight?: number;
  gapPx?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const measure = () => {
      setWidth(el.clientWidth);
      setScrollMargin(el.offsetTop);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);

  const columns = Math.max(1, getColumnCount(width, columnConfig));
  const rows = useMemo(() => chunk(items, columns), [items, columns]);
  const gridClass = gridClassFromColumnConfig(columnConfig);

  const rowHeight = useMemo(() => {
    if (width <= 0) return 280;
    const cardWidth = (width - gapPx * (columns - 1)) / columns;
    const cardHeight = cardWidth * CARD_ASPECT;
    return cardHeight + estimateExtraHeight;
  }, [width, columns, estimateExtraHeight, gapPx]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => rowHeight,
    overscan: 3,
    scrollMargin,
    gap: gapPx,
  });

  if (items.length < VIRTUALIZE_THRESHOLD) {
    return (
      <div ref={parentRef} className={gridClass}>
        {items.map((item) => (
          <div key={getItemKey(item)}>{renderItem(item)}</div>
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const rowItems = rows[virtualRow.index] ?? [];
        return (
          <div
            key={virtualRow.key}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
            className={gridClass}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {rowItems.map((item) => (
              <div key={getItemKey(item)}>{renderItem(item)}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
