import {alpha, styled} from '@mui/material/styles';
import React, {useMemo} from 'react';
import {type KeyStep, parseKeySequence} from '../../lib/keySequence';

/**
 * A key, drawn as a keycap in the text's grays: a thin outline with a
 * heavier bottom edge, on a faint fill.
 */
const Keycap = styled('kbd')(({theme}) => ({
  display: 'inline-block',
  minWidth: '1.75em',
  padding: '0 5px',
  margin: '2px 0',
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  fontSize: '12px',
  lineHeight: '18px',
  textAlign: 'center',
  color: 'inherit',
  backgroundColor: alpha(theme.palette.text.primary, 0.06),
  border: `1px solid ${alpha(theme.palette.text.primary, 0.3)}`,
  borderBottomWidth: '2px',
  borderRadius: '3px',
  whiteSpace: 'pre',
  // Keys typed in turn (`dG`): apart, without a joiner.
  '& + &': {marginLeft: '2px'},
}));

/** The `+` between keys pressed together and the `,` between steps. */
const Joiner = styled('span')(({theme}) => ({
  color: theme.palette.text.secondary,
  padding: '0 3px',
}));

const Step = ({step}: {step: KeyStep}) => (
  <kbd className="keyStep">
    {step.members.map((member, index) => (
      <React.Fragment key={member.id}>
        {index > 0 && <Joiner>+</Joiner>}
        {member.segments.map(segment =>
          segment.type === 'key' ? (
            <Keycap key={segment.id}>{segment.label}</Keycap>
          ) : (
            <span key={segment.id}>{segment.text}</span>
          )
        )}
      </React.Fragment>
    ))}
  </kbd>
);

/**
 * A shortcut's body drawn as keys (`parseKeySequence`): a line each, `,`
 * between the steps pressed one after another and `+` between the keys
 * pressed together. The steps are nested `<kbd>`s, the keys' own `<kbd>`s
 * inside them, as HTML marks up keyboard input.
 */
export const KeySequence = ({body}: {body: string}) => {
  const lines = useMemo(() => parseKeySequence(body), [body]);
  return (
    <span className="keySequence">
      {lines.map(line => (
        <span key={line.id} style={{display: 'block', minHeight: '1.2em'}}>
          {line.steps.map((step, index) => (
            <React.Fragment key={step.id}>
              {index > 0 && <Joiner>,</Joiner>}
              <Step step={step} />
            </React.Fragment>
          ))}
        </span>
      ))}
    </span>
  );
};
