# 🎯 Pose Detection Validator Guide

**Goal:** Achieve **95%+ accuracy** on rep counting for both push-ups and squats.

This guide explains how to use the pose detection validator, interpret results, and tune thresholds to hit near-invincibility.

---

## Quick Start

### Run All Benchmarks
```bash
npx ts-node scripts/validate-pose.ts --suite all --verbose
```

### Run Specific Exercise
```bash
npx ts-node scripts/validate-pose.ts --suite pushups --verbose
npx ts-node scripts/validate-pose.ts --suite squats --verbose
```

### Run Specific Benchmark
```bash
npx ts-node scripts/validate-pose.ts --benchmark pushup_10_good --verbose
```

### Export Results to CSV
```bash
npx ts-node scripts/validate-pose.ts --suite all --export results.csv
```

### Export Results to JSON
```bash
npx ts-node scripts/validate-pose.ts --suite all --export results.json
```

---

## Understanding Metrics

### Rep Accuracy %
- **Definition**: `(Expected Reps - |Detected - Expected|) / Expected * 100`
- **Target**: ≥95%
- **What it means**:
  - **95-100%**: Perfect detection, 0-1 rep error on 10-20 rep sets
  - **85-95%**: Good, minor misdetections
  - **<85%**: Needs tuning

### False Positives / False Negatives
- **FP**: Extra reps counted that didn't happen (user cheating risk!)
- **FN**: Missed reps (frustrating for user)
- **Target**: 0 for both

### Form Quality %
- **Definition**: Average form score across all reps (0-100)
- **How it's calculated**:
  - -30 pts: Incomplete ROM (range of motion)
  - -25 pts: Not lowering/squatting deep enough
  - -20 pts: Not fully extending/locking out
  - -15 pts: Body alignment issues (plank/torso lean)
- **Target**: ≥80%

### Temporal Consistency %
- **Definition**: Stability of phase detection (how smooth is up/down state)
- **Low score = flapping**: Phase switches too frequently (false reps)
- **High score = stable**: Phase transitions only on real rep boundaries
- **Target**: ≥85%

### Confidence Distribution
- **Very Low (0-30%)**: Noisy pose frames
- **Low (30-60%)**: Marginal detection
- **Medium (60-80%)**: Good detection
- **High (80%+)**: Excellent confidence
- **Target**: Majority in "High" range

---

## Tuning Strategy for 95%+ Accuracy

### 1. Identify the Problem

Run benchmarks with `--verbose` to see detailed output:

```
❌ Rep Accuracy: 78%
   - 2 False Positives (double-counting)
   - 0 False Negatives
   - Recommendation: Increase hysteresis angle to prevent flapping
```

### 2. Understand Current Thresholds

Current thresholds in `services/poseDetection.service.ts`:

**Push-ups:**
- Lockout angle: 160° (full arm extension)
- Bottom angle: 90° (elbow bend)
- Bottom hysteresis: 5° (must drop below 85° to trigger DOWN phase)
- Lockout hysteresis: 5° (must rise above 165° to trigger UP phase)
- Min ROM: 60° (must travel 60° elbow arc)
- Min lockout: 155° (must reach 155° at top for valid rep)

**Squats:**
- Lockout angle: 160° (standing with slight knee bend)
- Bottom angle: 90° (parallel squat depth)
- Hysteresis: 5° (same logic as push-ups)
- Min depth: 85° (must reach parallel for full credit)
- Min forward lean: 45° (torso lean tolerance)

### 3. Tuning Recommendations

#### Problem: False Positives (Double-counting)
**Root cause**: Hysteresis too small, phase flaps at boundary

**Fix**:
```typescript
// In poseDetection.service.ts
const PUSH_UP_BOTTOM_HYSTERESIS = 8;      // increase from 5
const PUSH_UP_LOCKOUT_HYSTERESIS = 8;     // increase from 5
```

**Why**: Larger hysteresis = phase only changes when angle moves further from threshold = prevents flapping near boundary = fewer false reps

**Expected impact**: FP drops from 2-3 → 0-1 per set

---

#### Problem: False Negatives (Missed Reps)
**Root cause**: Thresholds too strict, user's natural variation rejected

**Fix**:
```typescript
// Loosen angle thresholds slightly
const PUSH_UP_BOTTOM_ANGLE = 92;           // from 90 (allow slight variation)
const PUSH_UP_MAX_BOTTOM_ANGLE = 105;      // from 100 (less strict depth)
const PUSH_UP_BOTTOM_HYSTERESIS = 3;       // from 5 (easier to trigger)
```

**Why**: Small ROM variation is natural; don't reject good reps

**Expected impact**: FN drops from 2-3 → 0-1 per set

---

#### Problem: Low Form Quality
**Root cause**: ROM check too strict, most reps flagged as incomplete

**Fix**:
```typescript
// In poseDetection.service.ts
const PUSH_UP_MIN_RANGE = 55;              // from 60 (more forgiving)
const SQUAT_MIN_DEPTH_ANGLE = 88;          // from 85 (slightly less depth required)
```

**Why**: Stricter ROM = flagging legitimate reps as poor form = lower quality scores

**Expected impact**: Form quality 60% → 80%

---

#### Problem: Temporal Instability
**Root cause**: Phase transitions too sensitive

**Fix**:
```typescript
// Increase hysteresis
const PUSH_UP_LOCKOUT_HYSTERESIS = 7;      // from 5
const PUSH_UP_BOTTOM_HYSTERESIS = 7;       // from 5
```

**Why**: Larger hysteresis = stable phases = consistent state = no phase flapping = no phantom reps

**Expected impact**: Temporal consistency 70% → 90%

---

### 4. Testing Workflow

**After each tuning change:**

1. Run benchmark suite:
   ```bash
   npx ts-node scripts/validate-pose.ts --suite all
   ```

2. Check for improvements:
   - Did accuracy improve? ✅
   - Did we introduce new problems? (check FP/FN)
   - Did form quality stay consistent?

3. If better, keep it. If worse, revert.

4. Repeat until all benchmarks show ≥95% accuracy.

---

## 95%+ Accuracy Checklist

### Rep Counting Phase
- [ ] All 5 easy benchmarks ≥97% accuracy
- [ ] All 5 medium benchmarks ≥94% accuracy
- [ ] All 5 hard benchmarks ≥91% accuracy
- [ ] Total FP across all benchmarks: ≤2
- [ ] Total FN across all benchmarks: ≤2

### Form Quality Phase
- [ ] Easy benchmarks: ≥90% form quality
- [ ] Medium benchmarks: ≥78% form quality
- [ ] Hard benchmarks: ≥65% form quality
- [ ] All high-depth reps detected correctly (squats)
- [ ] All full-ROM reps credited (push-ups)

### Temporal Stability Phase
- [ ] All benchmarks: ≥85% temporal consistency
- [ ] No phase flapping in recorded test videos
- [ ] Smooth up→down→up transitions
- [ ] Real reps trigger state change, noise doesn't

### Real-World Testing
- [ ] Test with 5-10 test users (different body types)
- [ ] Record 3-5 minute videos of each exercise
- [ ] Vary: camera angle, lighting, form quality
- [ ] Check for accuracy degradation in real conditions

---

## Advanced: Fine-Tuning Matrix

| Problem | Parameter | Current | Try | Effect |
|---------|-----------|---------|-----|--------|
| Double-count | Bottom Hysteresis | 5° | 7-8° | ↓ FP |
| Double-count | Lockout Hysteresis | 5° | 7-8° | ↓ FP |
| Missed reps | Bottom Angle | 90° | 92° | ↓ FN |
| Missed reps | ROM threshold | 60° | 55° | ↓ FN |
| Poor form score | Max Bottom Angle | 100° | 105° | ↑ Quality |
| Flipping phases | Any Hysteresis | 5° | 6-7° | ↑ Stability |
| Noisy detection | Confidence min | 0.6 | 0.65 | ↑ Stability |

---

## Testing Against Real Videos

### How to Validate with Real Data

1. **Record test video**: User performs 10-20 reps at normal speed
2. **Extract poses**: Use MediaPipe or your pose detector on the video
3. **Run validator**:
   ```typescript
   import { PoseValidator } from '@/services/poseValidator.service';
   import { loadPosesFromVideo } from '@/lib/videoProcessor';

   const validator = new PoseValidator();
   const poses = await loadPosesFromVideo('test-video.mp4');
   const result = await validator.validateVideoWithGroundTruth(poses, {
     exercise: 'push_ups',
     expectedReps: 10,
     verbose: true,
   });
   ```

4. **Analyze results**: Check accuracy, form quality, recommendations

---

## Production Readiness Criteria

✅ **You're ready for production when:**

- [x] All synthetic benchmarks: ≥95% accuracy
- [x] Real-world test videos: ≥94% accuracy
- [x] Zero intentional false positives (anti-cheat)
- [x] <2% false negative rate (user frustration)
- [x] Form quality scoring correlates with visual inspection
- [x] Temporal consistency ≥90% across all tests
- [x] Works with ≥3 different body types
- [x] Works with ≥3 different camera angles
- [x] Works with ≥2 different lighting conditions

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `services/poseDetection.service.ts` | Core detection logic + thresholds |
| `services/poseValidator.service.ts` | Benchmark validator engine |
| `lib/benchmarks.ts` | Synthetic benchmark datasets |
| `scripts/validate-pose.ts` | CLI validator tool |

---

## Support

**Common Issues:**

- **"Rep accuracy stuck at 78%"**: Increase hysteresis by 1-2°
- **"Too many false positives"**: Increase lockout hysteresis
- **"Missed reps at end of set"**: Lower bottom angle threshold slightly
- **"Form quality too low"**: Relax ROM requirements by 5°

Run validator with `--verbose` flag to see frame-by-frame analysis.

---

**Target**: Ship with 95%+ accuracy detection across all exercises. This prevents cheating while maintaining user satisfaction.
