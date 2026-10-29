import {drawerClasses} from '@mui/material';
import {render} from '@testing-library/react';
import invariant from 'invariant';

import {RightDrawer} from '../../../../src/components/drawer/RightDrawer';

describe('Drawers', () => {
  it('Renders a RightDrawer: permanent, docked on the right', () => {
    const {container} = render(<RightDrawer />);

    const drawer = container.firstElementChild;
    invariant(drawer, 'the drawer is rendered');
    expect(drawer).toHaveClass(drawerClasses.docked, drawerClasses.anchorRight);
    expect(drawer.querySelector(`.${drawerClasses.paper}`)).toBeInTheDocument();
  });
});
