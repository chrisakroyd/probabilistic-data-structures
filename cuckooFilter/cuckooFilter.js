const MMH3 = require('imurmurhash');
const Bucket = require('./bucket.js');
// https://www.cs.cmu.edu/~dga/papers/cuckoo-conext2014.pdf

class CuckooFilter {
  /**
   *
   * @param capacity
   * @param fingerprintLength
   * @param bucketSize
   * @param maxNumKicks
   */
  constructor(capacity = 10000000, fingerprintLength = 8, bucketSize = 4, maxNumKicks = 400) {
    this.fingerprintLength = fingerprintLength;
    this.bucketSize = bucketSize;
    this.maxNumKicks = maxNumKicks;

    this.capacity = Math.ceil(capacity / this.bucketSize);

    this.table = this.createBuckets();
    this.count = 0;
  }

  createBuckets() {
    const buckets = [];

    for (let i = 0; i < this.capacity; i += 1) {
      buckets.push(new Bucket(this.bucketSize));
    }

    return buckets;
  }

  /**
   *
   * @param key
   */
  add(key) {
    const fingerprint = this.fingerprint(key);
    const { firstIndex, secondIndex } = this.obtainIndexPair(key, fingerprint);

    // If we can add the fingerprint to the table at either index, add it
    // and return true (result of successful addition).
    if (!this.table[firstIndex].isFull()) {
      this.count += 1;
      return this.table[firstIndex].add(fingerprint);
    } else if (!this.table[secondIndex].isFull()) {
      this.count += 1;
      return this.table[secondIndex].add(fingerprint);
    }

    let index = Math.random() < 0.5 ? firstIndex : secondIndex;
    let currentFingerprint = fingerprint;

    for (let i = 0; i < this.maxNumKicks; i += 1) {
      currentFingerprint = this.table[index].swap(currentFingerprint);
      index = (index ^ this.indexOfHash(fingerprint)) % this.capacity;

      if (!this.table[index].isFull()) {
        this.count += 1;
        return this.table[index].add(currentFingerprint);
      }
    }

    return false;
  }

  /**
   *
   * @param key
   */
  remove(key) {
    const fingerprint = this.fingerprint(key);
    const { firstIndex, secondIndex } = this.obtainIndexPair(key, fingerprint);

    if (this.table[firstIndex].contains(fingerprint)) {
      this.count -= 1;
      return this.table[firstIndex].remove(fingerprint);
    } else if (this.table[secondIndex].contains(fingerprint)) {
      this.count -= 1;
      return this.table[secondIndex].remove(fingerprint);
    }
    return false;
  }

  /**
   *
   * @param key
   */
  contains(key) {
    const fingerprint = this.fingerprint(key);
    const { firstIndex, secondIndex } = this.obtainIndexPair(key, fingerprint);
    // Test whether the key is already in the table.
    return this.table[firstIndex].contains(fingerprint) || this.table[secondIndex].contains(fingerprint);
  }

  /**
   *
   */
  fingerprint(key) {
    const hashValue = MMH3(key).result();
    return Number.parseInt(hashValue.toString(2).slice(0, this.fingerprintLength), 2);
  }

  indexOfHash(key) {
    let toHash = key;
    if (typeof toHash !== 'string') {
      toHash = key.toString();
    }

    const itemHash = MMH3(toHash).result();
    return itemHash % this.capacity;
  }

  obtainIndexPair(key, fingerprint) {
    const firstIndex = this.indexOfHash(key);
    const secondIndex = Math.abs((firstIndex ^ this.indexOfHash(fingerprint))) % this.capacity;

    return {
      firstIndex,
      secondIndex,
    };
  }
}

module.exports = CuckooFilter;
