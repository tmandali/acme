/**
 * Performance monitoring hook for data grid
 * Tracks render times, memory usage, and FPS
 */

import { useEffect, useRef, useState } from 'react'

interface PerformanceMetrics {
    renderTime: number
    fps: number
    memoryUsage?: number
    rowCount: number
    visibleRows: number
}

export function usePerformanceMonitoring(
    rowCount: number,
    visibleRowCount: number,
    enabled: boolean = process.env.NODE_ENV === 'development'
) {
    const [metrics, setMetrics] = useState<PerformanceMetrics>({
        renderTime: 0,
        fps: 0,
        rowCount: 0,
        visibleRows: 0,
    })

    const frameCountRef = useRef(0)
    const lastTimeRef = useRef(performance.now())
    const renderStartRef = useRef(0)

    useEffect(() => {
        if (!enabled) return

        renderStartRef.current = performance.now()

        return () => {
            const renderTime = performance.now() - renderStartRef.current

            // Update metrics
            setMetrics(prev => ({
                ...prev,
                renderTime,
                rowCount,
                visibleRows: visibleRowCount,
            }))
        }
    }, [rowCount, visibleRowCount, enabled])

    // FPS tracking
    useEffect(() => {
        if (!enabled) return

        let rafId: number

        const measureFPS = () => {
            frameCountRef.current++
            const now = performance.now()
            const delta = now - lastTimeRef.current

            if (delta >= 1000) {
                const fps = Math.round((frameCountRef.current * 1000) / delta)

                setMetrics(prev => ({ ...prev, fps }))

                frameCountRef.current = 0
                lastTimeRef.current = now
            }

            rafId = requestAnimationFrame(measureFPS)
        }

        rafId = requestAnimationFrame(measureFPS)

        return () => cancelAnimationFrame(rafId)
    }, [enabled])

    // Memory usage (if available)
    useEffect(() => {
        if (!enabled || !(performance as any).memory) return

        const interval = setInterval(() => {
            const memory = (performance as any).memory
            if (memory) {
                setMetrics(prev => ({
                    ...prev,
                    memoryUsage: Math.round(memory.usedJSHeapSize / 1048576), // MB
                }))
            }
        }, 2000)

        return () => clearInterval(interval)
    }, [enabled])

    return metrics
}

/**
 * Log performance warnings
 */
export function logPerformanceWarning(metrics: PerformanceMetrics) {
    if (metrics.renderTime > 100) {
        console.warn(`⚠️ Slow render detected: ${metrics.renderTime.toFixed(2)}ms`)
    }

    if (metrics.fps < 30) {
        console.warn(`⚠️ Low FPS detected: ${metrics.fps}`)
    }

    if (metrics.memoryUsage && metrics.memoryUsage > 500) {
        console.warn(`⚠️ High memory usage: ${metrics.memoryUsage}MB`)
    }
}
