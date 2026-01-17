# Info Page Content Outline

**Target Audience:** Users familiar with standard music notation.
**Goal:** Quickly bridge the gap from standard notation to TSFQS syntax.

## 1. Introduction
- **Concept:** TSFQS separates music into two parallel lines: **Rhythm/Lyrics** and **Pitch**.
- **Philosophy:** Text-based, optimized for typing speed and readability.
- **Visual:** "What you see is what you get" - formatting in the text editor roughly matches the visual layout.

## 2. Anatomy of a Music Block
*Use the "Happy Birthday" example.*
- **Line 1: Lyrics & Rhythm**
    - Text = Rhythm.
    - Spaces = Beat boundaries.
    - Explain `.` (syllable break) vs `,` (word tie).
- **Line 2: Pitch**
    - Standard note names (a-g).
    - Relative Pitch Rule (LilyPond style): Introduction to the "laziest path" to the next note.
- **Alignment:** How the two lines synchronize beat-by-beat.

## 3. Rhythm Quick Reference (Lyric Line)
| Symbol | Meaning | Standard Notation Equiv |
| :--- | :--- | :--- |
| `Space` | Next Beat | Barline / Beat grouping |
| `.` | Split Beat | Beams / FLAGS |
| `-` | Sustain | Ties / Dotted notes |
| `_` | Short Rest | Breaks within a beat |
| `;` | Full Beat Rest | Quarter/Eighth Rest |
| `*` | Melisma | Slurs |
| `|` | Barline | Barline |

## 4. Pitch Quick Reference (Pitch Line)
- **Relative Pitch:** The system determines the octave based on the previous note.
- **Octave Control:**
    - `^`: Higher octave.
    - `/`: Lower octave.
    - `[O4]`: Set absolute octave reference.
- **Accidentals:** `#` (sharp), `&` (flat), `%` (natural).
- **Key Signatures:** `[K#2]` (D Major), `[K&1]` (F Major).
- **Chords:** `(ceg)` - parenthesis grouping.

## 5. Metadata & Controls
- **Directives:** `[T120]` (Tempo), `[I1]` (Instrument), `[V80]` (Volume).
- **Time Signatures:** Handled via beat groupings (spaces) and `[B...]` directives.

## 6. Interactive Example
- A small editable block for them to try typing:
    - `Re,la,tive | pitch * is | cool - -|`
    - `c e g c |`

## 7. Reference
### General MIDI Instruments
Full list of instruments accessible via `I<number>`.
1. Acoustic Grand Piano
2. Bright Acoustic Piano
3. Electric Grand Piano
4. Honky-tonk Piano
5. Electric Piano 1
... (Full list 1-128 to be included in final page)
