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

export class MockFirestore {
  private data: FirestoreData = {};

  collection(name: string) {
    if (!this.data[name]) this.data[name] = {};
    return new MockCollection(this.data[name]);
  }

  seed(initialData: FirestoreData) {
    // Deep clone to avoid mutation across tests
    this.data = JSON.parse(JSON.stringify(initialData));
  }

  clear() {
    this.data = {};
  }
}

class MockCollection {
  constructor(private collectionData: Record<string, FirestoreDoc>) {}

  doc(id: string) {
    return new MockDoc(this.collectionData, id);
  }

  where(
    field: string,
    op: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'not-in',
    value: any
  ) {
    return new MockQuery(this.collectionData, [{ field, op, value }]);
  }

  async get() {
    const docs = Object.entries(this.collectionData).map(([id, data]) => ({
      id,
      data: () => data,
      ref: new MockDoc(this.collectionData, id),
    }));

    return {
      empty: docs.length === 0,
      docs,
    };
  }
}

class MockDoc {
  constructor(
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
  }

  async update(data: Partial<FirestoreDoc>) {
    if (!this.collectionData[this.id]) {
      throw new Error('No such document');
    }

    this.collectionData[this.id] = {
      ...this.collectionData[this.id],
      ...data,
    };
  }

  async delete() {
    delete this.collectionData[this.id];
  }

  get ref() {
    return this;
  }
}

class MockQuery {
  constructor(
    private collectionData: Record<string, FirestoreDoc>,
    private filters: WhereFilter[] = [],
    private orderByField?: OrderBy,
    private limitCount?: number
  ) {}

  where(field: string, op: FirestoreWhereOperator, value: any) {
    return new MockQuery(
      this.collectionData,
      [...this.filters, { field, op, value }],
      this.orderByField,
      this.limitCount
    );
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new MockQuery(this.collectionData, this.filters, { field, direction }, this.limitCount);
  }

  limit(n: number) {
    return new MockQuery(this.collectionData, this.filters, this.orderByField, n);
  }

  async get() {
    let docs = Object.entries(this.collectionData);

    // Apply filters
    docs = docs.filter(([_, data]) => {
      return this.filters.every(({ field, op, value }) => {
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
      });
    });

    // Apply ordering
    if (this.orderByField) {
      const { field, direction } = this.orderByField;
      docs.sort((a, b) => {
        const va = a[1][field];
        const vb = b[1][field];

        if (va === vb) return 0;

        if (direction === 'asc') {
          return va < vb ? -1 : 1;
        } else {
          return va > vb ? -1 : 1;
        }
      });
    }

    // Apply limit
    if (this.limitCount !== undefined) {
      docs = docs.slice(0, this.limitCount);
    }

    const resultDocs = docs.map(([id, data]) => ({
      id,
      data: () => data,
      ref: new MockDoc(this.collectionData, id),
    }));

    return {
      empty: resultDocs.length === 0,
      docs: resultDocs,
    };
  }
}
