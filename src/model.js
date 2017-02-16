import Bluebird from 'bluebird';
import { Relationship } from './relationship';
import mergeOptions from 'merge-options';
import { BehaviorSubject } from 'rxjs/Rx';
const $dirty = Symbol('$dirty');
const $plump = Symbol('$plump');
const $loaded = Symbol('$loaded');
const $unsubscribe = Symbol('$unsubscribe');
const $subject = Symbol('$subject');
export const $self = Symbol('$self');
export const $all = Symbol('$all');

// TODO: figure out where error events originate (storage or model)
// and who keeps a roll-backable delta

export class Model {
  constructor(opts, plump) {
    this[$dirty] = { id: undefined, attributes: {}, relationships: {} };
    this.$relationships = {};
    this[$subject] = new BehaviorSubject();
    this[$subject].next({});
    for (const relName in this.constructor.$fields.relationships) { // eslint-disable-line guard-for-in
      const Rel = this.constructor.$fields.relationships[relName];
      this.$relationships[relName] = new Rel(this, relName, plump);
    }
    this.$$copyValuesFrom(opts);
    if (plump) {
      this[$plump] = plump;
    }
  }

  get $name() {
    return this.constructor.$name;
  }

  get $id() {
    return this.$get(this.constructor.$id);
  }

  $$copyValuesFrom(opts = {}) {
    for (const key in opts) { // eslint-disable-line guard-for-in
      // Deep copy arrays and objects
      const val = typeof opts[key] === 'object' ? mergeOptions({}, opts[key]) : opts[key];
      if (key === this.constructor.$id) {
        this[this.constructor.$id] = val;
      } else if (this.constructor.$fields.attributes[key]) {
        this[$dirty].attributes[key] = val;
      } else if (this.constructor.$fields.relationships[key]) {
        this[$dirty].relationships[key] = val;
      }
    }
    this.$$fireUpdate();
  }

  $$hookToPlump() {
    if (this[$unsubscribe] === undefined) {
      this[$unsubscribe] = this[$plump].subscribe(this.constructor.$name, this.$id, ({ field, value }) => {
        if (field !== undefined) {
          // this.$$copyValuesFrom(value);
          this.$$copyValuesFrom({ [field]: value });
        } else {
          this.$$copyValuesFrom(value);
        }
      });
    }
  }

  $subscribe(...args) {
    let fields = [$self];
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
    this.$$hookToPlump();
    if (this[$loaded][$self] === false) {
      this[$plump].streamGet(this.constructor, this.$id, fields)
      .subscribe((v) => this.$$copyValuesFrom(v));
    }
    return this[$subject].subscribe(cb);
  }

  $$resetDirty() {
    this[$dirty] = { attributes: {}, relationships: {} };
  }

  $$fireUpdate() {
    this[$subject].next(this[$dirty]);
    this.$$resetDirty();
  }

  $get(opts) {
    if (opts) {
      // just get the stuff that was requested
      const keys = Array.isArray(opts) ? opts : [opts];
      return this[$plump].get(this.constructor, this.$id, keys);
    } else {
      // get everything
      return this[$plump].get(this.constructor, this.$id);
    }
  }

  $save() {
    return this.$set();
  }

  $set(u = {}) {
    const update = mergeOptions({}, this[$dirty].attributes, u);
    // this.$$copyValuesFrom(update); // this is the optimistic update;
    return this[$plump].save(this.constructor, update)
    .then((updated) => {
      this.$$copyValuesFrom(updated);
      return this;
    });
  }

  $delete() {
    return this[$plump].delete(this.constructor, this.$id);
  }

  $rest(opts) {
    const restOpts = Object.assign(
      {},
      opts,
      {
        url: `/${this.constructor.$name}/${this.$id}/${opts.url}`,
      }
    );
    return this[$plump].restRequest(restOpts);
  }

  $add(key, item, extras) {
    return Bluebird.resolve()
    .then(() => {
      if (this.constructor.$fields[key].type === 'hasMany') {
        let id = 0;
        if (typeof item === 'number') {
          id = item;
        } else if (item.$id) {
          id = item.$id;
        } else {
          id = item[this.constructor.$fields[key].relationship.$sides[key].other.field];
        }
        if ((typeof id === 'number') && (id >= 1)) {
          return this[$plump].add(this.constructor, this.$id, key, id, extras);
        } else {
          return Bluebird.reject(new Error('Invalid item added to hasMany'));
        }
      } else {
        return Bluebird.reject(new Error('Cannot $add except to hasMany field'));
      }
    }).then((l) => {
      this.$$copyValuesFrom({ [key]: l });
      return l;
    });
  }

  $modifyRelationship(key, item, extras) {
    if (this.constructor.$fields[key].type === 'hasMany') {
      let id = 0;
      if (typeof item === 'number') {
        id = item;
      } else {
        id = item.$id;
      }
      if ((typeof id === 'number') && (id >= 1)) {
        this[$store][key] = [];
        this[$loaded][key] = false;
        return this[$plump].modifyRelationship(this.constructor, this.$id, key, id, extras);
      } else {
        return Bluebird.reject(new Error('Invalid item added to hasMany'));
      }
    } else {
      return Bluebird.reject(new Error('Cannot $add except to hasMany field'));
    }
  }

  $remove(key, item) {
    if (this.constructor.$fields[key].type === 'hasMany') {
      let id = 0;
      if (typeof item === 'number') {
        id = item;
      } else {
        id = item.$id;
      }
      if ((typeof id === 'number') && (id >= 1)) {
        this[$store][key] = [];
        this[$loaded][key] = false;
        return this[$plump].remove(this.constructor, this.$id, key, id);
      } else {
        return Bluebird.reject(new Error('Invalid item $removed from hasMany'));
      }
    } else {
      return Bluebird.reject(new Error('Cannot $remove except from hasMany field'));
    }
  }

  $teardown() {
    if (this[$unsubscribe]) {
      this[$unsubscribe].unsubscribe();
    }
  }
}

Model.fromJSON = function fromJSON(json) {
  this.$id = json.$id || 'id';
  this.$name = json.$name;
  this.$include = json.$include;
  this.$fields = {};
  Object.keys(json.$fields).forEach((k) => {
    const field = json.$fields[k];
    if (field.type === 'hasMany') {
      class DynamicRelationship extends Relationship {}
      DynamicRelationship.fromJSON(field.relationship);
      this.$fields[k] = {
        type: 'hasMany',
        relationship: DynamicRelationship,
      };
    } else {
      this.$fields[k] = Object.assign({}, field);
    }
  });
};

Model.toJSON = function toJSON() {
  const retVal = {
    $id: this.$id,
    $name: this.$name,
    $include: this.$include,
    $fields: {},
  };
  const fieldNames = Object.keys(this.$fields);
  fieldNames.forEach((k) => {
    if (this.$fields[k].type === 'hasMany') {
      retVal.$fields[k] = {
        type: 'hasMany',
        relationship: this.$fields[k].relationship.toJSON(),
      };
    } else {
      retVal.$fields[k] = this.$fields[k];
    }
  });
  return retVal;
};

Model.$rest = function $rest(plump, opts) {
  const restOpts = Object.assign(
    {},
    opts,
    {
      url: `/${this.$name}/${opts.url}`,
    }
  );
  return plump.restRequest(restOpts);
};

Model.assign = function assign(opts) {
  const start = {};
  Object.keys(this.$fields).forEach((key) => {
    if (opts[key]) {
      start[key] = opts[key];
    } else if (this.$fields[key].default) {
      start[key] = this.$fields[key].default;
    } else if (this.$fields[key].type === 'hasMany') {
      start[key] = [];
    } else {
      start[key] = null;
    }
  });
  return start;
};

Model.$id = 'id';
Model.$name = 'Base';
Model.$self = $self;
Model.$fields = [Model.$id];
Model.$schema = {
  attributes: {},
  relationships: {},
};
Model.$included = [];
