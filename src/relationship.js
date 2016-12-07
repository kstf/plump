import deepAssign from 'deep-assign';

export class Relationship {
  constructor(model, title, plump) {
    this.plump = plump;
    this.for = model;
    this.title = title;
  }

  $otherItem(childId) {
    const otherInfo = this.constructor.$sides[this.title].other;
    return this.plump.find(otherInfo.type, childId);
  }

  $add(childId, extras) {
    return this.plump.add(this.for.constructor, this.for.$id, childId, extras);
  }

  $remove(childId) {
    return this.plump.remove(this.for.constructor, this.for.$id, childId);
  }

  $list() {
    return this.plump.get(this.for.constructor, this.for.$id, this.title);
  }

  $modify(childId, extras) {
    return this.plump.modifyRelationship(this.for.constructor, this.for.$id, this.title, childId, extras);
  }
}

Relationship.fromJSON = function fromJSON(json) {
  this.$name = json.$name;
  if (json.$extras) {
    this.$extras = json.$extras;
  }
  if (json.$restrict) {
    this.$restrict = json.$restrict;
  }
  this.$sides = deepAssign({}, json.$sides);
};

Relationship.toJSON = function toJSON() {
  const rV = {
    $name: this.$name,
    $sides: this.$sides,
  };
  if (this.$restrict) {
    rV.$restrict = this.$restrict;
  }
  if (this.$extras) {
    rV.$extras = this.$extras;
  }
  return rV;
};
