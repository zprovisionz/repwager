/*
  # Seed Badge Definitions

  Inserts all badge definitions that users can earn through gameplay.

  ## Badges by Category

  ### Push-Up Badges
  - first_pushup: Complete first push-up match
  - pushup_centurion: Score 100 push-ups in a single match
  - pushup_machine: Win 10 push-up matches

  ### Squat Badges
  - first_squat: Complete first squat match
  - squat_master: Score 100 squats in a single match

  ### Win Streak Badges
  - hot_streak: Win 3 matches in a row
  - unstoppable: Win 10 matches in a row

  ### Wager Badges
  - high_roller: Place a single wager of $50+
  - big_winner: Accumulate $500 in winnings

  ### Milestones
  - rep_legend: Complete 1000 total reps across all matches
  - veteran: Complete 50 total matches
*/

INSERT INTO badges (id, name, description, icon, xp_reward, rarity) VALUES
  ('first_pushup', 'First Blood', 'Complete your first push-up match', 'zap', 50, 'common'),
  ('first_squat', 'Leg Day', 'Complete your first squat match', 'zap', 50, 'common'),
  ('pushup_centurion', 'Centurion', 'Score 100 push-ups in a single match', 'shield', 200, 'rare'),
  ('squat_master', 'Squat Master', 'Score 100 squats in a single match', 'shield', 200, 'rare'),
  ('hot_streak', 'Hot Streak', 'Win 3 matches in a row', 'flame', 150, 'rare'),
  ('unstoppable', 'Unstoppable', 'Win 10 matches in a row', 'crown', 500, 'epic'),
  ('high_roller', 'High Roller', 'Wager $50 or more in a single match', 'dollar-sign', 100, 'rare'),
  ('big_winner', 'Big Winner', 'Accumulate $500 in total winnings', 'trophy', 300, 'epic'),
  ('rep_legend', 'Rep Legend', 'Complete 1,000 total reps across all matches', 'award', 400, 'epic'),
  ('veteran', 'Veteran', 'Complete 50 total matches', 'star', 300, 'rare'),
  ('first_win', 'First Victory', 'Win your first match', 'trophy', 75, 'common'),
  ('flawless', 'Flawless', 'Win a match with double your opponent''s reps', 'crown', 250, 'epic')
ON CONFLICT (id) DO NOTHING;
