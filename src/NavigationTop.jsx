import Logout from './Logout.jsx';
import React from "react";
import { observer } from 'mobx-react';
import { Link } from "react-router-dom";

@observer
class NavigationTop extends React.Component {
  render() {
    return (
      <div className="navbar navbar-top">
        <div className="flex-main-container">
          <div className="flex-side-column"></div>
          <div className="flex-center-column">
            <div className="flex">
              <div className="flex-align-left">
                <div className="menu-item inline-block">
                  <Link to="/">Tearleads</Link>
                </div>
              </div>
              <div className="flex-align-right">
                <div className="inline-block menu-item-small menu-item-spacing">
                  { observableUser.userName != ''
                    ? <Logout user={ observableUser }/>
                    : <Link to="/login" user={ observableUser }>Login</Link>
                  }
                </div>
              </div>
            </div>
          </div>
          <div className="flex-side-column"></div>
        </div>
      </div>
    )
  }
}

export default NavigationTop;
