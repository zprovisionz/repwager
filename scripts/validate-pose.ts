#!/usr/bin/env npx ts-node

/**
 * Pose Detection Validator CLI
 *
 * Usage:
 *   npx ts-node scripts/validate-pose.ts --benchmark pushup_10_good --verbose
 *   npx ts-node scripts/validate-pose.ts --suite all --export report.json
 *   npx ts-node scripts/validate-pose.ts --suite pushups --export results.csv
 */

import { PoseValidator } from '@/services/poseValidator.service';
import {
  BENCHMARK_SUITE,
  getBenchmark,
  getBenchmarksByExercise,
  getBenchmarksByDifficulty,
  type Benchmark,
} from '@/lib/benchmarks';
import * as fs from 'fs';
import * as path from 'path';

interface CLIArgs {
  benchmark?: string;
  suite?: 'all' | 'pushups' | 'squats' | 'easy' | 'medium' | 'hard';
  verbose?: boolean;
  export?: string;
  threshold?: number;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CLIArgs {
  const args: CLIArgs = {};
  const argList = process.argv.slice(2);

  for (let i = 0; i < argList.length; i++) {
    const arg = argList[i];
    const value = argList[i + 1];

    if (arg === '--benchmark') args.benchmark = value;
    else if (arg === '--suite') args.suite = value as any;
    else if (arg === '--verbose') args.verbose = true;
    else if (arg === '--export') args.export = value;
    else if (arg === '--threshold') args.threshold = parseInt(value);
  }

  return args;
}

/**
 * Get benchmarks to run based on args
 */
function selectBenchmarks(args: CLIArgs): Benchmark[] {
  if (args.benchmark) {
    const b = getBenchmark(args.benchmark);
    return b ? [b] : [];
  }

  if (args.suite === 'all') {
    return BENCHMARK_SUITE;
  }

  if (args.suite === 'pushups') {
    return getBenchmarksByExercise('push_ups');
  }

  if (args.suite === 'squats') {
    return getBenchmarksByExercise('squats');
  }

  if (args.suite && ['easy', 'medium', 'hard'].includes(args.suite)) {
    return getBenchmarksByDifficulty(args.suite as any);
  }

  // Default: run all
  return BENCHMARK_SUITE;
}

/**
 * Main validator runner
 */
async function main() {
  const args = parseArgs();
  const benchmarks = selectBenchmarks(args);
  const validator = new PoseValidator();
  const allMetrics = [];

  if (benchmarks.length === 0) {
    console.error('❌ No benchmarks found matching criteria');
    process.exit(1);
  }

  console.log(`\n🧪 Running ${benchmarks.length} benchmark(s)...\n`);

  for (const benchmark of benchmarks) {
    console.log(`📌 ${benchmark.name}`);
    console.log(`   ${benchmark.description}\n`);

    try {
      const { metrics, results } = await validator.validateVideoWithGroundTruth(
        benchmark.poses,
        {
          exercise: benchmark.exercise,
          expectedReps: benchmark.expectedReps,
          expectedFormQuality: benchmark.expectedFormQuality,
          verbose: args.verbose,
        }
      );

      allMetrics.push({
        id: benchmark.id,
        name: benchmark.name,
        ...metrics,
      });

      // Summary
      const accuracy = metrics.repAccuracy;
      const symbol = accuracy >= 95 ? '✅' : accuracy >= 85 ? '⚠️' : '❌';
      console.log(`${symbol} Rep Accuracy: ${accuracy}% (${metrics.totalRepsDetected}/${metrics.expectedReps} reps)`);
      console.log(`   Form Quality: ${metrics.averageFormQuality}%`);
      console.log(`   Temporal Consistency: ${metrics.temporalConsistency}%\n`);
    } catch (err) {
      console.error(`❌ Error validating ${benchmark.name}:`, err);
    }
  }

  // Export results
  if (args.export) {
    try {
      const outputPath = path.resolve(args.export);
      let content: string;

      if (args.export.endsWith('.csv')) {
        // CSV export
        const headers = [
          'ID',
          'Name',
          'Exercise',
          'Expected Reps',
          'Detected Reps',
          'Rep Accuracy %',
          'Form Quality %',
          'Temporal Consistency %',
          'False Positives',
          'False Negatives',
        ];

        const rows = allMetrics.map(m => [
          m.id,
          `"${m.name}"`,
          m.expectedReps,
          m.totalRepsDetected,
          m.repAccuracy,
          m.averageFormQuality,
          m.temporalConsistency,
          m.falsePositives,
          m.falseNegatives,
        ]);

        content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      } else {
        // JSON export
        content = JSON.stringify(allMetrics, null, 2);
      }

      fs.writeFileSync(outputPath, content);
      console.log(`✅ Results exported to: ${outputPath}`);
    } catch (err) {
      console.error(`❌ Error exporting results:`, err);
    }
  }

  // Summary statistics
  console.log('\n=== OVERALL RESULTS ===\n');
  const avgAccuracy = allMetrics.reduce((sum, m) => sum + m.repAccuracy, 0) / allMetrics.length;
  const avgQuality = allMetrics.reduce((sum, m) => sum + m.averageFormQuality, 0) / allMetrics.length;
  const totalAccurate = allMetrics.filter(m => m.repAccuracy >= 95).length;

  console.log(`📊 Average Rep Accuracy: ${Math.round(avgAccuracy * 100) / 100}%`);
  console.log(`✨ Average Form Quality: ${Math.round(avgQuality * 100) / 100}%`);
  console.log(`🎯 Benchmarks >= 95% accuracy: ${totalAccurate}/${allMetrics.length}`);

  if (totalAccurate === allMetrics.length) {
    console.log('\n🏆 ALL BENCHMARKS PASSED (95%+ accuracy)!\n');
  } else {
    console.log('\n⚠️  Some benchmarks below 95% — see recommendations above\n');
  }
}

// Run validator
main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
