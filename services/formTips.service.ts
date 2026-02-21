/**
 * Form Tips Service
 * Maps form quality issues to specific, actionable improvement tips
 */

interface FormTip {
  issue: string;
  tips: string[];
  priority: 'high' | 'medium' | 'low';
}

const PUSH_UP_TIPS: Record<string, FormTip> = {
  'Incomplete range of motion': {
    issue: 'Incomplete range of motion',
    tips: [
      'Lower your body until elbows are bent at 90 degrees',
      'Extend arms fully at the top for complete range',
      'Move slowly and deliberately through full motion',
    ],
    priority: 'high',
  },
  'Not lowering far enough (half rep)': {
    issue: 'Not lowering far enough (half rep)',
    tips: [
      'Lower your chest closer to the ground',
      'Aim for a 90-degree elbow angle at the bottom',
      'Increase your range of motion for full reps',
    ],
    priority: 'high',
  },
  'Not fully extending at top': {
    issue: 'Not fully extending at top',
    tips: [
      'Lock out your elbows fully at the top',
      'Push through to complete arm extension',
      'Avoid stopping short before lockout',
    ],
    priority: 'high',
  },
  'Keep body straight (avoid sagging hips)': {
    issue: 'Keep body straight (avoid sagging hips)',
    tips: [
      'Engage your core throughout the rep',
      'Keep your body in a straight line from head to heels',
      'Prevent hip sagging by tightening your abs',
      'Imagine a plank position throughout the movement',
    ],
    priority: 'high',
  },
  'Full push-up detected (not on knees)': {
    issue: 'Full push-up detected (not on knees)',
    tips: [
      'Your form indicates full push-ups',
      'Maintain body alignment from shoulders to toes',
      'Keep hips elevated and aligned',
    ],
    priority: 'medium',
  },
  'Uneven elbow angles (favor one side)': {
    issue: 'Uneven elbow angles (favor one side)',
    tips: [
      'Keep both elbows at the same angle',
      'Avoid favoring one arm over the other',
      'Check your hand positioning for symmetry',
      'Practice mirror check during rest periods',
    ],
    priority: 'medium',
  },
};

const SQUAT_TIPS: Record<string, FormTip> = {
  'Not squatting deep enough (quarter squat)': {
    issue: 'Not squatting deep enough (quarter squat)',
    tips: [
      'Go deeper - aim for parallel or below parallel',
      'Lower until knees reach 90 degrees or less',
      'Focus on full depth for maximum effectiveness',
    ],
    priority: 'high',
  },
  'Going too deep (risk of injury)': {
    issue: 'Going too deep (risk of injury)',
    tips: [
      'Stop at parallel (90-degree knee angle)',
      'Avoid excessive depth that strains knees',
      'Control your descent to prevent knee strain',
    ],
    priority: 'high',
  },
  'Left knee caving inward': {
    issue: 'Left knee caving inward',
    tips: [
      'Keep your left knee tracking over your toes',
      'Push your left knee outward throughout the squat',
      'Strengthen glutes and hip abductors',
      'Focus on maintaining knee alignment',
    ],
    priority: 'high',
  },
  'Right knee caving inward': {
    issue: 'Right knee caving inward',
    tips: [
      'Keep your right knee tracking over your toes',
      'Push your right knee outward throughout the squat',
      'Strengthen glutes and hip abductors',
      'Focus on maintaining knee alignment',
    ],
    priority: 'high',
  },
  'Uneven squat depth (one leg deeper)': {
    issue: 'Uneven squat depth (one leg deeper)',
    tips: [
      'Maintain equal depth on both sides',
      'Focus on balanced strength development',
      'Check your foot positioning',
      'Practice with feet shoulder-width apart',
    ],
    priority: 'medium',
  },
  'Chest leaning too far forward': {
    issue: 'Chest leaning too far forward',
    tips: [
      'Keep your chest up throughout the squat',
      'Maintain an upright torso position',
      'Engage your core to prevent forward lean',
      'Focus on pushing through your heels',
    ],
    priority: 'medium',
  },
};

class FormTipsService {
  /**
   * Get tips for a specific form issue
   */
  getTips(issue: string, exerciseType: 'push_ups' | 'squats'): string[] {
    const tipsMap = exerciseType === 'push_ups' ? PUSH_UP_TIPS : SQUAT_TIPS;
    const tip = tipsMap[issue];
    return tip ? tip.tips : [];
  }

  /**
   * Get the top priority tip for an issue
   */
  getTopTip(issue: string, exerciseType: 'push_ups' | 'squats'): string | null {
    const tips = this.getTips(issue, exerciseType);
    return tips.length > 0 ? tips[0] : null;
  }

  /**
   * Get grouped tips by priority
   */
  getTipsByPriority(issues: string[], exerciseType: 'push_ups' | 'squats'): Record<string, string[]> {
    const result: Record<string, string[]> = {
      high: [],
      medium: [],
      low: [],
    };

    const tipsMap = exerciseType === 'push_ups' ? PUSH_UP_TIPS : SQUAT_TIPS;

    for (const issue of issues) {
      const tip = tipsMap[issue];
      if (tip && tip.tips.length > 0) {
        result[tip.priority].push(tip.tips[0]);
      }
    }

    return result;
  }

  /**
   * Generate a motivational message based on quality score
   */
  getMotivationalMessage(quality: number, totalAttempts: number): string {
    if (quality >= 95) {
      return 'Perfect technique! 🏆';
    }
    if (quality >= 90) {
      return 'Excellent form! Keep it up! 🚀';
    }
    if (quality >= 85) {
      return 'Good form! Small tweaks needed 💪';
    }
    if (quality >= 75) {
      return 'Decent rep! Focus on details 👀';
    }
    if (totalAttempts < 3) {
      return 'Getting started! Keep going 🔥';
    }
    return 'Keep working on form! 📍';
  }

  /**
   * Get exercise-specific tips
   */
  getExerciseTips(exerciseType: 'push_ups' | 'squats'): string[] {
    const tips =
      exerciseType === 'push_ups'
        ? [
            'Keep your body in a straight line',
            'Lower until elbows are bent at 90°',
            'Extend arms fully at the top',
            'Breathe in on the way down, out on the way up',
            'Control the movement - no bouncing',
            'Keep hands shoulder-width apart',
            'Engage your core throughout',
          ]
        : [
            'Keep chest up and back straight',
            'Feet should be shoulder-width apart',
            'Lower until knees are at 90° or below',
            'Keep knees tracking over toes',
            'Push through heels to stand up',
            'Engage your core for stability',
            'Control the descent - no dropping',
          ];

    return tips;
  }
}

export const formTipsService = new FormTipsService();
