import {ITagJsonApi} from '../TagList';

export function sortArrayByAttribute(
  order: string,
  array: Array<ITagJsonApi>
): ITagJsonApi[] {
  let sortedArray: Array<ITagJsonApi>;
  if (order === 'name') {
    sortedArray = array.slice().sort((a, b) => {
      const nameA = a.attributes.name.toUpperCase(); // ignore upper and lowercase
      const nameB = b.attributes.name.toUpperCase(); // ignore upper and lowercase
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      // equal
      return 0;
    });
  } else if (order === 'order') {
    sortedArray = array.slice().sort((a, b) => {
      const orderA = a.attributes.order;
      const orderB = b.attributes.order;
      if (orderA < orderB) {
        return -1;
      }
      if (orderA > orderB) {
        return 1;
      }
      // equal
      return 0;
    });
  } else {
    throw 'Unknown sort order';
  }
  return sortedArray;
}
