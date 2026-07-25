const LOCAL_DEFAULTS = {
  durationSeconds: 900,
  witnessIntervalSeconds: 45,
  captureDistanceMeters: 25,
  captureHoldSeconds: 5,
  headStartSeconds: 30,
  positionSendIntervalSeconds: 5,
  roleAssignmentMode: "random",
};

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  }
  return value;
}

function pathParts(path) {
  return String(path ?? "").split("/").filter(Boolean);
}

function isContainer(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deleteAt(root, parts) {
  if (!parts.length) return undefined;

  const parents = [];
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!isContainer(cursor?.[parts[index]])) return root;
    parents.push([cursor, parts[index]]);
    cursor = cursor[parts[index]];
  }

  delete cursor[parts.at(-1)];
  for (let index = parents.length - 1; index >= 0; index -= 1) {
    const [parent, key] = parents[index];
    if (Object.keys(parent[key]).length) break;
    delete parent[key];
  }
  return root;
}

function setAt(root, parts, value) {
  if (!parts.length) return value === null ? undefined : clone(value);
  if (value === null) return deleteAt(root, parts);

  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (!isContainer(cursor[key])) cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[parts.at(-1)] = clone(value);
  return root;
}

function applyUpdate(root, basePath, updates) {
  const base = pathParts(basePath);
  if (updates === null || !isContainer(updates)) return setAt(root, base, updates);

  let next = root;
  for (const [relativePath, value] of Object.entries(updates)) {
    next = setAt(next, [...base, ...pathParts(relativePath)], value);
    if (next === undefined) next = {};
  }
  return next;
}

function makeSnapshot(value) {
  const snapshotValue = value === undefined ? null : clone(value);
  return {
    exists: () => snapshotValue !== null,
    val: () => clone(snapshotValue),
  };
}

export class LocalRoom {
  constructor(uid, onChange) {
    this.uid = uid;
    this.onChange = onChange;
    this.isLocal = true;
    this.id = "";
    this.data = null;
    this.witnessSubscribers = new Set();
    this.witnessSequence = 0;
  }

  async create(name) {
    const now = Date.now();
    this.id = "LOCAL";
    this.data = {
      meta: {
        hostUid: this.uid,
        status: "lobby",
        createdAt: now,
        expiresAt: now + 21600000,
      },
      settings: clone(LOCAL_DEFAULTS),
      game: { phase: "lobby", generationId: 0 },
      players: {
        [this.uid]: {
          displayName: name,
          role: "",
          isReady: false,
          isOnline: true,
          joinedAt: now,
          gpsStatus: "starting",
          safetyAccepted: true,
        },
      },
    };
    this.notify();
    return this.id;
  }

  async join(_id, _name) {
    throw new Error("ローカルデバッグには部屋参加機能がありません");
  }

  async patch(path, updates) {
    this.assertActive();
    this.data = applyUpdate(this.data, path, updates);
    this.notify(pathParts(path)[0] === "witnessReports");
  }

  async ready(value) {
    return this.patch(`players/${this.uid}`, { isReady: value });
  }

  async leave() {
    if (!this.id) return;
    this.data = applyUpdate(this.data, "", { [`players/${this.uid}`]: null });
    this.notify();
    this.witnessSubscribers.clear();
    this.data = null;
    this.id = "";
  }

  async bulkPatch(updates) {
    this.assertActive();
    this.data = applyUpdate(this.data, "", updates);
    const witnessChanged = Object.keys(updates || {}).some(
      path => pathParts(path)[0] === "witnessReports",
    );
    this.notify(witnessChanged);
  }

  async transactionGame(mutator) {
    this.assertActive();
    const nextGame = mutator(clone(this.data.game ?? null));
    if (nextGame instanceof Promise) {
      throw new TypeError("transactionGame の更新関数は同期関数である必要があります");
    }
    if (nextGame === undefined) {
      return { committed: false, snapshot: makeSnapshot(this.data.game) };
    }

    this.data = setAt(this.data, ["game"], nextGame) ?? {};
    this.notify();
    return { committed: true, snapshot: makeSnapshot(this.data.game) };
  }

  async addWitness(report) {
    this.assertActive();
    this.witnessSequence += 1;
    const key = `local_${Date.now().toString(36)}_${this.witnessSequence.toString(36)}`;
    this.data = setAt(this.data, ["witnessReports", key], report) ?? {};
    this.notify(true);
    return { key };
  }

  subscribeWitness(callback) {
    this.assertActive();
    this.witnessSubscribers.add(callback);
    callback(clone(this.data.witnessReports || {}));
    return () => this.witnessSubscribers.delete(callback);
  }

  async removeNode(path) {
    this.assertActive();
    this.data = setAt(this.data, pathParts(path), null) ?? {};
    this.notify(pathParts(path)[0] === "witnessReports");
  }

  assertActive() {
    if (!this.id || !this.data) throw new Error("ローカルデバッグが開始されていません");
  }

  notify(witnessChanged = false) {
    this.onChange?.(clone(this.data));
    if (!witnessChanged) return;
    for (const callback of this.witnessSubscribers) {
      callback(clone(this.data?.witnessReports || {}));
    }
  }
}
