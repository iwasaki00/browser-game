'use strict';

const WEAPONS = Object.freeze({
  balanced: Object.freeze({
    id: 'balanced',
    name: 'BALANCED',
    label: '標準型',
    description: '扱いやすい標準の三重振り子',
    segments: 3,
    segmentLength: 1,
    segmentMass: 1,
    tipMass: 1,
    motorPower: 1,
    damping: .9988,
    gravity: 1,
    damageMultiplier: 1,
    rodWidth: 1,
    tipSize: 1,
    previewSpeed: 1,
    stats: {power:3,speed:3,reach:3,control:3}
  }),
  long: Object.freeze({
    id: 'long',
    name: 'LONG',
    label: '長距離型',
    description: '広い間合いを大きくゆっくり制する',
    segments: 3,
    segmentLength: 1.28,
    segmentMass: 1.05,
    tipMass: 1.1,
    motorPower: .88,
    damping: .999,
    gravity: 1,
    damageMultiplier: 1.05,
    rodWidth: .92,
    tipSize: 1.05,
    previewSpeed: .72,
    stats: {power:4,speed:2,reach:5,control:2}
  }),
  heavy: Object.freeze({
    id: 'heavy',
    name: 'HEAVY',
    label: '重量型',
    description: '重い先端で慣性を乗せた一撃を狙う',
    segments: 3,
    segmentLength: 1,
    segmentMass: 1.2,
    tipMass: 2,
    motorPower: .78,
    damping: .99935,
    gravity: 1.08,
    damageMultiplier: 1.3,
    rodWidth: 1.18,
    tipSize: 1.5,
    previewSpeed: .58,
    stats: {power:5,speed:1,reach:3,control:2}
  }),
  light: Object.freeze({
    id: 'light',
    name: 'LIGHT',
    label: '軽量高速型',
    description: '素早い切り返しで相手を翻弄する',
    segments: 3,
    segmentLength: .86,
    segmentMass: .7,
    tipMass: .68,
    motorPower: 1.34,
    damping: .9977,
    gravity: .94,
    damageMultiplier: .78,
    rodWidth: .72,
    tipSize: .76,
    previewSpeed: 1.45,
    stats: {power:2,speed:5,reach:2,control:5}
  })
});

const WEAPON_IDS = Object.freeze(Object.keys(WEAPONS));
