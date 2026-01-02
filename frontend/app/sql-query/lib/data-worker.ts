/**
 * Data processing Web Worker wrapper
 * Offloads heavy data transformations to a separate thread
 */

type WorkerTask = 'parse-csv' | 'filter-rows' | 'sort-data' | 'aggregate'

interface WorkerMessage {
    task: WorkerTask
    data: any
}

interface WorkerResponse {
    task: WorkerTask
    result: any
    error?: string
}

class DataWorkerPool {
    private workers: Worker[] = []
    private taskQueue: Array<{
        task: WorkerTask
        data: any
        resolve: (result: any) => void
        reject: (error: Error) => void
    }> = []
    private maxWorkers = navigator.hardwareConcurrency || 4

    constructor() {
        // Workers are created on-demand
    }

    async execute(task: WorkerTask, data: any): Promise<any> {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ task, data, resolve, reject })
            this.processQueue()
        })
    }

    private processQueue() {
        if (this.taskQueue.length === 0) return

        // Find available worker or create new one
        const availableWorker = this.workers.find(w => (w as any).busy === false)

        if (availableWorker) {
            this.assignTask(availableWorker)
        } else if (this.workers.length < this.maxWorkers) {
            const worker = this.createWorker()
            this.workers.push(worker)
            this.assignTask(worker)
        }
        // If all workers busy and max reached, task will be processed when worker becomes available
    }

    private createWorker(): Worker {
        // In a real implementation, this would load a separate worker file
        // For now, we'll use inline worker with blob URL
        const workerCode = `
      self.onmessage = function(e) {
        const { task, data } = e.data
        
        try {
          let result
          
          switch(task) {
            case 'filter-rows':
              result = data.rows.filter(row => {
                // Apply filters
                return true // Simplified
              })
              break
              
            case 'sort-data':
              result = [...data.rows].sort((a, b) => {
                const aVal = a[data.column]
                const bVal = b[data.column]
                return data.direction === 'asc' 
                  ? aVal > bVal ? 1 : -1
                  : aVal < bVal ? 1 : -1
              })
              break
              
            default:
              result = data
          }
          
          self.postMessage({ task, result })
        } catch (error) {
          self.postMessage({ task, error: error.message })
        }
      }
    `

        const blob = new Blob([workerCode], { type: 'application/javascript' })
        const worker = new Worker(URL.createObjectURL(blob))

            ; (worker as any).busy = false

        return worker
    }

    private assignTask(worker: Worker) {
        const task = this.taskQueue.shift()
        if (!task) return

            ; (worker as any).busy = true

        worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
            ; (worker as any).busy = false

            if (e.data.error) {
                task.reject(new Error(e.data.error))
            } else {
                task.resolve(e.data.result)
            }

            // Process next task if any
            this.processQueue()
        }

        worker.onerror = (error) => {
            ; (worker as any).busy = false
            task.reject(new Error(error.message))
            this.processQueue()
        }

        worker.postMessage({ task: task.task, data: task.data })
    }

    terminate() {
        this.workers.forEach(w => w.terminate())
        this.workers = []
        this.taskQueue = []
    }
}

// Singleton instance
export const dataWorkerPool = new DataWorkerPool()

/**
 * Hook to use data worker pool
 */
export function useDataWorker() {
    return {
        filterRows: (rows: any[], filter: any) =>
            dataWorkerPool.execute('filter-rows', { rows, filter }),

        sortData: (rows: any[], column: string, direction: 'asc' | 'desc') =>
            dataWorkerPool.execute('sort-data', { rows, column, direction }),
    }
}
