import React from 'react';
import RightDrawer from '../src/RightDrawer';
import {render} from '@testing-library/react';

describe('Drawers', () => {
  it('Renders a RightDrawer', async () => {
    render(<RightDrawer />);
  });
});
