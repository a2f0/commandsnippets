import {type KeyLine, parseKeySequence} from '../../../src/lib/keySequence';

/**
 * A parse, compact: `[Ctrl]+[B] , [c]` for keys, text as written, steps
 * between ` , `, lines between ` / `.
 */
const shown = (lines: KeyLine[]) =>
  lines
    .map(line =>
      line.steps
        .map(step =>
          step.members
            .map(member =>
              member.segments
                .map(segment =>
                  segment.type === 'key' ? `[${segment.label}]` : segment.text
                )
                .join('')
            )
            .join('+')
        )
        .join(' , ')
    )
    .join(' / ');

describe('parseKeySequence', () => {
  it.each([
    // Keys pressed together, and in turn.
    ['cntrl + b, c', '[Ctrl]+[B] , [c]'],
    ['cntrl+b, ?', '[Ctrl]+[B] , [?]'],
    ['cmd + shift + p', '[Cmd]+[Shift]+[P]'],
    ['Shift + Cmd + E', '[Shift]+[Cmd]+[E]'],
    ['cnrl + b, alt + 1', '[Ctrl]+[B] , [Alt]+[1]'],
    ['cmd + `', '[Cmd]+[`]'],
    ['shift + \\', '[Shift]+[\\]'],
    ['cmd + option + w', '[Cmd]+[Option]+[W]'],
    ['opt + left', '[Option]+[←]'],
    ['alt + back arrow', '[Alt]+[←]'],
    ['cntrl + page up', '[Ctrl]+[Page Up]'],
    ['cntrl +b, alt + <arrow keys>', '[Ctrl]+[B] , [Alt]+[↑↓←→]'],
    ['cntrl + enter', '[Ctrl]+[Enter]'],
    ['ctrl + plus', '[Ctrl]+[+]'],
    ['ctrl+,', '[Ctrl]+[,]'],
    ['ctrl + comma', '[Ctrl]+[,]'],
    ['⌘ + ⇧ + ⌥ + ⌃ + k', '[Cmd]+[Shift]+[Option]+[Ctrl]+[K]'],
    ['win + d', '[Win]+[D]'],
    ['super + up arrow', '[Super]+[↑]'],
    // A letter alone keeps its case: vim's and Vimium's keys differ by it.
    ['f', '[f]'],
    ['F', '[F]'],
    ['H', '[H]'],
    ['w, b, W, B', '[w] , [b] , [W] , [B]'],
    ['F6', '[F6]'],
    ['f11', '[F11]'],
    ['esc', '[Esc]'],
    ['<enter>', '[Enter]'],
    ['space bar', '[Space]'],
    // Two or three characters alone are keys typed in turn.
    ['dG', '[d][G]'],
    ['gg', '[g][g]'],
    // Words that name no key stay text, keys beside them.
    ['cmd + left click', '[Cmd]+left click'],
    ['alt + drag', '[Alt]+drag'],
    ['option + click green dot', '[Option]+click green dot'],
    ['hold super + up arrow, up arrow', 'hold [Super]+[↑] , [↑]'],
    [
      'cntrl + a, [, then space, then enter',
      '[Ctrl]+[A] , [[] , then [Space] , then [Enter]',
    ],
    ['press cntrl + v', 'press [Ctrl]+[V]'],
    ['two keys in lower left corner + g', 'two keys in lower left corner+[g]'],
    // A step that names no key is text, as written.
    ['Python: Select Interpreter', 'Python: Select Interpreter'],
    ['select the text', 'select the text'],
    ['typescript -> restart server', 'typescript -> restart server'],
    ['a + b + c d', '[a]+[b]+c d'],
    ['foo + bar baz', 'foo + bar baz'],
    ['ctrl + + b', 'ctrl + + b'],
    ['then nothing', 'then nothing'],
    // Lines.
    [
      'cmd + shift + p\nFormat Code With...',
      '[Cmd]+[Shift]+[P] / Format Code With...',
    ],
    [
      '  cmd + j  \n\ngo to the OUTPUT tab',
      '[Cmd]+[J] /  / go to the OUTPUT tab',
    ],
    ['cntrl + b , <arrow keys>', '[Ctrl]+[B] , [↑↓←→]'],
    ['ctrl + b, <arrow keys>,', '[Ctrl]+[B] , <arrow keys>,'],
  ])('reads %j as %j', (body, expected) => {
    expect(shown(parseKeySequence(body))).toBe(expected);
  });

  it('names every line, step, part and segment by its place', () => {
    const [line] = parseKeySequence('ctrl + b, dG');
    expect(line?.id).toBe('0');
    expect(line?.steps.map(step => step.id)).toEqual(['0.0', '0.1']);
    expect(line?.steps[0]?.members.map(member => member.id)).toEqual([
      '0.0.0',
      '0.0.1',
    ]);
    expect(
      line?.steps[1]?.members[0]?.segments.map(segment => segment.id)
    ).toEqual(['0.1.0.0', '0.1.0.1']);
  });

  it('reads a key name, not an object property, from the names', () => {
    expect(shown(parseKeySequence('constructor + toString'))).toBe(
      'constructor + toString'
    );
  });
});
