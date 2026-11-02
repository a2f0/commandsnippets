import type {TextEntry} from '@commandsnippets/api-shared';
import type React from 'react';
import {keyOfRow} from '../../lib/data/rowKey';
import {Entry} from './Entry';

/** What every row of the list is given alike. */
export interface EntryRowShared {
  moveEntry: (id: string, to: number) => void;
  findEntry: (id: string) => {entry: TextEntry; index: number};
  findEntryByIndex: (id: number) => TextEntry | null;
  keepRendered: (rowKey: string) => () => void;
  /**
   * The tag the rows are of, read with them: the last tag's while the next
   * tag's are read (its rows render again only once they are), and none in
   * the all or untagged list.
   */
  tagId: string | undefined;
}

/** Where a long list places a row, and how it measures it. */
export interface EntryRowPlace {
  measure: (node: HTMLDivElement | null) => void;
  style: React.CSSProperties;
}

interface IProps {
  entry: TextEntry;
  index: number;
  tagNames: readonly string[];
  shared: EntryRowShared;
  /** Each row's element, by entry id, which the row keeps up to date. */
  elements: Map<string, HTMLDivElement>;
  /** In a long list: where the row is placed. */
  placed?: EntryRowPlace | undefined;
}

/** An entry of the list, in its own element (measured, in a long list). */
export const EntryRow = ({
  entry,
  index,
  tagNames,
  shared,
  elements,
  placed,
}: IProps) => (
  <div
    data-index={index}
    style={placed?.style}
    ref={node => {
      placed?.measure(node);
      if (node === null) {
        elements.delete(entry.id);
      } else {
        elements.set(entry.id, node);
      }
    }}
  >
    <Entry
      id={entry.id}
      index={index}
      moveEntry={shared.moveEntry}
      findEntry={shared.findEntry}
      object={entry}
      rowKey={keyOfRow(entry)}
      tagId={shared.tagId}
      tagNames={tagNames}
      findEntryByIndex={shared.findEntryByIndex}
      keepRendered={shared.keepRendered}
    />
  </div>
);
