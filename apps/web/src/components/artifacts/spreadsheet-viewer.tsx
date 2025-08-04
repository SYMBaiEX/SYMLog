"use client"

import { useState, useMemo } from "react"
import type { SpreadsheetArtifact } from "@/types/artifacts"
import { cn } from "@/lib/utils"
import { GlassButton } from "@/components/ui/glass-button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Download,
  Filter,
} from "lucide-react"

interface SpreadsheetViewerProps {
  artifact: SpreadsheetArtifact
  className?: string
}

type SortDirection = "asc" | "desc" | null

export function SpreadsheetViewer({ artifact, className }: SpreadsheetViewerProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())

  const filteredAndSortedData = useMemo(() => {
    let data = [...artifact.data]

    // Filter by search term
    if (searchTerm) {
      data = data.filter((row) =>
        Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    }

    // Sort data
    if (sortColumn && sortDirection) {
      data.sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]

        if (aVal == null) return 1
        if (bVal == null) return -1

        let comparison = 0
        if (typeof aVal === "number" && typeof bVal === "number") {
          comparison = aVal - bVal
        } else {
          comparison = String(aVal).localeCompare(String(bVal))
        }

        return sortDirection === "asc" ? comparison : -comparison
      })
    }

    return data
  }, [artifact.data, searchTerm, sortColumn, sortDirection])

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else if (sortDirection === "desc") {
        setSortDirection(null)
        setSortColumn(null)
      }
    } else {
      setSortColumn(columnKey)
      setSortDirection("asc")
    }
  }

  const handleSelectAll = () => {
    if (selectedRows.size === filteredAndSortedData.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(filteredAndSortedData.map((_, i) => i)))
    }
  }

  const handleSelectRow = (index: number) => {
    const newSelected = new Set(selectedRows)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedRows(newSelected)
  }

  const exportToCSV = () => {
    const headers = artifact.columns.map(col => col.label).join(",")
    const rows = filteredAndSortedData.map(row =>
      artifact.columns.map(col => {
        const value = row[col.key]
        // Escape quotes and wrap in quotes if contains comma
        const stringValue = String(value ?? "")
        if (stringValue.includes(",") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      }).join(",")
    )
    
    const csv = [headers, ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${artifact.title}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const formatCellValue = (value: any, type: string) => {
    if (value == null) return ""
    
    switch (type) {
      case "number":
        return typeof value === "number" ? value.toLocaleString() : value
      case "date":
        return value instanceof Date
          ? value.toLocaleDateString()
          : new Date(value).toLocaleDateString()
      case "boolean":
        return value ? "✓" : "✗"
      default:
        return String(value)
    }
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 p-4 border-b border-white/10">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-black/20"
          />
        </div>
        <GlassButton
          variant="ghost"
          size="sm"
          onClick={exportToCSV}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </GlassButton>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        <Table>
          <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filteredAndSortedData.length}
                  onChange={handleSelectAll}
                  className="rounded border-white/20"
                  aria-label="Select all rows"
                />
              </TableHead>
              {artifact.columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width }}
                  className="cursor-pointer select-none"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {sortColumn === column.key ? (
                      sortDirection === "asc" ? (
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
                key={rowIndex}
                className={cn(
                  selectedRows.has(rowIndex) && "bg-white/5"
                )}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedRows.has(rowIndex)}
                    onChange={() => handleSelectRow(rowIndex)}
                    className="rounded border-white/20"
                    aria-label={`Select row ${rowIndex + 1}`}
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
      <div className="flex items-center justify-between p-4 border-t border-white/10 text-sm text-muted-foreground">
        <div>
          {selectedRows.size > 0 && (
            <span>{selectedRows.size} row(s) selected • </span>
          )}
          {filteredAndSortedData.length} row(s)
          {searchTerm && ` (filtered from ${artifact.data.length})`}
        </div>
      </div>
    </div>
  )
}