export const ItemTypes = {
  ENTRY: 'entry',
  UNTAGGEDENTRY: 'untaggedentry',
  TAG: 'tag',
};

/** What a dragged tag or entry carries (React DnD's item). */
export interface DraggableItem {
  id: string;
  type: string;
  originalIndex: number;
  index: number;
}

/** What a drop target returns to the dragged item. */
export interface DropResult {
  id: string;
  type: string;
}
