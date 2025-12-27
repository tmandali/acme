/**
 * Column virtualization hook
 * Only renders visible columns for tables with many columns
 */

import { useEffect, useRef, useState } from 'react'

interface ColumnRange {
    startIndex: number
    endIndex: number
    visibleColumns: number
}

/**
 * Hook to track visible column range for horizontal virtualization
 * @param totalColumns - Total number of columns
 * @param columnWidth - Average column width in pixels
 * @param overscan - Number of extra columns to render on each side
 */
export function useColumnVirtualization(
    totalColumns: number,
    columnWidth: number = 150,
    overscan: number = 2
): ColumnRange {
    const [range, setRange] = useState<ColumnRange>({
        startIndex: 0,
        endIndex: Math.min(10, totalColumns),
        visibleColumns: Math.min(10, totalColumns),
    })

    const scrollRef = useRef<Element | null>(null)

    useEffect(() => {
        const element = scrollRef.current
        if (!element || totalColumns <= 10) return

        const handleScroll = () => {
            const scrollLeft = element.scrollLeft
            const containerWidth = element.clientWidth

            const startIndex = Math.max(0, Math.floor(scrollLeft / columnWidth) - overscan)
            const visibleColumns = Math.ceil(containerWidth / columnWidth)
            const endIndex = Math.min(
                totalColumns,
                startIndex + visibleColumns + overscan * 2
            )

            setRange({ startIndex, endIndex, visibleColumns })
        }

        element.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll() // Initial calculation

        return () => element.removeEventListener('scroll', handleScroll)
    }, [totalColumns, columnWidth, overscan])

    return range
}

/**
 * Determine if column virtualization should be enabled
 */
export function shouldVirtualizeColumns(columnCount: number): boolean {
    return columnCount > 20 // Enable for tables with more than 20 columns
}
