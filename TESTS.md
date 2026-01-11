# miniFQS Test Cases

This document outlines small, simple test cases to verify the syntax and semantics of miniFQS as defined in `LANGUAGE.md`.

## 1. Basic Alignment & Pitch
**Goal**: Verify basic mapping of lyrics to pitches and default octave assumptions.

```
Test 1: Basics

One Two Three Four |
[K0] c d e f |
```
**Expectation**:
- 4 Beats.
- Pitches: C4, D4, E4, F4 (assuming default O4 start).

## 2. Relative Octaves (LilyPond Rule)
**Goal**: Verify that pitches are placed relative to the previous note.

```
Test 2: Octaves

Up and Down |
[K0 O4] c g e c |
```
**Expectation**:
- `c` = C4 (start).
- `g` = G3 (Closest G to C4 is G3 or G4? C4 to G3 is 4th down. C4 to G4 is 5th up. 4th is smaller. So **G3**).
- `e` = E3 (Closest E to G3 is E3 or E4? G3 up to E4 is a 6th. G3 down to E3 is a 3rd. So **E3**).
- `c` = C3 (Closest C to E3 is C3).

## 3. Explicit Octave Shifts
**Goal**: Verify `^` and `/` override relative placement.

```
Test 3: Shifts

Jump Up |
[K0] c ^c //c |
```
**Expectation**:
- `c` = C4 (default).
- `^c` = C5 (forced up).
- `//c` = C3 (forced down 2 octaves).

## 4. Partial Measures (`N`)
**Goal**: Verify `[N...]` shifts the start beat.

```
Test 4: Pickup

[N4] And | One Two Three Four |
[K0] g | c c c c |
```
**Expectation**:
- Measure 1: Starts on beat 4. Duration 1 beat.
- Measure 2: Full 4 beats.

## 5. Beat Duration (`B`) with Values
**Goal**: Verify `[B...]` changes note durations.

```
Test 5: Durations

[B4] Quarter Quarter | [B8] Eighth Eighth |
[K0] c d | e f |
```
**Expectation**:
- Measure Beats 1 & 2: Quarters (C, D).
- Measure 2 Beats 1&2: Eighths (E, F)

## 6. Chords and Ascending Rule
**Goal**: Verify chords build strictly upwards.

```
Test 6: Chords

Chord Chord |
[K0] (ceg) (cf) |
```
**Expectation**:
- `(ceg)`: C4 (rel), E4 (>C4), G4 (>E4).
- `(cf)`: C4 F4 (bass resets to default prior, F4 is closest to C4
Test 7: Scope

Vol Change |
[K0 V50 I1] c [V100] c |
```
**Expectation**:
- Note 1: Vol 50, Inst 1.
- Note 2: Vol 100, Inst 1.

## 8. Partial Beats (`_`)
**Goal**: Verify silent subdivision logic.

```
Test 8: Underscore

[B4] **_ |
[K0] cd |
```
**Expectation**:
- `**_` = 3 subdivisions. $D = 1/3$ beat.
- Notes: C, D.
- Duration: C (1/3), D (1/3), Ignored (1/3).

## 9. Accidentals Scope
**Goal**: Verify accidentals persist through measure.

```
Test 9: Accidentals

Sharp Nat | Sharp |
[K0] #f ^f /f | f 
```
**Expectation**:
- Meas 1: F#4, F5, F#4 (accidental persists for same pitch in same octave.
- Meas 2: F natural (reset at barline).
