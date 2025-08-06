'use client';

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Filter,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { GlassButton } from '@/components/ui/glass-button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { SpreadsheetArtifact } from '@/types/artifacts';

interface SpreadsheetViewerProps {
  artifact: SpreadsheetArtifact;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

export function SpreadsheetViewer({
  artifact,
  className,
}: SpreadsheetViewerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const filteredAndSortedData = useMemo(() => {
    let data = [...artifact.data];

    // Filter by search term
    if (searchTerm) {
      data = data.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Sort data
    if (sortColumn && sortDirection) {
      data.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (aVal == null) return 1;
        if (bVal == null) return -1;

        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }

        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return data;
  }, [artifact.data, searchTerm, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedRows.size === filteredAndSortedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredAndSortedData.map((_, i) => i)));
    }
  };

  const handleSelectRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const exportToCSV = () => {
    const headers = artifact.columns.map((col) => col.label).join(',');
    const rows = filteredAndSortedData.map((row) =>
      artifact.columns
        .map((col) => {
          const value = row[col.key];
          // Escape quotes and wrap in quotes if contains comma
          const stringValue = String(value ?? '');
          if (stringValue.includes(',') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',')
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatCellValue = (value: any, type: string) => {
    if (value == null) return '';

    switch (type) {
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      case 'date':
        return value instanceof Date
          ? value.toLocaleDateString()
          : new Date(value).toLocaleDateString();
      case 'boolean':
        return value ? '✓' : '✗';
      default:
        return String(value);
    }
  };

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 border-white/10 border-b p-4">
        <div className="relative max-w-sm flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
          <Input
            className="bg-black/20 pl-9"
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search..."
            value={searchTerm}
          />
        </div>
        <GlassButton
          className="gap-2"
          onClick={exportToCSV}
          size="sm"
          variant="ghost"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </GlassButton>
      </div>

      {/* Table */}
      <div className="scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
            <TableRow>
              <TableHead className="w-12">
                <input
                  aria-label="Select all rows"
                  checked={selectedRows.size === filteredAndSortedData.length}
                  className="rounded border-white/20"
                  onChange={handleSelectAll}
                  type="checkbox"
                />
              </TableHead>
              {artifact.columns.map((column) => (
                <TableHead
                  className="cursor-pointer select-none"
                  key={column.key}
                  onClick={() => handleSort(column.key)}
                  style={{ width: column.width }}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {sortColumn === column.key ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.map((row, rowIndex) => (
              <TableRow
                className={cn(selectedRows.has(rowIndex) && 'bg-white/5')}
                key={rowIndex}
              >
                <TableCell>
                  <input
                    aria-label={`Select row ${rowIndex + 1}`}
                    checked={selectedRows.has(rowIndex)}
                    className="rounded border-white/20"
                    onChange={() => handleSelectRow(rowIndex)}
                    type="checkbox"
                  />
                </TableCell>
                {artifact.columns.map((column) => (
                  <TableCell key={column.key}>
                    {formatCellValue(row[column.key], column.type)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-white/10 border-t p-4 text-muted-foreground text-sm">
        <div>
          {selectedRows.size > 0 && (
            <span>{selectedRows.size} row(s) selected • </span>
          )}
          {filteredAndSortedData.length} row(s)
          {searchTerm && ` (filtered from ${artifact.data.length})`}
        </div>
      </div>
    </div>
  );
}
