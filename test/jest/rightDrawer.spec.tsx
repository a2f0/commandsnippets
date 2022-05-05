import React from 'react';
import RightDrawer from '../../src/RightDrawer';
import {render} from '@testing-library/react';

test('RightDrawer', () => {
  const rendered = render(<RightDrawer />);
  expect(true).toBe(true);
});
