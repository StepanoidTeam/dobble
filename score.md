# Scoring System

## Formula

```
cardScore = round((BASE + speedBonus) × difficultyMult × streakMult × progressionMult)
```

## Components

### 1. Base + Speed Bonus

- **BASE** = `100` — awarded for finding the correct match
- **speedBonus** = `floor((1 - elapsed / timeLimit) × 100)` — ranges from 0 to 100
- Combined raw score per card: **100–200** before multipliers

### 2. Difficulty Multiplier (time-per-card setting)

```
difficultyMult = √(MAX_TIME / chosenTime)
```

Where `MAX_TIME` is the maximum allowed time setting (currently 100 s).

Square root provides a balanced curve: shorter time limits are well-rewarded without making longer limits pointless.

| Time Limit | Multiplier |
| ---------- | ---------- |
| 5 s        | ×4.47      |
| 10 s       | ×3.16      |
| 15 s       | ×2.58      |
| 20 s       | ×2.24      |
| 30 s       | ×1.83      |
| 50 s       | ×1.41      |
| 100 s      | ×1.00      |

**Why square root?**

- Linear (`MAX / chosen`) gives ×20 at 5 s — too aggressive
- Logarithmic flattens the curve too much — barely differentiates 5 s from 10 s
- Square root is the standard game-design approach for diminishing returns

### 3. Streak Multiplier (consecutive correct answers without mistakes)

```
streakMult = 1 + min(streak, 10) × 0.1
```

| Streak | Multiplier |
| ------ | ---------- |
| 0      | ×1.0       |
| 1      | ×1.1       |
| 3      | ×1.3       |
| 5      | ×1.5       |
| 10+    | ×2.0 (cap) |

- Streak resets to 0 on any wrong answer
- Streak does NOT increase when the answer was hinted (see Hinted Cards below)

### 4. Progression Multiplier (card number in deck)

```
progressionMult = 1 + (cardIndex - 1) × 0.02
```

| Card # | Multiplier |
| ------ | ---------- |
| 1      | ×1.00      |
| 5      | ×1.08      |
| 10     | ×1.18      |
| 15     | ×1.28      |
| 20     | ×1.38      |

A gentle bonus that rewards reaching deeper into the deck.

## Wrong Answer Penalty

```
penalty = round(50 × difficultyMult)
```

| Time Limit | Penalty |
| ---------- | ------- |
| 5 s        | −224    |
| 10 s       | −158    |
| 20 s       | −112    |
| 50 s       | −71     |
| 100 s      | −50     |

Penalty scales with difficulty so players on short time limits can't gain advantage by spam-clicking.

## Hinted Cards (after wrong answer)

When a player makes a wrong answer, the correct symbol is highlighted as a hint. The subsequent correct tap on that card receives reduced scoring:

```
hintedCardScore = round(10 × difficultyMult × progressionMult)
```

- **BASE** drops from 100 → **10**
- **speedBonus** = **0** (time after hint is irrelevant)
- **streakMult** = **1.0** (streak was already reset by the wrong answer)

This ensures a hinted answer is always a net negative when combined with the penalty:

| Time Limit | Penalty | Hinted Score | Net Result |
| ---------- | ------- | ------------ | ---------- |
| 5 s        | −224    | +45          | **−179**   |
| 10 s       | −158    | +32          | **−126**   |
| 50 s       | −71     | +14          | **−57**    |

A player who makes a mistake ALWAYS scores worse than one who found the answer themselves, regardless of time settings.

## Full Examples

### Pro player (5 s limit, answers in 0.5 s, streak 10, card 20)

```
speedBonus = floor((1 - 500/5000) × 100) = 90
difficultyMult = √(100000/5000) = 4.47
streakMult = 1 + 10 × 0.1 = 2.0
progressionMult = 1 + 19 × 0.02 = 1.38

cardScore = round((100 + 90) × 4.47 × 2.0 × 1.38) = 2345
```

### Casual player (50 s limit, answers in 25 s, streak 0, card 20)

```
speedBonus = floor((1 - 25000/50000) × 100) = 50
difficultyMult = √(100000/50000) = 1.41
streakMult = 1 + 0 × 0.1 = 1.0
progressionMult = 1 + 19 × 0.02 = 1.38

cardScore = round((100 + 50) × 1.41 × 1.0 × 1.38) = 292
```

## Constants

| Constant                     | Value | Location    |
| ---------------------------- | ----- | ----------- |
| `SCORE_BASE`                 | 100   | game.js     |
| `SCORE_SPEED_MAX`            | 100   | game.js     |
| `SCORE_HINTED_BASE`          | 10    | game.js     |
| `SCORE_PENALTY_BASE`         | 50    | game.js     |
| `STREAK_CAP`                 | 10    | game.js     |
| `STREAK_BONUS_PER_LEVEL`     | 0.1   | game.js     |
| `PROGRESSION_BONUS_PER_CARD` | 0.02  | game.js     |
| `TIME_PER_CARD_MAX_SECONDS`  | 100   | settings.js |
