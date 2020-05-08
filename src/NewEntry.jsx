import React from "react";

class NewEntry extends React.Component { 

  constructor(props) {
    super(props);
  }

  saveEntry( ) {
    console.log("saveEntry");
  }

  newEntry( ) {
    console.log("newEntry");
    this.props.parentShowNewEntry();
  }

  render() {

    return (
      <div>
        <div>
          <input type="text" id="subject" name="subject"></input>
        </div>
        <div>
          <input type="text" id="body" name="body"></input>
        </div>
        <div>
          <div className="create-entry-button" onClick={() => this.saveEntry()}>
          Save2
          </div>
          <div className="create-entry-button" onClick={() => this.newEntry()}>
          Cancel
          </div>
        </div>
      </div>
    )
  }
}

export default NewEntry;