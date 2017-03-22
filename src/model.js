import mergeOptions from 'merge-options';
import Rx from 'rxjs/Rx';

import { validateInput } from './util';
const $dirty = Symbol('$dirty');
const $plump = Symbol('$plump');
const $unsubscribe = Symbol('$unsubscribe');
const $subject = Symbol('$subject');

// TODO: figure out where error events originate (storage or model)
// and who keeps a roll-backable delta

export class Model {
  constructor(opts, plump) {
    if (plump) {
      this[$plump] = plump;
    } else {
      throw new Error('Cannot construct Plump model without a Plump');
    }
    // TODO: Define Delta interface
    this[$dirty] = {
      attributes: {}, // Simple key-value
      relationships: {}, // relName: Delta[]
    };
    this.$$copyValuesFrom(opts);
    // this.$$fireUpdate(opts);
  }

  // CONVENIENCE ACCESSORS

  get type() {
    return this.constructor.type;
  }

  get $fields() {
    return Object.keys(this.$schema.attributes)
    .concat(Object.keys(this.$schema.relationships));
  }

  get $schema() {
    return this.constructor.$schema;
  }

  get $dirtyFields() {
    return Object.keys(this[$dirty])
    .map(k => Object.keys(this[$dirty][k]))
    .reduce((acc, curr) => acc.concat(curr), [])
    .filter(k => k !== this.constructor.$id) // id should never be dirty
    .reduce((acc, curr) => acc.concat(curr), []);
  }

  // WIRING

  $$copyValuesFrom(opts = {}) {
    // const idField = this.constructor.$id in opts ? this.constructor.$id : 'id';
    // this[this.constructor.$id] = opts[idField] || this.$id;
    if ((this.id === undefined) && (opts[this.constructor.$id])) {
      this.id = opts[this.constructor.$id];
    }
    this[$dirty] = mergeOptions(this[$dirty], { attributes: opts });
  }

  $$resetDirty(opts) {
    const key = opts || this.$dirtyFields;
    const newDirty = { attributes: {}, relationships: {} };
    const keys = Array.isArray(key) ? key : [key];
    Object.keys(this[$dirty]).forEach(schemaField => {
      for (const field in this[$dirty][schemaField]) {
        if (keys.indexOf(field) < 0) {
          const val = this[$dirty][schemaField][field];
          newDirty[schemaField][field] = typeof val === 'object' ? mergeOptions({}, val) : val;
        }
      }
    });
    this[$dirty] = newDirty;
  }

  $$fireUpdate(v) {
    const update = this.constructor.resolveAndOverlay(this[$dirty], v);
    if (this.$id) {
      update.id = this.$id;
    }
    this[$subject].next(update);
  }

  $teardown() {
    if (this[$unsubscribe]) {
      this[$unsubscribe].unsubscribe();
    }
  }

  // API METHODS

  get(opts = 'attributes') {
    // If opts is falsy (i.e., undefined), get attributes
    // Otherwise, get what was requested,
    // wrapping the request in a Array if it wasn't already one
    const keys = opts && !Array.isArray(opts) ? [opts] : opts;
    return this[$plump].get(this, keys)
    .then(self => {
      if (!self && this.$dirtyFields.length === 0) {
        return null;
      } else if (this.$dirtyFields.length === 0) {
        return self;
      } else {
        const resolved = this.constructor.resolveAndOverlay(this[$dirty], self || undefined);
        return mergeOptions({}, self || { id: this.id, type: this.type }, resolved);
      }
    });
  }

  bulkGet() {
    return this[$plump].bulkGet(this.constructor, this.$id);
  }

  // TODO: Should $save ultimately return this.get()?
  save(opts) {
    const options = opts || this.$fields;
    const keys = Array.isArray(options) ? options : [options];

    // Deep copy dirty cache, filtering out keys that are not in opts
    const update = Object.keys(this[$dirty]).map(schemaField => {
      const value = Object.keys(this[$dirty][schemaField])
        .filter(key => keys.indexOf(key) >= 0)
        .map(key => ({ [key]: this[$dirty][schemaField][key] }))
        .reduce((acc, curr) => Object.assign(acc, curr), {});
      return { [schemaField]: value };
    })
    .reduce(
      (acc, curr) => mergeOptions(acc, curr),
      { id: this.$id, type: this.constructor.type });

    if (this.$id !== undefined) {
      update.id = this.$id;
    }
    update.type = this.type;

    return this[$plump].save(update)
    .then((updated) => {
      this.$$resetDirty(opts);
      if (updated.id) {
        this[this.constructor.$id] = updated.id;
        this.id = updated.id;
      }
      // this.$$fireUpdate(updated);
      return this.get();
    });
  }

  set(update) {
    const flat = update.attributes || update;
    // Filter out non-attribute keys
    const sanitized = Object.keys(flat)
      .filter(k => k in this.$schema.attributes)
      .map(k => { return { [k]: flat[k] }; })
      .reduce((acc, curr) => mergeOptions(acc, curr), {});

    this.$$copyValuesFrom(sanitized);
    // this.$$fireUpdate(sanitized);
    return this;
  }

  subscribe(...args) {
    let fields = ['attributes'];
    let cb;
    if (args.length === 2) {
      fields = args[0];
      if (!Array.isArray(fields)) {
        fields = [fields];
      }
      cb = args[1];
    } else {
      cb = args[0];
    }

    const hots = this[$plump].stores.filter(s => s.hot(this.type, this.$id));
    const colds = this[$plump].stores.filter(s => !s.hot(this.type, this.$id));
    const terminal = this[$plump].stores.filter(s => s.terminal === true);

    const preload$ = Rx.Observable.from(hots)
    .flatMap(s => Rx.Observable.fromPromise(s.read(this.type, this.$id, fields)))
    .defaultIfEmpty(null)
    .flatMap((v) => {
      if (v !== null) {
        return Rx.Observable.of(v);
      } else {
        const terminal$ = Rx.Observable.from(terminal)
        .flatMap(s => Rx.Observable.fromPromise(s.read(this.type, this.$id, fields)))
        .share();
        const cold$ = Rx.Observable.from(colds)
        .flatMap(s => Rx.Observable.fromPromise(s.read(this.type, this.$id, fields)));
        return Rx.Observable.merge(
          terminal$,
          cold$.takeUntil(terminal$)
        );
      }
    });
    // TODO: cacheable reads
    // const watchRead$ = Rx.Observable.from(terminal)
    // .flatMap(s => s.read$.filter(v => v.type === this.type && v.id === this.$id));
    const watchWrite$ = Rx.Observable.from(terminal)
    .flatMap(s => s.write$)
    .filter(v => {
      return (
        (v.type === this.type) &&
        (v.id === this.$id) &&
        (v.invalidate.some(i => fields.indexOf(i) >= 0))
      );
    })
    .flatMapTo(
      Rx.Observable.from(terminal)
      .flatMap(s => Rx.Observable.fromPromise(s.read(this.type, this.$id, fields)))
    );
    // );
    return preload$.merge(watchWrite$)
    .subscribe(cb);
  }

  delete() {
    return this[$plump].delete(this);
  }

  $rest(opts) {
    const restOpts = Object.assign(
      {},
      opts,
      {
        url: `/${this.constructor.type}/${this.$id}/${opts.url}`,
      }
    );
    return this[$plump].restRequest(restOpts).then(data => this.constructor.schematize(data));
  }

  add(key, item) {
    if (key in this.$schema.relationships) {
      if (item.id >= 1) {
        this[$dirty].relationships[key] = this[$dirty].relationships[key] || [];
        this[$dirty].relationships[key].push({
          op: 'add',
          data: item,
        });
        // this.$$fireUpdate();
        return this;
      } else {
        throw new Error('Invalid item added to hasMany');
      }
    } else {
      throw new Error('Cannot $add except to hasMany field');
    }
  }

  modifyRelationship(key, item) {
    if (key in this.$schema.relationships) {
      if (item.id >= 1) {
        this[$dirty].relationships[key] = this[$dirty].relationships[key] || [];
        this[$dirty].relationships[key].push({
          op: 'modify',
          data: item,
        });
        // this.$$fireUpdate();
        return this;
      } else {
        throw new Error('Invalid item added to hasMany');
      }
    } else {
      throw new Error('Cannot $add except to hasMany field');
    }
  }

  remove(key, item) {
    if (key in this.$schema.relationships) {
      if (item.id >= 1) {
        if (!(key in this[$dirty].relationships)) {
          this[$dirty].relationships[key] = [];
        }
        this[$dirty].relationships[key].push({
          op: 'remove',
          data: item,
        });
        // this.$$fireUpdate();
        return this;
      } else {
        throw new Error('Invalid item $removed from hasMany');
      }
    } else {
      throw new Error('Cannot $remove except from hasMany field');
    }
  }
}

Model.$rest = function $rest(plump, opts) {
  const restOpts = Object.assign(
    {},
    opts,
    {
      url: `/${this.type}/${opts.url}`,
    }
  );
  return plump.restRequest(restOpts);
};

// SCHEMA FUNCTIONS

Model.addDelta = function addDelta(relName, relationship) {
  return relationship.map(rel => {
    const relSchema = this.$schema.relationships[relName].type.$sides[relName];
    const schematized = { op: 'add', data: { id: rel[relSchema.other.field] } };
    for (const relField in rel) {
      if (!(relField === relSchema.self.field || relField === relSchema.other.field)) {
        schematized.data[relField] = rel[relField];
      }
    }
    return schematized;
  });
};

Model.applyDefaults = function applyDefaults(v) {
  return validateInput(this, v);
};

Model.applyDelta = function applyDelta(current, delta) {
  if (delta.op === 'add' || delta.op === 'modify') {
    const retVal = mergeOptions({}, current, delta.data);
    return retVal;
  } else if (delta.op === 'remove') {
    return undefined;
  } else {
    return current;
  }
};

// Model.assign = function assign(opts) {
//   // const schematized = this.schematize(opts, { includeId: true });
//   const retVal = this.applyDefaults(opts);
//   Object.keys(this.$schema)
//   .filter(k => k[0] !== '$')
//   .forEach(schemaField => {
//     for (const field in this.$schema[schemaField]) {
//       if (!(field in retVal[schemaField])) {
//         retVal[schemaField][field] = schemaField === 'relationships' ? [] : null;
//       }
//     }
//   });
//   retVal.type = this.type;
//   return retVal;
// };

Model.cacheGet = function cacheGet(store, key) {
  return (this.$$storeCache.get(store) || {})[key];
};

Model.cacheSet = function cacheSet(store, key, value) {
  if (this.$$storeCache.get(store) === undefined) {
    this.$$storeCache.set(store, {});
  }
  this.$$storeCache.get(store)[key] = value;
};

Model.resolveAndOverlay = function resolveAndOverlay(update, base = { attributes: {}, relationships: {} }) {
  const attributes = mergeOptions({}, base.attributes, update.attributes);
  // const baseIsResolved = Object.keys(base.relationships).map(relName => {
  //   return base.relationships[relName].map(rel => !('op' in rel)).reduce((acc, curr) => acc && curr, true);
  // }).reduce((acc, curr) => acc && curr, true);
  // const resolvedBaseRels = baseIsResolved ? base.relationships : this.resolveRelationships(base.relationships);
  const resolvedRelationships = this.resolveRelationships(update.relationships, base.relationships);
  return { attributes, relationships: resolvedRelationships };
};

Model.resolveRelationships = function resolveRelationships(deltas, base = {}) {
  const updates = Object.keys(deltas).map(relName => {
    const resolved = this.resolveRelationship(deltas[relName], base[relName]);
    return { [relName]: resolved };
  })
  .reduce((acc, curr) => mergeOptions(acc, curr), {});
  return mergeOptions({}, base, updates);
};

Model.resolveRelationship = function resolveRelationship(deltas, base = []) {
  // Index current relationships by ID for efficient modification
  const updates = base.map(rel => {
    return { [rel.id]: rel };
  }).reduce((acc, curr) => mergeOptions(acc, curr), {});

  // Apply deltas on top of updates
  deltas.forEach(delta => {
    const childId = delta.data ? delta.data.id : delta.id;
    updates[childId] = delta.op ? this.applyDelta(updates[childId], delta) : delta;
  });

  // Reduce updates back into list, omitting undefineds
  return Object.keys(updates)
    .map(id => updates[id])
    .filter(rel => rel !== undefined)
    .reduce((acc, curr) => acc.concat(curr), []);
};

// Model.schematize = function schematize(v = {}, opts = { includeId: false }) {
//   const retVal = {};
//   if (opts.includeId) {
//     retVal.id = this.$id in v ? v[this.$id] : v.id;
//   }
//   Object.keys(this.$schema)
//   .filter(k => k[0] !== '$')
//   .forEach(schemaField => {
//     if (schemaField in v) {
//       retVal[schemaField] = mergeOptions({}, v[schemaField]);
//     } else {
//       retVal[schemaField] = retVal[schemaField] || {};
//       for (const field in this.$schema[schemaField]) {
//         if (field in v) {
//           retVal[schemaField][field] = schemaField === 'relationships' ? this.addDelta(field, v[field]) : v[field];
//         }
//       }
//     }
//   });
//   return retVal;
// };
//
// METADATA

Model.$$storeCache = new Map();

Model.$id = 'id';
Model.type = 'Base';
Model.$schema = {
  $name: 'base',
  $id: 'id',
  attributes: {},
  relationships: {},
};
Model.$included = [];
