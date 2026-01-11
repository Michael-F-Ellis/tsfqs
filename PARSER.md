# miniFQS Parser Design

## Architecture
The parsing process will be divided into three stages:
1.  **Lexing (Tokenization)**: Converting the raw string into a stream of typed Tokens.
2.  **Parsing**: Consuming tokens to build an Abstract Syntax Tree (AST).
3.  **Validation/Post-processing**: (Optional) Checking for semantic consistency (e.g., verifying measure lengths vs time signature if we decide to enforce that later, or alignment checks).

## 1. Lexer
The lexer scans the input character by character (or using regex matchers) to produce tokens.

### Token Types (`TokenType`)
-   `Identifier` (Syllables, Instrument names)
-   `Number` (Integers, Floats for tempo)
-   `String` (Quoted text if needed, maybe for titles)
-   `Barline` (`|`)
-   `LBrak`, `RBrak` (`[`, `]`)
-   `LParen`, `RParen` (`(`, `)`)
-   `Dot` (`.`)
-   `Hyphen` (`-`)
-   `Underscore` (`_`)
-   `Asterisk` (`*`)
-   `Caret` (`^`)
-   `Slash` (`/`)
-   `Accidental` (`#`, `&`, `%`, `##`, `&&`)
-   `KeySigPrefix` (`K`)
-   `OctavePrefix` (`O`)
-   `InstPrefix` (`I`)
-   `VolPrefix` (`V`)
-   `DirectiveName` (`N`, `B`, `T`...)
-   `Newline`
-   `EOF`

*Note: The lexer needs to distinguish between a "Lyric" syllable and a "Pitch" note name dependent on context, OR (simpler) the Lexer is dumb and just emits `Identifier` or `Char`, and the Parser validates if it's a valid Pitch based on whether it's parsing a PitchLine.*
*Decision*: Keep Lexer simple. `a-g` are just Identifiers or Chars. Parser decides semantics.

## 2. AST Structure (`src/ast.ts`)

```typescript
export interface Score {
    title: string[];
    blocks: MusicBlock[];
}

export interface MusicBlock {
    lyricLine?: LyricLine;
    pitchLine?: PitchLine;
}

export interface Directive {
    type: 'N' | 'B' | 'T' | 'K' | 'O' | 'I' | 'V';
    value: string | number;
    location: SourceLocation;
}

export interface LyricLine {
    directives: Directive[]; // Line-start directives like [N3]
    measures: LyricMeasure[];
}

export interface LyricMeasure {
    beats: Beat[];
    barline?: boolean; // true if ended with |
}

export interface Beat {
    subdivisions: Subdivision[];
    durationDirective?: BeatDuration; // if [B4] appeared before this beat
}

export interface Subdivision {
    type: 'Syllable' | 'Melisma' | 'Hyphen' | 'Rest' | 'Partial' | 'Chord';
    text: string; // The syllable text, or *, -, ;, _
    isChord?: boolean; // For future/instrumental expansion if needed in lyric line
}

export interface PitchLine {
    directives: Directive[]; // [K... O...]
    measures: PitchMeasure[];
}

export interface PitchMeasure {
    elements: (Pitch | Chord | Barline)[];
}

export interface Pitch {
    note: string; // 'c'
    accidental?: string; // '#'
    octaveShift?: number; // +1 for ^, -1 for /
    octave?: number; // Calculated absolute octave (post-processing)
}
```

## 3. Parser Strategy
Recursive Descent.

-   `Parsed<T>`: A result type returning `{ success: true, value: T }` or `{ success: false, error: ParseError }`.
-   Errors should contain: `message`, `line`, `col`.
-   **Synchronization**: If a line fails to parse, try to sync to the next Newline or Barline to continue parsing the next block/measure, gathering multiple errors.

### Directives Parsing
Directives `[...]` are context-dependent.
-   Inside `[]`, consume tokens until `]`.
-   Directives can be mixed `[N3 B4]`. Parser handles the internal list.

### Line Type Detection
**Strict Ordering**: Every Music Block consists of a **Lyric Section** followed by a **Pitch Section**.

1.  **Lyric Section**:
    -   Starts at the first line of the block.
    -   Consumes lines until a line ends with a **Barline** (`|`) (ignoring trailing whitespace/comments).
    -   Allows for multi-line lyrics (e.g., for narrow screens or formatting).
    -   *Edge Case*: "Happy Birthday Without Lyrics" uses `** |` which ends with a barline, so it correctly terminates the lyric section.

2.  **Pitch Section**:
    -   Starts immediately after the Lyric Section ends.
    -   Consumes all remaining lines in the block (until one or more Empty Lines are encountered).
    -   This effectively allows Pitch Lines to be multi-line as well.

## 4. Error Handling
-   **Lexer Errors**: Unexpected characters. Emit `ErrorToken` and continue.
-   **Parser Errors**: Unexpected token.
    -   *Panic Mode*: Upon error in a measure, consume tokens until `|` or `Newline`. Log error, push incomplete measure, continue.
