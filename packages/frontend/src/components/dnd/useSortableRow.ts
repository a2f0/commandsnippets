import {useCallback, useRef} from 'react';
import {
  type ConnectDragPreview,
  type DropTargetMonitor,
  useDrag,
} from 'react-dnd';
import type {DraggableItem, DropResult} from './itemTypes';
import type {DraggedRows} from './useDraggedRows';

interface ISortableRowOptions<T extends {id: string}>
  extends Omit<DraggedRows<T>, 'rows'> {
  /** What the row is dragged as (`ItemTypes`). */
  type: string;
  id: string;
  /** Where the row is in the list shown. */
  index: number;
  /** Another user's row: never dragged. */
  readOnly: boolean;
  /** Store the order a drop leaves: the row `topId` right above `bottomId`. */
  reorder: (topId: string, bottomId: string) => Promise<void>;
  /** Dropped on a tag: the entry dragged is tagged with it. */
  onDropOnTag?: (tagId: string) => void;
  /** Whether a row dragged over this one moves here (the list's order). */
  canMoveHere?: () => boolean;
}

interface ISortableRow {
  isDragging: boolean;
  /** The drag handle's ref: where a drag starts, and what a hover measures. */
  handleRef: (element: HTMLDivElement | null) => void;
  /** The ref of what a drag shows. */
  preview: ConnectDragPreview;
  /** The row's drop target's `hover`: it moves the row dragged over it. */
  hover: (
    item: DraggableItem,
    monitor: DropTargetMonitor<DraggableItem, DropResult>
  ) => void;
}

/**
 * A row of a list the user orders by drag and drop (`useDraggedRows`), as
 * React DnD's sortable example has it: a row dragged over another moves
 * there once the pointer is past the middle of its drag handle, and the
 * drop stores the order (or a drop on no target puts the row back).
 */
export function useSortableRow<T extends {id: string}>({
  type,
  id,
  index,
  readOnly,
  findEntry,
  findEntryByIndex,
  moveEntry,
  reorder,
  onDropOnTag,
  canMoveHere,
}: ISortableRowOptions<T>): ISortableRow {
  const handle = useRef<HTMLDivElement | null>(null);
  const [{isDragging}, drag, preview] = useDrag<
    DraggableItem,
    DropResult,
    {isDragging: boolean}
  >(
    {
      item: (): DraggableItem => ({id, originalIndex: index, type, index}),
      type,
      canDrag: () => !readOnly,
      collect: monitor => ({
        isDragging: monitor.isDragging(),
      }),
      end: async (draggedItem, monitor) => {
        const {id: droppedId, originalIndex} = monitor.getItem();
        console.debug(
          `useDrag end: draggedItem ID: ${draggedItem.id} originalIndex: ${draggedItem.originalIndex} index ${draggedItem.index}`
        );
        console.debug(
          `useDrag end: droppedId: ${droppedId} originalIndex ${originalIndex}`
        );
        if (!monitor.didDrop()) {
          console.debug('!didDrop');
          // No target took the drop: the row goes back where it was.
          moveEntry(droppedId, originalIndex);
          return;
        }
        const dropResult = monitor.getDropResult();
        if (onDropOnTag !== undefined && dropResult?.type === 'Tag') {
          onDropOnTag(dropResult.id);
          return;
        }
        if (originalIndex === draggedItem.index) {
          console.debug('useDrag end: it was not moved within the list.');
          return;
        }
        console.debug(
          `useDrag end: it moved from index ${originalIndex} to ${draggedItem.index}`
        );
        // Right above the row now below it; at the bottom, right below the
        // row above it.
        const {entry, index: at} = findEntry(draggedItem.id);
        const below = findEntryByIndex(at + 1);
        const top = below === null ? findEntryByIndex(at - 1) : entry;
        const bottom = below ?? entry;
        if (top !== null) {
          await reorder(top.id, bottom.id);
        }
      },
    },
    [
      type,
      id,
      index,
      readOnly,
      findEntry,
      findEntryByIndex,
      moveEntry,
      reorder,
      onDropOnTag,
    ]
  );

  const handleRef = useCallback(
    (element: HTMLDivElement | null) => {
      handle.current = element;
      drag(element);
    },
    [drag]
  );

  const hover = useCallback(
    (
      item: DraggableItem,
      monitor: DropTargetMonitor<DraggableItem, DropResult>
    ) => {
      console.debug(
        `hover: index ${index} originalIndex ${item.originalIndex}`
      );
      const element = handle.current;
      // Not one of the list's rows (an entry over a tag is a tagging), or
      // over itself.
      if (
        element === null ||
        item.type !== type ||
        item.index === index ||
        canMoveHere?.() === false
      ) {
        return;
      }
      const clientOffset = monitor.getClientOffset();
      if (clientOffset === null) {
        return;
      }
      const {top, bottom} = element.getBoundingClientRect();
      const middle = (bottom - top) / 2;
      const pointer = clientOffset.y - top;
      // Dragging down, below the middle; dragging up, above it.
      if (
        (item.index < index && pointer < middle) ||
        (item.index > index && pointer > middle)
      ) {
        return;
      }
      moveEntry(item.id, index);
      // The drag's own item, changed in place: where the row is now, with
      // no search of the list on the next hover.
      item.index = index;
    },
    [type, index, moveEntry, canMoveHere]
  );

  return {isDragging, handleRef, preview, hover};
}
