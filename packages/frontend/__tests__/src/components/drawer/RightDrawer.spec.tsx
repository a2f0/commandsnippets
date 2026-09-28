import {render} from '@testing-library/react';

import {RightDrawer} from '../../../../src/components/drawer/RightDrawer';

describe('Drawers', () => {
  it('Renders a RightDrawer', async () => {
    render(<RightDrawer />);
  });
});
