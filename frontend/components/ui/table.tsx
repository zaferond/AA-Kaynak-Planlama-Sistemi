"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { todayMonthProgress } from "@/src/resource-dates"

type TableProps = React.ComponentProps<"table"> & {
  todayDate?: string
  todayMonthsKey?: string
  stickyProjectRows?: boolean
}

function Table({ className, todayDate, todayMonthsKey, stickyProjectRows, ...props }: TableProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const markerRef = React.useRef<HTMLDivElement>(null)
  const updateProjectRows = React.useRef<(() => void) | null>(null)

  React.useLayoutEffect(() => {
    const container = containerRef.current
    const header = container?.querySelector("thead")
    if (!stickyProjectRows || !container || !header) return
    const update = () => {
      const headerHeight = header.offsetHeight
      const zoom = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1
      const top = container.getBoundingClientRect().top
      // Read all group bounds before updating styles to avoid repeated layout work.
      const positions = Array.from(container.querySelectorAll<HTMLTableSectionElement>("tbody[data-project-group]"))
        .flatMap(group => {
          const heading = group.querySelector<HTMLTableRowElement>("[data-project-heading]")
          if (!heading) return []
          const end = (group.getBoundingClientRect().bottom - top - heading.getBoundingClientRect().height) / zoom
          return [{ heading, offset: Math.min(headerHeight, end) }]
        })
      container.style.setProperty("--project-sticky-offset", `${headerHeight}px`)
      for (const { heading, offset } of positions) {
        heading.style.setProperty("--project-row-top", `${offset}px`)
      }
    }
    updateProjectRows.current = update
    update()
    container.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(header)
    const table = container.querySelector("table")
    if (table) observer.observe(table)
    return () => {
      updateProjectRows.current = null
      container.removeEventListener("scroll", update)
      observer.disconnect()
      container.style.removeProperty("--project-sticky-offset")
      for (const row of container.querySelectorAll<HTMLElement>("[data-project-heading]")) row.style.removeProperty("--project-row-top")
    }
  }, [stickyProjectRows])

  React.useLayoutEffect(() => { updateProjectRows.current?.() })

  React.useLayoutEffect(() => {
    const container = containerRef.current
    const marker = markerRef.current
    if (!container || !marker || !todayDate) return
    const table = container.querySelector("table")
    const header = Array.from(container.querySelectorAll<HTMLTableCellElement>("thead th[data-month], thead th[data-date-start]"))
      .find(cell => cell.dataset.month === todayDate.slice(0, 7) || !!cell.dataset.dateStart && cell.dataset.dateStart <= todayDate && todayDate <= (cell.dataset.dateEnd || ""))
    if (!table || !header) {
      marker.style.display = "none"
      return
    }
    const update = () => {
      const containerRect = container.getBoundingClientRect()
      const headerRect = header.getBoundingClientRect()
      const start=header.dataset.dateStart
      const end=header.dataset.dateEnd
      const progress=start&&end?((Date.parse(todayDate+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000+0.5)/((Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000+1):todayMonthProgress(todayDate)
      const zoom=Number.parseFloat(getComputedStyle(document.documentElement).zoom)||1
      marker.style.left = `${(headerRect.left - containerRect.left + headerRect.width * progress)/zoom + container.scrollLeft}px`
      // Keep the marker inside the content bounds. Following scrollTop would
      // retain obsolete scroll space when rows are collapsed or filtered out.
      marker.style.top = "0px"
      marker.style.height = `${table.offsetHeight}px`
      marker.style.display = "block"
    }
    update()
    container.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(table)
    observer.observe(header)
    return () => {
      container.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [todayDate, todayMonthsKey])

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      data-sticky-projects={stickyProjectRows ? "true" : undefined}
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
      {todayDate && <div ref={markerRef} className="today-date-line" title={`Bugün: ${todayDate}`} aria-hidden="true" />}
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
