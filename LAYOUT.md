# miniFQS Layout Specification

This document describes the layout and rendering logic for the `miniFQS` language. The engine converts the Abstract Syntax Tree (AST) into a visual representation (typically SVG).

## 1. Visual Style

miniFQS uses a **"Note Names on Staff"** notation style, distinct from standard music notation (dots):
-   **Staff**: Three lines representing Octaves +1, 0, and -1 (Reference G). The 'O' directive controls which octave is the reference.  For `O4`, the default, the lowest line is G3, the middle line is G4, and the highest line is G5.  For `O3`, the lowest line is G2, the middle line is G3, and the highest line is G4, etc.
-   **Note Heads**: Rendered as their letter name (`c`, `d`, `e`...).
-   **Pitch Height**: Y-position corresponds to pitch.  A key feature of this style is that the staff lines are spaced one octave apart.  A semitone corresponds to 1/12 of the octave spacing and 
the vertical position of each note is the sum of the semitone distances from the reference G. Note that there is some slight variation for certain letters from the strict 1/12 spacing to account for the visual weight of different characters.  This determination is empirical and a lookup table  was created in a prior repo version of this project. 
-   **Accidentals**:
    -   Color Coding: Notes with effective accidentals are colored (e.g., Red for Sharp, Blue for Flat).
	-   Key Signature is not displayed in the staff. The color of altered pitches makes it unnecessary.
-   **Rhythm**:
    -   Implied by horizontal spacing (Grid System).
    -   Beat Numbers (Counter) displayed below the staff.

## 2. Coordinate System

-   **Units**: Abstract Pixels (px).
-   **Origin**: Top-Left (0, 0).
-   **Y-Axis**: Screen coordinates (Down is positive).
    -   Higher Pitch = Lower Y value.
-   **Grid**:
    -   **Column Width**: `Matches Character Width` (Monospaced alignment).
    -   **Beat Spacing**: Derived from Lyric Syllable length.

## 3. Layout Components

### Score
-   **Title**: Centered at top.
-   **Blocks**: Rendered vertically sequentially. **Crucially, each block is its own independent render unit (e.g., separate <svg> element)** to support future valid interactivity/editing.

### Music Block
A block consists of:
1.  **Staff Lines**: Three horizontal lines.
2.  **Lyric Row**: Text below the staff (or aligned with grid).
3.  **Counter Row**: Beat numbers below lyrics.
4.  **Note Objects**: Placed on the staff.

### Alignment (The "Grid")
The core layout challenge is aligning the **Lyric Line** (source of truth for time) with the **Pitch Line**.
-   **Input**: AST `MusicBlock` (LyricLines, PitchLines).
-   **Logic**:
    1.  FLATTEN Lyric Measures into a stream of **Beats**.
    2.  FLATTEN Pitch Measures into a stream of **Elements** (Notes/Chords).
    3.  **Match** Pitch Elements to Lyric Subdivisions (Attacks).
        -   **Attacks (Consume Pitch)**:
            -   `Syllable` (e.g., "Do", "Re")
            -   `Melisma` (`*`)
        -   **Non-Attacks (Do NOT Consume Pitch)**:
            -   `Hyphen` (`-`)
            -   `Rest` (`;`)
            -   `Partial` (`_`)
            -   *Note*: These elements occupy X-space but do not advance the Pitch Pointer.
    4.  **Calculate X**:
        -   **Beat Width**: Sum of widths of all subdivisions + separate spacing.
        -   **Grid Alignment**:
            -   Pitches align with the start of their corresponding Attack subdivision.
            -   Non-attacks create horizontal gaps in the pitch line.

## 4. New Language Features Support

### Directives
-   `[K...]`: Render Key Signature (Flats/Sharps) at current cursor position (typically start of measure).
-   `[T...]`: Render Tempo marking (e.g., "♩=120") above the staff.
-   `[B...]`: Sets the default beat duration (counter increment per beat).
-   `[N...]`: Pickup logic affects start count.
-   **Beat Prefix**: A number at the start of a beat (e.g., `2Se**Me**`) overrides the duration *for that beat only*. Layout must parse/handle this if the AST provides it (or process the raw text).

### Chords `(ceg)`
-   **Rendering**: Stacking the letters vertically at the same X position will not work well because the letters will overlap.  Instead, we will render the chord members  in their expected Y positions and spaced horizontally by their width. There will be a need to make chords visually distinct for sequences of notes that are not chords.  For example, we could draw a box around the chord, or simply a line connecting the notes.
-   **Pitch Calculation**:
    -   First note relative to `prevPitch`.
    -   Subsequent notes relative to previous note *in chord* (strictly ascending).
-   **Colors**: Each note in chord calculated individually for accidentals.

### Multi-line Lyrics
-   Parser aggregates them into logical `LyricLine`.
-   Layout treats them as a single sequence of beats. Layout does *not* necessarily wrap lines visually unless width exceeds page. Use horizontal scrolling or auto-scaling for now?
    -   Legacy: `maxScoreWidth`.
    -   *Decision*: Render as one long horizontal strip per Block (scrollable).

## 5. Implementation Architecture

### `LayoutEngine`
-   **Input**: `AST.Score`
-   **Output**: `ScoreLayout` object containing:
    -   `title`: commands for title.
    -   `blocks`: Array of `BlockLayout` objects, where each contains `RenderCommand[]` relative to that block's layout (0,0).

### `RenderCommand` Interface
```typescript
type CommandType = 'text' | 'line' | 'rect';

interface RenderCommand {
    type: CommandType;
    x: number;
    y: number;
    // ... specific props (text, color, font, width, height)
}
```

### `KeySigCalculator`
-   State machine tracking current Key and Accidentals (Measure scope).

### `yPositionFor(pitch: Pitch)`
-   Function mapping pitch (Note + Octave) to Y coordinate relative to Center Line.

## 6. Constants (Draft)
```typescript
const FONT_WIDTH = 12;
const FONT_HEIGHT = 20;
const STAFF_LINE_SPACING = 35; // Between Octave lines
```
