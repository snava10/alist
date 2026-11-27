/* eslint-disable @typescript-eslint/no-explicit-any */
type FirestoreDoc = Record<string, any>;

type FirestoreData = {
  [collection: string]: {
    [docId: string]: FirestoreDoc;
  };
};

type FirestoreWhereOperator =
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'array-contains'
  | 'in'
  | 'not-in';

type WhereFilter = {
  field: string;
  op: FirestoreWhereOperator;
  value: any;
};

type OrderBy = {
  field: string;
  direction: 'asc' | 'desc';
};

type SnapshotListener = {
  filters: WhereFilter[];
  onNext: (snapshot: { empty: boolean; docs: SnapshotDoc[] }) => void;
};

type SnapshotDoc = {
  id: string;
  data: () => FirestoreDoc;
  ref: MockDoc;
};

export class MockFirestore {
  private data: FirestoreData = {};
  private listeners = new Map<string, Set<SnapshotListener>>();

  collection(name: string) {
    if (!this.data[name]) this.data[name] = {};
    return new MockCollection(this, name, this.data[name]);
  }

  addListener(collectionName: string, listener: SnapshotListener): () => void {
    let listeners = this.listeners.get(collectionName);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(collectionName, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  notify(collectionName: string) {
    const listeners = this.listeners.get(collectionName);
    if (!listeners) return;
    const collectionData = this.data[collectionName] ?? {};
    const entries = Object.entries(collectionData);
    for (const listener of [...listeners]) {
      const docs = applyFilters(entries, listener.filters, this, collectionName, collectionData);
      listener.onNext({ empty: docs.length === 0, docs });
    }
  }

  seed(initialData: FirestoreData) {
    // Deep clone to avoid mutation across tests
    this.data = JSON.parse(JSON.stringify(initialData));
  }

  clear() {
    this.data = {};
  }
}

function toSnapshotDocs(
  entries: Array<[string, FirestoreDoc]>,
  firestore: MockFirestore,
  collectionName: string,
  collectionData: Record<string, FirestoreDoc>
): SnapshotDoc[] {
  return entries.map(([id, data]) => ({
    id,
    data: () => data,
    ref: new MockDoc(firestore, collectionName, collectionData, id),
  }));
}

function applyFilters(
  entries: Array<[string, FirestoreDoc]>,
  filters: WhereFilter[],
  firestore: MockFirestore,
  collectionName: string,
  collectionData: Record<string, FirestoreDoc>
): SnapshotDoc[] {
  const filtered = entries.filter(([_, data]) =>
    filters.every(({ field, op, value }) => {
      const fieldValue = data[field];
      switch (op) {
        case '==':
          return fieldValue === value;
        case '!=':
          return fieldValue !== value;
        case '<':
          return fieldValue < value;
        case '<=':
          return fieldValue <= value;
        case '>':
          return fieldValue > value;
        case '>=':
          return fieldValue >= value;
        case 'array-contains':
          return Array.isArray(fieldValue) && fieldValue.includes(value);
        case 'in':
          return Array.isArray(value) && value.includes(fieldValue);
        case 'not-in':
          return Array.isArray(value) && !value.includes(fieldValue);
        default:
          throw new Error(`Unsupported operator: ${op}`);
      }
    })
  );
  return toSnapshotDocs(filtered, firestore, collectionName, collectionData);
}

class MockCollection {
  constructor(
    private firestore: MockFirestore,
    private name: string,
    private collectionData: Record<string, FirestoreDoc>
  ) {}

  doc(id: string) {
    return new MockDoc(this.firestore, this.name, this.collectionData, id);
  }

  where(
    field: string,
    op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'not-in',
    value: any
  ) {
    return new MockQuery(this.firestore, this.name, this.collectionData, [{ field, op, value }]);
  }

  async get() {
    const docs = toSnapshotDocs(
      Object.entries(this.collectionData),
      this.firestore,
      this.name,
      this.collectionData
    );
    return {
      empty: docs.length === 0,
      docs,
    };
  }
}

class MockDoc {
  constructor(
    private firestore: MockFirestore,
    private collectionName: string,
    private collectionData: Record<string, FirestoreDoc>,
    private id: string
  ) {}

  async get() {
    const data = this.collectionData[this.id];
    return {
      exists: !!data,
      data: () => data,
    };
  }

  async set(data: FirestoreDoc) {
    this.collectionData[this.id] = data;
    this.firestore.notify(this.collectionName);
  }

  async update(data: Partial<FirestoreDoc>) {
    if (!this.collectionData[this.id]) {
      throw new Error('No such document');
    }

    this.collectionData[this.id] = {
      ...this.collectionData[this.id],
      ...data,
    };
    this.firestore.notify(this.collectionName);
  }

  async delete() {
    delete this.collectionData[this.id];
    this.firestore.notify(this.collectionName);
  }

  get ref() {
    return this;
  }
}

class MockQuery {
  constructor(
    private firestore: MockFirestore,
    private collectionName: string,
    private collectionData: Record<string, FirestoreDoc>,
    private filters: WhereFilter[] = [],
    private orderByField?: OrderBy,
    private limitCount?: number
  ) {}

  where(field: string, op: FirestoreWhereOperator, value: any) {
    return new MockQuery(
      this.firestore,
      this.collectionName,
      this.collectionData,
      [...this.filters, { field, op, value }],
      this.orderByField,
      this.limitCount
    );
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new MockQuery(
      this.firestore,
      this.collectionName,
      this.collectionData,
      this.filters,
      { field, direction },
      this.limitCount
    );
  }

  limit(n: number) {
    return new MockQuery(
      this.firestore,
      this.collectionName,
      this.collectionData,
      this.filters,
      this.orderByField,
      n
    );
  }

  private filteredDocs(): SnapshotDoc[] {
    let docs = applyFilters(
      Object.entries(this.collectionData),
      this.filters,
      this.firestore,
      this.collectionName,
      this.collectionData
    );
    if (this.orderByField) {
      const { field, direction } = this.orderByField;
      docs = [...docs].sort((a, b) => {
        const va = a.data()[field];
        const vb = b.data()[field];
        if (va === vb) return 0;
        if (direction === 'asc') {
          return va < vb ? -1 : 1;
        }
        return va > vb ? -1 : 1;
      });
    }
    if (this.limitCount !== undefined) {
      docs = docs.slice(0, this.limitCount);
    }
    return docs;
  }

  async get() {
    const docs = this.filteredDocs();
    return {
      empty: docs.length === 0,
      docs,
    };
  }

  onSnapshot(
    onNext: (snapshot: { empty: boolean; docs: SnapshotDoc[] }) => void,
    _onError?: (error: unknown) => void
  ): () => void {
    // Deliver the current snapshot immediately, then every write.
    const docs = this.filteredDocs();
    onNext({ empty: docs.length === 0, docs });
    return this.firestore.addListener(this.collectionName, {
      filters: this.filters,
      onNext,
    });
  }
}
