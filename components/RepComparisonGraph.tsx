import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, typography, spacing, radius } from '@/lib/theme';

interface RepComparisonGraphProps {
  selfReps: number;
  opponentReps: number;
  selfName: string;
  opponentName: string;
}

export default function RepComparisonGraph({
  selfReps,
  opponentReps,
  selfName,
  opponentName,
}: RepComparisonGraphProps) {
  // Dimensions
  const width = 280;
  const height = 160;
  const padding = 20;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  // Scale to max reps + 10% buffer
  const maxReps = Math.max(selfReps, opponentReps) * 1.1 || 1;
  const scale = graphHeight / maxReps;

  // Heights for bars
  const selfHeight = selfReps * scale;
  const opponentHeight = opponentReps * scale;

  // Positions
  const barWidth = 40;
  const spacing_between = graphWidth - barWidth * 2;
  const selfX = padding + spacing_between / 4;
  const opponentX = padding + spacing_between / 4 + barWidth + spacing_between / 2;
  const baselineY = padding + graphHeight;

  // Colors
  const selfBarColor = colors.primary;
  const opponentBarColor = colors.secondary;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>REP COMPARISON</Text>
      <Svg width={width} height={height}>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <Line
            key={`grid-${ratio}`}
            x1={padding}
            y1={padding + graphHeight * (1 - ratio)}
            x2={width - padding}
            y2={padding + graphHeight * (1 - ratio)}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        ))}

        {/* Self bar */}
        <Rect
          x={selfX}
          y={baselineY - selfHeight}
          width={barWidth}
          height={selfHeight}
          fill={selfBarColor}
          rx={3}
        />

        {/* Opponent bar */}
        <Rect
          x={opponentX}
          y={baselineY - opponentHeight}
          width={barWidth}
          height={opponentHeight}
          fill={opponentBarColor}
          rx={3}
        />

        {/* Self label */}
        <SvgText
          x={selfX + barWidth / 2}
          y={baselineY + 16}
          textAnchor="middle"
          fontSize={11}
          fill={colors.textSecondary}
          fontFamily={typography.fontBodyMedium}
        >
          YOU
        </SvgText>

        {/* Opponent label */}
        <SvgText
          x={opponentX + barWidth / 2}
          y={baselineY + 16}
          textAnchor="middle"
          fontSize={11}
          fill={colors.textSecondary}
          fontFamily={typography.fontBodyMedium}
        >
          OPP
        </SvgText>

        {/* Self rep count above bar */}
        <SvgText
          x={selfX + barWidth / 2}
          y={baselineY - selfHeight - 6}
          textAnchor="middle"
          fontSize={14}
          fill={selfBarColor}
          fontFamily={typography.fontDisplayMedium}
          fontWeight="bold"
        >
          {selfReps}
        </SvgText>

        {/* Opponent rep count above bar */}
        <SvgText
          x={opponentX + barWidth / 2}
          y={baselineY - opponentHeight - 6}
          textAnchor="middle"
          fontSize={14}
          fill={opponentBarColor}
          fontFamily={typography.fontDisplayMedium}
          fontWeight="bold"
        >
          {opponentReps}
        </SvgText>

        {/* Baseline */}
        <Line
          x1={padding}
          y1={baselineY}
          x2={width - padding}
          y2={baselineY}
          stroke={colors.border}
          strokeWidth={1}
        />
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: selfBarColor }]} />
          <Text style={styles.legendLabel}>{selfName}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: opponentBarColor }]} />
          <Text style={styles.legendLabel}>{opponentName}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
