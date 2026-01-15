# miniFQS Language Definition

## Overview
miniFQS is a concise format for representing vocal and instrumental music scores, consisting of lyrics and pitches aligned with each other. It is designed to be human-readable and easily editable.

## File Structure
A miniFQS file consists of a **Title Block** followed by one or more **Music Blocks**. Blocks are separated by one or more empty lines.

### Title Block
The first block in the file is the Title Block. It can contain one or more lines of text (e.g., Title, Composer, Arranger).

### Music Blocks
Each Music Block represents a line of music and consists of:
1.  **Lyric Line(s)**: The text and rhythm data. May span multiple lines. Continues until a line ends with a barline `|`.
2.  **Pitch Line(s)**: The musical notes and key signature. Occupies the remainder of the block.

Example 1:
```
Happy Birthday
 
[N3] Hap,py | birth day to | you - ; |
[K&1] cc | d c f | e |
```

Example 2:
```
Happy Birthday Without Lyrics.
 
[N3] ** | * * * | * - ; |
[K&1] cc | d c f | e |
```

---

## Syntax Details

### 1. Lyric Line
The lyric line defines the rhythm of the music and the lyrics to be sung (for vocal music). FQS is beat-oriented, with each beat containing one or more subdivisions. Each beat subdivision is assigned a duration based on the beat duration and the number of subdivisions in the beat. 

-   **Syllables**: Text segments to be sung (e.g., `Hap`, `py`).
-   **Barlines**: `|` delimits measures. **Must** be present at the end of the line.
-   **Beat Separators**: whitespace separates beats.
-   **Syllable Separator**: `.` separates syllables within a single beat. `,` is also a separator.
    -   `,` (Comma): Separates syllables that are part of the same word (e.g., `Hap,py` renders as "Happy").
    -   `.` (Dot): Separates distinct words within a single beat (e.g., `in.ex` renders as "in ex").
    -   `-`: Hyphen (continuation of a note or rest subdivision).
    -   `*`: Asterisk (melisma) continues a syllable with change of pitch.  Does not require a `.` to separate from the previous subdivision,e.g, `Glo*** o*ri* a -`Instrumental scores will use this to indicate each attack, e.g., `**** **** * -` for the same rhythm as the previous example.
    -   `_`: Underscore (Silent Subdivision). Counts as a beat subdivision but represents truncation of the beat.
    -   `;`: Semicolon (denotes a musical rest).
    -   `=`: Shorthand for `--`. (therefore 2 subdivisions)

#### Subdivision Duration Formula
The duration ($D$) of each subdivision in a beat is calculated as:
$$ D = \frac{M}{S} $$
Where:
-   $M$ is the Multi-beat count (defaults to 1 if no prefix).
-   $S$ is the total count of subdivisions in the beat (syllables, `*`, `-`, `;``_`).

**Example**: `[B4.] **_`
-   $M=1$
-   $S=3$ (`*`, `*`, `_`)
-   $D = 1/3$ beat.
-   Result: Two notes each lasting 1/3 beat, followed by 1/3 beat of silence. (Effective for 5/8 feel within 6/8 time).

**Example**: `2**-__`
-   $M=2$ (spans 2 beats)
-   $S=5$ (`*`, `*`, `-`, `_`, `_`)
-   $D = 2/5$ beat.
-   Result:
    -   First `*`: $2/5$ beat.
    -   Second `*` + `-`: $4/5$ beat.
    -   `_` + `_`: $4/5$ beat silence.

-   **Directives**: Square brackets `[...]` contain optional directives. Multiple directives can be combined (e.g., `[N3 B4.]`).
    -   `N<number>`: **Pickup Measure Start Count**.
        -   **Placement**: Valid only at the beginning of a lyric line.
        -   **Scope**: Applies only to the current line. Does not persist.
    -   `B<duration>`: **Beat Duration**.
        -   **Placement**: Valid only at the beginning of a measure.
        -   **Scope**: Persists until changed by a subsequent `B` directive.
        -   Supported values: `B1`, `B1.`, `B2`, `B2.`, `B4` (default), `B4.`, `B8`, `B8.`, `B16`, `B16.`.
    -   `T<number>`: **Tempo** (BPM).
        -   **Placement**: Valid anywhere, even within a beat between subdivisions (e.g., `* **[T110]* *`).
        -   **Scope**: Persists until changed. Default is 120.
-   **Multi-beat Tuples**: An integer prefix indicates a group of syllables and special characters that span multiple beats.
    -   `2these.three.words` spans 2 beats with each word getting 2/3 of a beat.  It is rhythmically equivalent to `these-three -words-`
	- There is an implicit `1` prefix if no prefix is present, i.e., `these.three.words` is equivalent to `1these.three.words`.

### 2. Pitch Line
The pitch line defines the melody and harmonization.

-   **Structure**: Starts with a Key Signature, followed by pitches and barlines.
-   **Directives**: Square brackets `[...]` contain optional directives.
    -   **Key Signature**: `K<accidental><count>` (e.g., `K&3`).
        -   **Placement**: Valid only at the beginning of a measure.
        -   **Scope**: Persists until changed.
    -   **Prior Pitch Octave**: `O<number>`.
        -   **Placement**: Valid only at the beginning of a line.
        -   **Scope**: Persists until changed (sets the default reference for line start).
        -   Sets the octave for relative pitch calculation at the start of the line. Default is 4 (Middle C).
    -   **Instrument**: `I<number>` (General MIDI 1-128).
        -   **Placement**: Valid anywhere.
        -   **Scope**: Persists until changed. Default is 1.
    -   **Volume**: `V<number>` (0-100).
        -   **Placement**: Valid anywhere.
        -   **Scope**: Persists until changed. Default is 70 (maps to MIDI 0-127).
-   **Pitches**:
    -   **Note Names**: `a` through `g`.
    -   **Octave Shifts**:
        -   Pitches are relative to the previous pitch. By default, a pitch is placed in the octave that creates the smallest musical interval (ignoring accidentals) with the preceding pitch (the "LilyPond Rule").
        -   `^`: Forces the pitch to be in the octave *above* the default relative octave.
        -   `/`: Forces the pitch to be in the octave *below* the default relative octave.
		-   Multiple `^` or `/` are allowed, e.g., `^^c` is two octaves above the default relative octave.
    -   **Accidentals**:
        -   Placed immediately before a pitch letter (e.g., `#c`, `&b`, `%a`).
        -   **Scope**: Override the key signature for the specific pitch AND octave. Persists for the remainder of the measure unless altered by another accidental.
        -   `#`: Sharp.
        -   `##`: Double Sharp.
        -   `&`: Flat.
        -   `&&`: Double Flat.
        -   `%`: Natural.
	-   **Chords**: Chords are specified in the pitch line by enclosing the pitches in parentheses. e.g., `(ceg)`. The LilyPond rule is modified for chords.  Chord pitches are determined by finding the closest instance of the pitch class that is **strictly higher** than the previous chord pitch (left-to-right), with the leftmost pitch being the bass pitch (calculated relative to the `O` prior for the line).  The "^" octave shift is permitted before any pitch in the chord, but the '/' octave shift is valid only on the first pitch of the chord. An example needed to clarify this:  Consider `[K&1 O4] f e (/c^eg) a` as pitch line:  The pitches would be placed as F4 E4 C3 E4 G4 A4 because: 
	    -   the first pitch, f, is in the default relative octave, 
	    -   the second pitch, e, is in the default relative octave, 
	    -   the third pitch, c, would normally be C4 because that is the O4 prior for the line, but the `/` octave shift forces it down an octave.
	    -   the fourth pitch, e, would be E3 but it has the `^` octave shift, so it is in the octave above.
	    -   the fifth pitch, g, has no octave shift, so it is placed a musical interval of a third above the fourth pitch, e, which is E4.
	    -   the sixth pitch, a, has no octave shift, so it is placed relative the last note of the chord. Hence it is A4

   - rhythmically, a chord is a single subdivision, so the duration of the chord is the duration of the corresponding subdivision in the lyric line.
	-   **Barlines**: `|` aligns with the lyric line barlines. **Must** be present at the end.

## Alignment
The parser and layout engine align the Lyric Line and Pitch Line beat-by-beat. Barlines in both lines are expected to match.
