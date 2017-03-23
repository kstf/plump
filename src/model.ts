import * as mergeOptions from 'merge-options';
import { Observable } from 'rxjs/Rx';

import { validateInput } from './util';
import * as Interfaces from './dataTypes';

// TODO: figure out where error events originate (storage or model)
// and who keeps a roll-backable delta



export class Model {
  static $id: string = 'id';
  static type: string = 'BASE';
  static schema: Interfaces.ModelSchema = {
    $id: 'id',
    attributes: {},
    relationships: {},
  };
  id: string | number;
  private dirty: Interfaces.DirtyValues;
  private static storeCache = new Map();

  get type() {
    return this.constructor['type'];
  }

  get schema() {
    return this.constructor['schema'];
  }

  dirtyFields() {
    return Object.keys(this.dirty.attributes)
    .concat(Object.keys(this.dirty.relationships));
  }

  constructor(opts, private plump) {
    // TODO: Define Delta interface
    this.dirty = {
      attributes: {}, // Simple key-value
      relationships: {}, // relName: Delta[]
    };
    this.$$copyValuesFrom(opts);
    // this.$$fireUpdate(opts);
  }

  $$copyValuesFrom(opts = {}) {
    // const idField = this.constructor.$id in opts ? this.constructor.$id : 'id';
    // this[this.constructor.$id] = opts[idField] || this.id;
    if ((this.id === undefined) && (opts[this.constructor['$id']])) {
      this.id = opts[this.constructor['$id']];
    }
    this.dirty = mergeOptions(this.dirty, { attributes: opts });
  }

  $$resetDirty() {
    this.dirty = {
      attributes: {}, // Simple key-value
      relationships: {}, // relName: Delta[]
    };
  }

  // $$fireUpdate(v) {
  //   const update = Model.resolveAndOverlay(this.dirty, v);
  //   if (this.id) {
  //     update.id = this.id;
  //   }
  //   this[$subject].next(update);
  // }

  // API METHODS

  get(opts = 'attributes') {
    // If opts is falsy (i.e., undefined), get attributes
    // Otherwise, get what was requested,
    // wrapping the request in a Array if it wasn't already one
    const keys = opts && !Array.isArray(opts) ? [opts] : opts;
    return this.plump.get(this, keys)
    .then(self => {
      if (!self && this.dirtyFields().length === 0) {
        return null;
      } else if (this.dirtyFields().length === 0) {
        return self;
      } else {
        const resolved = Model.resolveAndOverlay(this.dirty, self || undefined);
        return mergeOptions({}, self || { id: this.id, type: this.type }, resolved);
      }
    });
  }

  bulkGet() {
    return this.plump.bulkGet(this.constructor, this.id);
  }

  // TODO: Should $save ultimately return this.get()?
  save() {
    const update = Object.keys(this.dirty).map(schemaField => {
      const value = Object.keys(this.dirty[schemaField])
        // .filter(key => keys.indexOf(key) >= 0)
        .map(key => ({ [key]: this.dirty[schemaField][key] }))
        .reduce((acc, curr) => Object.assign(acc, curr), {});
      return { [schemaField]: value };
    })
    .reduce(
      (acc, curr) => mergeOptions(acc, curr),
      { id: this.id, type: this.type });

    if (this.id !== undefined) {
      update.id = this.id;
    }
    update.type = this.type;

    return this.plump.save(update)
    .then((updated) => {
      this.$$resetDirty();
      if (updated.id) {
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
      .filter(k => k in this.schema.attributes)
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

    const hots = this.plump.stores.filter(s => s.hot(this.type, this.id));
    const colds = this.plump.stores.filter(s => !s.hot(this.type, this.id));
    const terminal = this.plump.stores.filter(s => s.terminal === true);

    const preload$ = Observable.from(hots)
    .flatMap((s:Storage) => Observable.fromPromise(s.read(this.type, this.id, fields)))
    .defaultIfEmpty(null)
    .flatMap((v) => {
      if (v !== null) {
        return Observable.of(v);
      } else {
        const terminal$ = Observable.from(terminal)
        .flatMap((s:Storage) => Observable.fromPromise(s.read(this.type, this.id, fields)))
        .share();
        const cold$ = Observable.from(colds)
        .flatMap((s:Storage) => Observable.fromPromise(s.read(this.type, this.id, fields)));
        return Observable.merge(
          terminal$,
          cold$.takeUntil(terminal$)
        );
      }
    });
    // TODO: cacheable reads
    // const watchRead$ = Observable.from(terminal)
    // .flatMap(s => s.read$.filter(v => v.type === this.type && v.id === this.id));
    const watchWrite$ = Observable.from(terminal)
    .flatMap((s:Storage) => s.write$)
    .filter((v:Interfaces.ModelDelta) => {
      return (
        (v.type === this.type) &&
        (v.id === this.id) &&
        (v.invalidate.some(i => fields.indexOf(i) >= 0))
      );
    })
    .flatMapTo(
      Observable.from(terminal)
      .flatMap((s:Storage) => Observable.fromPromise(s.read(this.type, this.id, fields)))
    );
    // );
    return preload$.merge(watchWrite$)
    .subscribe(cb);
  }

  delete() {
    return this.plump.delete(this);
  }

  $rest(opts) {
    const restOpts = Object.assign(
      {},
      opts,
      {
        url: `/${this.constructor['type']}/${this.id}/${opts.url}`,
      }
    );
    return this.plump.restRequest(restOpts).then(res => res.data);
  }

  add(key, item) {
    if (key in this.schema.relationships) {
      if (item.id >= 1) {
        if (this.dirty.relationships[key] === undefined) {
          this.dirty.relationships[key] = [];
        }

        this.dirty.relationships[key].push({
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
    if (key in this.schema.relationships) {
      if (item.id >= 1) {
        this.dirty.relationships[key] = this.dirty.relationships[key] || [];
        this.dirty.relationships[key].push({
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
    if (key in this.schema.relationships) {
      if (item.id >= 1) {
        if (!(key in this.dirty.relationships)) {
          this.dirty.relationships[key] = [];
        }
        this.dirty.relationships[key].push({
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


  static rest(plump, opts) {
    const restOpts = Object.assign(
      {},
      opts,
      {
        url: `/${this.type}/${opts.url}`,
      }
    );
    return plump.restRequest(restOpts);
  }

  static applyDefaults(v) {
    return validateInput(this, v);
  };

  static applyDelta(current, delta) {
    if (delta.op === 'add' || delta.op === 'modify') {
      const retVal = mergeOptions({}, current, delta.data);
      return retVal;
    } else if (delta.op === 'remove') {
      return undefined;
    } else {
      return current;
    }
  };

  static cacheGet(store, key) {
    return (this.storeCache.get(store) || {})[key];
  }

  static cacheSet(store, key, value) {
    if (this.storeCache.get(store) === undefined) {
      this.storeCache.set(store, {});
    }
    this.storeCache.get(store)[key] = value;
  }

  static resolveAndOverlay(update, base = { attributes: {}, relationships: {} }) {
    const attributes = mergeOptions({}, base.attributes, update.attributes);
    const resolvedRelationships = this.resolveRelationships(update.relationships, base.relationships);
    return { attributes, relationships: resolvedRelationships };
  }

  static resolveRelationships(deltas, base = {}) {
    const updates = Object.keys(deltas).map(relName => {
      const resolved = this.resolveRelationship(deltas[relName], base[relName]);
      return { [relName]: resolved };
    })
    .reduce((acc, curr) => mergeOptions(acc, curr), {});
    return mergeOptions({}, base, updates);
  }

  static resolveRelationship(deltas: Interfaces.RelationshipDelta[], base: Interfaces.RelationshipItem[] = []) {
    const retVal = base.concat();
    deltas.forEach((delta) => {
      if ((delta.op === 'add') || (delta.op === 'modify')) {
        const currentIndex = retVal.findIndex(v => v.id === delta.data.id);
        if (currentIndex >= 0) {
          retVal[currentIndex] = delta.data;
        } else {
          retVal.push(delta.data);
        }
      } else if (delta.op === 'remove') {
        const currentIndex = retVal.findIndex(v => v.id === delta.data.id);
        if (currentIndex >= 0) {
          retVal.splice(currentIndex, 1);
        }
      }
    });
    return retVal;
  }

}
