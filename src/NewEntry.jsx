import React from "react";

class NewEntry extends React.Component { 

  constructor(props) {
    super(props);
    this.state = {
      subject: '',
      body: '',
    };
    this.handleSubjectChange = this.handleSubjectChange.bind(this);
    this.handleBodyChange = this.handleBodyChange.bind(this);
  }

  saveEntry( ) {
    console.log("saveEntry");
  }

  showNewEntry( ) {
    this.props.parentShowNewEntry();
  }

  handleSubjectChange(event) {
    this.setState({subject: event.target.value});
  }

  handleBodyChange(event) {
    this.setState({body: event.target.value});
  }

  render() {

    return (
      <div>
        <div>
          <input type="text" id="subject" name="subject"  value={this.state.subject} onChange={this.handleSubjectChange}></input>
        </div>
        <div>
          <input type="text" id="body" name="body" value={this.state.body} onChange={this.handleBodyChange}></input>
        </div>
        <div>
          <div className="create-entry-button" onClick={() => this.saveEntry()}>
          Save
          </div>
          <div className="create-entry-button" onClick={() => this.showNewEntry()}>
          Cancel
          </div>
        </div>
      </div>
    )
  }
}

export default NewEntry;