import type { Dataset } from '../datasets'

interface StoredDataset {
  dataset: Dataset
  file: File
  hasHeader: boolean
}

const storeName = 'datasets'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('prote-prote', 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName, { keyPath: 'dataset.name' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode)
      const request = operation(transaction.objectStore(storeName))

      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(transaction.error ?? request.error)
    })
  } finally {
    database.close()
  }
}

export async function listStoredDatasets(): Promise<Dataset[]> {
  const records = await runTransaction<StoredDataset[]>('readonly', (store) => store.getAll())
  return records.map(({ dataset }) => dataset)
}

export async function saveStoredDataset(record: StoredDataset): Promise<void> {
  await runTransaction('readwrite', (store) => store.put(record))
}

export async function deleteStoredDataset(name: string): Promise<void> {
  await runTransaction('readwrite', (store) => store.delete(name))
}
