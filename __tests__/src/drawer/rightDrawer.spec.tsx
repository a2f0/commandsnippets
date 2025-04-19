import {render} from '@testing-library/react';
import React from 'react';

import {RightDrawer} from '../../../src/drawer/RightDrawer';

describe('Drawers', () => {
  it('Renders a RightDrawer', async () => {
    render(<RightDrawer />);
  });
});
