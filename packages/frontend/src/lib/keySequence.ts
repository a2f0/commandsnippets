/**
 * A shortcut entry's body read as keys to press: a line each, steps one after
 * another between `, `, and keys pressed together between `+`, as in
 * `ctrl + b, alt + 1`. Key names are spelled loosely (`cntrl`, `cmd`, `opt`)
 * and come out as one label each (`Ctrl`, `Cmd`, `Option`). What names no
 * key stays text, so a body that mixes keys with mouse actions (`alt +
 * drag`) or typed commands still reads. Pure: no DOM, no React.
 */

/** A key's label, or text that names none. */
export type KeySegment =
  | {id: string; type: 'key'; label: string}
  | {id: string; type: 'text'; text: string};

/**
 * One of a step's `+`-joined parts: a key, keys typed in turn (`dG`), or
 * text, with a key after a leading word (`hold super`).
 */
export interface KeyMember {
  id: string;
  segments: KeySegment[];
}

/** Keys pressed together, or text alone when the step names no key. */
export interface KeyStep {
  id: string;
  members: KeyMember[];
}

/** A line's steps, pressed one after another (none: a blank line). */
export interface KeyLine {
  id: string;
  steps: KeyStep[];
}

const ARROWS = '↑↓←→';

/** Every key name (lower case, single spaces) and the label it comes out as. */
const NAMES = new Map<string, string>(
  Object.entries({
    Ctrl: ['ctrl', 'control', 'cntrl', 'cnrl', 'ctl', '⌃'],
    Cmd: ['cmd', 'command', '⌘'],
    Alt: ['alt'],
    Option: ['option', 'opt', '⌥'],
    Shift: ['shift', '⇧'],
    Super: ['super'],
    Win: ['win', 'windows'],
    Meta: ['meta'],
    Fn: ['fn'],
    Enter: ['enter', 'return', '↵', '⏎'],
    Esc: ['esc', 'escape'],
    Tab: ['tab'],
    Space: ['space', 'spacebar', 'space bar'],
    Backspace: ['backspace'],
    Delete: ['delete', 'del'],
    Insert: ['insert', 'ins'],
    Home: ['home'],
    End: ['end'],
    'Page Up': ['page up', 'pageup', 'pgup', 'pg up'],
    'Page Down': ['page down', 'pagedown', 'pgdn', 'pg dn'],
    '↑': ['up', 'up arrow', 'arrow up'],
    '↓': ['down', 'down arrow', 'arrow down'],
    '←': ['left', 'left arrow', 'arrow left', 'back arrow'],
    '→': ['right', 'right arrow', 'arrow right'],
    [ARROWS]: ['arrow', 'arrows', 'arrow keys'],
    '+': ['plus'],
    ',': ['comma'],
  }).flatMap(([label, names]) => names.map(name => [name, label] as const))
);

/** Keys held while another is pressed: a step with one shows letters upper case. */
const MODIFIERS = new Set([
  'Ctrl',
  'Cmd',
  'Alt',
  'Option',
  'Shift',
  'Super',
  'Win',
  'Meta',
  'Fn',
]);

const FUNCTION_KEY = /^f([1-9]|1\d|2[0-4])$/i;
/** A word before a key that says how to press it (`hold super`). */
const LEADING_WORD = /^(hold|press|then|tap)\s+(\S.*)$/i;
/** Keys typed in turn, written together: two or three characters (`dG`). */
const TYPED_KEYS = /^\S{2,3}$/u;

/** The label of the key `word` names (`<enter>` too), or null. */
function keyLabel(word: string): string | null {
  const name = word.replace(/^<(.+)>$/u, '$1');
  const named = NAMES.get(name.toLowerCase().replace(/\s+/gu, ' '));
  if (named !== undefined) {
    return named;
  }
  if (FUNCTION_KEY.test(name)) {
    return name.toUpperCase();
  }
  return [...name].length === 1 ? name : null;
}

type Segment = {type: 'key'; label: string} | {type: 'text'; text: string};

/**
 * The segments of a `+`-joined part. `alone`: the step's only part, which
 * can be keys typed in turn.
 */
function segmentsOf(part: string, alone: boolean): Segment[] {
  const label = keyLabel(part);
  if (label !== null) {
    return [{type: 'key', label}];
  }
  const [, word, rest] = LEADING_WORD.exec(part) ?? [];
  if (word !== undefined && rest !== undefined) {
    const after = segmentsOf(rest, false);
    if (after.some(segment => segment.type === 'key')) {
      return [{type: 'text', text: `${word} `}, ...after];
    }
  }
  if (alone && TYPED_KEYS.test(part)) {
    return [...part].map(character => ({type: 'key', label: character}));
  }
  return [{type: 'text', text: part}];
}

/** A step's parts; text alone (as written) when it names no key. */
function stepParts(step: string): Segment[][] {
  const parts = step.split(/\s*\+\s*/u);
  const parsed = parts.every(part => part !== '')
    ? parts.map(part => segmentsOf(part, parts.length === 1))
    : [];
  const keys = parsed.flat().filter(segment => segment.type === 'key');
  if (keys.length === 0) {
    return [[{type: 'text', text: step}]];
  }
  if (!keys.some(key => MODIFIERS.has(key.label))) {
    return parsed;
  }
  // Ctrl + b is Ctrl + B: a letter held with a modifier shows upper case.
  return parsed.map(segments =>
    segments.map(segment =>
      segment.type === 'key' && /^[a-z]$/u.test(segment.label)
        ? {...segment, label: segment.label.toUpperCase()}
        : segment
    )
  );
}

/** `body` as lines of steps of keys (see the module comment). */
export function parseKeySequence(body: string): KeyLine[] {
  return body.split('\n').map((line, lineIndex) => {
    const steps = line
      .trim()
      .split(/\s*,\s+/u)
      .filter(step => step !== '');
    return {
      id: `${lineIndex}`,
      steps: steps.map((step, stepIndex) => {
        const stepId = `${lineIndex}.${stepIndex}`;
        return {
          id: stepId,
          members: stepParts(step).map((segments, memberIndex) => {
            const memberId = `${stepId}.${memberIndex}`;
            return {
              id: memberId,
              segments: segments.map((segment, segmentIndex) => ({
                ...segment,
                id: `${memberId}.${segmentIndex}`,
              })),
            };
          }),
        };
      }),
    };
  });
}
